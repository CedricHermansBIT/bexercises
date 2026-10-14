const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { normalizeGradingOutput, compareRunnerResults } = require('../services/gradingComparison');

const utilitySource = fs.readFileSync('frontend/js/utils/gradingComparison.js', 'utf8');
const utility = import(`data:text/javascript,${encodeURIComponent(utilitySource)}`);

test('admin comparison matches grading for whitespace, line endings and real changes', async () => {
	const { compareTestOutputs, normalizeGradingOutput: normalizeFrontend } = await utility;
	const values = [undefined, null, '', '\n', 'Number of mines: 10', 'Number of mines: 10\n',
		'first\r\nsecond\r\n', 'first\nsecond', 'a  b', 'a b', 'first\n\nsecond'];
	for (const actual of values) {
		assert.equal(normalizeFrontend(actual), normalizeGradingOutput(actual));
		for (const expected of values) {
			const change = compareTestOutputs({ output: actual, stderr: actual, exitCode: 0 },
				{ expectedOutput: expected, expectedStderr: expected, expectedExitCode: 0 });
			const graded = compareRunnerResults({ stdout: actual, stderr: actual, exitCode: 0 },
				{ stdout: expected, stderr: expected, exitCode: 0 });
			assert.equal(change.outputChanged, !graded.outputMatch);
			assert.equal(change.stderrChanged, !graded.stderrMatch);
			assert.equal(change.hasChanges, !graded.passed);
		}
	}
	assert.equal(compareTestOutputs({ exitCode: 0 }, { expectedExitCode: '0' }).hasChanges, false);
	assert.equal(compareTestOutputs({ exitCode: null }, { expectedExitCode: 0 }).exitCodeChanged, true);
});

test('the admin verify-all flow ignores normalized output but reports actual changes', async () => {
	const { compareTestOutputs } = await utility;
	const status = { innerHTML: '', querySelector: () => ({ style: {} }) };
	const context = vm.createContext({ compareTestOutputs, console,
		document: { getElementById: () => status, addEventListener() {} } });
	const source = fs.readFileSync('frontend/js/pages/admin/exercisesPage.js', 'utf8')
		.replace(/^import .*;\r?\n/gm, '');
	vm.runInContext(source + '\n globalThis.Page = ExercisesPage;', context);
	const page = Object.create(context.Page.prototype);
	page.selectedLanguage = 'bash';
	page.languages = [{ id: 'bash', name: 'Shell Scripting' }];
	page.exercises = [{ id: 'mine-counter', language_id: 'bash', solution: 'reference' }];
	const cases = [
		{ expectedOutput: 'Number of mines: 10', expectedStderr: '', expectedExitCode: 0 },
		{ expectedOutput: 'first\nsecond', expectedStderr: 'warning', expectedExitCode: 0 },
		{ expectedOutput: 'right', expectedStderr: '', expectedExitCode: 0 },
		{ expectedOutput: 'same', expectedStderr: '', expectedExitCode: 0 },
		{ expectedOutput: 'same', expectedStderr: '', expectedExitCode: 0 }
	];
	const actual = [
		{ output: 'Number of mines: 10\n', stderr: '\n', exitCode: 0 },
		{ output: 'first\r\nsecond\r\n', stderr: 'warning\r\n', exitCode: 0 },
		{ output: 'wrong\n', stderr: '', exitCode: 0 },
		{ output: 'same\n', stderr: 'unexpected', exitCode: 0 },
		{ output: 'same\n', stderr: '', exitCode: 1 }
	];
	let index = 0, report;
	page.apiService = {
		getExerciseWithTests: async () => ({ ...page.exercises[0], testCases: cases }),
		runTestCase: async () => actual[index++]
	};
	page.displayVerificationResults = (...args) => { report = args; };
	await page.runBulkVerification();
	assert.deepEqual(report.slice(1), [5, 3, 0]);
	const checks = report[0][0].testCaseResults;
	assert.equal(checks[0].hasChanges, false);
	assert.equal(checks[1].hasChanges, false);
	assert.equal(checks[2].outputChanged, true);
	assert.equal(checks[3].stderrChanged, true);
	assert.equal(checks[4].exitCodeChanged, true);
});

test('admin bulk comparison uses semantic file results instead of differing binary hashes', async () => {
 const {compareTestOutputs}=await utility;
 const expected={expectedOutput:'',expectedStderr:'',expectedExitCode:0};
 assert.equal(compareTestOutputs({output:'',stderr:'',exitCode:0,fileComparisons:[{matches:true}]},expected).hasChanges,false);
 assert.equal(compareTestOutputs({output:'',stderr:'',exitCode:0,fileComparisons:[{matches:false}]},expected).filesChanged,true);
});

test('bulk verification overlaps two exercises, preserves course order, and prevents duplicate runs', async () => {
 const {compareTestOutputs}=await utility;
 const status={innerHTML:'',querySelector:()=>({style:{}})};
 const button={disabled:false};
 const context=vm.createContext({compareTestOutputs,console,
  document:{getElementById:id=>id==='bulk-verify-btn'?button:status,addEventListener(){}}});
 const source=fs.readFileSync('frontend/js/pages/admin/exercisesPage.js','utf8').replace(/^import .*;\r?\n/gm,'');
 vm.runInContext(source+'\n globalThis.Page = ExercisesPage;',context);
 const page=Object.create(context.Page.prototype);
 page.selectedLanguage='python';page.languages=[{id:'python',name:'Python'}];
 page.exercises=['first','second','third'].map(id=>({id,title:id,language_id:'python',solution:id}));
 let releaseFirst;
 const firstGate=new Promise(resolve=>{releaseFirst=resolve;});
 let active=0,peak=0,calls=0,report;
 const completed=[];
 page.apiService={
  getExerciseWithTests:async id=>({...page.exercises.find(e=>e.id===id),testCases:[
   {arguments:[id],expectedOutput:'expected',expectedExitCode:0},
   {arguments:[id],expectedOutput:'expected',expectedExitCode:0}]}),
  runTestCase:async (solution,tc)=>{
   assert.equal(solution,tc.arguments[0]);calls++;active++;peak=Math.max(peak,active);
   if(solution==='first')await firstGate;
   else await new Promise(resolve=>setImmediate(resolve));
   active--;completed.push(solution);
   return {output:'changed',stderr:'',exitCode:0};
  }
 };
 page.displayVerificationResults=(...args)=>{report=args;};
 const run=page.runBulkVerification();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(button.disabled,true);
 await page.runBulkVerification();
 // The faster worker must move on to the third exercise while the first waits.
 for(let i=0;i<10 && !completed.includes('third');i++)await new Promise(resolve=>setImmediate(resolve));
 assert.ok(completed.includes('third'));
 assert.equal(peak,2);
 releaseFirst();await run;
 assert.equal(calls,6);
 assert.deepEqual(Array.from(report[0],entry=>entry.exercise.id),['first','second','third']);
 assert.deepEqual(report.slice(1),[6,6,0]);
 assert.equal(button.disabled,false);
 assert.equal(page.bulkVerificationRunning,false);
});
