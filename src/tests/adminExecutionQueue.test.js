const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const config = require('../config');
const middleware = require('../middleware/adminExecutionQueue');

test('admin execution routes share the global execution scheduler', async () => {
	const oldParallel = config.docker.maxParallelTests;
	const oldQueue = config.docker.maxQueuedRuns;
	config.docker.maxParallelTests = 1;
	config.docker.maxQueuedRuns = 1;
	const first = new EventEmitter();
	const second = new EventEmitter();
	first.destroyed = false;
	second.destroyed = false;
	let started = 0;
	try {
		middleware({ method: 'POST', path: '/test-solution' }, first, () => { started++; });
		middleware({ method: 'POST', path: '/run-test-case' }, second, () => { started++; });
		await new Promise(resolve => setImmediate(resolve));
		assert.equal(started, 1);
		first.emit('finish');
		await new Promise(resolve => setImmediate(resolve));
		assert.equal(started, 2);
		second.emit('finish');
	} finally {
		config.docker.maxParallelTests = oldParallel;
		config.docker.maxQueuedRuns = oldQueue;
	}
});
