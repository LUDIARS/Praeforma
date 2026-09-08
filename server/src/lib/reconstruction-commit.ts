import { ulid } from 'ulid';
import { isDeepStrictEqual } from 'node:util';
import type { ReconstructionProposal,SpecVersionHead } from '../../../shared/spec-versioning.ts';
import { nextSpecVersion,versionLabel } from '../../../shared/spec-versioning.ts';
import { versionBatch,type VersionStatement } from '../db/spec-version-store.ts';
import { getLocalSqlite } from '../db/connection.ts';
import { AppError } from './errors.ts';
import { reconstructionMaterial } from './reconstruction-material.ts';

function start(pid:string,head:SpecVersionHead):VersionStatement[] {
  return [
    {sql:'SELECT id FROM projects WHERE id=? AND deleted_at IS NULL',args:[pid],lock:true,check:rows=>rows.length===1},
    {sql:'INSERT INTO spec_version_heads(project_id) VALUES(?) ON CONFLICT DO NOTHING',args:[pid]},
    {sql:'UPDATE spec_version_heads SET suppress=1 WHERE project_id=? AND revision=? AND suppress=0',args:[pid,head.revision],affected:1},
  ];
}
function finish(pid:string,head:SpecVersionHead,kind:'minor'|'major',payload:unknown):VersionStatement[] {
  const next=nextSpecVersion(head,kind);
  return [{sql:'UPDATE spec_version_heads SET major=?,minor=?,patch=?,revision=?,suppress=0 WHERE project_id=?',args:[next.major,next.minor,next.patch,next.revision,pid],affected:1},
    {sql:'INSERT INTO spec_version_logs(id,project_id,version,revision,kind,payload,created_at) VALUES(?,?,?,?,?,?,?)',args:[ulid(),pid,versionLabel(next),next.revision,kind==='minor'?'reconstruction':'release',JSON.stringify(payload),new Date().toISOString()],affected:1}];
}
export async function confirmReconstruction(pid:string,proposal:ReconstructionProposal,actor:string):Promise<string> {
  const {material,plan}=proposal;
  // Early feedback; statements below repeat row guards within the commit transaction.
  if(!isDeepStrictEqual(await reconstructionMaterial(pid),material))throw AppError.conflict('reconstruction_source_changed');
  if(!plan.changes.length)throw AppError.badRequest('reconstruction_no_changes');
  const changes=plan.changes.filter(change=>{const before=material.specs.find(s=>s.id===change.specId);return !before||before.title!==change.title||before.description!==change.description;});
  const steps=start(pid,material.head);const logs:unknown[]=[];
  const timestamp=getLocalSqlite()?Date.now():new Date().toISOString();
  for(const spec of material.specs){
    steps.push({sql:'SELECT id FROM specs WHERE id=? AND project_id=? AND version=? AND deleted_at IS NULL',args:[spec.id,pid,spec.version],lock:true,check:rows=>rows.length===1});
    steps.push({sql:"SELECT ref_id FROM spec_targets WHERE spec_id=? AND kind='domain' ORDER BY ref_id",args:[spec.id],lock:true,check:rows=>JSON.stringify(rows.map(row=>String(row.ref_id)))===JSON.stringify(spec.domainIds)});
  }
  for(const fragment of material.fragments)steps.push({sql:'SELECT id FROM spec_fragments WHERE id=? AND project_id=? AND revision=?',args:[fragment.id,pid,fragment.revision],lock:true,check:rows=>rows.length===1});
  for(const change of changes){
    const before=material.specs.find(s=>s.id===change.specId);const id=before?.id??ulid();
    steps.push({sql:'SELECT id FROM domains WHERE id=? AND project_id=?',args:[change.domainId,pid],lock:true,check:rows=>rows.length===1});
    if(before)steps.push({sql:'UPDATE specs SET title=?,description=?,version=version+1,updated_at=? WHERE id=? AND project_id=? AND version=? AND deleted_at IS NULL',args:[change.title,change.description,timestamp,id,pid,before.version],affected:1});
    else {
      steps.push({sql:'INSERT INTO specs(id,project_id,code,title,description,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',args:[id,pid,`REC-${id}`,change.title,change.description,actor,timestamp,timestamp],affected:1});
      steps.push({sql:'INSERT INTO spec_targets(spec_id,kind,ref_id) VALUES(?,?,?)',args:[id,'domain',change.domainId],affected:1});
    }
    logs.push({id,before:before??null,after:{...change,id},fragments:material.fragments.filter(f=>change.fragmentIds.includes(f.id))});
  }
  for(const change of plan.changes)for(const fragment of change.fragmentIds)steps.push({sql:'INSERT INTO spec_reconstruction_fragments(fragment_id,reconstruction_id) VALUES(?,?)',args:[fragment,proposal.id],affected:1});
  const version=versionLabel(nextSpecVersion(material.head,'minor'));
  steps.push({sql:'UPDATE spec_reconstructions SET confirmed_version=? WHERE id=? AND project_id=? AND confirmed_version IS NULL',args:[version,proposal.id,pid],affected:1});
  steps.push(...finish(pid,material.head,'minor',{actor,changes:logs,integratedFragments:plan.changes.flatMap(change=>change.fragmentIds),deferred:plan.deferred}));
  await versionBatch(steps);return version;
}
export async function recordSpecRelease(pid:string,head:SpecVersionHead,note:string,actor:string):Promise<string> {
  await versionBatch([...start(pid,head),...finish(pid,head,'major',{note,actor})]);return versionLabel(nextSpecVersion(head,'major'));
}
