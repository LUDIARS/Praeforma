// /api/projects/:pid/concept-sheets — 企画概要書 (ペライチのコンセプトシート)。spec/feature/concept-sheet.md。
//
// role:
//   - 閲覧 (一覧・1 枚): プロジェクトメンバー全員
//   - 生成・修正・削除: owner / planner / designer (UX/ゴールを編集できる人と同じ)
// PF-CS-1 (UX/ゴールとキービジュアルから生成) / PF-CS-4 (人の修正は版一致で保存) / PF-CS-6 (版の競合) / PF-CS-7 (鮮度)。
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { and, eq, isNull, desc } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { conceptSheets, type ConceptSheetPayload } from '../db/schema/concept-sheet.ts';
import { persistConceptSheet, deleteConceptSheet } from '../db/concept-sheet-persistence.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { conceptSheetGenerationSchema, conceptSheetSaveSchema, decodeKeyVisual, type DecodedKeyVisual } from '../lib/concept-sheet-input.ts';
import { readConceptSheetMaterial, assertMaterialPresent, conceptSheetFreshness } from '../lib/concept-sheet-sources.ts';
import { writeConceptSheet, type ConceptSheetWriter } from '../lib/concept-sheet-writer.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';
import { parsePagination } from '../lib/pagination.ts';
import { KEY_VISUAL_MAX_BYTES, type ConceptSheetRecord, type ConceptSheetSummary } from '../../../shared/concept-sheet.ts';

const VIEW: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
const EDIT: readonly ProjectRole[] = ['owner', 'planner', 'designer'];
/** 生成は数十秒かかる。同じプロジェクトの同時生成と、サーバ全体で 2 本を超える生成を断る。 */
const MAX_PARALLEL_GENERATIONS = 2;
/** data URL は画像の実体の約 4/3 倍。JSON の包みの分を足す。 */
const GENERATION_BODY_LIMIT = Math.ceil(KEY_VISUAL_MAX_BYTES * 4 / 3) + 16_384;

type Row = typeof conceptSheets.$inferSelect;
async function findSheet(projectId: string, id: string): Promise<Row | undefined> {
  const [row] = await getDb().select().from(conceptSheets)
    .where(and(eq(conceptSheets.projectId, projectId), eq(conceptSheets.id, id))).limit(1);
  return row;
}
async function toRecord(row: Row): Promise<ConceptSheetRecord> {
  return {
    id: row.id, projectId: row.projectId, revision: row.revision, updatedAt: row.updatedAt.toISOString(),
    status: row.payload.status, document: row.payload.document, keyVisual: row.payload.keyVisual, source: row.payload.source,
    freshness: await conceptSheetFreshness(row.projectId, row.payload.source),
  };
}

/** keyVisual の指定を実体へ。'keep' は保存済みの画像を使い続ける (無ければ無し)。 */
function resolveKeyVisual(requested: string | null, before: Row | undefined): DecodedKeyVisual | null {
  if (requested === null) return null;
  if (requested === 'keep') return before?.payload.keyVisual ? decodeKeyVisual(before.payload.keyVisual.dataUrl) : null;
  return decodeKeyVisual(requested);
}

export function makeConceptSheetRouter(binary: string, writer: ConceptSheetWriter = writeConceptSheet): Hono {
  const router = new Hono();
  const generating = new Set<string>();
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
    const rows = await getDb().select().from(conceptSheets).where(eq(conceptSheets.projectId, pid))
      .orderBy(desc(conceptSheets.updatedAt), conceptSheets.id).limit(page.limit + 1).offset(page.offset);
    // 一覧には画像を含めない (1 枚ずつ数 MB になりうるため)。鮮度は UX/ゴールを 1 回だけ読んで比べる。
    const current = (await readConceptSheetMaterial(pid)).digest;
    const items: ConceptSheetSummary[] = rows.slice(0, page.limit).map((r) => ({
      id: r.id, title: r.payload.document.title, catchcopy: r.payload.document.catchcopy, status: r.payload.status,
      updatedAt: r.updatedAt.toISOString(), freshness: r.payload.source.uxDigest === current ? 'current' : 'outdated',
      hasKeyVisual: r.payload.keyVisual !== null,
    }));
    return c.json({ canEdit: EDIT.includes(c.get('projectRole')), hasMore: rows.length > page.limit, items });
  });

  router.get('/:id', async (c) => {
    const row = await findSheet(c.req.param('pid')!, c.req.param('id'));
    if (!row) throw AppError.notFound('concept_sheet_not_found');
    return c.json({ sheet: await toRecord(row), canEdit: EDIT.includes(c.get('projectRole')) });
  });

  router.post('/generate', requireRole(EDIT), bodyLimit({
    maxSize: GENERATION_BODY_LIMIT, onError: () => { throw new AppError('key_visual_too_large', 413); },
  }), async (c) => {
    const parsed = conceptSheetGenerationSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_concept_sheet_request');
    const input = parsed.data; const pid = c.req.param('pid')!;
    const before = await findSheet(pid, input.id);
    if ((before?.revision ?? 0) !== input.expectedRevision) throw AppError.conflict('concept_sheet_revision_conflict');
    const keyVisual = resolveKeyVisual(input.keyVisual, before);
    const material = await readConceptSheetMaterial(pid);
    assertMaterialPresent(material);
    if (generating.has(pid) || generating.size >= MAX_PARALLEL_GENERATIONS) throw new AppError('concept_sheet_generation_busy', 429);
    generating.add(pid);
    try {
      const generated = await writer(binary, material, keyVisual);
      // 生成中に UX/ゴールが変わったら、古い材料のシートを保存しない。
      if ((await readConceptSheetMaterial(pid)).digest !== material.digest) throw AppError.conflict('concept_sheet_source_changed');
      const payload: ConceptSheetPayload = {
        document: generated.document, keyVisual: keyVisual?.visual ?? null, status: 'generated',
        source: { uxGoalRevision: material.revision, uxDigest: material.digest,
          keyVisualDigest: keyVisual?.visual.digest ?? null, skillDigest: generated.skillDigest },
      };
      await persistConceptSheet(input.id, pid, payload, input.expectedRevision);
      await recordAudit({ projectId: pid, actor: getIdentity(c), action: 'concept_sheet.generate', targetKind: 'concept_sheet',
        targetId: input.id, meta: { revision: input.expectedRevision + 1, uxGoalRevision: material.revision, keyVisual: keyVisual !== null } });
      return c.json({ id: input.id, revision: input.expectedRevision + 1 }, input.expectedRevision === 0 ? 201 : 200);
    } finally { generating.delete(pid); }
  });

  router.put('/:id', requireRole(EDIT), bodyLimit({ maxSize: 64_000 }), async (c) => {
    const parsed = conceptSheetSaveSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_concept_sheet_document', parsed.error.flatten());
    const pid = c.req.param('pid')!; const id = c.req.param('id');
    const row = await findSheet(pid, id);
    if (!row) throw AppError.notFound('concept_sheet_not_found');
    // 文面だけを人が直す。材料の版 (source) とキービジュアルは生成時のまま残す。
    await persistConceptSheet(id, pid, { ...row.payload, document: parsed.data.document, status: 'edited' }, parsed.data.expectedRevision);
    await recordAudit({ projectId: pid, actor: getIdentity(c), action: 'concept_sheet.save', targetKind: 'concept_sheet', targetId: id,
      meta: { revision: parsed.data.expectedRevision + 1 } });
    return c.json({ id, revision: parsed.data.expectedRevision + 1 });
  });

  router.delete('/:id', requireRole(EDIT), async (c) => {
    const expected = Number(c.req.query('expectedRevision'));
    if (!Number.isInteger(expected) || expected < 1) throw AppError.badRequest('expected_revision_required');
    const pid = c.req.param('pid')!; const id = c.req.param('id');
    if (!await findSheet(pid, id)) throw AppError.notFound('concept_sheet_not_found');
    await deleteConceptSheet(id, pid, expected);
    await recordAudit({ projectId: pid, actor: getIdentity(c), action: 'concept_sheet.delete', targetKind: 'concept_sheet',
      targetId: id, meta: { revision: expected } });
    return c.json({ deleted: true });
  });
  return router;
}
