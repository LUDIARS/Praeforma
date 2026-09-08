import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { ManualDocument, ManualRecord } from '../../../../shared/feature-manual.ts';

process.env.PRAEFORMA_LOCAL_MODE='1';
const document:ManualDocument={title:'持ち物を見る',purpose:'集めた品物を確認できます。',sections:[{heading:'使い方',text:'持ち物を押すと一覧が開きます。'}],
  diagram:{caption:'品物を確認する流れ',steps:[{label:'持ち物を押す',branches:[]},{label:'一覧を見る',branches:[{condition:'品物がないとき',result:'まだありませんと表示します。'}]}]}};

test('manual quality validation covers figure labels and requires a useful diagram',async()=>{
  const {manualDocumentSchema}=await import('../manual-input.ts');
  assert.equal(manualDocumentSchema.safeParse(document).success,true);
  assert.equal(manualDocumentSchema.safeParse({...document,diagram:{caption:'流れ',steps:[]}}).success,false);
  const technical=structuredClone(document);technical.diagram.steps[1]!.label='APIでDBから取得';
  assert.equal(manualDocumentSchema.safeParse(technical).success,false);
  assert.equal(manualDocumentSchema.safeParse({...document,purpose:'<script>alert(1)</script>'}).success,false);
});

test('manual proposals preserve edits, enforce scope and revisions, and detect changed evidence',async()=>{
  const {initLocalDb,getDb,getLocalSqlite}=await import('../../db/connection.ts');
  const {projects,projectMembers}=await import('../../db/schema/project.ts');
  const {specs}=await import('../../db/schema/spec.ts');
  const {enableLocalAuth}=await import('../../middleware/require-auth.ts');
  const {makeManualRouter}=await import('../../routes/manuals.ts');
  const {loadManualSkill}=await import('../manual-writer.ts');
  const {AppError}=await import('../errors.ts');
  const state=await initLocalDb(':memory:');assert.equal(state.ok,true,state.error??undefined);
  const close=getLocalSqlite() as unknown as {close():void};
  try{
    const identify=(userId:string):void=>enableLocalAuth({userId,displayName:null,role:'user',projectKey:null});
    identify('author');
    await getDb().insert(projects).values([{id:'p',name:'One',orgId:'test',ownerUserId:'author'},{id:'other',name:'Two',orgId:'test',ownerUserId:'author'}]);
    await getDb().insert(projectMembers).values([{id:'a',projectId:'p',userId:'author',role:'owner'},{id:'b',projectId:'other',userId:'author',role:'owner'},{id:'c',projectId:'p',userId:'reader',role:'viewer'}]);
    await getDb().insert(specs).values([{id:'s',projectId:'p',code:'S',title:'持ち物',createdBy:'author'},{id:'foreign',projectId:'other',code:'F',title:'Private',createdBy:'author'}]);
    let fail=false;
    let duringGeneration:(()=>Promise<void>)|undefined;
    const app=new Hono();app.onError(e=>new Response(JSON.stringify({error:e.message}),{status:e instanceof AppError?e.status:500}));
    app.route('/projects/:pid/manuals',makeManualRouter('unused',async()=>{
      if(fail)throw new AppError('manual_generation_failed',502);
      await duringGeneration?.();
      return {document:structuredClone(document),skillDigest:(await loadManualSkill()).digest};
    }));
    const request=(path:string,method:string,body:unknown)=>app.request(path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const id=randomUUID();const input={id,expectedRevision:0,specId:'s',implementation:{reference:'inventory',version:'v1',content:'function openInventory() { showItems(); }'}};
    const read=async():Promise<{manual:ManualRecord}> => await (await app.request(`/projects/p/manuals/${id}`)).json() as {manual:ManualRecord};
    assert.equal((await request('/projects/p/manuals/generate','POST',{...input,specId:'foreign'})).status,404);
    assert.equal((await request('/projects/p/manuals/generate','POST',input)).status,201);
    assert.equal((await request('/projects/p/manuals/generate','POST',input)).status,409);
    identify('reader');
    assert.equal((await app.request(`/projects/p/manuals/${id}`)).status,404);
    assert.equal((await request('/projects/p/manuals/generate','POST',{...input,id:randomUUID()})).status,403);
    identify('author');
    const edited={...document,purpose:'持ち物を確認し、次に使う品物を選べます。'};
    const save={expectedRevision:1,basis:'proposal',document:edited};
    assert.equal((await request(`/projects/other/manuals/${id}`,'PUT',save)).status,404);
    assert.equal((await request(`/projects/p/manuals/${id}`,'PUT',save)).status,200);
    assert.equal((await request(`/projects/p/manuals/${id}`,'PUT',save)).status,409);
    fail=true;
    assert.equal((await request('/projects/p/manuals/generate','POST',{...input,expectedRevision:2})).status,502);
    let response=await read();
    assert.equal(response.manual.revision,2);assert.deepEqual(response.manual.document,edited);
    fail=false;
    assert.equal((await request('/projects/p/manuals/generate','POST',{...input,expectedRevision:2,implementation:{...input.implementation,version:'v2'}})).status,201);
    response=await read();
    assert.deepEqual(response.manual.document,edited);assert.equal(response.manual.freshness,'outdated');
    identify('reader');response=await read();
    assert.deepEqual(response.manual.document,edited);assert.equal(response.manual.source,undefined);assert.equal(response.manual.proposal,undefined);
    assert.equal((await request(`/projects/p/manuals/${id}`,'PUT',{...save,expectedRevision:3})).status,403);
    identify('author');
    duringGeneration=async()=>{
      assert.equal((await request(`/projects/p/manuals/${id}`,'PUT',{...save,expectedRevision:3})).status,200);
    };
    assert.equal((await request('/projects/p/manuals/generate','POST',{...input,expectedRevision:3})).status,409);
    duringGeneration=undefined;
    response=await read();assert.equal(response.manual.revision,4);assert.deepEqual(response.manual.document,edited);
    await getDb().update(specs).set({description:'changed'}).where(eq(specs.id,'s'));
    assert.equal((await request(`/projects/p/manuals/${id}`,'PUT',{...save,expectedRevision:4})).status,409);
    response=await read();assert.equal(response.manual.freshness,'outdated');
    await getDb().update(projects).set({deletedAt:new Date()}).where(eq(projects.id,'p'));
    assert.equal((await app.request(`/projects/p/manuals/${id}`)).status,404);
  }finally{close.close();}
});
