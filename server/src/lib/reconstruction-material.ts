import type { ReconstructionMaterial,SpecVersionHead } from '../../../shared/spec-versioning.ts';
import { versionRows,parseStored } from '../db/spec-version-store.ts';
import { AppError } from './errors.ts';
import { parseSpecTerms } from '../../../shared/spec-terms.ts';
export async function readSpecHead(pid:string):Promise<SpecVersionHead> {
  const [row]=await versionRows('SELECT major,minor,patch,revision FROM spec_version_heads WHERE project_id=?',[pid]);
  return row?{major:Number(row.major),minor:Number(row.minor),patch:Number(row.patch),revision:Number(row.revision)}:{major:0,minor:0,patch:0,revision:0};
}
const PENDING_FRAGMENTS='SELECT id,content,revision FROM spec_fragments WHERE project_id=? AND NOT EXISTS(SELECT 1 FROM spec_reconstruction_fragments r WHERE r.fragment_id=spec_fragments.id)';
const IN_SPRINT=' AND EXISTS(SELECT 1 FROM spec_sprint_fragments sf WHERE sf.fragment_id=spec_fragments.id AND sf.sprint_id=?)';
/** 資料にする未処理断片の範囲。sprintId はそのスプリント (PF-SPRINT-5)、fragmentIds は外部案が指定した断片。 */
export interface MaterialScope { sprintId?:string|null; fragmentIds?:readonly string[] }
/** fragmentIds 指定時はその未処理断片だけを資料にする。処理済み・別プロジェクトの断片が混ざれば競合。 */
async function pendingFragments(pid:string,{sprintId,fragmentIds}:MaterialScope):Promise<Record<string,unknown>[]> {
  const base=sprintId?`${PENDING_FRAGMENTS}${IN_SPRINT}`:PENDING_FRAGMENTS;const args=sprintId?[pid,sprintId]:[pid];
  if(!fragmentIds)return versionRows(`${base} ORDER BY id LIMIT 501`,args);
  const ids=[...new Set(fragmentIds)];
  if(ids.length!==fragmentIds.length)throw AppError.badRequest('invalid_reconstruction_fragment');
  const rows=await versionRows(`${base} AND id IN (${ids.map(()=>'?').join(',')}) ORDER BY id`,[...args,...ids]);
  if(rows.length!==ids.length)throw AppError.conflict('reconstruction_fragment_unavailable');
  return rows;
}
/** PF-SPRINT-5: a sprint narrows the pending fragments; specs and domains stay project-wide. */
export async function reconstructionMaterial(pid:string,scope:MaterialScope={}):Promise<ReconstructionMaterial> {
  const {sprintId}=scope;
  const specs=await versionRows('SELECT id,code,title,description,version,priority,category,status,preconditions,postconditions,measurements,contracts FROM specs WHERE project_id=? AND deleted_at IS NULL ORDER BY id LIMIT 501',[pid]);
  const fragments=await pendingFragments(pid,scope);
  const domains=await versionRows('SELECT id,name FROM domains WHERE project_id=? ORDER BY id',[pid]);
  const targets=await versionRows("SELECT t.spec_id,t.ref_id FROM spec_targets t JOIN specs s ON s.id=t.spec_id WHERE s.project_id=? AND t.kind='domain' ORDER BY t.ref_id",[pid]);
  if(specs.length>500||fragments.length>500)throw new AppError('reconstruction_material_too_large',413);
  return {head:await readSpecHead(pid),specs:specs.map(s=>({id:String(s.id),code:String(s.code),title:String(s.title),description:s.description===null?null:String(s.description),version:Number(s.version),domainIds:targets.filter(t=>t.spec_id===s.id).map(t=>String(t.ref_id)),priority:String(s.priority),category:String(s.category),status:String(s.status),preconditions:parseStored<string[]>(s.preconditions),postconditions:parseStored<string[]>(s.postconditions),...parseSpecTerms(s.measurements,s.contracts)})),
    fragments:fragments.map(f=>({id:String(f.id),content:String(f.content),revision:Number(f.revision)})),domains:domains.map(d=>({id:String(d.id),name:String(d.name)})),...(sprintId?{sprintId}:{})};
}
