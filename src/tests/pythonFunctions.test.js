const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { validateFunctionTest, canonicalJSON } = require('../services/pythonFunctionService');
const { exerciseSchema } = require('../mcp/server');
const { prepareExercise } = require('../mcp/authoringService');
const DatabaseService = require('../services/databaseService').constructor;

test('function inputs validate across MCP and persistence, with legacy script cases preserved', async () => {
	const call = { name: 'repeat', args: ['sample A'], kwargs: { times: 3 } };
	const draft = exerciseSchema.parse({ id: 'repeat', language_id: 'python', chapter: 'Functions',
		title: 'Repeat', description: 'Return a repeated label.', solution: 'def repeat(): pass',
		testCases: [{ functionTest: call }] });
	assert.deepEqual(draft.testCases[0].functionTest, call);
	assert.throws(() => validateFunctionTest(call, 'bash'), /only supported for Python/);
	for (const bad of [{ name: 'x()', args: [] }, { name: 'x', args: {} },
		{ name: 'x', kwargs: [] }, { name: 'x', args: [NaN] }, { name: 'x', args: [undefined] }]) {
		assert.throws(() => validateFunctionTest(bad));
	}
	assert.throws(() => validateFunctionTest(call, 'python', { useDynamicOutput: true }), /instead of/);
	assert.throws(() => validateFunctionTest(call, 'python', { input: ['prompt'] }), /instead of/);
	assert.equal(canonicalJSON({ b: { y: 2, x: 1 }, a: false }), '{"a":false,"b":{"x":1,"y":2}}');
	const service = new DatabaseService();
	service.db = await open({ filename: ':memory:', driver: sqlite3.Database });
	try {
		await service.createTables();
		await service.createLanguage({ id: 'python', name: 'Python' });
		await service.createLanguage({ id: 'bash', name: 'Bash' });
		await service.createChapter({ id: 'functions', language_id: 'python', name: 'Functions' });
		await service.createChapter({ id: 'scripts', language_id: 'bash', name: 'Scripts' });
		await service.createExercise({ ...draft, chapter_id: 'functions', testCases: [
			{ functionTest: call, expectedOutput: '"sample A-sample A-sample A"' }, { expectedOutput: 'legacy' }
		] });
		let saved = await service.getExerciseWithTests(draft.id);
		assert.deepEqual(saved.testCases[0].functionTest, call);
		assert.equal(saved.testCases[1].functionTest, null);
		await service.createTables(); // Migration is repeatable and preserves inputs.
		await assert.rejects(service.updateExercise(draft.id, { chapter_id: 'scripts' }), /only supported/);
		assert.equal((await service.getExerciseWithTests(draft.id)).chapter_id, 'functions');
		await service.updateExercise(draft.id, { testCases: [{ functionTest: { ...call, args: ['B'] } }] });
		saved = await service.getExerciseWithTests(draft.id);
		assert.deepEqual(saved.testCases[0].functionTest.args, ['B']);
		await service.updateExercise(draft.id, { testCases: [{ expectedOutput: 'script again' }] });
		assert.equal((await service.getExerciseWithTests(draft.id)).testCases[0].functionTest, null);
	} finally {
		service.cache.clear();
		await service.db.close();
	}
});

test('Python harness distinguishes a return from prints, handles kwargs and reports useful errors', async () => {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-function-test-'));
	const script = path.join(directory, 'student.py');
	const invoke = (name, args = [], kwargs = {}) => spawnSync('python3', [
		path.join(__dirname, '../runners/pythonFunctionRunner.py'), script, JSON.stringify({ name, args, kwargs })
	], { encoding: 'utf8', timeout: 3000 });
	try {
		await fs.writeFile(script, `
def repeat(label, times=2):
    print("debug")
    return "-".join([label] * times)
def only_print():
    print(12)
def fail():
    raise ValueError("bad input")
def invalid():
    return {1, 2}
def huge():
    return 9007199254740993
if __name__ == "__main__":
    raise RuntimeError("The command-line block must not run")
`);
		const good = invoke('repeat', ['sample A'], { times: 3 });
		assert.equal(good.status, 0, good.stderr);
		assert.deepEqual(JSON.parse(good.stdout), { value: 'sample A-sample A-sample A', printedOutput: 'debug\n' });
		assert.equal(JSON.parse(invoke('only_print').stdout).value, null);
		for (const [name, message] of [['missing', 'Define a function named missing'],
			['fail', 'ValueError: bad input'], ['invalid', 'Return a JSON value'], ['huge', 'safe range']]) {
			const result = invoke(name);
			assert.equal(result.status, 1);
			assert.match(result.stderr, new RegExp(message));
			assert.equal(result.stdout, '');
		}
	} finally {
		await fs.rm(directory, { recursive: true, force: true });
	}
});

test('authoring refuses to save a failed function reference as a passing expected error', async () => {
	await assert.rejects(prepareExercise({ language_id: 'python', solution: 'broken',
		testCases: [{ functionTest: { name: 'missing', args: [], kwargs: {} } }]
	}, { database: { getLanguage: async () => ({ exercise_type: 'programming' }) },
		runner: { runTests: async () => [{ actualOutput: '', actualStderr: 'NameError', exitCode: 1 }] }
	}), /Reference test 1 failed/);
});

test('real sandbox grades returned values across cases and keeps script execution unchanged', {
	skip: process.env.RUN_CONTAINER_TESTS !== '1' ? 'Set RUN_CONTAINER_TESTS=1 for container integration tests' : false
}, async () => {
	const { runTests } = require('../services/testRunner');
	const exercise = { id: 'function-draft-only', language_id: 'python', testCases: [
		{ functionTest: { name: 'double', args: [6] }, expectedOutput: '12' },
		{ functionTest: { name: 'double', args: [-2] }, expectedOutput: '-4' }
	] };
	let results = await runTests(exercise, 'def double(value):\n    print("debug")\n    return value * 2\n');
	assert.deepEqual(results.map(result => result.passed), [true, true]);
	assert.equal(results[0].functionStdout, 'debug\n');
	assert.equal(results[1].actualOutput, '-4');
	results = await runTests(exercise, 'def double(value):\n    print(value * 2)\n');
	assert.deepEqual(results.map(result => result.passed), [false, false]);
	assert.equal(results[0].actualOutput, 'null');
	results = await runTests({ ...exercise, testCases: exercise.testCases.slice(0, 1) }, 'def other(): return 12');
	assert.equal(results[0].passed, false);
	assert.match(results[0].actualStderr, /Define a function named double/);
	results = await runTests({ ...exercise, testCases: [{ expectedOutput: 'Hello' }] }, 'print("Hello")');
	assert.equal(results[0].passed, true);
});

test('admin reference testing and MCP draft testing use the same function runner', {
	skip: process.env.RUN_CONTAINER_TESTS !== '1' ? 'Set RUN_CONTAINER_TESTS=1 for container integration tests' : false
}, async () => {
	const router = require('../routes/admin');
	const handler = router.stack.find(layer => layer.route?.path === '/run-test-case').route.stack[0].handle;
	const body = { solution: 'def double(value): return value * 2', languageId: 'python',
		functionTest: { name: 'double', args: [6], kwargs: {} } };
	let response, status = 200;
	const res = { status(code) { status = code; return this; }, json(value) { response = value; } };
	await handler({ body }, res);
	assert.equal(status, 200);
	assert.equal(response.output, '12');
	assert.equal(response.exitCode, 0);
	await handler({ body: { ...body, functionTest: { name: 'bad()', args: [] } } }, res);
	assert.equal(status, 400);
	assert.match(response.error, /valid Python function name/);
	const { runTests } = require('../services/testRunner');
	const prepared = await prepareExercise({ id: 'unsaved-function-draft', language_id: 'python', solution: body.solution,
		testCases: [{ functionTest: body.functionTest }]
	}, { database: { getLanguage: async () => ({ exercise_type: 'programming' }) }, runner: { runTests } });
	assert.equal(prepared.exercise.testCases[0].expectedOutput, '12');
	assert.equal(prepared.verification[0].passed, true);
});

test('course libraries run inside the normal restricted container with saved plots and SQLite', {
	skip: process.env.RUN_CONTAINER_TESTS !== '1' ? 'Set RUN_CONTAINER_TESTS=1 for container integration tests' : false
}, async () => {
	const { runTests } = require('../services/testRunner');
	const script = `
import numpy as np, pandas as pd, sqlite3
import Bio, bs4, openpyxl, docx, reportlab, skimage
from PIL import Image
import matplotlib.pyplot as plt
assert np.array([1, 2, 3]).sum() == 6
assert pd.DataFrame({"value": [1, 2]}).value.mean() == 1.5
connection = sqlite3.connect(":memory:")
assert connection.execute("SELECT 1").fetchone()[0] == 1
Image.new("RGB", (2, 3)).save("image.png")
plt.plot([1, 2], [3, 4])
plt.savefig("plot.png")
from pathlib import Path
assert Path("plot.png").stat().st_size > 100
print("libraries OK")
`;
	const results = await runTests({ id: 'course-runtime-smoke', language_id: 'python',
		testCases: [{ expectedOutput: 'libraries OK' }] }, script);
	assert.equal(results[0].passed, true, JSON.stringify(results[0]));
});
