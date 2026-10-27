import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import type {ReconstructionPlan} from '../../../../shared/spec-versioning.ts';
process.env.PRAEFORMA_LOCAL_MODE='1';
test('PF-SPRINT-9 applyDecision moves rejected changes to rejected fragments',async()=>{
  const {applyDecision}=await import('../reconstruction-decision.ts');
  const change=(id:string)=>({specId:null,domainId:'d',title:id,description:id,fragmentIds:[id],rationale:'r'});
  const plan:ReconstructionPlan={changes:[change('a'),change('b')],deferred:[{fragmentId:'c',reason:'later'}],rejected:[{fragmentId:'e',reason:'old'}]};
  const decided=applyDecision(plan,{rejectedChanges:[{index:1,reason:'not now'}]});
  assert.deepEqual(decided.changes.map(c=>c.title),['a']);
  assert.deepEqual(decided.rejected,[{fragmentId:'e',reason:'old'},{fragmentId:'b',reason:'not now'}]);
  assert.deepEqual(decided.deferred,plan.deferred);
  assert.throws(()=>applyDecision(plan,{rejectedChanges:[{index:2,reason:'x'}]}));
  assert.throws(()=>applyDecision(plan,{rejectedChanges:[{index:0,reason:'x'},{index:0,reason:'y'}]}));
});
test('PF-SPRINT-9 decides a sprint proposal per change',async()=>{
  const {initLocalDb,getDb,getLocalSqlite}=await import('../../db/connection.ts');
  const {projects,projectMembers}=await import('../../db/schema/project.ts');
  const {domains}=await import('../../db/schema/domain.ts');
  const {enableLocalAuth}=await import('../../middleware/require-auth.ts');
  const {makeSpecFragmentRouter}=await import('../../routes/spec-fragments.ts');
  const {makeSpecVersionRouter}=await import('../../routes/spec-versions.ts');
  const {makeSpecSprintRouter}=await import('../../routes/spec-sprints.ts');
  const {versionRows}=await import('../../db/spec-version-store.ts');
  const {AppError}=await import('../errors.ts');
  const state=await initLocalDb(':memory:');assert.equal(state.ok,true,state.error??undefined);
  const sqlite=getLocalSqlite() as unknown as {close():void};
  try{
    const identify=(userId:string)=>enableLocalAuth({userId,displayName:null,role:'user',projectKey:null});identify('author');
    await getDb().insert(projects).values([{id:'p',name:'One',orgId:'test',ownerUserId:'author'},{id:'q',name:'Two',orgId:'test',ownerUserId:'author'}]);
    await getDb().insert(projectMembers).values([{id:'a',projectId:'p',userId:'author',role:'owner'},{id:'b',projectId:'q',userId:'author',role:'owner'},{id:'c',projectId:'p',userId:'reader',role:'viewer'}]);
    await getDb().insert(domains).values({id:'d',projectId:'p',name:'Town'});
    const app=new Hono();app.onError(e=>new Response(JSON.stringify({error:e.message}),{status:e instanceof AppError?e.status:500}));
    app.route('/projects/:pid/spec-fragments',makeSpecFragmentRouter());
    app.route('/projects/:pid/spec-sprints',makeSpecSprintRouter());
    // One change per fragment except the last, which is deferred.
    app.route('/projects/:pid/spec-versions',makeSpecVersionRouter('unused',async(_binary,material):Promise<ReconstructionPlan>=>{
      const [last,...rest]=[...material.fragments].reverse();
      return {changes:rest.reverse().map(f=>({specId:null,domainId:'d',title:f.content,description:f.content,fragmentIds:[f.id],rationale:'Sprint'})),deferred:[{fragmentId:last!.id,reason:'later'}]};
    }));
    const send=(method:string,path:string,body?:unknown)=>app.request(path,{method,...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});
    const fragment=async(content:string,n:number)=>((await (await send('POST','/projects/p/spec-fragments',{content,sourceEventId:`00000000-0000-4000-8000-00000000000${n}`})).json()) as {fragment:{id:string}}).fragment;
    const [signs,mouse,pad,ext]=[await fragment('Signs',1),await fragment('Mouse',2),await fragment('Pad',3),await fragment('External',4)];
    const sprint=(await (await send('POST','/projects/p/spec-sprints',{title:'Town',fragmentIds:[signs.id,mouse.id,pad.id]})).json() as {sprint:{id:string}}).sprint;
    const pending=async(sid:string,pid='p')=>await send('GET',`/projects/${pid}/spec-versions/reconstructions?sprintId=${sid}`);
    assert.deepEqual(await (await pending(sprint.id)).json(),{proposal:null});
    assert.equal((await pending(sprint.id,'q')).status,404);
    // A project-wide external proposal does not belong to the sprint until all its fragments are in it.
    const external=await send('POST','/projects/p/spec-versions/reconstructions/external',{fragmentIds:[ext.id],plan:{changes:[{specId:null,domainId:'d',title:'Ext',description:'Ext',fragmentIds:[ext.id],rationale:'r'}],deferred:[]}});
    assert.equal(external.status,201);
    const other=(await (await send('POST','/projects/p/spec-sprints',{title:'Ext'})).json() as {sprint:{id:string}}).sprint;
    assert.deepEqual(await (await pending(other.id)).json(),{proposal:null});
    assert.equal((await send('POST',`/projects/p/spec-sprints/${other.id}/fragments`,{fragmentIds:[ext.id]})).status,200);
    const externalId=((await external.json()) as {proposal:{id:string}}).proposal.id;
    assert.equal(((await (await pending(other.id)).json()) as {proposal:{id:string}}).proposal.id,externalId);
    // Rejecting every change is allowed and still confirms the proposal. Confirming first keeps the next proposal's material current.
    assert.equal((await send('POST',`/projects/p/spec-versions/reconstructions/${externalId}/decide`,{rejectedChanges:[{index:0,reason:'Dropped'}]})).status,200);
    const dropped=await versionRows('SELECT disposition FROM spec_reconstruction_fragments WHERE fragment_id=?',[ext.id]);
    assert.deepEqual(dropped.map(r=>r.disposition),['rejected']);
    const created=(await (await send('POST','/projects/p/spec-versions/reconstructions',{sprintId:sprint.id})).json() as {proposal:{id:string;plan:ReconstructionPlan}}).proposal;
    const found=(await (await pending(sprint.id)).json() as {proposal:{id:string;plan:ReconstructionPlan}}).proposal;
    assert.equal(found.id,created.id);assert.equal(found.plan.changes.length,2);
    const rejectIndex=found.plan.changes.findIndex(c=>c.fragmentIds[0]===mouse.id);
    const decide=(rid:string,body:unknown)=>send('POST',`/projects/p/spec-versions/reconstructions/${rid}/decide`,body);
    assert.equal((await decide(created.id,{rejectedChanges:[{index:5,reason:'x'}]})).status,400);
    assert.equal((await decide(created.id,{rejectedChanges:[{index:rejectIndex,reason:' '}]})).status,400);
    identify('reader');
    assert.equal((await decide(created.id,{rejectedChanges:[]})).status,403);
    assert.equal((await pending(sprint.id)).status,403);
    identify('author');
    const response=await decide(created.id,{rejectedChanges:[{index:rejectIndex,reason:'Not for PC'}]});
    assert.equal(response.status,200);assert.match(((await response.json()) as {version:string}).version,/^\d+\.\d+\.0$/);
    const rows=await versionRows('SELECT fragment_id,disposition,reason FROM spec_reconstruction_fragments WHERE reconstruction_id=? ORDER BY disposition',[created.id]);
    assert.deepEqual(rows.map(r=>[r.fragment_id,r.disposition,r.reason??null]),[[signs.id,'integrated',null],[mouse.id,'rejected','Not for PC']]);
    const specs=await versionRows("SELECT title FROM specs WHERE project_id='p' ORDER BY title",[]);
    assert.deepEqual(specs.map(s=>s.title),['Signs']);
    assert.equal((await decide(created.id,{rejectedChanges:[]})).status,409);
    assert.deepEqual(await (await pending(sprint.id)).json(),{proposal:null});
  }finally{sqlite.close();}
});
