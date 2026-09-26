const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const DatabaseService = require('../services/databaseService').constructor;

test('a failed attempt-history insert rolls back progress', async () => {
	const service = new DatabaseService();
	service.db = await open({ filename: ':memory:', driver: sqlite3.Database });
	try {
		await service.db.exec(`
			CREATE TABLE user_progress (user_id INTEGER, exercise_id TEXT, completed INTEGER,
				last_submission TEXT, last_submission_at TEXT, completed_at TEXT,
				attempts INTEGER, attempts_to_completion INTEGER,
				successful_attempts INTEGER, failed_attempts INTEGER);
			CREATE TABLE submission_attempts (user_id INTEGER, exercise_id TEXT, passed INTEGER,
				test_count INTEGER, runtime_ms INTEGER, failure_category TEXT, failed_test_number INTEGER);
			CREATE TRIGGER reject_attempt BEFORE INSERT ON submission_attempts
				BEGIN SELECT RAISE(ABORT, 'rejected attempt'); END;
		`);
		await assert.rejects(service.recordSubmission(1, 'ex', {
			completed: true, last_submission: 'echo pass'
		}, [{ passed: true }], 42), /rejected attempt/);
		assert.equal(await service.db.get('SELECT * FROM user_progress'), undefined);
		await service.db.exec('DROP TRIGGER reject_attempt');
		await service.recordSubmission(1, 'ex', {
			completed: true, last_submission: 'echo pass'
		}, [{ passed: true }], 42);
		assert.equal((await service.db.get('SELECT attempts FROM user_progress')).attempts, 1);
		assert.equal((await service.db.get('SELECT COUNT(*) AS count FROM submission_attempts')).count, 1);
	} finally {
		await service.db.close();
	}
});
