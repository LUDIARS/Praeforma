import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb, getDbState } from '../db/connection.ts';
import { layouts } from '../db/schema/layout.ts';
import { sceneDocuments } from '../db/schema/scene-editor.ts';
import { persistScene } from '../db/scene-persistence.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import type { ProjectRole } from '../db/schema/project.ts';
import { projects } from '../db/schema/project.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';
import { seedScene } from '../lib/scene-seed.ts';
import { analyzeLayoutImage } from '../lib/ux-image-analysis.ts';
import { runtimeSnapshotSchema, sceneSaveSchema } from '../../../shared/scene-editor.ts';

declare module 'hono' {
  interface ContextVariableMap { sceneName: string }
}

const all: readonly ProjectRole[] = ['owner','planner','designer','programmer','reviewer','viewer'];
const edit: readonly ProjectRole[] = ['owner','planner'];
const activeAnalyses = new Set<string>();
export function makeSceneEditorRouter(claudeBin: string): Hono {
  const r = new Hono();
  r.use('*', requireAuth, requireRole(all));
  r.use('*', async (c, next) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const [project] = await getDb().select({id:projects.id}).from(projects).where(and(eq(projects.id,c.req.param('pid')!),isNull(projects.deletedAt))).limit(1);
    if (!project) throw AppError.notFound('project_not_found');
    const [layout] = await getDb().select({name:layouts.name}).from(layouts).where(and(eq(layouts.id,c.req.param('lid')!),eq(layouts.projectId,c.req.param('pid')!),isNull(layouts.deletedAt))).limit(1);
    if (!layout) throw AppError.notFound('scene_not_found');
    c.set('sceneName', layout.name);
    await next();
  });
  r.use('*', bodyLimit({ maxSize: 8 * 1024 * 1024, onError: () => { throw new AppError('scene_request_too_large',413); } }));
  r.get('/', async c => {
    const pid=c.req.param('pid')!; const lid=c.req.param('lid')!;
    const name = c.get('sceneName');
    const [row] = await getDb().select().from(sceneDocuments).where(and(eq(sceneDocuments.layoutId,lid),eq(sceneDocuments.projectId,pid))).limit(1);
    const document = row ? { ...row.payload, canvas: { ...row.payload.canvas, revision: row.revision } } : await seedScene(pid,lid,name);
    return c.json({ document, name, canEdit: edit.includes(c.get('projectRole') as ProjectRole) });
  });
  r.put('/', requireRole(edit), async c => {
    const parsed=sceneSaveSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('invalid_scene',parsed.error.flatten());
    const { expected_revision: expected, ...canvas }=parsed.data.canvas;
    const document={ canvas:{ ...canvas, revision:expected+1 }, sources:parsed.data.sources, ...(parsed.data.web ? {web:parsed.data.web} : {}) };
    await persistScene(c.req.param('lid')!,c.req.param('pid')!,document,expected);
    await recordAudit({ projectId:c.req.param('pid')!, actor:getIdentity(c), action:'scene.save', targetKind:'layout', targetId:c.req.param('lid')!, meta:{ revision:expected+1 } });
    return c.json({ document });
  });
  r.post('/analyze', requireRole(edit), async c => {
    const key = c.req.param('pid')!;
    if (activeAnalyses.has(key)) throw new AppError('scene_analysis_busy',429);
    activeAnalyses.add(key);
    try {
      const form=await c.req.parseBody(); const image=form.image;
      if (!image || typeof image==='string' || image.size>2*1024*1024) throw AppError.badRequest('image_required_max_2mb');
      let runtime;
      if (form.runtime) {
        if (typeof form.runtime !== 'string' || form.runtime.length>600_000) throw AppError.badRequest('invalid_runtime');
        let input: unknown; try { input=JSON.parse(form.runtime); } catch { throw AppError.badRequest('invalid_runtime'); }
        const parsed=runtimeSnapshotSchema.safeParse(input); if (!parsed.success) throw AppError.badRequest('invalid_runtime',parsed.error.flatten());
        runtime=parsed.data;
      }
      const result=await analyzeLayoutImage(claudeBin,new Uint8Array(await image.arrayBuffer()),image.type,runtime);
      return c.json(result);
    } finally { activeAnalyses.delete(key); }
  });
  return r;
}
