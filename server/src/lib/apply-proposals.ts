// LLM 提案 (Proposal) を既存 CRUD の器へ反映する (feature/screen-flow.md §5.3)。
// LLM が DB を直接書く経路は作らない。 ここは「ユーザが反映を押した提案」だけを扱う。
//
// @spec 5.3 提案

import { and, desc, eq, isNull, like } from 'drizzle-orm';
import { ulid } from 'ulid';
import { getDb } from '../db/connection.ts';
import { domains } from '../db/schema/domain.ts';
import { objects, objectAttrs } from '../db/schema/object.ts';
import { layouts, layoutObjects } from '../db/schema/layout.ts';
import { specs, specTargets, specAcceptance } from '../db/schema/spec.ts';
import { transitions, type Proposal } from '../db/schema/screen-flow.ts';
import { AppError } from './errors.ts';
import { insertTransition, TRIGGER_PATTERN } from '../routes/transitions.ts';

export interface AppliedResult {
  index: number;
  kind: Proposal['kind'];
  id: string;
}

const SPEC_CODE_PREFIX = 'SF-';

/** 会話由来 spec の code を採番する: SF-001, SF-002 … (既存最大 + 1)。 */
export async function nextSpecCode(pid: string): Promise<string> {
  const rows = await getDb()
    .select({ code: specs.code })
    .from(specs)
    .where(and(eq(specs.projectId, pid), like(specs.code, `${SPEC_CODE_PREFIX}%`)))
    .orderBy(desc(specs.code));
  let max = 0;
  for (const r of rows) {
    const n = Number(r.code.slice(SPEC_CODE_PREFIX.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${SPEC_CODE_PREFIX}${String(max + 1).padStart(3, '0')}`;
}

async function ensureUiDomain(pid: string): Promise<string> {
  const [row] = await getDb()
    .select({ id: domains.id })
    .from(domains)
    .where(and(eq(domains.projectId, pid), eq(domains.name, 'UI')))
    .limit(1);
  if (row) return row.id;
  const id = ulid();
  try {
    await getDb().insert(domains).values({
      id,
      projectId: pid,
      name: 'UI',
      description: '画面上に固定表示される UI 要素 (Screen Flow 既定ドメイン)',
      color: '#4f7cff',
      requiredAttrs: [
        { name: 'widget', type: 'enum', enum: ['button', 'label', 'list', 'input', 'image', 'tab', 'modal', 'custom'] },
      ],
    });
  } catch (e) {
    // read-then-insert なので、 UI 要素を続けて作ると uq_domains_project_name で衝突しうる。
    // 衝突は「誰かが先に作った」なのでそれを使う。
    if (!/unique|duplicate/i.test(String(e))) throw e;
    const [existing] = await getDb()
      .select({ id: domains.id })
      .from(domains)
      .where(and(eq(domains.projectId, pid), eq(domains.name, 'UI')))
      .limit(1);
    if (!existing) throw e;
    return existing.id;
  }
  return id;
}

/**
 * spec の紐づけ先が本当に `:pid` に属するか確認する。 LLM が履歴中の他プロジェクトの ID を
 * 復唱しても跨いで書けないようにする (§5.3)。
 */
async function assertTargetInProject(pid: string, kind: string, id: string): Promise<void> {
  const db = getDb();
  const bad = () => AppError.badRequest('proposal_target_not_in_project', { kind, id });
  if (kind === 'project') {
    if (id !== pid) throw bad();
    return;
  }
  if (kind === 'domain') {
    const [r] = await db.select({ id: domains.id }).from(domains)
      .where(and(eq(domains.id, id), eq(domains.projectId, pid))).limit(1);
    if (!r) throw bad();
    return;
  }
  if (kind === 'layout') {
    const [r] = await db.select({ id: layouts.id }).from(layouts)
      .where(and(eq(layouts.id, id), eq(layouts.projectId, pid), isNull(layouts.deletedAt))).limit(1);
    if (!r) throw bad();
    return;
  }
  if (kind === 'transition') {
    const [r] = await db.select({ id: transitions.id }).from(transitions)
      .where(and(eq(transitions.id, id), eq(transitions.projectId, pid))).limit(1);
    if (!r) throw bad();
    return;
  }
  if (kind === 'object') {
    // 会話の文脈では配置 (layout_objects.id) を指すが、 既存 spec_targets は objects.id も取る。
    const [placement] = await db.select({ objectId: layoutObjects.objectId }).from(layoutObjects)
      .where(eq(layoutObjects.id, id)).limit(1);
    const objectId = placement?.objectId ?? id;
    const [o] = await db.select({ id: objects.id }).from(objects)
      .where(and(eq(objects.id, objectId), eq(objects.projectId, pid))).limit(1);
    if (!o) throw bad();
    return;
  }
  throw AppError.badRequest('proposal_target_kind_unknown', { kind });
}

/** 採番衝突 (`uq_specs_project_code`) を採番からやり直す回数。 nextSpecCode は read-then-insert。 */
const SPEC_CODE_ATTEMPTS = 5;

async function applySpec(pid: string, userId: string, p: Extract<Proposal, { kind: 'spec' }>): Promise<string> {
  if (!p.title?.trim()) throw AppError.badRequest('proposal_spec_title_required');
  if (p.target?.id && p.target.kind) await assertTargetInProject(pid, p.target.kind, p.target.id);
  const sid = ulid();
  for (let attempt = 1; ; attempt++) {
    try {
      await getDb().insert(specs).values({
        id: sid,
        projectId: pid,
        code: await nextSpecCode(pid),
        title: p.title.trim().slice(0, 200),
        description: p.description ?? null,
        priority: p.priority ?? 'should',
        category: p.category ?? 'behavior',
        preconditions: [],
        postconditions: [],
        status: 'draft',
        createdBy: userId,
      });
      break;
    } catch (e) {
      if (attempt >= SPEC_CODE_ATTEMPTS || !/unique|duplicate/i.test(String(e))) throw e;
    }
  }
  if (p.target?.id && p.target.kind) {
    await getDb().insert(specTargets).values({ specId: sid, kind: p.target.kind, refId: p.target.id });
  }
  const acc = (p.acceptance ?? []).filter((a) => typeof a === 'string' && a.trim());
  if (acc.length > 0) {
    await getDb().insert(specAcceptance).values(
      acc.map((text, i) => ({
        id: ulid(),
        specId: sid,
        ordinal: i,
        text: text.trim().slice(0, 2000),
        level: 'manual',
        expression: null,
        kind: 'positive',
        enabled: true,
      })),
    );
  }
  return sid;
}

async function applyTransition(pid: string, p: Extract<Proposal, { kind: 'transition' }>): Promise<string> {
  const trigger = TRIGGER_PATTERN.test(p.trigger ?? '') ? p.trigger : 'tap';
  return insertTransition(pid, {
    from_layout_id: p.from_layout_id,
    source_object_id: p.source_object_id ?? null,
    to_layout_id: p.to_layout_id,
    trigger,
    condition: (p.condition ?? '').slice(0, 500),
    label: p.label ?? null,
    ordinal: 0,
  });
}

/** UI 要素を 1 つ作って画面に配置する (object + attrs + layout_objects)。 戻り値は placement id。 routes/widgets からも使う。 */
export async function applyObject(pid: string, p: Extract<Proposal, { kind: 'object' }>): Promise<string> {
  const [layout] = await getDb()
    .select({ id: layouts.id })
    .from(layouts)
    .where(and(eq(layouts.id, p.layout_id), eq(layouts.projectId, pid), isNull(layouts.deletedAt)))
    .limit(1);
  if (!layout) throw AppError.badRequest('proposal_layout_not_found');
  const domainId = await ensureUiDomain(pid);
  const oid = ulid();
  const label = (p.label ?? '').trim() || p.widget || 'widget';
  await getDb().insert(objects).values({
    id: oid,
    projectId: pid,
    domainId,
    label: label.slice(0, 200),
    placeholderShape: 'plane',
    placeholderColor: '#4f7cff',
  });
  await getDb().insert(objectAttrs).values([
    { objectId: oid, key: 'widget', value: p.widget ?? 'custom' },
    { objectId: oid, key: 'label', value: label },
    { objectId: oid, key: 'action', value: p.action ?? 'none' },
  ]);
  const [last] = await getDb()
    .select({ ordinal: layoutObjects.ordinal })
    .from(layoutObjects)
    .where(eq(layoutObjects.layoutId, layout.id))
    .orderBy(desc(layoutObjects.ordinal))
    .limit(1);
  const placementId = ulid();
  await getDb().insert(layoutObjects).values({
    id: placementId,
    layoutId: layout.id,
    objectId: oid,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    ordinal: (last?.ordinal ?? -1) + 1,
  });
  return placementId;
}

/** 指定 index の提案を順に反映する。 1 つ失敗したらそこで止め、 反映済みは残す (部分成功を返す)。 */
export async function applyProposals(
  pid: string,
  userId: string,
  proposals: Proposal[],
  indices: number[],
): Promise<{ applied: AppliedResult[]; failed: { index: number; error: string } | null }> {
  const applied: AppliedResult[] = [];
  for (const index of indices) {
    const p = proposals[index];
    if (!p) return { applied, failed: { index, error: 'proposal_index_out_of_range' } };
    try {
      let id: string;
      if (p.kind === 'spec') id = await applySpec(pid, userId, p);
      else if (p.kind === 'transition') id = await applyTransition(pid, p);
      else if (p.kind === 'object') id = await applyObject(pid, p);
      else return { applied, failed: { index, error: 'proposal_kind_unknown' } };
      applied.push({ index, kind: p.kind, id });
    } catch (e) {
      const msg = e instanceof AppError ? e.message : String(e);
      return { applied, failed: { index, error: msg } };
    }
  }
  return { applied, failed: null };
}
