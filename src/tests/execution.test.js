const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const express = require('express');
const { hashFile, hashOutputFiles, removeRecursive } = require('../services/dockerService');
const config = require('../config');
const limiter = require('../services/executionLimiter');
const { parseContainerCreatedAt } = require('../services/containerCleanupService');

test('cleanup parses Docker and Podman creation timestamps', () => {
	assert.equal(parseContainerCreatedAt('2026-05-19 13:44:04.241755929 +0200 CEST'),
		Date.parse('2026-05-19T13:44:04+02:00'));
	assert.equal(parseContainerCreatedAt('2026-05-19 13:44:04 +0000 UTC'),
		Date.parse('2026-05-19T13:44:04+00:00'));
});

test('tar archives with identical names and different contents hash differently', async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-tar-test-'));
	try {
		const input = path.join(dir, 'input');
		await fs.mkdir(input);
		const file = path.join(input, 'foo.txt');
		const first = path.join(dir, 'first.tar.gz');
		const second = path.join(dir, 'second.tar.gz');
		await fs.writeFile(file, 'first');
		assert.equal(spawnSync('tar', ['-czf', first, '-C', input, 'foo.txt']).status, 0);
		await fs.writeFile(file, 'second');
		assert.equal(spawnSync('tar', ['-czf', second, '-C', input, 'foo.txt']).status, 0);
		assert.notEqual(await hashFile(first), await hashFile(second));
	} finally {
		await fs.rm(dir, { recursive: true, force: true });
	}
});

test('archive hashing stops when expanded content exceeds its limit', async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-tar-limit-'));
	const oldLimit = config.docker.maxArchiveExpandedBytes;
	try {
		const file = path.join(dir, 'large.txt');
		const archive = path.join(dir, 'large.tar.gz');
		await fs.writeFile(file, Buffer.alloc(1024 * 1024));
		assert.equal(spawnSync('tar', ['-czf', archive, '-C', dir, 'large.txt']).status, 0);
		config.docker.maxArchiveExpandedBytes = 1024;
		await assert.rejects(hashFile(archive), /expanded size limit/);
	} finally {
		config.docker.maxArchiveExpandedBytes = oldLimit;
		await fs.rm(dir, { recursive: true, force: true });
	}
});

test('cleanup never chmods or follows a generated symlink', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-cleanup-test-'));
	const target = path.join(root, 'host-file');
	const work = path.join(root, 'work');
	const locked = path.join(work, 'locked');
	try {
		await fs.writeFile(target, 'keep this');
		await fs.chmod(target, 0o600);
		await fs.mkdir(locked, { recursive: true });
		await fs.symlink(target, path.join(locked, 'link'));
		await fs.chmod(locked, 0o000);
		await removeRecursive(work);
		assert.equal((await fs.stat(target)).mode & 0o777, 0o600);
		assert.equal(await fs.readFile(target, 'utf8'), 'keep this');
	} finally {
		await fs.chmod(locked, 0o700).catch(() => {});
		await fs.rm(root, { recursive: true, force: true });
	}
});

test('output grading cannot read paths outside the workspace', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-output-path-'));
	const workspace = path.join(root, 'work');
	const secret = path.join(root, 'secret.txt');
	try {
		await fs.mkdir(workspace);
		await fs.writeFile(secret, 'outside');
		await fs.symlink(root, path.join(workspace, 'escape'));
		const results = await hashOutputFiles(workspace, [
			'../secret.txt', secret, 'escape/secret.txt'
		]);
		assert.equal(results.every(result => result.exists === false && result.error), true);
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});

test('execution limiter enforces per-user rate and global concurrency', async () => {
	const oldRate = config.docker.runsPerMinute;
	const oldParallel = config.docker.maxParallelTests;
	try {
		config.docker.runsPerMinute = 2;
		assert.equal(limiter.checkRateLimit('user-a', 100000), true);
		assert.equal(limiter.checkRateLimit('user-a', 100001), true);
		assert.equal(limiter.checkRateLimit('user-a', 100002), false);
		assert.equal(limiter.checkRateLimit('user-b', 100002), true);
		assert.equal(limiter.checkRateLimit('user-a', 160001), true);

		config.docker.maxParallelTests = 1;
		let release;
		const first = limiter.enqueue(() => new Promise(resolve => { release = resolve; }));
		let secondStarted = false;
		const second = limiter.enqueue(() => { secondStarted = true; return 2; });
		await new Promise(resolve => setImmediate(resolve));
		assert.equal(secondStarted, false);
		release(1);
		assert.deepEqual(await Promise.all([first, second]), [1, 2]);
	} finally {
		config.docker.runsPerMinute = oldRate;
		config.docker.maxParallelTests = oldParallel;
	}
});

test('zero-length queue accepts free slots and rejects full queues without charging a run', async () => {
	const oldRate = config.docker.runsPerMinute;
	const oldParallel = config.docker.maxParallelTests;
	const oldQueued = config.docker.maxQueuedRuns;
	try {
		config.docker.runsPerMinute = 1;
		config.docker.maxParallelTests = 1;
		config.docker.maxQueuedRuns = 0;
		let release;
		const first = limiter.enqueue(() => new Promise(resolve => { release = resolve; }), 'queue-user-a');
		await new Promise(resolve => setImmediate(resolve));
		await assert.rejects(limiter.enqueue(() => 2, 'queue-user-b'), { statusCode: 503 });
		await assert.rejects(limiter.enqueue(() => 2, 'queue-user-a'), { statusCode: 429 });
		release(1);
		assert.equal(await first, 1);
		await new Promise(resolve => setImmediate(resolve));
		assert.equal(await limiter.enqueue(() => 2, 'queue-user-b'), 2);
	} finally {
		config.docker.runsPerMinute = oldRate;
		config.docker.maxParallelTests = oldParallel;
		config.docker.maxQueuedRuns = oldQueued;
	}
});

test('anonymous execution request is rejected before running an exercise', async () => {
	const app = express();
	app.use(express.json());
	app.use((req, _res, next) => { req.isAuthenticated = () => false; next(); });
	app.use('/api', require('../routes/api'));
	const server = app.listen(0);
	try {
		const response = await fetch(`http://127.0.0.1:${server.address().port}/api/exercises/1/run`, {
			method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ script: 'echo hi' })
		});
		assert.equal(response.status, 401);
	} finally {
		await new Promise(resolve => server.close(resolve));
	}
});

test('authenticated execution rejects scripts over 64 KiB before loading tests', async () => {
	const app = express();
	app.use(express.json({ limit: '1mb' }));
	app.use((req, _res, next) => { req.isAuthenticated = () => true; req.user = { id: 1 }; next(); });
	app.use('/api', require('../routes/api'));
	app.use(require('../middleware/errorHandler').errorMiddleware);
	const server = app.listen(0);
	try {
		const response = await fetch(`http://127.0.0.1:${server.address().port}/api/exercises/1/run`, {
			method: 'POST', headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ script: 'x'.repeat(65537) })
		});
		assert.equal(response.status, 400);
		assert.match((await response.json()).error, /64 KiB/);
	} finally {
		await new Promise(resolve => server.close(resolve));
	}
});

test('an exercise without tests cannot be completed by submitting code', async () => {
	const exerciseService = require('../services/exerciseService');
	const original = exerciseService.getExerciseWithTests;
	exerciseService.getExerciseWithTests = async () => ({ testCases: [] });
	const app = express();
	app.use(express.json());
	app.use((req, _res, next) => {
		req.isAuthenticated = () => true;
		req.user = { id: 'zero-tests-user' };
		next();
	});
	app.use('/api', require('../routes/api'));
	app.use(require('../middleware/errorHandler').errorMiddleware);
	const server = app.listen(0);
	try {
		const response = await fetch(`http://127.0.0.1:${server.address().port}/api/exercises/empty/run`, {
			method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ script: 'echo hi' })
		});
		assert.equal(response.status, 400);
		assert.match((await response.json()).error, /no tests/i);
	} finally {
		exerciseService.getExerciseWithTests = original;
		await new Promise(resolve => server.close(resolve));
	}
});
