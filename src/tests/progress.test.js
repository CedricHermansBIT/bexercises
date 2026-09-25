const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const databaseService = require('../services/databaseService');

test('completion remains earned after a later failed attempt', async () => {
	const db = await open({ filename: ':memory:', driver: sqlite3.Database });
	const originalDb = databaseService.db;
	try {
		await db.exec(`CREATE TABLE user_progress (
			user_id TEXT, exercise_id TEXT, completed INTEGER, last_submission TEXT,
			last_submission_at TEXT, completed_at TEXT, attempts INTEGER, attempts_to_completion INTEGER,
			successful_attempts INTEGER, failed_attempts INTEGER,
			PRIMARY KEY (user_id, exercise_id))`);
		databaseService.db = db;
		await databaseService.saveUserProgress('student', 'exercise', { completed: true, last_submission: 'pass' });
		await databaseService.saveUserProgress('student', 'exercise', { completed: false, last_submission: 'fail' });
		const progress = await databaseService.getUserProgress('student', 'exercise');
		assert.equal(progress.completed, 1);
		assert.equal(progress.attempts, 2);
		assert.equal(progress.attempts_to_completion, 1);
		assert.equal(progress.successful_attempts, 1);
		assert.equal(progress.failed_attempts, 1);
		assert.equal(progress.last_submission, 'fail');
		assert.ok(progress.completed_at);
	} finally {
		databaseService.db = originalDb;
		await db.close();
	}
});

test('first completion records the attempt count once', async () => {
	const db = await open({ filename: ':memory:', driver: sqlite3.Database });
	const originalDb = databaseService.db;
	try {
		await db.exec(`CREATE TABLE user_progress (
			user_id TEXT, exercise_id TEXT, completed INTEGER, last_submission TEXT,
			last_submission_at TEXT, completed_at TEXT, attempts INTEGER, attempts_to_completion INTEGER,
			successful_attempts INTEGER, failed_attempts INTEGER,
			PRIMARY KEY (user_id, exercise_id))`);
		databaseService.db = db;
		await databaseService.saveUserProgress('student', 'exercise', { completed: false, last_submission: 'fail' });
		await databaseService.saveUserProgress('student', 'exercise', { completed: true, last_submission: 'pass' });
		await databaseService.saveUserProgress('student', 'exercise', { completed: false, last_submission: 'rerun' });
		const progress = await databaseService.getUserProgress('student', 'exercise');
		assert.equal(progress.attempts, 3);
		assert.equal(progress.attempts_to_completion, 2);
		assert.equal((await databaseService.getAllExercisesGlobalStats()).exercise.avgTries, 2);
	} finally {
		databaseService.db = originalDb;
		await db.close();
	}
});

test('first-try achievements survive reruns after completion', async () => {
	const db = await open({ filename: ':memory:', driver: sqlite3.Database });
	const originalDb = databaseService.db;
	try {
		await db.exec(`
			CREATE TABLE user_progress (user_id TEXT, completed INTEGER, attempts INTEGER, attempts_to_completion INTEGER);
			CREATE TABLE achievements (id TEXT PRIMARY KEY, requirement_type TEXT, requirement_value INTEGER);
			CREATE TABLE user_achievements (user_id TEXT, achievement_id TEXT, progress INTEGER, earned_at TEXT);
			INSERT INTO user_progress VALUES ('student', 1, 4, 1);
			INSERT INTO achievements VALUES ('first-try', 'first_try_completions', 1);
		`);
		databaseService.db = db;
		const earned = await databaseService.checkAndAwardAchievements('student');
		assert.deepEqual(earned.map(achievement => achievement.id), ['first-try']);
	} finally {
		databaseService.db = originalDb;
		await db.close();
	}
});
