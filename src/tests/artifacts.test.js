const test = require('node:test');
const assert = require('node:assert/strict');
const { validateArtifactChecks, compareArtifactState, publicArtifactResults } = require('../services/artifactService');
const { canonicalJSON } = require('../services/pythonFunctionService');
const { exerciseSchema } = require('../mcp/server');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const checks = [
 {filename:'report.xlsx',kind:'xlsx'},
 {filename:'results.db',kind:'sqlite',queries:[{name:'results',sql:'SELECT name, score FROM results',ordered:false}]},
 {filename:'image.png',kind:'image'}
];
const script = `
from openpyxl import Workbook
from openpyxl.styles import Font
from PIL import Image, PngImagePlugin
import sqlite3
book = Workbook()
book.active.title = 'Results'
book.active.append(['Name', 'Score'])
book.active.append(['Ada', 7])
book.save('report.xlsx')
connection = sqlite3.connect('results.db')
connection.execute('CREATE TABLE results(name TEXT, score INTEGER)')
connection.executemany('INSERT INTO results VALUES (?, ?)', [('Ada', 7), ('Ben', 5)])
connection.commit()
connection.close()
Image.new('RGB', (3, 2), (10, 20, 30)).save('image.png')
`;

test('artifact configuration validates in MCP and round-trips in persistence', async () => {
 const draft = exerciseSchema.parse({id:'artifacts',language_id:'python',chapter:'Files',title:'Files',description:'Make files',solution:script,
 testCases:[{outputFiles:checks.map(c=>c.filename),artifactChecks:checks}]});
 assert.equal(draft.testCases[0].artifactChecks[1].queries[0].ordered,false);
 for (const invalid of [[{filename:'../out',kind:'image'}],[{filename:'x',kind:'nope'}],[{filename:'x',kind:'sqlite',queries:[{name:'bad',sql:'DELETE FROM results'}]}]]) {
  assert.throws(()=>validateArtifactChecks(invalid));
 }
 assert.throws(()=>validateArtifactChecks(checks, ['image.png']), /expected output paths/);
 const service = new (require('../services/databaseService').constructor)();
 service.db = await open({filename:':memory:',driver:sqlite3.Database});
 try {
  await service.createTables();
  await service.createLanguage({id:'python',name:'Python'});
  await service.createChapter({id:'files',language_id:'python',name:'Files'});
  await service.createExercise({...draft,chapter_id:'files'});
  assert.deepEqual((await service.getExerciseWithTests('artifacts')).testCases[0].artifactChecks, draft.testCases[0].artifactChecks);
  await service.updateExercise('artifacts',{testCases:[{expectedOutput:'legacy'}]});
  await service.createTables();
  assert.deepEqual((await service.getExerciseWithTests('artifacts')).testCases[0].artifactChecks, []);
 } finally {service.cache.clear(); await service.db.close();}
});

test('semantic equality preserves types, duplicate rows and stale-reference detection', () => {
 const check=checks[1];
 const artifact=rows=>({kind:'sqlite',checkSignature:canonicalJSON(check),data:{queries:[{name:'results',columns:['n'],rows}]}});
 const num={type:'number',value:'9007199254740993'};
 const state=rows=>({exists:true,type:'file',artifact:artifact(rows)});
 assert.equal(compareArtifactState(state([[num],[null]]),state([[null],[num]]),check).matches,true);
 assert.equal(compareArtifactState(state([[num],[num]]),state([[num]]),check).matches,false);
 assert.equal(compareArtifactState(state([[{type:'text',value:'9007199254740993'}]]),state([[num]]),check).matches,false);
 assert.equal(compareArtifactState(state([[num]]),state([[num]]),{...check,queries:[{...check.queries[0],sql:'SELECT score FROM results'}]}).matches,false);
 assert.equal(publicArtifactResults([{outputFiles:[{artifactSnapshot:artifact([]),artifact:{kind:'sqlite'}}]}])[0].outputFiles[0].artifactSnapshot,undefined);
});

test('feedback escapes cell values and only embeds regenerated PNG previews', async () => {
 const fs=require('node:fs/promises');
 const source=await fs.readFile(require('node:path').join(__dirname,'../../frontend/js/utils/artifactResults.js'),'utf8');
 const {renderArtifactFeedback}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
 const html=renderArtifactFeedback({kind:'xlsx',totalDifferences:1,differences:[{location:'<script>',expected:'<img onerror="boom">',actual:'&'}],actualPreview:{png:'bad" onerror="boom',tables:[{name:'<script>',columns:['<x>'],rows:[['<img>']],totalRows:1}]}});
 assert.ok(!html.includes('<script>'));
 assert.ok(!html.includes('<img'));
 assert.ok(html.includes('&lt;img'));
});

test('real sandbox accepts equivalent files and identifies changed cells, rows and pixels', {
 skip:process.env.RUN_CONTAINER_TESTS !== '1' ? 'Set RUN_CONTAINER_TESTS=1 for container integration tests' : false
}, async () => {
 const {prepareExercise}=require('../mcp/authoringService');
 const {runTests}=require('../services/testRunner');
 const {exercise}=await prepareExercise({id:'unsaved-artifact-draft',language_id:'python',solution:script,
 testCases:[{outputFiles:checks.map(c=>c.filename),artifactChecks:checks}]},
 {database:{getLanguage:async()=>({exercise_type:'programming'})},runner:{runTests}});
 const equivalent=script+`
book.active['A1'].font = Font(bold=True, color='FF0000')
book.active['Z100000'].font = Font(bold=True)
book.save('report.xlsx')
connection=sqlite3.connect('results.db')
connection.execute('DELETE FROM results')
connection.executemany('INSERT INTO results VALUES (?, ?)', [('Ben', 5), ('Ada', 7)])
connection.commit()
connection.execute('VACUUM')
connection.close()
metadata=PngImagePlugin.PngInfo()
metadata.add_text('Comment','Equivalent image')
Image.new('RGBA', (3,2),(10,20,30,255)).save('image.png',pnginfo=metadata,compress_level=0)
`;
 let result=(await runTests(exercise,equivalent))[0];
 assert.equal(result.passed,true,JSON.stringify(result));
 assert.ok(result.outputFiles.every(file=>file.matches));
 assert.ok(result.outputFiles.some(file=>file.actualHash!==file.expectedHash));
 const wrong=script+`
book.active['B2']='7'
book.save('report.xlsx')
connection=sqlite3.connect('results.db')
connection.execute("UPDATE results SET score=8 WHERE name='Ada'")
connection.commit()
connection.close()
image=Image.open('image.png')
image.putpixel((1,0),(99,20,30))
image.save('image.png')
`;
 result=(await runTests(exercise,wrong))[0];
 assert.equal(result.passed,false);
 assert.deepEqual(result.outputFiles.map(file=>file.matches),[false,false,false]);
 assert.equal(result.outputFiles[0].artifact.differences[0].location,'Results!B2');
 assert.match(result.outputFiles[1].artifact.differences[0].location,/results: row/);
 assert.equal(result.outputFiles[2].artifact.differences[0].location,'Pixel (1, 0)');
 assert.ok(result.outputFiles[2].artifact.actualPreview.png);
 // A student-controlled module is never copied into the inspector environment.
 result=(await runTests(exercise,script+`\nopen('openpyxl.py','w').write('raise RuntimeError("shadowed")')\n`))[0];
 assert.equal(result.passed,true,JSON.stringify(result));
 const router=require('../routes/admin');
 const handler=router.stack.find(layer=>layer.route?.path==='/run-test-case').route.stack[0].handle;
 let response;
 await handler({body:{solution:equivalent,languageId:'python',...exercise.testCases[0]}},{status(){return this},json(value){response=value}});
 assert.ok(response.fileComparisons.every(file=>file.matches),JSON.stringify(response));
 assert.ok(response.fileHashes[0].artifact.data);
 const {inspectArtifact}=require('../services/artifactService');
 const fs=require('node:fs/promises'), os=require('node:os'), path=require('node:path');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'bitlab-artifact-safety-'));
 try {
  await fs.symlink('/etc/passwd',path.join(dir,'linked.png'));
  assert.match((await inspectArtifact(dir,{filename:'linked.png',kind:'image'})).error,/regular file/);
 } finally {await fs.rm(dir,{recursive:true,force:true});}
});

test('inspector enforces read-only SQL and reports size and shape failures', {
 skip:process.env.RUN_CONTAINER_TESTS !== '1' ? 'Set RUN_CONTAINER_TESTS=1 for container integration tests' : false
}, async () => {
 const {createTempScript,runScriptInContainer,removeRecursive}=require('../services/dockerService');
 const {inspectArtifact}=require('../services/artifactService');
 const images=require('../config/runtimeImages');
 const temp=await createTempScript(script,'python');
 try {
  const execution=await runScriptInContainer(temp.tmpdir,temp.scriptFilename,{...temp.languageConfig,dockerImage:images.python},[],[],30000);
  assert.equal(execution.exitCode,0);
  const result=await inspectArtifact(temp.tmpdir,{filename:'results.db',kind:'sqlite',queries:[{name:'write',sql:'WITH unused AS (SELECT 1) DELETE FROM results RETURNING name'}]});
  assert.match(result.error,/not authorized|readonly/i);
  assert.match((await inspectArtifact(temp.tmpdir,{filename:'report.xlsx',kind:'xlsx',sheets:['Missing']})).error,/Missing worksheet/);
  const tooMany=await inspectArtifact(temp.tmpdir,{filename:'results.db',kind:'sqlite',queries:[{name:'many',sql:'WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<1001) SELECT x FROM n'}]});
  assert.match(tooMany.error,/1000 returned rows/);
  const fs=require('node:fs/promises');
  const path=require('node:path');
  const file=await fs.open(path.join(temp.tmpdir,'large.png'),'w');
  await file.truncate(16*1024*1024+1); await file.close();
  assert.match((await inspectArtifact(temp.tmpdir,{filename:'large.png',kind:'image'})).error,/16 MiB/);
 } finally {await removeRecursive(temp.tmpdir);}
});
