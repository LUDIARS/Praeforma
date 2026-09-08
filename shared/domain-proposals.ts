import { z } from 'zod';
export const businessDomainProposalSchema=z.object({candidates:z.array(z.object({
  name:z.string().trim().min(1).max(200),responsibility:z.string().trim().min(1).max(2000),value:z.string().trim().min(1).max(2000),
  sourceRefs:z.array(z.string().min(1).max(600)).min(1).max(100),
  coreComparisons:z.array(z.object({coreId:z.string().min(1),relationship:z.string().min(1).max(2000),difference:z.string().min(1).max(2000)}).strict()).min(1).max(50),
}).strict()).max(50)}).strict();
export type BusinessDomainCandidate=z.infer<typeof businessDomainProposalSchema>['candidates'][number];
export interface DomainProposalMaterial {
  registered:Array<{id:string;name:string;kind:string|null;value:string;description:string|null;anatomiaDomain:string|null}>;
  unregistered:Array<{name:string;description:string|null}>;
  sources:Array<{ref:string;content:string}>;
  includesAnatomia:boolean;
}
export const normalizeDomainName=(name:string):string=>name.normalize('NFKC').trim().toLowerCase();
export function validateBusinessCandidates(material:DomainProposalMaterial,candidates:BusinessDomainCandidate[]):boolean {
  const registered=new Set(material.registered.flatMap(domain=>[domain.name,...(domain.anatomiaDomain?[domain.anatomiaDomain]:[])]).map(normalizeDomainName));
  const cores=new Set(material.registered.filter(domain=>domain.kind==='core').map(domain=>domain.id));
  const refs=new Set(material.sources.map(source=>source.ref));const seen=new Set<string>();
  return candidates.every(candidate=>{
    const name=normalizeDomainName(candidate.name);
    if(registered.has(name)||seen.has(name)||new Set(candidate.coreComparisons.map(core=>core.coreId)).size!==candidate.coreComparisons.length||new Set(candidate.sourceRefs).size!==candidate.sourceRefs.length||candidate.coreComparisons.some(core=>!cores.has(core.coreId))||candidate.sourceRefs.some(ref=>!refs.has(ref)))return false;
    seen.add(name);return true;
  });
}
