import type { ReconstructionMaterial,SpecVersionHead } from '../../../shared/spec-versioning.ts';
import { versionRows,parseStored } from '../db/spec-version-store.ts';
import { AppError } from './errors.ts';
export async function readSpecHead(pid:string):Promise<SpecVersionHead> {
  const [row]=await versionRows('SELECT major,minor,patch,revision FROM spec_version_heads WHERE project_id=?',[pid]);
  return row?{major:Number(row.major),minor:Number(row.minor),patch:Number(row.patch),revision:Number(row.revision)}:{major:0,minor:0,patch:0,revision:0};
}
export async function reconstructionMaterial(pid:string):Promise<ReconstructionMaterial> {
  const specs=await versionRows('SELECT id,code,title,description,version,priority,category,status,preconditions,postconditions FROM specs WHERE project_id=? AND deleted_at IS NULL ORDER BY id LIMIT 501',[pid]);
  const fragments=await versionRows('SELECT id,content,revision FROM spec_fragments WHERE project_id=? AND NOT EXISTS(SELECT 1 FROM spec_reconstruction_fragments r WHERE r.fragment_id=spec_fragments.id) ORDER BY id LIMIT 501',[pid]);
  const domains=await versionRows('SELECT id,name FROM domains WHERE project_id=? ORDER BY id',[pid]);
  const targets=await versionRows("SELECT t.spec_id,t.ref_id FROM spec_targets t JOIN specs s ON s.id=t.spec_id WHERE s.project_id=? AND t.kind='domain' ORDER BY t.ref_id",[pid]);
  if(specs.length>500||fragments.length>500)throw new AppError('reconstruction_material_too_large',413);
  return {head:await readSpecHead(pid),specs:specs.map(s=>({id:String(s.id),code:String(s.code),title:String(s.title),description:s.description===null?null:String(s.description),version:Number(s.version),domainIds:targets.filter(t=>t.spec_id===s.id).map(t=>String(t.ref_id)),priority:String(s.priority),category:String(s.category),status:String(s.status),preconditions:parseStored<string[]>(s.preconditions),postconditions:parseStored<string[]>(s.postconditions)})),
    fragments:fragments.map(f=>({id:String(f.id),content:String(f.content),revision:Number(f.revision)})),domains:domains.map(d=>({id:String(d.id),name:String(d.name)}))};
}
