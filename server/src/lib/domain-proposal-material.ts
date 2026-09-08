import type {DomainProposalMaterial} from '../../../shared/domain-proposals.ts';
import {normalizeDomainName} from '../../../shared/domain-proposals.ts';
import {versionRows} from '../db/spec-version-store.ts';
import {reconstructionMaterial} from './reconstruction-material.ts';
import {fetchAnatomiaDomains,type AnatomiaDomainsOptions} from './anatomia-domains.ts';
import {AppError} from './errors.ts';
export async function domainProposalMaterial(pid:string,includeAnatomia:boolean,options:AnatomiaDomainsOptions):Promise<DomainProposalMaterial> {
  const material=await reconstructionMaterial(pid);
  const rows=await versionRows('SELECT id,name,definition_kind,definition_value,description,anatomia_domain FROM domains WHERE project_id=? ORDER BY id',[pid]);
  const registered=rows.map(row=>({id:String(row.id),name:String(row.name),kind:row.definition_kind===null?null:String(row.definition_kind),value:String(row.definition_value),description:row.description===null?null:String(row.description),anatomiaDomain:row.anatomia_domain===null?null:String(row.anatomia_domain)}));
  let unregistered:DomainProposalMaterial['unregistered']=[];
  if(includeAnatomia){
    const [project]=await versionRows('SELECT anatomia_repo FROM projects WHERE id=?',[pid]);
    if(!project?.anatomia_repo)throw AppError.conflict('anatomia_repo_unset');
    const catalog=await fetchAnatomiaDomains(options,String(project.anatomia_repo));
    const names=new Set(registered.flatMap(domain=>[domain.name,...(domain.anatomiaDomain?[domain.anatomiaDomain]:[])]).map(normalizeDomainName));
    unregistered=catalog.filter(domain=>!names.has(normalizeDomainName(domain.name))).map(({name,description})=>({name,description}));
  }
  const sources=[...material.specs.map(spec=>({ref:`spec:${spec.id}`,content:`${spec.title}\n${spec.description??''}`})),...material.fragments.map(fragment=>({ref:`fragment:${fragment.id}`,content:fragment.content})),...unregistered.map(domain=>({ref:`anatomia:${domain.name}`,content:`${domain.name}\n${domain.description??''}`}))];
  return {registered,unregistered,sources,includesAnatomia:includeAnatomia};
}
