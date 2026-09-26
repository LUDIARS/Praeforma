// /api/projects/:pid/concept-sheets — 企画概要書 (ペライチのコンセプトシート)。spec/feature/concept-sheet.md。
//
// role:
//   - 閲覧 (一覧・1 枚・生成の状態): プロジェクトメンバー全員
//   - 生成・削除: owner / planner / designer (UX/ゴールを編集できる人と同じ)
// PF-CS-1 (UX/ゴールと画面の候補から Astra が設計) / PF-CS-2 (画面の候補) / PF-CS-6 (版の競合) /
// PF-CS-7 (鮮度) / PF-CS-9 (生成は裏で走らせ、状態を問い合わせる)。
// キャッチコピーは UX/ゴールの文言を固定で載せ、空なら Astra の案で UX/ゴールも埋める (PF-GOAL-W3)。
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { and, eq, isNull, desc } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { conceptSheets, type ConceptSheetPayload } from '../db/schema/concept-sheet.ts';
import { persistConceptSheet, deleteConceptSheet } from '../db/concept-sheet-persistence.ts';
import { fillEmptyCatchcopy } from '../db/project-catchcopy-persistence.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { conceptSheetGenerationSchema, decodeSceneImages, imagesDigest, type DecodedSceneImage } from '../lib/concept-sheet-input.ts';
import { readConceptSheetMaterial, assertMaterialPresent, conceptSheetFreshness, type ConceptSheetMaterial } from '../lib/concept-sheet-sources.ts';
import type { ConceptSheetWriter } from '../lib/concept-sheet-writer.ts';
import { ConceptSheetJobs } from '../lib/concept-sheet-jobs.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';
import { parsePagination } from '../lib/pagination.ts';
import { SCENE_IMAGES_TOTAL_MAX_BYTES, type ConceptSheetRecord, type ConceptSheetSummary } from '../../../shared/concept-sheet.ts';

const VIEW: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];
const EDIT: readonly ProjectRole[] = ['owner', 'planner', 'designer'];
/** data URL は画像の実体の約 4/3 倍。JSON の包みと指示文の分を足す。 */
const GENERATION_BODY_LIMIT = Math.ceil(SCENE_IMAGES_TOTAL_MAX_BYTES * 4 / 3) + 64 * 1024;

type Row = typeof conceptSheets.$inferSelect;
/** 2026-09-26 より前の形 (design を持たない) の行は読まない (spec/schema/concept-sheets.md)。 */
const isCurrentFormat = (row: Row): boolean => typeof row.payload?.design?.html === 'string';

async function findSheet(projectId: string, id: string): Promise<Row | undefined> {
  const [row] = await getDb().select().from(conceptSheets)
    .where(and(eq(conceptSheets.projectId, projectId), eq(conceptSheets.id, id))).limit(1);
  return row && isCurrentFormat(row) ? row : undefined;
}
async function toRecord(row: Row): Promise<ConceptSheetRecord> {
  return {
    id: row.id, projectId: row.projectId, revision: row.revision, updatedAt: row.updatedAt.toISOString(),
    design: row.payload.design, images: row.payload.images, source: row.payload.source,
    freshness: await conceptSheetFreshness(row.projectId, row.payload.source),
  };
}

/** 'keep' は保存済みの候補を使い続ける。保存済みも入力と同じ確認を通す。 */
function resolveImages(requested: 'keep' | Array<{ label: string; dataUrl: string }>, before: Row | undefined): DecodedSceneImage[] {
  if (requested !== 'keep') return decodeSceneImages(requested);
  if (!before) throw AppError.badRequest('scene_images_required');
  return decodeSceneImages(before.payload.images.map((i) => ({ label: i.label, dataUrl: i.dataUrl })));
}

interface GenerationTask {
  projectId: string; sheetId: string; expectedRevision: number; images: DecodedSceneImage[];
  material: ConceptSheetMaterial; instructions: string; previous: Row | undefined;
  writer: ConceptSheetWriter; actor: ReturnType<typeof getIdentity>;
}

/** 裏で走る 1 回の生成。材料が途中で変わったら保存しない。 */
async function generate(t: GenerationTask): Promise<void> {
  const generated = await t.writer({ material: t.material, images: t.images, instructions: t.instructions,
    previous: t.previous?.payload.design ?? null });
  let current = await readConceptSheetMaterial(t.projectId);
  if (current.digest !== t.material.digest) throw AppError.conflict('concept_sheet_source_changed');
  const filled = !t.material.catchcopy.text;
  if (filled) {
    // 空欄だけを AI案 で埋める。人が生成中に書いていたら、その文言を優先してこのシートは保存しない。
    if (!await fillEmptyCatchcopy(t.projectId, generated.design.catchcopy, t.material.revision)) {
      throw AppError.conflict('concept_sheet_source_changed');
    }
    current = await readConceptSheetMaterial(t.projectId);
  }
  const images = t.images.map((i) => i.image);
  const payload: ConceptSheetPayload = {
    design: generated.design, images,
    source: { uxGoalRevision: current.revision, uxDigest: current.digest, imagesDigest: imagesDigest(images),
      skillDigest: generated.skillDigest, model: generated.model, instructions: t.instructions },
  };
  await persistConceptSheet(t.sheetId, t.projectId, payload, t.expectedRevision);
  await recordAudit({ projectId: t.projectId, actor: t.actor, action: 'concept_sheet.generate', targetKind: 'concept_sheet',
    targetId: t.sheetId, meta: { revision: t.expectedRevision + 1, uxGoalRevision: current.revision, images: images.length,
      model: generated.model, catchcopyFilled: filled } });
}

export function makeConceptSheetRouter(writer: ConceptSheetWriter, jobs: ConceptSheetJobs = new ConceptSheetJobs()): Hono {
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
    const rows = (await getDb().select().from(conceptSheets).where(eq(conceptSheets.projectId, pid))
      .orderBy(desc(conceptSheets.updatedAt), conceptSheets.id).limit(page.limit + 1).offset(page.offset));
    // 一覧には画像と紙面を含めない (1 枚で数 MB になりうるため)。鮮度は UX/ゴールを 1 回だけ読んで比べる。
    const current = (await readConceptSheetMaterial(pid)).digest;
    const items: ConceptSheetSummary[] = rows.slice(0, page.limit).filter(isCurrentFormat).map((r) => ({
      id: r.id, title: r.payload.design.title, catchcopy: r.payload.design.catchcopy, concept: r.payload.design.concept,
      sceneLabel: r.payload.design.scene.label, updatedAt: r.updatedAt.toISOString(),
      freshness: r.payload.source.uxDigest === current ? 'current' : 'outdated',
    }));
    return c.json({ canEdit: EDIT.includes(c.get('projectRole')), hasMore: rows.length > page.limit, items });
  });

  // '/:id' より前に置く (generation を id として読ませない)。
  router.get('/generation', (c) => c.json({ job: jobs.get(c.req.param('pid')!) }));

  router.get('/:id', async (c) => {
    const row = await findSheet(c.req.param('pid')!, c.req.param('id'));
    if (!row) throw AppError.notFound('concept_sheet_not_found');
    return c.json({ sheet: await toRecord(row), canEdit: EDIT.includes(c.get('projectRole')) });
  });

  router.post('/generate', requireRole(EDIT), bodyLimit({
    maxSize: GENERATION_BODY_LIMIT, onError: () => { throw new AppError('scene_images_too_large', 413); },
  }), async (c) => {
    const parsed = conceptSheetGenerationSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_concept_sheet_request');
    const input = parsed.data; const pid = c.req.param('pid')!;
    const before = await findSheet(pid, input.id);
    if ((before?.revision ?? 0) !== input.expectedRevision) throw AppError.conflict('concept_sheet_revision_conflict');
    const images = resolveImages(input.images, before);
    const material = await readConceptSheetMaterial(pid);
    assertMaterialPresent(material);
    jobs.start(pid, input.id, () => generate({ projectId: pid, sheetId: input.id, expectedRevision: input.expectedRevision,
      images, material, instructions: input.instructions, previous: before, writer, actor: getIdentity(c) }));
    return c.json({ id: input.id, state: 'running' }, 202);
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
