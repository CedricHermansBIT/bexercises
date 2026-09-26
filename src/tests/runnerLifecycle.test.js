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
