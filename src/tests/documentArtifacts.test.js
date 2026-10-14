const test = require('node:test');
const assert = require('node:assert/strict');
const {validateArtifactChecks,compareArtifactState} = require('../services/artifactService');
const {canonicalJSON} = require('../services/pythonFunctionService');
const zlib = require('node:zlib');
const checks=[{filename:'report.docx',kind:'docx'},{filename:'report.pdf',kind:'pdf',layout:true,positionTolerance:2},
 {filename:'chart.png',kind:'plot'}];
const script=`
from docx import Document
from docx.shared import Pt
from reportlab.pdfgen import canvas
import matplotlib.pyplot as plt
report=Document()
report.add_heading('Sample report',level=1)
report.add_paragraph('Sample A')
table=report.add_table(rows=2,cols=2)
table.cell(0,0).text='Sample'
table.cell(0,1).text='Count'
table.cell(1,0).text='A'
table.cell(1,1).text='7'
report.save('report.docx')
pdf=canvas.Canvas('report.pdf',pagesize=(300,300))
pdf.drawString(40,240,'Sample A: 7')
pdf.save()
plt.figure(figsize=(4,3),dpi=100)
plt.bar(['A','B'],[7,5])
plt.title('Sample counts')
plt.xlabel('Sample')
plt.ylabel('Count')
plt.savefig('chart.png')
plt.close()
`;
function state(check,data) {return {exists:true,type:'file',artifact:{kind:check.kind,data,checkSignature:canonicalJSON(check)}};}
test('new check modes validate, PDFs enforce optional positions and plots have bounded tolerance',()=>{
 validateArtifactChecks(checks,checks.map(check=>check.filename));
 for(const bad of [{...checks[2],maxDifferentPixelRatio:1},{...checks[1],positionTolerance:-1},{...checks[0],headings:'yes'}]) assert.throws(()=>validateArtifactChecks([bad]));
 const check=checks[1];
 const data={pages:[{text:'A',size:[300,300],characters:[{text:'A',box:[40,240,50,250]}]}]};
 assert.equal(compareArtifactState(state(check,data),state(check,data),check).matches,true);
 const moved=structuredClone(data);moved.pages[0].characters[0].box[0]+=20;
 assert.equal(compareArtifactState(state(check,moved),state(check,data),check).matches,false);
 const pixels=(value)=>({width:2,height:2,rgba:zlib.deflateSync(Buffer.from(Array.from({length:4},()=>[value,value,value,255]).flat())).toString('base64')});
 assert.equal(compareArtifactState(state(checks[2],pixels(101)),state(checks[2],pixels(100)),checks[2]).matches,false); // Mean error still matters.
 const tolerant={...checks[2],maxMeanAbsoluteError:1};
 assert.equal(compareArtifactState(state(tolerant,pixels(101)),state(tolerant,pixels(100)),tolerant).matches,true);
 assert.equal(compareArtifactState(state(tolerant,pixels(200)),state(tolerant,pixels(100)),tolerant).matches,false);
});

test('real document and plot grading accepts formatting/metadata changes and detects incorrect content/layout', {
 skip:process.env.RUN_CONTAINER_TESTS !== '1' ? 'Set RUN_CONTAINER_TESTS=1' : false
},async()=>{
 const {prepareExercise}=require('../mcp/authoringService');
 const {runTests}=require('../services/testRunner');
 const {exercise}=await prepareExercise({id:'unsaved-documents',language_id:'python',solution:script,
 testCases:[{outputFiles:checks.map(check=>check.filename),artifactChecks:checks}]},
 {database:{getLanguage:async()=>({exercise_type:'programming'})},runner:{runTests}});
 let result=(await runTests(exercise,script+`
report.core_properties.author='Different author'
report.paragraphs[0].runs[0].font.size=Pt(30)
report.save('report.docx')
pdf=canvas.Canvas('report.pdf',pagesize=(300,300))
pdf.setAuthor('Another author')
pdf.drawString(41,240,'Sample A: 7')
pdf.save()
from PIL import Image, PngImagePlugin
image=Image.open('chart.png')
metadata=PngImagePlugin.PngInfo()
metadata.add_text('Comment','Same plot')
image.save('chart.png',pnginfo=metadata,compress_level=0)
`))[0];
 assert.equal(result.passed,true,JSON.stringify(result));
 assert.ok(result.outputFiles[1].artifact.actualPreview.pages[0].png);
 result=(await runTests(exercise,script+`
table.cell(1,1).text='8'
report.save('report.docx')
pdf=canvas.Canvas('report.pdf',pagesize=(300,300))
pdf.drawString(80,240,'Sample A: 7')
pdf.save()
from PIL import Image
Image.new('RGB',(400,300),'white').save('chart.png')
`))[0];
 assert.deepEqual(result.outputFiles.map(file=>file.matches),[false,false,false]);
 assert.equal(result.outputFiles[0].artifact.differences[0].location,'Table 3, cell (2, 2)');
 assert.match(result.outputFiles[1].artifact.differences[0].location,/position/);
 assert.ok(result.outputFiles[2].artifact.metrics.differentPixelRatio>0.005);
 const textOnly={...checks[1],layout:false};
 const {inspectOutputFiles}=require('../services/artifactService');
 const {createTempScript,runScriptInContainer,removeRecursive}=require('../services/dockerService');
 const temp=await createTempScript(script,'python');
 try{
  const execution=await runScriptInContainer(temp.tmpdir,temp.scriptFilename,temp.languageConfig,[],[],30000);
  assert.equal(execution.exitCode,0);
  const [original]=await inspectOutputFiles(temp.tmpdir,['report.pdf'],[textOnly]);
  const layoutSnapshot=result.outputFiles[1].artifactSnapshot;
  const candidate={exists:true,type:'file',artifact:{...layoutSnapshot,checkSignature:canonicalJSON(textOnly)}};
  assert.equal(compareArtifactState(candidate,original,textOnly).matches,true);
 }finally{await removeRecursive(temp.tmpdir)}
});


test('runtime activation compares artifact content rather than creation metadata',()=>{
 const {equivalentOutputFiles}=require('../scripts/activatePythonCourse');
 const check=checks[0], data={blocks:[{kind:'paragraph',text:'Report',heading:'Heading 1'}]};
 const before=[{filename:check.filename,exists:true,actualType:'file',actualHash:'old',artifactSnapshot:state(check,data).artifact}];
 const after=[{...before[0],actualHash:'new'}];
 assert.equal(equivalentOutputFiles(before,after,[check]),true);
 assert.equal(equivalentOutputFiles(before,after,[]),false);
 after[0].artifactSnapshot=state(check,{blocks:[{kind:'paragraph',text:'Wrong report',heading:'Heading 1'}]}).artifact;
 assert.equal(equivalentOutputFiles(before,after,[check]),false);
});
