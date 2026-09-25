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
	let runResult = { stdout: 'same', stderr: '', exitCode: 0 };
	require.cache[dockerPath].exports = {
		...original,
		createTempScript: async () => {
			const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-exam-test-'));
			return { tmpdir, scriptFilename: 'script.sh', languageConfig: { interpreter: 'bash' } };
		},
		runScriptInContainer: async (...args) => {
			calls.push(args);
			return runResult;
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
			assert.equal(args[2].dockerImage, require('../config').docker.image);
			assert.deepEqual(args[3], ['arg']);
			assert.deepEqual(args[4], ['input']);
		}
		runResult = { stdout: '', stderr: '', exitCode: -1, timedOut: true };
		assert.equal((await grader.compareScriptOutputs(student, solution)).passed, false);
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

test('dynamic database output uses a clean reference database and reports broken references', async () => {
	const containerPath = require.resolve('../services/databaseContainerService');
	const runnerPath = require.resolve('../services/testRunner');
	const databaseService = require('../services/databaseService');
	const originalContainer = require.cache[containerPath]?.exports;
	const originalGetLanguage = databaseService.getLanguage;
	const started = [];
	const cleaned = [];
	let breakReference = false;
	require.cache[containerPath] = {
		id: containerPath, filename: containerPath, loaded: true,
		exports: {
			startMariaDBContainer: async (_dir, fixtures) => {
				const container = { fixtures, cleanup: async () => cleaned.push(container) };
				started.push(container);
				return container;
			},
			startMongoDBContainer: () => { throw new Error('Unexpected MongoDB run'); },
			executeMariaDBQuery: async (container, query) => {
				assert.equal(container.fixtures[0], 'seed.sql');
				if (query === 'reference' && breakReference) return { stdout: '', stderr: '', exitCode: -1, timedOut: true };
				return { stdout: 'expected', stderr: '', exitCode: 0 };
			},
			executeMongoDBQuery: () => { throw new Error('Unexpected MongoDB query'); }
		}
	};
	databaseService.getLanguage = async () => ({ docker_image: 'mariadb:10.11' });
	delete require.cache[runnerPath];
	try {
		const exercise = {
			id: 'dynamic-db', language_id: 'mariadb', exercise_type: 'database', solution: 'reference',
			testCases: [{ useDynamicOutput: true, fixtures: ['seed.sql'], expectedOutput: 'old' }]
		};
		assert.equal((await require(runnerPath).runTests(exercise, 'student'))[0].passed, true);
		assert.equal(started.length, 2);
		assert.equal(cleaned.length, 2);
		assert.notEqual(started[0], started[1]);
		breakReference = true;
		const broken = (await require(runnerPath).runTests(exercise, 'student'))[0];
		assert.equal(broken.passed, false);
		assert.match(broken.configurationError, /Reference solution failed/);
	} finally {
		databaseService.getLanguage = originalGetLanguage;
		if (originalContainer) require.cache[containerPath].exports = originalContainer;
		else delete require.cache[containerPath];
		delete require.cache[runnerPath];
	}
});

test('failed database validation is a configuration error even with empty expected output', async () => {
	const containerPath = require.resolve('../services/databaseContainerService');
	const runnerPath = require.resolve('../services/testRunner');
	const databaseService = require('../services/databaseService');
	const originalContainer = require.cache[containerPath]?.exports;
	const originalGetLanguage = databaseService.getLanguage;
	require.cache[containerPath] = {
		id: containerPath, filename: containerPath, loaded: true,
		exports: {
			startMariaDBContainer: async () => ({ cleanup: async () => {} }),
			startMongoDBContainer: () => { throw new Error('Unexpected MongoDB run'); },
			executeMariaDBQuery: async (_container, query) => query === 'check'
				? { stdout: '', stderr: '', exitCode: -1, timedOut: true }
				: { stdout: '', stderr: '', exitCode: 0 },
			executeMongoDBQuery: () => { throw new Error('Unexpected MongoDB query'); }
		}
	};
	databaseService.getLanguage = async () => ({ docker_image: 'mariadb:10.11' });
	delete require.cache[runnerPath];
	try {
		const [result] = await require(runnerPath).runTests({
			id: 'validation-timeout', language_id: 'mariadb', exercise_type: 'database',
			testCases: [{ validationQuery: 'check', expectedValidationOutput: '', expectedOutput: '' }]
		}, 'student');
		assert.equal(result.passed, false);
		assert.match(result.configurationError, /Validation query failed/);
	} finally {
		databaseService.getLanguage = originalGetLanguage;
		if (originalContainer) require.cache[containerPath].exports = originalContainer;
		else delete require.cache[containerPath];
		delete require.cache[runnerPath];
	}
});
