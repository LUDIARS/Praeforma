import { z } from 'zod';
export interface SpecVersionHead { major:number;minor:number;patch:number;revision:number }
export const versionLabel=(head:SpecVersionHead):string=>`${head.major}.${head.minor}.${head.patch}`;
export function nextSpecVersion(head:SpecVersionHead,kind:'patch'|'minor'|'major'):SpecVersionHead {
  return { major:head.major+(kind==='major'?1:0),minor:kind==='major'?0:head.minor+(kind==='minor'?1:0),patch:kind==='patch'?head.patch+1:0,revision:head.revision+1 };
}
export const reconstructionSchema=z.object({
  changes:z.array(z.object({specId:z.string().nullable(),domainId:z.string().min(1),title:z.string().trim().min(1).max(200),description:z.string().trim().min(1).max(20000),fragmentIds:z.array(z.string()).min(1).max(500),rationale:z.string().min(1).max(2000)}).strict()).max(100),
  deferred:z.array(z.object({fragmentId:z.string(),reason:z.string().min(1).max(2000)}).strict()).max(500),
}).strict();
export type ReconstructionPlan=z.infer<typeof reconstructionSchema>;
export interface ReconstructionMaterial {
  head:SpecVersionHead;
  specs:Array<{id:string;code:string;title:string;description:string|null;version:number;domainIds:string[];priority:string;category:string;status:string;preconditions:string[];postconditions:string[]}>;
  fragments:Array<{id:string;content:string;revision:number}>;
  domains:Array<{id:string;name:string}>;
}
export interface ReconstructionProposal { id:string;material:ReconstructionMaterial;plan:ReconstructionPlan;confirmedVersion:string|null }
export interface SpecVersionLog { id:string;version:string;kind:string;payload:unknown;created_at:string }
