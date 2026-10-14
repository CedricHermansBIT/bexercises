// Verify the complete course bank before atomically publishing it.
// Usage: node src/scripts/publishPythonCourse.js --fixtures /absolute/staged/fixtures
// Add --save to publish. --resume reuses checks only when draft, fixtures and image match.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sqlite3 = require('sqlite3');
const {open} = require('sqlite');
const database = require('../services/databaseService');
const config = require('../config');
const {prepareExercise} = require('../mcp/authoringService');
const {exerciseSchema} = require('../mcp/server');
const {runTests} = require('../services/testRunner');
const images = require('../config/runtimeImages');
const drafts = require('../exercise-drafts/python-course-content/bank.json');
const chapters = require('../exercise-drafts/python-course-content/chapters.json');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const normalize = value => String(value ?? '').replace(/\r\n/g, '\n').trim();
async function files(root, directory = '') {
 const output = [];
 for(const item of await fs.readdir(path.join(root,directory), {withFileTypes:true})) {
  const name = path.posix.join(directory,item.name);
  if(item.isSymbolicLink()) throw new Error(`Symlink fixture rejected: ${name}`);
  if(item.isDirectory()) { output.push({name,type:'folder'}); output.push(...await files(root,name)); }
  else {const bytes=await fs.readFile(path.join(root,name)); output.push({name,type:'file',size:bytes.length,sha256:hash(bytes)});}
 }
 return output.sort((a,b)=>a.name.localeCompare(b.name));
}
async function snapshot(db) {
 return {
  chapters:await db.all('SELECT * FROM chapters WHERE language_id=? ORDER BY id','python'),
  exercises:await db.all('SELECT e.* FROM exercises e JOIN chapters c ON c.id=e.chapter_id WHERE c.language_id=? ORDER BY e.id','python'),
  tests:await db.all('SELECT t.* FROM test_cases t JOIN exercises e ON e.id=t.exercise_id JOIN chapters c ON c.id=e.chapter_id WHERE c.language_id=? ORDER BY t.id','python'),
  fixtures:await db.all('SELECT f.* FROM test_case_fixtures f JOIN test_cases t ON t.id=f.test_case_id JOIN exercises e ON e.id=t.exercise_id JOIN chapters c ON c.id=e.chapter_id WHERE c.language_id=? ORDER BY f.test_case_id,f.fixture_id','python')
 };
}
async function main() {
 const ix = process.argv.indexOf('--fixtures');
 if(ix<0 || !process.argv[ix+1])throw new Error('Supply --fixtures /absolute/staged/fixtures');
 const staging = await fs.realpath(process.argv[ix+1]);
 if(staging===await fs.realpath(config.paths.fixtures))throw new Error('Use a separate staged fixture directory');
 const fileList=await files(staging);
 if(!fileList.length || fileList.some(f=>!f.name.startsWith('python-course/') && f.name!=='python-course'))throw new Error('Only isolated python-course fixtures may be published');
 const fixtureDigest=hash(JSON.stringify(fileList));
 const db=await open({filename:path.join(__dirname,'../../data/exercises.db'),driver:sqlite3.Database});
 database.db=db;
 const originalFixtures=config.paths.fixtures, originalGetFixture=database.getFixtureFile, originalGetLanguage=database.getLanguage;
 const cachePath=path.join(staging,'../verified.json');
 let copied=false,committed=false;
 try {
  await db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000');
  const before=await snapshot(db);
  const priorForeignKeyIssues=new Set((await db.all('PRAGMA foreign_key_check')).map(issue=>JSON.stringify(issue)));
  const language=await originalGetLanguage.call(database,'python');
  if(!language || language.docker_image!==images.python)throw new Error('Activate the pinned course runtime first');
  const targetIds=new Set(drafts.map(d=>d.id));
  if(targetIds.size!==drafts.length)throw new Error('Duplicate exercise IDs');
  for(const ex of before.exercises)if(!targetIds.has(ex.id))throw new Error(`Existing exercise not explicitly incorporated: ${ex.id}`);
  for(const ch of chapters){const existing=await database.getChapter(ch.id);if(existing && existing.language_id!=='python')throw new Error('Chapter ID belongs to another language');}
  for(const d of drafts){const existing=await database.getExerciseWithTests(d.id);if(existing && (await database.getChapter(existing.chapter_id)).language_id!=='python')throw new Error('Exercise ID belongs to another language');}
  config.paths.fixtures=staging;
  database.getFixtureFile=async name=>{
   const item=fileList.find(f=>f.name===name);
   if(!item)throw new Error(`Unknown staged fixture: ${name}`);
   return {filename:name,type:item.type,permissions:item.type==='folder'?'rwxr-xr-x':'rw-r--r--'};
  };
  database.getLanguage=async id=>id==='python'?{...language,docker_image:images.python}:originalGetLanguage.call(database,id);
  let cached={};
  if(process.argv.includes('--resume'))try{cached=JSON.parse(await fs.readFile(cachePath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const prepared=[];
  let cacheWrites=Promise.resolve();
  async function verifyOne(raw) {
   const key=hash(JSON.stringify(raw)+fixtureDigest+images.python);
   if(cached[raw.id]?.key===key){console.log(JSON.stringify({id:raw.id,reusedVerified:true}));return cached[raw.id].exercise;}
   const draft=exerciseSchema.parse(raw);
   const verified=await prepareExercise(draft);
   for(let i=0;i<raw.testCases.length;i++) {
    const tc=raw.testCases[i], result=verified.verification[i];
    if(normalize(result.actualOutput)!==normalize(tc.oracle) || normalize(result.actualStderr)!==normalize(tc.oracleStderr) || result.exitCode!==(tc.oracleExit ?? 0))throw new Error(`Independent expected result mismatch: ${raw.id} test ${i+1}: ${JSON.stringify({output:result.actualOutput,expected:tc.oracle,stderr:result.actualStderr,exit:result.exitCode})}`);
   }
   // A clean wrong answer must fail. Artifacts must not be accepted merely because stdout matches.
   const wrong=draft.testCases[0].functionTest
    ? `def ${draft.testCases[0].functionTest.name}(*args, **kwargs):\n    return "wrong answer"\n`
    : draft.testCases[0].outputFiles.length ? 'pass\n' : 'print("wrong answer")\n';
   const results=await runTests({...verified.exercise,testCases:verified.exercise.testCases.slice(0,1)},wrong);
   if(results.length!==1 || results[0].passed || results[0].configurationError || results[0].error || results[0].exitCode!==0)throw new Error(`Incorrect candidate check failed: ${raw.id}`);
   if(draft.testCases[0].outputFiles.length) {
    const tc=draft.testCases[0], kind=tc.artifactChecks[0]?.kind;
    let faulty=draft.solution;
    if(kind==='xlsx')faulty += `from openpyxl import load_workbook\nw = load_workbook(${JSON.stringify(tc.outputFiles[0])})\nw.active["B2"] = "incorrect"\nw.save(${JSON.stringify(tc.outputFiles[0])})\n`;
    else if(kind==='docx')faulty=faulty.replace('level=1','level=2');
    else if(kind==='pdf')faulty=faulty.replace('40, 240','80, 240');
    else if(kind==='plot')faulty=faulty.replace('plt.bar(["A", "B"], values)','plt.bar(["A", "B"], [values[0]+2, values[1]])');
    else if(kind==='image')faulty += `from PIL import Image\np = ${JSON.stringify(tc.outputFiles[0])}\nim = Image.open(p).convert("RGBA")\nr,g,b,a = im.getpixel((0,0))\nim.putpixel((0,0), ((r+1)%256,g,b,a))\nim.save(p)\n`;
    else if(kind==='sqlite')faulty=`print(${JSON.stringify(raw.testCases[0].oracle)})\n`;
    else {
     const target=tc.outputFiles.find(name=>name.includes('.') && name!=='selected');
     if(!target)throw new Error('Need a corrupt-file candidate');
     faulty += `with open(${JSON.stringify(target)}, "a", encoding="utf-8") as target:\n    target.write("incorrect")\n`;
    }
    const corrupt=await runTests({...verified.exercise,testCases:verified.exercise.testCases.slice(0,1)},faulty);
    if(corrupt.length!==1 || corrupt[0].passed || corrupt[0].configurationError || corrupt[0].error || corrupt[0].exitCode!==0 || normalize(corrupt[0].actualOutput)!==normalize(raw.testCases[0].oracle))throw new Error(`Wrong file with matching stdout was not cleanly rejected: ${raw.id}`);
   }
   cached[raw.id]={key,exercise:verified.exercise};
   cacheWrites=cacheWrites.then(()=>fs.writeFile(cachePath,JSON.stringify(cached,null,2)));
   await cacheWrites;
   console.log(JSON.stringify({id:raw.id,referenceTests:verified.verification.length,exampleAndBoundaryChecks:true,wrongAnswerRejected:true}));
   return verified.exercise;
  }
  // Two isolated reference runners at a time; retain the declared chapter order.
  for(let start=0;start<drafts.length;start+=2) {
   const checks=await Promise.allSettled(drafts.slice(start,start+2).map(verifyOne));
   for(const check of checks)if(check.status==='rejected')throw check.reason;
   prepared.push(...checks.map(check=>check.value));
  }
  config.paths.fixtures=originalFixtures;database.getFixtureFile=originalGetFixture;
  if(!process.argv.includes('--save')){console.log(JSON.stringify({verified:prepared.length,cachePath,published:false}));return;}
  const backupDir=await fs.mkdtemp(path.join(__dirname,'../../data/python-course-backup-'));
  await fs.chmod(backupDir,0o700);
  const backup=path.join(backupDir,'exercises.db');await db.run('VACUUM INTO ?',backup);await fs.chmod(backup,0o600);
  await fs.writeFile(path.join(backupDir,'python-before.json'),JSON.stringify(before,null,2),{mode:0o600});
  const destination=path.join(originalFixtures,'python-course');
  try{await fs.access(destination);throw new Error('Course fixtures already exist; refusing to overwrite');}catch(error){if(error.code!=='ENOENT')throw error;}
  // Hold the write lock while checking the prior bank and inserting chapters/tests.
  await db.exec('BEGIN IMMEDIATE');
  try {
   if(hash(JSON.stringify(await snapshot(db)))!==hash(JSON.stringify(before)))throw new Error('Python content changed while verification ran; rerun before publishing');
   await fs.cp(path.join(staging,'python-course'),destination,{recursive:true,errorOnExist:true,force:false});copied=true;
   for(const f of fileList){
    const existing=await originalGetFixture.call(database,f.name);if(existing)throw new Error(`Fixture already registered: ${f.name}`);
    let content=null;
    if(f.type==='file' && /\.(txt|csv|tsv|py|json|xml|html|count)$/.test(f.name))content=await fs.readFile(path.join(staging,f.name),'utf8');
    await db.run('INSERT INTO fixture_files(filename,type,content,size,permissions,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)',[f.name,f.type,content,f.size||0,f.type==='folder'?'rwxr-xr-x':'rw-r--r--']);
   }
   for(const chapter of chapters) {
    const existing=await database.getChapter(chapter.id);
    if(existing)await database.updateChapter(chapter.id,chapter);else await database.createChapter(chapter);
   }
   for(const draft of prepared) {
    const chapter=chapters.find(c=>c.name===draft.chapter);
    const data={...draft,chapter_id:chapter.id,order_num:draft.order};
    await database.validateFunctionTests(data);await database.validateFixtureReferences(data.testCases);
    if(await database.getExerciseWithTests(draft.id))await database.updateExerciseInTransaction(draft.id,data);
    else await database.createExerciseInTransaction(data);
   }
   for(const old of before.chapters)if(!chapters.some(c=>c.id===old.id)) {
    const occupied=await db.get('SELECT count(*) n FROM exercises WHERE chapter_id=?',old.id);
    if(occupied.n)throw new Error('Old chapter still has exercises');
    await database.deleteChapter(old.id);
   }
   const violations=await db.all('PRAGMA foreign_key_check');
   if(violations.some(issue=>!priorForeignKeyIssues.has(JSON.stringify(issue))))throw new Error('Publication introduced a foreign-key violation');
   await db.exec('COMMIT');committed=true;
  }catch(error){await db.exec('ROLLBACK');throw error;}
  const after=await snapshot(db);
  if(after.exercises.length!==drafts.length || after.chapters.length!==chapters.length)throw new Error('Published counts do not match');
  const report={exercises:after.exercises.length,testCases:after.tests.length,chapters:after.chapters.length,updated:before.exercises.map(e=>e.id),created:drafts.filter(d=>!before.exercises.some(e=>e.id===d.id)).map(d=>d.id),removedEmptyChapters:before.chapters.filter(c=>!chapters.some(n=>n.id===c.id)).map(c=>c.id),backup,runtime:language.docker_image,pythonEnabled:Boolean(language.enabled)};
  await fs.writeFile(path.join(staging,'../publication.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
 }finally{
  if(copied&&!committed)await fs.rm(path.join(originalFixtures,'python-course'),{recursive:true,force:true});
  config.paths.fixtures=originalFixtures;database.getFixtureFile=originalGetFixture;database.getLanguage=originalGetLanguage;
  database.cache.clear();database.db=null;await db.close();
 }
}
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={main};
