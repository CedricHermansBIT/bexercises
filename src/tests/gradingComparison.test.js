const test = require('node:test');
const assert = require('node:assert/strict');
const { compareRunnerResults, compareOutputState } = require('../services/gradingComparison');

test('runner comparison includes stderr and execution failures', () => {
	const reference = { stdout: 'ok', stderr: 'warning', exitCode: 0 };
	assert.equal(compareRunnerResults({ ...reference, stderr: '' }, reference).passed, false);
	assert.equal(compareRunnerResults({ ...reference, timedOut: true }, reference).passed, false);
	assert.equal(compareRunnerResults(reference, { ...reference, outputLimited: true }).passed, false);
	assert.equal(compareRunnerResults(reference, reference).passed, true);
});

test('output comparison distinguishes file types and symlink targets', () => {
	const reference = { exists: true, type: 'link', linkTarget: 'correct.txt' };
	assert.equal(compareOutputState({ exists: true, type: 'link', linkTarget: 'wrong.txt' }, reference).matches, false);
	assert.equal(compareOutputState({ exists: true, type: 'file', sha256: 'same' }, reference).matches, false);
	assert.equal(compareOutputState({ ...reference }, reference).matches, true);
	const directory = { exists: true, type: 'directory', entries: [{ path: 'a', type: 'file', sha256: 'abc' }] };
	assert.equal(compareOutputState({ ...directory, entries: [{ path: 'a', type: 'file', sha256: 'def' }] }, directory).matches, false);
});
