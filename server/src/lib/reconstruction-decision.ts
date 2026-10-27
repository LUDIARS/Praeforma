/** PF-SPRINT-9: find a sprint's pending proposal and apply per-change accept/reject decisions. */
import type { ReconstructionPlan,ReconstructionProposal,ReconstructionDecision } from '../../../shared/spec-versioning.ts';
import { versionRows,parseStored } from '../db/spec-version-store.ts';
import { AppError } from './errors.ts';

const PENDING_SCAN_LIMIT=50;

/** The latest unconfirmed proposal generated for the sprint, or registered externally for fragments all inside it. */
export async function sprintProposal(pid:string,sid:string):Promise<ReconstructionProposal|null> {
  const members=new Set((await versionRows('SELECT fragment_id FROM spec_sprint_fragments WHERE sprint_id=?',[sid])).map(row=>String(row.fragment_id)));
  const rows=await versionRows(`SELECT payload FROM spec_reconstructions WHERE project_id=? AND confirmed_version IS NULL ORDER BY id DESC LIMIT ${PENDING_SCAN_LIMIT}`,[pid]);
  for(const row of rows){
    const proposal=parseStored<ReconstructionProposal>(row.payload);
    if(proposal.material.sprintId===sid)return proposal;
    if(!proposal.material.sprintId&&proposal.fragmentScope?.length&&proposal.fragmentScope.every(id=>members.has(id)))return proposal;
  }
  return null;
}

/** Rejected changes leave the plan; their fragments become rejected with the given reason. Accepted changes stay as proposed. */
export function applyDecision(plan:ReconstructionPlan,decision:ReconstructionDecision):ReconstructionPlan {
  const reasons=new Map<number,string>();
  for(const item of decision.rejectedChanges){
    if(item.index>=plan.changes.length||reasons.has(item.index))throw AppError.badRequest('invalid_reconstruction_decision');
    reasons.set(item.index,item.reason);
  }
  const rejected=plan.changes.flatMap((change,index)=>{const reason=reasons.get(index);return reason===undefined?[]:change.fragmentIds.map(fragmentId=>({fragmentId,reason}));});
  return {...plan,changes:plan.changes.filter((_,index)=>!reasons.has(index)),rejected:[...plan.rejected??[],...rejected]};
}
