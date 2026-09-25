const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

test('exam comparison passes the current runner arguments', async () => {
	const dockerPath = require.resolve('../services/dockerService');
	const graderPath = require.resolve('../services/examGraderService');
	require(dockerPath);
	const original = require.cache[dockerPath].exports;
	const calls = [];
	require.cache[dockerPath].exports = {
		...original,
		createTempScript: async () => {
			const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-exam-test-'));
			return { tmpdir, scriptFilename: 'script.sh', languageConfig: { interpreter: 'bash' } };
		},
		runScriptInContainer: async (...args) => {
			calls.push(args);
			return { stdout: 'same', stderr: '', exitCode: 0 };
		}
	};
	delete require.cache[graderPath];
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-exam-files-'));
	try {
		const student = path.join(dir, 'student.sh');
		const solution = path.join(dir, 'solution.sh');
		await fs.writeFile(student, 'echo same');
		await fs.writeFile(solution, 'echo same');
		const grader = require(graderPath);
		const result = await grader.compareScriptOutputs(student, solution, ['arg'], ['input']);
		assert.equal(result.passed, true);
		assert.equal(calls.length, 2);
		for (const args of calls) {
			assert.equal(args[1], 'script.sh');
			assert.equal(args[2].interpreter, 'bash');
			assert.deepEqual(args[3], ['arg']);
			assert.deepEqual(args[4], ['input']);
		}
	} finally {
		require.cache[dockerPath].exports = original;
		delete require.cache[graderPath];
		await fs.rm(dir, { recursive: true, force: true });
	}
});

test('database cases start with clean state and their own fixtures', async () => {
	const containerPath = require.resolve('../services/databaseContainerService');
	const runnerPath = require.resolve('../services/testRunner');
	const databaseService = require('../services/databaseService');
	const originalContainer = require.cache[containerPath]?.exports;
	const originalGetLanguage = databaseService.getLanguage;
	const started = [];
	const cleaned = [];
	require.cache[containerPath] = {
		id: containerPath, filename: containerPath, loaded: true,
		exports: {
			startMariaDBContainer: async (_dir, fixtures) => {
				const container = { count: 0, fixtures, cleanup: async () => cleaned.push(container) };
				started.push(container);
				return container;
			},
			startMongoDBContainer: () => { throw new Error('Unexpected MongoDB run'); },
			executeMariaDBQuery: async container => ({
				stdout: String(++container.count), stderr: '', exitCode: 0, timedOut: false
			}),
			executeMongoDBQuery: () => { throw new Error('Unexpected MongoDB query'); }
		}
	};
	databaseService.getLanguage = async () => ({ docker_image: 'mariadb:10.11' });
	delete require.cache[runnerPath];
	try {
		const results = await require(runnerPath).runTests({
			id: 'isolation-test', language_id: 'mariadb', exercise_type: 'database',
			testCases: [{ expectedOutput: '1', fixtures: [] }, { expectedOutput: '1', fixtures: [] }]
		}, 'increment');
		assert.deepEqual(results.map(result => result.passed), [true, true]);
		assert.equal(started.length, 2);
		assert.equal(cleaned.length, 2);
		assert.notEqual(started[0], started[1]);
	} finally {
		databaseService.getLanguage = originalGetLanguage;
		if (originalContainer) require.cache[containerPath].exports = originalContainer;
		else delete require.cache[containerPath];
		delete require.cache[runnerPath];
	}
});
