// Verify complete drafts before publishing. Run with --save to create all four.
const path=require('node:path');
const fs=require('node:fs/promises');
const os=require('node:os');
const sqlite3=require('sqlite3');
const {open}=require('sqlite');
const database=require('../services/databaseService');
const {prepareExercise}=require('../mcp/authoringService');
const {exerciseSchema}=require('../mcp/server');
const {runTests}=require('../services/testRunner');
const images=require('../config/runtimeImages');
const drafts=require('../exercise-drafts/python-course-demos.json');
async function main() {
 const db=await open({filename:path.join(__dirname,'../../data/exercises.db'),driver:sqlite3.Database});
 database.db=db;
 const originalGetLanguage=database.getLanguage;
 let backup;
 try {
  const language=await originalGetLanguage.call(database,'python');
  if(!language)throw new Error('Python runtime is not configured');
  // A local compatibility probe must not change the service runtime configuration.
  database.getLanguage=async id=>id==='python'?{...language,docker_image:images.python}:originalGetLanguage.call(database,id);
  const chapter=await db.get('SELECT id FROM chapters WHERE language_id=? AND name=?','python','Additional exercises');
  if(!chapter)throw new Error('Additional exercises chapter is missing');
  const prepared=[];
  for(const raw of drafts) {
   const draft=exerciseSchema.parse(raw);
   if(await database.getExerciseWithTests(draft.id))throw new Error(`Exercise already exists: ${draft.id}; no overwrite performed`);
   const verified=await prepareExercise(draft);
   let wrong=draft.solution;
   if(draft.id==='python-short-word-report')wrong=wrong.replace('str(count)','str(count + 1)');
   else if(draft.id==='python-one-page-pdf-report')wrong=wrong.replace('40, 240','80, 240');
   else if(draft.id==='python-small-bar-chart')wrong=wrong.replace('[count_a, count_b]','[count_a + 2, count_b]');
   else wrong=wrong.replace('metadata[\'name\'][\'short\']','"incorrect"');
   // Keep candidate checks small; the full reference already passed both inputs.
   if(draft.id==='python-fetch-pfam-entry')wrong="print('Accession: PF00001')\nprint('Short name: incorrect')\nprint('Type: domain')\n";
   const wrongResult=await runTests({...verified.exercise,testCases:verified.exercise.testCases.slice(0,1)},wrong);
   if(wrongResult.some(result=>result.passed || result.error || result.configurationError || result.exitCode!==0))throw new Error(`Incorrect candidate did not cleanly fail for ${draft.id}`);
   prepared.push({...verified.exercise,chapter_id:chapter.id,order_num:draft.order});
   console.log(JSON.stringify({id:draft.id,referenceTests:verified.verification.length,incorrectCandidateRejected:true}));
  }
  await fs.writeFile(path.join(os.tmpdir(),'bitlab-python-course-demos-verified.json'),JSON.stringify(prepared,null,2));
  if(!process.argv.includes('--save')){console.log('Verified only. Use --save to create the four exercises.');return;}
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'bitlab-course-demo-backup-'));
  backup=path.join(directory,'exercises.db');await db.run('VACUUM INTO ?',backup);await fs.chmod(backup,0o600);
  await db.exec('PRAGMA foreign_keys=ON');
  await db.exec('BEGIN IMMEDIATE');
  try {
   const columns=await db.all('PRAGMA table_info(test_cases)');
   if(!columns.some(column=>column.name==='network_hosts'))await db.exec("ALTER TABLE test_cases ADD COLUMN network_hosts TEXT DEFAULT '[]'");
   for(const draft of prepared) {
    await database.validateFunctionTests(draft);
    await database.validateFixtureReferences(draft.testCases);
    await database.createExerciseInTransaction(draft);
   }
   await db.exec('COMMIT');
  }catch(error){await db.exec('ROLLBACK');throw error;}
  console.log(JSON.stringify({created:prepared.map(draft=>draft.id),backup,runtimeActivationRequired:images.python}));
 }finally{
  database.getLanguage=originalGetLanguage;database.cache.clear();database.db=null;await db.close();
 }
}
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1});
module.exports={main};
