/** PF-MANUAL-1/2/7/8: project-scoped generation proposals and reviewed documents. */
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { and, eq, isNull, desc } from 'drizzle-orm';
import { getDb } from '../db/connection.ts';
import { projects, type ProjectRole } from '../db/schema/project.ts';
import { specs } from '../db/schema/spec.ts';
import { specFragments } from '../db/schema/spec-fragment.ts';
import { featureManuals, type ManualPayload } from '../db/schema/feature-manual.ts';
import { persistManual } from '../db/manual-persistence.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { manualGenerationSchema, manualSaveSchema } from '../lib/manual-input.ts';
import { readManualSpec, manualFreshness } from '../lib/manual-sources.ts';
import { writeManual, digest } from '../lib/manual-writer.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';
import { parsePagination } from '../lib/pagination.ts';

const VIEW: readonly ProjectRole[] = ['owner','planner','designer','programmer','reviewer','viewer'];
const EDIT: readonly ProjectRole[] = ['owner','planner','designer','programmer','reviewer'];
async function findManual(projectId: string,id: string) {
  const [row] = await getDb().select().from(featureManuals).where(and(eq(featureManuals.projectId,projectId),eq(featureManuals.id,id))).limit(1);
  return row;
}
async function viewManual(row: typeof featureManuals.$inferSelect, canEdit: boolean) {
  const basis = row.payload.publishedSource ?? row.payload.source;
  let freshness = await manualFreshness(row.projectId,basis);
  if (freshness === 'current' && row.payload.publishedSource &&
    (basis.implementationDigest !== row.payload.source.implementationDigest || basis.specDigest !== row.payload.source.specDigest)) freshness = 'outdated';
  return { id:row.id,projectId:row.projectId,revision:row.revision,updatedAt:row.updatedAt.toISOString(),freshness,
    document:row.payload.document, ...(canEdit ? { proposal:row.payload.proposal,source:row.payload.source,publishedSource:row.payload.publishedSource } : {}) };
}

export function makeManualRouter(binary: string, writer: typeof writeManual = writeManual): Hono {
  const router = new Hono();
  const generating = new Set<string>();
  router.use('*',requireAuth,requireRole(VIEW));
  router.use('*',async(c,next) => {
    const [p] = await getDb().select({id:projects.id}).from(projects).where(and(eq(projects.id,c.req.param('pid')!),isNull(projects.deletedAt))).limit(1);
    if (!p) throw AppError.notFound('project_not_found');
    await next();
  });
  router.get('/sources', requireRole(EDIT), async c => {
    const page = parsePagination(c.req.query());
    if (!Number.isInteger(page.limit) || !Number.isInteger(page.offset)) throw AppError.badRequest('invalid_page');
    if (c.req.query('kind') === 'fragment') {
      const rows = await getDb().select({id:specFragments.id,content:specFragments.content}).from(specFragments)
        .where(eq(specFragments.projectId,c.req.param('pid')!)).orderBy(specFragments.id).limit(page.limit+1).offset(page.offset);
      return c.json({items:rows.slice(0,page.limit).map(r=>({id:`fragment:${r.id}`,title:`${r.content.slice(0,80)}（断片）`})),hasMore:rows.length>page.limit});
    }
    const items = await getDb().select({id:specs.id,title:specs.title}).from(specs)
      .where(and(eq(specs.projectId,c.req.param('pid')!),isNull(specs.deletedAt))).orderBy(specs.id).limit(page.limit+1).offset(page.offset);
    return c.json({items:items.slice(0,page.limit),hasMore:items.length>page.limit});
  });
  router.get('/',async c => {
    const page = parsePagination(c.req.query());
    if (!Number.isInteger(page.limit) || !Number.isInteger(page.offset)) throw AppError.badRequest('invalid_page');
    const rows = await getDb().select().from(featureManuals).where(eq(featureManuals.projectId,c.req.param('pid')!))
      .orderBy(desc(featureManuals.updatedAt),featureManuals.id).limit(page.limit+1).offset(page.offset);
    const canEdit = EDIT.includes(c.get('projectRole'));
    return c.json({canEdit,hasMore:rows.length>page.limit,items:rows.slice(0,page.limit).flatMap(r => !canEdit && !r.payload.document ? [] : [{
      id:r.id,title:(r.payload.document ?? r.payload.proposal).title,published:!!r.payload.document,
    }])});
  });
  router.get('/:id',async c => {
    const row = await findManual(c.req.param('pid')!,c.req.param('id'));
    const canEdit = EDIT.includes(c.get('projectRole'));
    if (!row || (!canEdit && !row.payload.document)) throw AppError.notFound('manual_not_found');
    return c.json({manual:await viewManual(row,canEdit),canEdit});
  });
  router.post('/generate',requireRole(EDIT),bodyLimit({maxSize:400000}),async c => {
    const parsed = manualGenerationSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_manual_source');
    const input = parsed.data; const pid = c.req.param('pid')!;
    const before = await findManual(pid,input.id);
    if ((before?.revision ?? 0) !== input.expectedRevision) throw AppError.conflict('manual_revision_conflict');
    if (generating.has(pid) || generating.size >= 2) throw new AppError('manual_generation_busy',429);
    generating.add(pid);
    try {
      const spec = await readManualSpec(pid,input.specId);
      const generated = await writer(binary,{specification:spec.material,implementation:input.implementation,
        existingDocument:before?.payload.document ?? null});
      if ((await readManualSpec(pid,input.specId)).digest !== spec.digest) throw AppError.conflict('manual_source_changed');
      const payload: ManualPayload = {document:before?.payload.document ?? null,proposal:generated.document,
        publishedSource:before?.payload.publishedSource ?? null,
        source:{specId:input.specId,specDigest:spec.digest,implementation:input.implementation,
          implementationDigest:digest(JSON.stringify(input.implementation)),skillDigest:generated.skillDigest}};
      await persistManual(input.id,pid,payload,input.expectedRevision);
      await recordAudit({projectId:pid,actor:getIdentity(c),action:'manual.generate',targetKind:'manual',targetId:input.id,meta:{revision:input.expectedRevision+1}});
      return c.json({id:input.id,revision:input.expectedRevision+1},201);
    } finally { generating.delete(pid); }
  });
  router.put('/:id',requireRole(EDIT),bodyLimit({maxSize:100000}),async c => {
    const parsed = manualSaveSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_manual_document',parsed.error.flatten());
    const pid=c.req.param('pid')!; const id=c.req.param('id'); const input=parsed.data;
    const row=await findManual(pid,id);
    if (!row) throw AppError.notFound('manual_not_found');
    const basis=input.basis==='saved' ? row.payload.publishedSource : row.payload.source;
    if (!basis) throw AppError.conflict('manual_basis_missing');
    if (await manualFreshness(pid,basis) !== 'current') throw AppError.conflict('manual_source_changed');
    await persistManual(id,pid,{...row.payload,document:input.document,publishedSource:basis},input.expectedRevision);
    await recordAudit({projectId:pid,actor:getIdentity(c),action:'manual.save',targetKind:'manual',targetId:id,meta:{revision:input.expectedRevision+1}});
    return c.json({id,revision:input.expectedRevision+1});
  });
  return router;
}
