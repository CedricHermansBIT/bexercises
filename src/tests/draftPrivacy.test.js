const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

test('local drafts stay within the authenticated user namespace', async () => {
	const values = new Map([['bash-exercises-progress', JSON.stringify({ exercise: { code: 'private legacy code' } })]]);
	global.localStorage = {
		getItem: key => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		removeItem: key => values.delete(key)
	};
	try {
		const source = await fs.readFile(path.join(__dirname, '../../frontend/js/services/storageService.js'), 'utf8');
		const { default: StorageService } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
		const alice = new StorageService(1);
		assert.equal(alice.getExerciseProgress('exercise'), null);
		alice.updateExerciseProgress('exercise', 'Alice code', false);
		const bob = new StorageService(2);
		assert.equal(bob.getExerciseProgress('exercise'), null);
		assert.equal(alice.getExerciseProgress('exercise').code, 'Alice code');
		assert.equal(values.has('bash-exercises-progress'), false);
	} finally {
		delete global.localStorage;
	}
});
