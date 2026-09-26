// /api/projects/:pid/concept-sheets — 企画概要書 (ペライチのコンセプトシート)。spec/feature/concept-sheet.md。
//
// role:
//   - 閲覧 (一覧・1 枚・版・生成の状態): プロジェクトメンバー全員
//   - 生成・自動更新の ON/OFF・削除: owner / planner / designer (UX/ゴールを編集できる人と同じ)
// PF-CS-1 (UX/ゴールと画面の候補から Astra が設計) / PF-CS-6 (版の競合) / PF-CS-7 (鮮度) / PF-CS-9 (生成は裏で走らせる) /
// PF-CS-10 (版 rv を残し、切り替えて見る) / PF-CS-11 (自動更新) / PF-CS-12 (候補はビジュアルから選ぶ)。
// キャッチコピーは UX/ゴールの文言を固定で載せ、空なら Astra の案で UX/ゴールも埋める (PF-GOAL-W3)。
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { deleteConceptSheet, setConceptSheetAutoUpdate } from '../db/concept-sheet-persistence.ts';
import { findSheetRow, isCurrentFormat, listSheetRows, listVersionSummaries } from '../db/concept-sheet-reads.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { conceptSheetGenerationSchema } from '../lib/concept-sheet-input.ts';
import { readConceptSheetMaterial, assertMaterialPresent } from '../lib/concept-sheet-sources.ts';
import { readFreshnessBasis, freshnessOf } from '../lib/concept-sheet-freshness.ts';
import { readConceptSheetRecord } from '../lib/concept-sheet-records.ts';
import { resolveSelectedVisuals } from '../lib/concept-sheet-candidates.ts';
import { planFromLatest, runConceptSheetGeneration, type GenerationPlan } from '../lib/concept-sheet-generation.ts';
import type { ConceptSheetWriter } from '../lib/concept-sheet-writer.ts';
import { ConceptSheetJobs } from '../lib/concept-sheet-jobs.ts';
import { ignoreMaterialChange, type MaterialChangeListener } from '../lib/concept-sheet-auto-update.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';
import { parsePagination } from '../lib/pagination.ts';
import type { ConceptSheetGenerationStatus, ConceptSheetSummary } from '../../../shared/concept-sheet.ts';

const VIEW: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
const EDIT: readonly ProjectRole[] = ['owner', 'planner', 'designer'];
/** 生成の要求は候補の id と指示だけ (画像はビジュアルとして先に登録する)。 */
const GENERATION_BODY_LIMIT = 64 * 1024;
const autoUpdateSchema = z.object({ enabled: z.boolean() }).strict();

/** 自動更新の予約の見え方と、ON にしたときの予約 (ConceptSheetAutoUpdater が満たす)。 */
export interface ConceptSheetAutoUpdateHandle {
  scheduledAt(projectId: string): string | null;
  notifyChange: MaterialChangeListener;
}
const NO_AUTO_UPDATE: ConceptSheetAutoUpdateHandle = { scheduledAt: () => null, notifyChange: ignoreMaterialChange };

/** 人の作成・作り直しの計画。'keep' は前回の版の候補、それ以外は選んだビジュアル。 */
async function planManual(pid: string, input: z.infer<typeof conceptSheetGenerationSchema>,
  actor: ReturnType<typeof getIdentity>): Promise<GenerationPlan> {
  const before = await findSheetRow(pid, input.id);
  if ((before?.revision ?? 0) !== input.expectedRevision) throw AppError.conflict('concept_sheet_revision_conflict');
  if (input.visualIds === 'keep') {
    if (!before) throw AppError.badRequest('scene_images_required');
    return planFromLatest(pid, input.id, { kind: 'regenerate', instructions: input.instructions, actor, expectedRevision: input.expectedRevision });
  }
  const material = await readConceptSheetMaterial(pid);
  assertMaterialPresent(material);
  const candidates = await resolveSelectedVisuals(pid, input.visualIds);
  return { projectId: pid, sheetId: input.id, expectedRevision: input.expectedRevision, kind: before ? 'regenerate' : 'create',
    candidates, material, instructions: input.instructions, previous: before?.payload.design ?? null, actor };
}

export function makeConceptSheetRouter(writer: ConceptSheetWriter, jobs: ConceptSheetJobs = new ConceptSheetJobs(),
  autoUpdate: ConceptSheetAutoUpdateHandle = NO_AUTO_UPDATE): Hono {
  const router = new Hono();
  router.use('*', requireAuth, requireRole(VIEW));
  router.use('*', async (c, next) => {
    const [p] = await getDb().select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, c.req.param('pid')!), isNull(projects.deletedAt))).limit(1);
    if (!p) throw AppError.notFound('project_not_found');
    await next();
  });

  router.get('/', async (c) => {
    const page = parsePagination(c.req.query());
    if (!Number.isInteger(page.limit) || !Number.isInteger(page.offset)) throw AppError.badRequest('invalid_page');
    const pid = c.req.param('pid')!;
    const rows = await listSheetRows(pid, page.limit, page.offset);
    const current = rows.slice(0, page.limit).filter(isCurrentFormat);
    // 一覧は最新版を出し、画像と紙面を含めない (1 枚で数 MB になりうるため)。鮮度は材料を 1 回だけ読んで比べる。
    const basis = await readFreshnessBasis(pid, current.flatMap((r) => r.payload.visualRefs ?? []));
    const items: ConceptSheetSummary[] = current.map((r) => ({
      id: r.id, title: r.payload.design.title, catchcopy: r.payload.design.catchcopy, concept: r.payload.design.concept,
      sceneLabel: r.payload.design.scene.label, updatedAt: r.updatedAt.toISOString(), rv: r.latestRv, autoUpdate: r.autoUpdate,
      freshness: freshnessOf(r.payload.source, r.payload.visualRefs ?? [], basis),
    }));
    return c.json({ canEdit: EDIT.includes(c.get('projectRole')), hasMore: rows.length > page.limit, items });
  });

  // '/:id' より前に置く (generation を id として読ませない)。
  router.get('/generation', (c) => {
    const pid = c.req.param('pid')!;
    const status: ConceptSheetGenerationStatus = { job: jobs.get(pid), autoUpdate: { scheduledAt: autoUpdate.scheduledAt(pid) } };
    return c.json(status);
  });

  router.get('/:id', async (c) => {
    const head = await findSheetRow(c.req.param('pid')!, c.req.param('id'));
    if (!head) throw AppError.notFound('concept_sheet_not_found');
    const sheet = await readConceptSheetRecord(head, head.latestRv);
    if (!sheet) throw AppError.notFound('concept_sheet_not_found');
    return c.json({ sheet, versions: await listVersionSummaries(head.id), canEdit: EDIT.includes(c.get('projectRole')) });
  });

  router.get('/:id/versions/:rv', async (c) => {
    const rv = Number(c.req.param('rv'));
    if (!Number.isInteger(rv) || rv < 1) throw AppError.badRequest('invalid_rv');
    const head = await findSheetRow(c.req.param('pid')!, c.req.param('id'));
    if (!head) throw AppError.notFound('concept_sheet_not_found');
    const sheet = await readConceptSheetRecord(head, rv);
    if (!sheet) throw AppError.notFound('concept_sheet_version_not_found');
    return c.json({ sheet, versions: await listVersionSummaries(head.id), canEdit: EDIT.includes(c.get('projectRole')) });
  });

  router.post('/generate', requireRole(EDIT), bodyLimit({
    maxSize: GENERATION_BODY_LIMIT, onError: () => { throw AppError.badRequest('invalid_concept_sheet_request'); },
  }), async (c) => {
    const parsed = conceptSheetGenerationSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_concept_sheet_request');
    const pid = c.req.param('pid')!;
    const plan = await planManual(pid, parsed.data, getIdentity(c));
    // 待たない: 結果は生成の状態に残り、画面は GET /generation で受け取る (start は reject しない)。
    void jobs.start(pid, plan.sheetId, () => runConceptSheetGeneration(plan, writer), 'manual');
    return c.json({ id: plan.sheetId, state: 'running' }, 202);
  });

  router.put('/:id/auto-update', requireRole(EDIT), async (c) => {
    const parsed = autoUpdateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_auto_update');
    const pid = c.req.param('pid')!; const id = c.req.param('id');
    if (!await findSheetRow(pid, id)) throw AppError.notFound('concept_sheet_not_found');
    await setConceptSheetAutoUpdate(id, pid, parsed.data.enabled);
    await recordAudit({ projectId: pid, actor: getIdentity(c), action: 'concept_sheet.auto_update_setting', targetKind: 'concept_sheet',
      targetId: id, meta: { enabled: parsed.data.enabled } });
    // ON にしたら、古くなっていれば静かな時間の後に作り直す (古くなければ予約が走っても何もしない)。
    if (parsed.data.enabled) autoUpdate.notifyChange(pid);
    return c.json({ autoUpdate: parsed.data.enabled });
  });

  router.delete('/:id', requireRole(EDIT), async (c) => {
    const expected = Number(c.req.query('expectedRevision'));
    if (!Number.isInteger(expected) || expected < 1) throw AppError.badRequest('expected_revision_required');
    const pid = c.req.param('pid')!; const id = c.req.param('id');
    if (!await findSheetRow(pid, id)) throw AppError.notFound('concept_sheet_not_found');
    await deleteConceptSheet(id, pid, expected);
    await recordAudit({ projectId: pid, actor: getIdentity(c), action: 'concept_sheet.delete', targetKind: 'concept_sheet',
      targetId: id, meta: { revision: expected } });
    return c.json({ deleted: true });
  });
  return router;
}
