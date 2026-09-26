const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { getContainerCommand, createTempScript, runScriptInContainer, removeRecursive } = require('../services/dockerService');

function managedContainers() {
	const result = spawnSync(getContainerCommand(), [
		'ps', '--all', '--filter', 'label=bitlab.managed=true', '--format', '{{.Names}}'
	], { encoding: 'utf8' });
	assert.equal(result.status, 0, result.stderr);
	return new Set(result.stdout.trim().split('\n').filter(name => name.startsWith('bex-run-')));
}

test('runner removes its container after a timeout', {
	skip: process.env.RUN_CONTAINER_TESTS !== '1' ? 'Set RUN_CONTAINER_TESTS=1 for container integration tests' : false
}, async () => {
	const before = managedContainers();
	const temp = await createTempScript('#!/bin/bash\nsleep 5\n');
	try {
		const result = await runScriptInContainer(temp.tmpdir, temp.scriptFilename,
			{ ...temp.languageConfig, dockerImage: 'bitlab-runner:latest' }, [], [], 2500);
		assert.equal(result.timedOut, true);
	} finally {
		await removeRecursive(temp.tmpdir);
	}
	assert.deepEqual(managedContainers(), before);
});

test('runner passes literal backslash sequences to stdin', {
	skip: process.env.RUN_CONTAINER_TESTS !== '1' ? 'Set RUN_CONTAINER_TESTS=1 for container integration tests' : false
}, async () => {
	const temp = await createTempScript('#!/bin/bash\nod -An -tx1\n');
	try {
		const result = await runScriptInContainer(temp.tmpdir, temp.scriptFilename,
			{ ...temp.languageConfig, dockerImage: 'bitlab-runner:latest' }, [], ['\\n', '\\x41'], 10000);
		assert.equal(result.exitCode, 0, result.stderr || result.error);
		assert.match(result.stdout, /5c 6e 0a 5c 78 34 31 0a/);
	} finally {
		await removeRecursive(temp.tmpdir);
	}
});
