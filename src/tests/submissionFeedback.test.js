const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const databaseService = require('../services/databaseService');
const { classifyFailure } = require('../services/submissionFeedback');

test('failure categories identify timeout, output, stderr, and bad reference configuration', () => {
	assert.equal(classifyFailure({ passed: false, timedOut: true }), 'timeout');
	assert.equal(classifyFailure({ passed: false, outputLimited: true }), 'output_limit');
	assert.equal(classifyFailure({ passed: false, configurationError: 'Reference timed out' }), 'configuration_error');
	assert.equal(classifyFailure({ passed: false, exitCode: 1, expectedExitCode: 0 }), 'wrong_exit_code');
	assert.equal(classifyFailure({ passed: false, exitCode: 0, expectedExitCode: 0,
		actualOutput: 'wrong', expectedOutput: 'right' }), 'wrong_output');
	assert.equal(classifyFailure({ passed: false, exitCode: 0, expectedExitCode: 0,
		actualOutput: 'same', expectedOutput: 'same', actualStderr: 'warning', expectedStderr: '' }), 'wrong_stderr');
});

test('attempt history supplies failure reasons without storing submitted code', async () => {
	const db = await open({ filename: ':memory:', driver: sqlite3.Database });
	const originalDb = databaseService.db;
	try {
		await db.exec(`
			CREATE TABLE submission_attempts (id INTEGER PRIMARY KEY, user_id TEXT, exercise_id TEXT,
				created_at TEXT DEFAULT CURRENT_TIMESTAMP, passed INTEGER, test_count INTEGER,
				runtime_ms INTEGER, failure_category TEXT, failed_test_number INTEGER);
			CREATE TABLE user_progress (user_id TEXT, exercise_id TEXT, completed INTEGER,
				attempts INTEGER, successful_attempts INTEGER, failed_attempts INTEGER, started_at TEXT);
		`);
		databaseService.db = db;
		await db.run('INSERT INTO user_progress VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
			['student', 'exercise', 0, 1, 0, 1]);
		await databaseService.saveSubmissionAttempt('student', 'exercise',
			[{ passed: false, testNumber: 3, failureCategory: 'wrong_output' }], 123);
		const stats = await databaseService.getExerciseStatistics('student', 'exercise');
		assert.deepEqual(stats.failureReasons, { wrong_output: 1 });
		assert.deepEqual(await db.get('SELECT runtime_ms, failed_test_number FROM submission_attempts'),
			{ runtime_ms: 123, failed_test_number: 3 });
		assert.equal((await db.all('PRAGMA table_info(submission_attempts)')).some(column => column.name === 'code'), false);
	} finally {
		databaseService.db = originalDb;
		await db.close();
	}
});
