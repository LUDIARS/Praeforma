import { z } from 'zod';
import { contractsSchema,measurementsSchema,type Contract,type Measurement } from './spec-terms.ts';
export interface SpecVersionHead { major:number;minor:number;patch:number;revision:number }
export const versionLabel=(head:SpecVersionHead):string=>`${head.major}.${head.minor}.${head.patch}`;
export function nextSpecVersion(head:SpecVersionHead,kind:'patch'|'minor'|'major'):SpecVersionHead {
  return { major:head.major+(kind==='major'?1:0),minor:kind==='major'?0:head.minor+(kind==='minor'?1:0),patch:kind==='patch'?head.patch+1:0,revision:head.revision+1 };
}
export const reconstructionSchema=z.object({
  changes:z.array(z.object({specId:z.string().nullable(),domainId:z.string().min(1),title:z.string().trim().min(1).max(200),description:z.string().trim().min(1).max(20000),fragmentIds:z.array(z.string()).min(1).max(500),rationale:z.string().min(1).max(2000),
    // 数値計測と契約。省略は「既存のまま」、空配列は「無し」。原文の数値・条件・報酬を落とさない。
    measurements:measurementsSchema.optional(),contracts:contractsSchema.optional()}).strict()).max(100),
  deferred:z.array(z.object({fragmentId:z.string(),reason:z.string().min(1).max(2000)}).strict()).max(500),
  // 棄却: 現在の仕様に入っていない・後から覆された断片を、理由付きで処理済みにする。原文は消さない。
  rejected:z.array(z.object({fragmentId:z.string(),reason:z.string().trim().min(1).max(2000)}).strict()).max(500).optional(),
}).strict();
export type ReconstructionPlan=z.infer<typeof reconstructionSchema>;
/** 外部で作成した再構築案。対象断片を指定して分割登録できる。確定は人が画面で行う。 */
export const externalReconstructionSchema=z.object({
  fragmentIds:z.array(z.string().min(1)).min(1).max(500),
  plan:reconstructionSchema,
}).strict();
export type FragmentDispositionState='pending'|'integrated'|'rejected';
export interface FragmentDisposition { state:FragmentDispositionState;reason:string|null;version:string|null }
export interface ReconstructionMaterial {
  head:SpecVersionHead;
  specs:Array<{id:string;code:string;title:string;description:string|null;version:number;domainIds:string[];priority:string;category:string;status:string;preconditions:string[];postconditions:string[];measurements:Measurement[];contracts:Contract[]}>;
  fragments:Array<{id:string;content:string;revision:number}>;
  domains:Array<{id:string;name:string}>;
  /** PF-SPRINT-5: present when the fragments were limited to one sprint. */
  sprintId?:string;
}
/** fragmentScope があるときは、その断片だけを資料にした案 (外部登録)。無ければ未処理の全断片。 */
export interface ReconstructionProposal { id:string;material:ReconstructionMaterial;plan:ReconstructionPlan;confirmedVersion:string|null;fragmentScope?:string[] }
export interface SpecVersionLog { id:string;version:string;kind:string;payload:unknown;created_at:string }
