import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { ulid } from 'ulid';
import { requireAuth,getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import type { ProjectRole } from '../db/schema/project.ts';
import { versionRows,versionBatch,parseStored } from '../db/spec-version-store.ts';
import { reconstructionMaterial,readSpecHead } from '../lib/reconstruction-material.ts';
import { writeReconstruction } from '../lib/reconstruction-writer.ts';
import { confirmReconstruction,recordSpecRelease } from '../lib/reconstruction-commit.ts';
import { AppError } from '../lib/errors.ts';
import type { ReconstructionProposal,ReconstructionMaterial,ReconstructionPlan } from '../../../shared/spec-versioning.ts';
import { versionLabel } from '../../../shared/spec-versioning.ts';
const view:readonly ProjectRole[]=['owner','planner','designer','programmer','reviewer','viewer'];
const edit:readonly ProjectRole[]=['owner','planner'];
const active=new Set<string>();
type Writer=(binary:string,material:ReconstructionMaterial)=>Promise<ReconstructionPlan>;
export function makeSpecVersionRouter(binary:string,writer:Writer=writeReconstruction):Hono {
  const r=new Hono();r.use('*',requireAuth,requireRole(view),bodyLimit({maxSize:32768}));
  r.use('*',async(c,next)=>{const rows=await versionRows('SELECT id FROM projects WHERE id=? AND deleted_at IS NULL',[c.req.param('pid')!]);if(!rows.length)throw AppError.notFound('project_not_found');await next();});
  r.get('/',async c=>{
    const pid=c.req.param('pid')!;const offset=Number(c.req.query('offset')??0);if(!Number.isInteger(offset)||offset<0)throw AppError.badRequest('invalid_page');
    const head=await readSpecHead(pid);const logs=await versionRows('SELECT id,version,kind,payload,created_at FROM spec_version_logs WHERE project_id=? ORDER BY revision DESC LIMIT 21 OFFSET ?',[pid,offset]);
    return c.json({head,version:versionLabel(head),canEdit:edit.includes(c.get('projectRole')),hasMore:logs.length>20,logs:logs.slice(0,20).map(row=>({...row,payload:parseStored<unknown>(row.payload)}))});
  });
  r.post('/reconstructions',requireRole(edit),async c=>{
    const pid=c.req.param('pid')!;if(active.has(pid))throw new AppError('reconstruction_busy',429);active.add(pid);
    try {
      const material=await reconstructionMaterial(pid);if(!material.fragments.length)throw AppError.badRequest('no_pending_fragments');if(!material.domains.length)throw AppError.badRequest('domain_required');
      const plan=await writer(binary,material);const id=ulid();
      const proposal:ReconstructionProposal={id,material,plan,confirmedVersion:null};
      await versionBatch([{sql:'INSERT INTO spec_reconstructions(id,project_id,payload) SELECT ?,id,? FROM projects WHERE id=? AND deleted_at IS NULL',args:[id,JSON.stringify(proposal),pid],affected:1}]);
      return c.json({proposal},201);
    } finally {active.delete(pid);}
  });
  r.get('/reconstructions',requireRole(edit),async c=>{
    const rows=await versionRows('SELECT payload FROM spec_reconstructions WHERE project_id=? AND confirmed_version IS NULL ORDER BY id DESC LIMIT 1',[c.req.param('pid')!]);
    return c.json({proposal:rows[0]?parseStored<ReconstructionProposal>(rows[0].payload):null});
  });
  r.post('/reconstructions/:rid/confirm',requireRole(edit),async c=>{
    const pid=c.req.param('pid')!;const [row]=await versionRows('SELECT payload,confirmed_version FROM spec_reconstructions WHERE id=? AND project_id=?',[c.req.param('rid')!,pid]);
    if(!row)throw AppError.notFound('reconstruction_not_found');if(row.confirmed_version)throw AppError.conflict('reconstruction_already_confirmed');
    return c.json({version:await confirmReconstruction(pid,parseStored<ReconstructionProposal>(row.payload),getIdentity(c).userId)});
  });
  r.post('/releases',requireRole(edit),async c=>{
    const parsed=z.object({expectedRevision:z.number().int().min(0),note:z.string().trim().min(1).max(2000)}).strict().safeParse(await c.req.json().catch(()=>null));
    if(!parsed.success)throw AppError.badRequest('release_note_required');const head=await readSpecHead(c.req.param('pid')!);if(head.revision!==parsed.data.expectedRevision)throw AppError.conflict('spec_version_conflict');
    return c.json({version:await recordSpecRelease(c.req.param('pid')!,head,parsed.data.note,getIdentity(c).userId)});
  });
  return r;
}
