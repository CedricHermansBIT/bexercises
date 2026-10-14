const test=require('node:test');
const assert=require('node:assert/strict');
const sqlite3=require('sqlite3');
const {open}=require('sqlite');
const database=require('../services/databaseService');
const exercises=require('../services/exerciseService');
const {exerciseSchema}=require('../mcp/server');
const {extractDescriptionStarter,validateStarterCode}=require('../services/exerciseStarterService');

test('starter templates round trip, inherit, preserve omitted edits, and allow intentional blank code',async()=>{
 const original=database.db;
 database.db=await open({filename:':memory:',driver:sqlite3.Database});database.cache.clear();
 try {
  await database.createTables();
  await database.createLanguage({id:'python',name:'Python',code_template:'# language template\n'});
  await database.createChapter({id:'starter-chapter',language_id:'python',name:'Starters'});
  await database.createExercise({id:'starter-ex',chapter_id:'starter-chapter',title:'Starter',solution:'print(1)',testCases:[{expectedOutput:'1'}]});
  assert.equal((await exercises.getExerciseById('starter-ex')).code_template,'# language template\n');
  const scaffold='def double(value):\n    pass\n';
  await database.updateExercise('starter-ex',{starter_code:scaffold});
  assert.equal((await exercises.getExerciseById('starter-ex')).code_template,scaffold);
  assert.equal((await exercises.getExerciseWithTests('starter-ex')).starter_code,scaffold);
  await database.updateExercise('starter-ex',{title:'Retitled',testCases:[{expectedOutput:'2'}]});
  assert.equal((await exercises.getExerciseById('starter-ex')).starter_code,scaffold);
  await database.updateExercise('starter-ex',{starter_code:''});
  assert.equal((await exercises.getExerciseById('starter-ex')).code_template,'');
  await database.updateExercise('starter-ex',{starter_code:null});
  assert.equal((await exercises.getExerciseById('starter-ex')).code_template,'# language template\n');
  await assert.rejects(database.updateExercise('starter-ex',{starter_code:123}),/text or null/);
  await assert.rejects(database.updateExercise('starter-ex',{starter_code:'é'.repeat(40000)}),/64 KiB/);
  assert.equal((await database.getExercise('starter-ex')).title,'Retitled');
 }finally{database.cache.clear();await database.db.close();database.db=original;}
});

test('MCP retains starter metadata and explicit starter blocks are extracted without copying examples',()=>{
 const raw={id:'starter',title:'Starter',language_id:'python',chapter:'Basics',description:'Task',solution:'print(1)',testCases:[{}]};
 assert.equal(exerciseSchema.parse({...raw,starter_code:''}).starter_code,'');
 assert.equal(exerciseSchema.parse({...raw,starter_code:null}).starter_code,null);
 assert.equal(exerciseSchema.parse(raw).starter_code,undefined);
 const description='### Example\n```python\nprint("solution example")\n```\n\n### Starter code\n```python\ndef f():\n    pass\n```\n\nDifficulty: easy.';
 const result=extractDescriptionStarter(description);
 assert.equal(result.starter_code,'def f():\n    pass\n');
 assert.ok(result.description.includes('print("solution example")'));
 assert.ok(!result.description.includes('def f()'));
 assert.ok(result.description.includes('Difficulty: easy.'));
 assert.equal(extractDescriptionStarter(result.description),null);
 assert.equal(extractDescriptionStarter('### Hint\n```python\nprint("not a starter")\n```'),null);
 assert.equal(extractDescriptionStarter('### Starter code\r\n```python\r\na = 1\r\n```').starter_code,'a = 1\n');
 assert.throws(()=>validateStarterCode({}),/text or null/);
});

test('workspace starts and resets with exercise scaffolding while preserving local and server drafts',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const node={style:{}};
 const context=vm.createContext({console,confirm:()=>true,setTimeout:fn=>fn(),window:{history:{replaceState(){}}},
  document:{getElementById:()=>node,querySelector:()=>node,addEventListener(){}}});
 vm.runInContext(fs.readFileSync('frontend/js/pages/workspacePage.js','utf8').replace(/^import .*;\r?\n/gm,'')+'\n globalThis.Page=WorkspacePage;',context);
 for(const [starter,local,server,expected] of [
  ['# scaffold',null,null,'# scaffold'],['',null,null,''],[null,null,null,'# language'],
  ['# scaffold',null,{code:'server work'},'server work'],
  ['# scaffold',{code:'local work',lastModified:'2026-10-09T12:00:00Z'},{code:'older server work',updatedAt:'2026-10-08T12:00:00Z'},'local work'],
  ['# scaffold',null,{code:''},'']]) {
  const page=Object.create(context.Page.prototype);let actual;
  page.apiService={getExercise:async()=>({id:'ex',title:'Exercise',language_id:'python',code_template:'# language',starter_code:starter}),getExerciseDraft:async()=>server};
  page.storageService={getExerciseProgress:()=>local,syncExerciseProgress(){}};
  page.codeEditor={setValue:value=>{actual=value;},setOption(){},refresh(){}};
  page.testResults={displayNoResults(){},displayError:message=>{throw new Error(message);}};
  for(const method of ['loadFixtures','loadDatabaseSchema','updateCompletionStatus','hideNextExerciseCta','loadChapterExercises','updateNavigationButtons','loadStatistics','queueDraftSave','updateProgress'])page[method]=()=>{};
  await page.loadExercise('ex');assert.equal(actual,expected);
  await page.resetCode();assert.equal(actual,starter ?? '# language');
 }
});
