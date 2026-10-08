const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const createRouter = require('../mcp/router');
const { createMcpServer } = require('../mcp/server');
const { prepareExercise } = require('../mcp/authoringService');
const token = 'bitlab-test-token-that-is-long-enough';

async function serve(router) {
	const app = express();
	app.use('/mcp', router);
	const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
	return { url: `http://127.0.0.1:${server.address().port}/mcp`, close: () => new Promise(resolve => server.close(resolve)) };
}

test('MCP denies missing credentials, hostile hosts, browser origins and disabled configuration', async () => {
	const live = await serve(createRouter({ token }));
	try {
		assert.equal((await fetch(live.url, { method: 'POST', body: '{}' })).status, 401);
		const hostileHostStatus = await new Promise((resolve, reject) => {
            const request = http.request(live.url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Host: 'attacker.example' } }, response => { response.resume(); resolve(response.statusCode); });
            request.on('error', reject);
            request.end();
        });
        assert.equal(hostileHostStatus, 403);
		assert.equal((await fetch(live.url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: 'https://attacker.example' } })).status, 403);
	} finally { await live.close(); }
	const disabled = await serve(createRouter({ token: '' }));
	try { assert.equal((await fetch(disabled.url)).status, 404); } finally { await disabled.close(); }
	assert.throws(() => createRouter({ token: 'short' }), /32 characters/);
});

test('real MCP client initializes, discovers schemas, calls tools and receives tool errors', async () => {
	const serverFactory = () => createMcpServer({ database: { getLanguages: async () => [{ id: 'bash' }] },
		exercises: { getExerciseWithTests: async () => null }, runner: {}, authoring: {} });
	const live = await serve(createRouter({ token, serverFactory }));
	const client = new Client({ name: 'bitlab-test-client', version: '1.0.0' });
	try {
		await client.connect(new StreamableHTTPClientTransport(new URL(live.url), {
			requestInit: { headers: { Authorization: `Bearer ${token}` } }
		}));
		const listed = await client.listTools();
		assert.equal(listed.tools.length, 10);
		const save = listed.tools.find(tool => tool.name === 'bitlab_save_exercise');
		assert.equal(save.annotations.readOnlyHint, false);
		assert.ok(save.inputSchema.properties.exercise.properties.testCases);
		const languages = await client.callTool({ name: 'bitlab_list_languages', arguments: {} });
		assert.deepEqual(JSON.parse(languages.content[0].text), [{ id: 'bash' }]);
		const missing = await client.callTool({ name: 'bitlab_get_exercise', arguments: { id: 'missing' } });
		assert.equal(missing.isError, true);
		const invalid = await client.callTool({ name: 'bitlab_save_exercise', arguments: { mode: 'create', exercise: {} } });
		assert.equal(invalid.isError, true);
		const traversal = await client.callTool({ name: 'bitlab_create_fixture', arguments: { filename: '../escape', content: 'no' } });
		assert.equal(traversal.isError, true);
	} finally { await client.close(); await live.close(); }
});

test('authoring derives stdout, stderr, validation and file hashes, then verifies the reference', async () => {
	const calls = [];
	const draft = { id: 'redirect', language_id: 'bash', solution: 'reference', testCases: [{ outputFiles: ['listing.txt'] }] };
	const deps = { database: { getLanguage: async () => ({ exercise_type: 'programming' }) },
		runner: { runTests: async exercise => {
			calls.push(exercise);
			return [{ actualOutput: 'generated', actualStderr: '', exitCode: 0, actualValidationOutput: 'database state',
				outputFiles: [{ filename: 'listing.txt', exists: true, actualType: 'file', actualHash: 'current' }],
				passed: calls.length === 2 }];
		} } };
	const { exercise, verification } = await prepareExercise(draft, deps);
	assert.equal(exercise.testCases[0].expectedOutput, 'generated');
	assert.equal(exercise.testCases[0].expectedValidationOutput, 'database state');
	assert.equal(exercise.testCases[0].expectedOutputFiles[0].sha256, 'current');
	assert.equal(verification[0].passed, true);
	assert.equal(calls.length, 2);
	deps.runner.runTests = async () => [{ timedOut: true, exitCode: null }];
	await assert.rejects(prepareExercise(draft, deps), /Reference test 1 failed/);
	deps.runner.runTests = async () => [{ exitCode: 0, outputFiles: [{ exists: false }] }];
	await assert.rejects(prepareExercise(draft, deps), /did not create/);
	deps.runner.runTests = async () => [{ actualOutput: '', actualStderr: '', exitCode: 0, passed: false }];
	await assert.rejects(prepareExercise(draft, deps), /did not pass/);
});

test('MCP creates, edits and grades exercises through the real sandbox without student progress', {
	skip: process.env.RUN_CONTAINER_TESTS !== '1' ? 'Set RUN_CONTAINER_TESTS=1 for container integration tests' : false
}, async () => {
	const sqlite3 = require('sqlite3');
	const { open } = require('sqlite');
	const database = require('../services/databaseService');
	const originalDb = database.db;
	const fs = require('node:fs/promises');
	const path = require('node:path');
	const config = require('../config');
	const originalFixtures = config.paths.fixtures;
	const fixtureRoot = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'bitlab-mcp-fixtures-'));
	config.paths.fixtures = fixtureRoot;
	const memory = await open({ filename: ':memory:', driver: sqlite3.Database });
	database.db = memory;
	database.cache.clear();
	const live = await serve(createRouter({ token }));
	const client = new Client({ name: 'bitlab-container-test', version: '1.0.0' });
	try {
		await database.createTables();
		await database.createLanguage({ id: 'bash', name: 'Bash' });
		await client.connect(new StreamableHTTPClientTransport(new URL(live.url), {
			requestInit: { headers: { Authorization: `Bearer ${token}` } }
		}));
        let fixtureResult = await client.callTool({ name: 'bitlab_create_fixture', arguments: { filename: 'mcp-seed.txt', content: 'seed' } });
        assert.ok(!fixtureResult.isError, JSON.stringify(fixtureResult));
        assert.equal(await fs.readFile(path.join(fixtureRoot, 'mcp-seed.txt'), 'utf8'), 'seed');
        fixtureResult = await client.callTool({ name: 'bitlab_create_fixture', arguments: { filename: 'mcp-seed.txt', content: 'overwrite' } });
        assert.equal(fixtureResult.isError, true);
        fixtureResult = await client.callTool({ name: 'bitlab_get_fixture', arguments: { filename: 'mcp-seed.txt' } });
        assert.equal(JSON.parse(fixtureResult.content[0].text).content, 'seed');
		const exercise = { id: 'mcp-created', title: 'Generated exercise', language_id: 'bash', chapter: 'MCP tests',
			description: 'Print hello', solution: 'echo hello', testCases: [{}] };
		let result = await client.callTool({ name: 'bitlab_save_exercise', arguments: { mode: 'create', exercise } });
		assert.ok(!result.isError, JSON.stringify(result));
		assert.equal(JSON.parse(result.content[0].text).exercise.testCases[0].expectedOutput, 'hello');
		result = await client.callTool({ name: 'bitlab_run_exercise', arguments: { id: exercise.id, script: 'echo wrong' } });
		assert.equal(JSON.parse(result.content[0].text).allPassed, false);
		exercise.solution = 'echo updated';
		result = await client.callTool({ name: 'bitlab_save_exercise', arguments: { mode: 'update', exercise } });
		assert.ok(!result.isError, JSON.stringify(result));
		result = await client.callTool({ name: 'bitlab_run_exercise', arguments: { id: exercise.id } });
		assert.equal(JSON.parse(result.content[0].text).allPassed, true);
		exercise.testCases = [{ outputFiles: ['missing.txt'] }];
		result = await client.callTool({ name: 'bitlab_save_exercise', arguments: { mode: 'update', exercise } });
		assert.equal(result.isError, true);
		assert.deepEqual((await database.getExerciseWithTests(exercise.id)).testCases[0].outputFiles, []);
        result = await client.callTool({ name: 'bitlab_test_exercise', arguments: {
            exercise: { ...exercise, id: 'mcp-unsaved-listing', solution: 'ls -l > listing.txt',
                testCases: [{ outputFiles: ['listing.txt'], useDynamicOutput: true }] }, script: 'echo wrong > listing.txt'
        } });
        assert.ok(!result.isError, JSON.stringify(result));
        assert.equal(JSON.parse(result.content[0].text).allPassed, false);
        assert.equal(await database.getExerciseWithTests('mcp-unsaved-listing'), null);
		assert.equal((await memory.get('SELECT COUNT(*) AS count FROM submission_attempts')).count, 0);
		assert.equal((await memory.get('SELECT COUNT(*) AS count FROM user_progress')).count, 0);
	} finally {
		await client.close(); await live.close();
		database.db = originalDb; database.cache.clear();
		config.paths.fixtures = originalFixtures;
		await fs.rm(fixtureRoot, { recursive: true, force: true });
		await memory.close();
	}
});
