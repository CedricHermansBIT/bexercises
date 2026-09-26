const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const DatabaseService = require('../services/databaseService').constructor;

test('exercise edits roll back all test and order changes on failure', async () => {
	const service = new DatabaseService();
	service.db = await open({ filename: ':memory:', driver: sqlite3.Database });
	try {
		await service.db.exec('PRAGMA foreign_keys = ON');
		await service.createTables();
		await service.createLanguage({ id: 'bash', name: 'Bash' });
		await service.createChapter({ id: 'one', language_id: 'bash', name: 'One' });
		await assert.rejects(service.createExercise({ id: 'failed', chapter_id: 'one', title: 'Failed',
			testCases: [{ expectedOutput: 'one' }, { arguments: [1n] }]
		}), /BigInt/);
		assert.equal(await service.getExerciseWithTests('failed'), null);
		await service.createExercise({ id: 'ex', chapter_id: 'one', title: 'Original',
			testCases: [{ expectedOutput: 'original' }] });
		await assert.rejects(service.updateExercise('ex', {
			title: 'Changed', testCases: [{ expectedOutput: 'changed' }, { arguments: [1n] }]
		}), /BigInt/);
		let exercise = await service.getExerciseWithTests('ex');
		assert.equal(exercise.title, 'Original');
		assert.equal(exercise.testCases.length, 1);
		assert.equal(exercise.testCases[0].expectedOutput, 'original');
		await assert.rejects(service.updateExercise('ex', {
			testCases: [{ fixtures: ['missing.txt'] }]
		}), /Fixture not found/);
		assert.equal((await service.getExerciseWithTests('ex')).testCases.length, 1);
		await assert.rejects(service.reorderExercises([
			{ id: 'ex', chapter_id: 'one', order: 9 },
			{ id: 'ex', chapter_id: 'missing', order: 10 }
		]), /FOREIGN KEY/);
		exercise = await service.getExerciseWithTests('ex');
		assert.equal(exercise.chapter_id, 'one');
		assert.equal(exercise.order_num, 0);
	} finally {
		service.cache.clear();
		await service.db.close();
	}
});
