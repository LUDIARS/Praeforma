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

test('manual writer replies separate declared refusals from quality failures',async()=>{
  const {interpretManualResponse}=await import('../manual-response.ts');
  const {AppError}=await import('../errors.ts');
  const failure=(raw:string):InstanceType<typeof AppError>=>{try{interpretManualResponse(raw);}catch(e){assert.ok(e instanceof AppError);return e;}assert.fail('expected an error');};
  assert.deepEqual(interpretManualResponse('```json\n'+JSON.stringify(document)+'\n```'),document);
  const refused=failure(JSON.stringify({error:'選んだ後の結果が資料にありません。'}));
  assert.equal(refused.message,'manual_insufficient_material');assert.equal(refused.status,422);
  assert.deepEqual(refused.detail,{reason:'選んだ後の結果が資料にありません。'});
  assert.equal((failure(JSON.stringify({error:'あ'.repeat(5000)})).detail as {reason:string}).reason.length,1000);
  const unparsable=failure('説明できません');
  assert.equal(unparsable.message,'manual_quality_check_failed');assert.equal(unparsable.detail,undefined);
  const malformed=failure(JSON.stringify({...document,sections:[]}));
  assert.equal(malformed.message,'manual_quality_check_failed');
  assert.deepEqual(malformed.detail,{issues:['節が少なすぎます（1 個以上）。']});
  const technical=structuredClone(document);technical.purpose='APIで持ち物を確認できます。';
  assert.deepEqual(failure(JSON.stringify(technical)).detail,{issues:['「API」を身近な言葉に置き換えてください。']});
  assert.equal(failure(JSON.stringify({error:'理由',title:'混在'})).message,'manual_quality_check_failed');
});

test('manual shape failures name the place and limit without echoing the rejected text',async()=>{
  const {interpretManualResponse}=await import('../manual-response.ts');
  const {AppError}=await import('../errors.ts');
  const issuesOf=(value:unknown):unknown=>{try{interpretManualResponse(JSON.stringify(value));}catch(e){assert.ok(e instanceof AppError);return e.detail;}assert.fail('expected an error');};
  const fiveWays=structuredClone(document);
  fiveWays.diagram.steps[1]!.branches=['扉','紙','机','鞄','箱'].map(name=>({condition:`${name}を選ぶ`,result:'次の画面が開きます。'}));
  assert.deepEqual(issuesOf(fiveWays),{issues:['図の 2 段目の分岐が多すぎます（4 個まで）。']});
  const longText=structuredClone(document);longText.sections[0]!.text='秘密の文'.repeat(400);
  const detail=issuesOf(longText) as {issues:string[]};
  assert.deepEqual(detail,{issues:['1 番目の節の本文が長すぎます（1200 字まで）。']});
  assert.ok(!JSON.stringify(detail).includes('秘密の文'));
  assert.deepEqual(issuesOf({...document,extra:'x'}),{issues:['文書に決められていない項目があります。']});
  assert.deepEqual(issuesOf({...document,title:''}),{issues:['題名が空です。']});
});

test('a rejected first draft is repaired once with its issues, and refusals are not retried',async()=>{
  const {writeManual}=await import('../manual-writer.ts');
  const {AppError}=await import('../errors.ts');
  const fiveWays=structuredClone(document);
  fiveWays.diagram.steps[1]!.branches=['扉','紙','机','鞄','箱'].map(name=>({condition:`${name}を選ぶ`,result:'次の画面が開きます。'}));
  const scripted=(replies:string[])=>{const prompts:string[]=[];return {prompts,run:async(_b:string,prompt:string)=>{prompts.push(prompt);return replies.shift()??'';}};};
  const fixed=scripted([JSON.stringify(fiveWays),JSON.stringify(document)]);
  assert.deepEqual((await writeManual('unused',{a:1},fixed.run)).document,document);
  assert.equal(fixed.prompts.length,2);
  assert.ok(fixed.prompts[1]!.includes('- 図の 2 段目の分岐が多すぎます（4 個まで）。'));
  assert.ok(fixed.prompts[1]!.includes('前回の出力:\n'+JSON.stringify(fiveWays)));
  assert.ok(!fixed.prompts[0]!.includes('前回の出力'));
  const unreadable=scripted(['説明します',JSON.stringify(document)]);
  await writeManual('unused',{a:1},unreadable.run);
  assert.ok(unreadable.prompts[1]!.includes('- 出力が決められた形の JSON として読めませんでした。'));
  const twice=scripted([JSON.stringify(fiveWays),JSON.stringify(fiveWays),JSON.stringify(document)]);
  await assert.rejects(writeManual('unused',{a:1},twice.run),(e:unknown)=>e instanceof AppError&&e.message==='manual_quality_check_failed');
  assert.equal(twice.prompts.length,2);
  const refused=scripted([JSON.stringify({error:'資料が足りません。'}),JSON.stringify(document)]);
  await assert.rejects(writeManual('unused',{a:1},refused.run),(e:unknown)=>e instanceof AppError&&e.message==='manual_insufficient_material');
  assert.equal(refused.prompts.length,1);
  const crashed={calls:0,run:async()=>{crashed.calls+=1;throw new AppError('manual_generation_timeout',504);}};
  await assert.rejects(writeManual('unused',{a:1},crashed.run),(e:unknown)=>e instanceof AppError&&e.message==='manual_generation_timeout');
  assert.equal(crashed.calls,1);
});

test('the writer prompt states every shape limit the validation enforces',async()=>{
  const {buildManualPrompt}=await import('../manual-writer.ts');
  const {MANUAL_LIMITS:L}=await import('../manual-limits.ts');
  const prompt=buildManualPrompt('規則','{"material":true}');
  for(const fragment of [`title は ${L.title} 字まで`,`sections は ${L.sections.min}〜${L.sections.max} 個`,`text は ${L.text} 字まで`,
    `diagram.steps は ${L.steps.min}〜${L.steps.max} 段`,`branches は ${L.branches.max} 個まで`,`result は ${L.result} 字まで`]) assert.ok(prompt.includes(fragment),fragment);
  assert.ok(prompt.indexOf('形の上限')<prompt.indexOf('以下は参照資料'));
  assert.ok(prompt.endsWith('{"material":true}'));
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
