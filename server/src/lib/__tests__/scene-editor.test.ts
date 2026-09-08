import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { runtimeSnapshotSchema, canvasFromRuntime, sceneSaveSchema, type RuntimeSnapshot } from '../../../../shared/scene-editor.ts';

process.env.PRAEFORMA_LOCAL_MODE='1';
const snapshot:RuntimeSnapshot={version:1,source:'menu',capturedAt:'2026-09-08T00:00:00Z',viewport:{width:1280,height:720},nodes:[{id:'start',parentId:null,label:'Start',kind:'button',bounds:{x:20,y:30,width:80,height:40},ontologyRef:'menu/start',sampleText:null}]};
test('PF-SCENE-3 runtime import rejects duplicate, cyclic and unknown parent nodes and preserves coordinates',()=>{
  assert.equal(runtimeSnapshotSchema.safeParse(snapshot).success,true);
  assert.equal(runtimeSnapshotSchema.safeParse({...snapshot,nodes:[snapshot.nodes[0],snapshot.nodes[0]]}).success,false);
  assert.equal(runtimeSnapshotSchema.safeParse({...snapshot,nodes:[{...snapshot.nodes[0],parentId:'start'}]}).success,false);
  assert.equal(runtimeSnapshotSchema.safeParse({...snapshot,nodes:[{...snapshot.nodes[0],parentId:'unknown'}]}).success,false);
  const {revision,...canvas}=canvasFromRuntime(snapshot,'f');
  assert.equal(canvas.elements[0]?.x,20);assert.equal(canvas.elements[0]?.dynamic?.source,'start');
  assert.equal(sceneSaveSchema.safeParse({canvas:{...canvas,expected_revision:revision},sources:[]}).success,true);
  assert.equal(sceneSaveSchema.safeParse({canvas:{...canvas,expected_revision:revision},sources:[{id:'s',frameId:'unknown',fingerprint:null,image:null,runtime:snapshot,notes:[]}]}).success,false);
});
test('PF-SCENE-5/6 scenes preserve saves, reject stale writes and isolate projects and roles',async()=>{
  const {initLocalDb,getDb,getLocalSqlite}=await import('../../db/connection.ts');
  const {projects,projectMembers}=await import('../../db/schema/project.ts');
  const {layouts}=await import('../../db/schema/layout.ts');
  const {enableLocalAuth}=await import('../../middleware/require-auth.ts');
  const {makeSceneEditorRouter}=await import('../../routes/scene-editor.ts');
  const {AppError}=await import('../errors.ts');
  const state=await initLocalDb(':memory:');assert.equal(state.ok,true,state.error??undefined);
  const sqlite=getLocalSqlite() as unknown as {close():void};
  try {
    const identify=(userId:string)=>enableLocalAuth({userId,displayName:null,role:'user',projectKey:null});identify('author');
    await getDb().insert(projects).values([{id:'p',name:'One',orgId:'test',ownerUserId:'author'},{id:'q',name:'Two',orgId:'test',ownerUserId:'author'}]);
    await getDb().insert(projectMembers).values([{id:'a',projectId:'p',userId:'author',role:'owner'},{id:'b',projectId:'q',userId:'author',role:'owner'},{id:'c',projectId:'p',userId:'reader',role:'viewer'}]);
    await getDb().insert(layouts).values({id:'scene',projectId:'p',name:'Menu',kind:'ui-2d'});
    const app=new Hono();app.onError(e=>new Response(JSON.stringify({error:e.message}),{status:e instanceof AppError?e.status:500}));
    app.route('/projects/:pid/layouts/:lid/scene-editor',makeSceneEditorRouter('unused'));
    const route='/projects/p/layouts/scene/scene-editor';
    const {revision,...canvas}=canvasFromRuntime(snapshot,'f');const body={canvas:{...canvas,expected_revision:revision},sources:[]};
    const save=(path:string,input:unknown)=>app.request(path,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
    assert.equal((await app.request(route)).status,200);
    assert.equal((await app.request('/projects/q/layouts/scene/scene-editor')).status,404);
    assert.equal((await save('/projects/q/layouts/scene/scene-editor',body)).status,404);
    assert.equal((await save(route,body)).status,200);
    assert.equal((await save(route,body)).status,409);
    assert.equal((await save(route,{...body,canvas:{...body.canvas,expected_revision:1}})).status,200);
    const saved=await (await app.request(route)).json() as {document:{canvas:{revision:number}}};assert.equal(saved.document.canvas.revision,2);
    identify('reader');assert.equal((await app.request(route)).status,200);
    assert.equal((await save(route,body)).status,403);
    assert.equal((await app.request(`${route}/analyze`,{method:'POST'})).status,403);
    identify('author');await getDb().update(layouts).set({deletedAt:new Date()}).where(eq(layouts.id,'scene'));
    assert.equal((await app.request(route)).status,404);
    assert.equal((await save(route,{...body,canvas:{...body.canvas,expected_revision:2}})).status,404);
  } finally {sqlite.close();}
});
