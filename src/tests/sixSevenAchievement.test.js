const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const databaseService = require('../services/databaseService');

test('Six Seven is awarded after 67 distinct completed exercises', async () => {
	const db = await open({ filename: ':memory:', driver: sqlite3.Database });
	const originalDb = databaseService.db;
	try {
		await db.exec(`
			CREATE TABLE achievements (id TEXT PRIMARY KEY, name TEXT, description TEXT, icon TEXT,
				category TEXT, points INTEGER, requirement_type TEXT, requirement_value INTEGER, hidden INTEGER);
			CREATE TABLE user_achievements (user_id TEXT, achievement_id TEXT, progress INTEGER,
				earned_at TEXT, PRIMARY KEY (user_id, achievement_id));
			CREATE TABLE user_progress (user_id TEXT, exercise_id TEXT, completed INTEGER, attempts INTEGER);
			CREATE TABLE languages (id TEXT, name TEXT, order_num INTEGER);
		`);
		databaseService.db = db;
		await databaseService.seedDefaultAchievements();
		const achievement = await db.get('SELECT * FROM achievements WHERE id = ?', 'six-seven');
		assert.equal(achievement.requirement_type, 'exercises_completed');
		assert.equal(achievement.requirement_value, 67);
		assert.equal(achievement.icon, '🙌');
		for (let i = 0; i < 66; i++) {
			await db.run('INSERT INTO user_progress VALUES (?, ?, ?, ?)', ['student', `exercise-${i}`, 1, 1]);
		}
		assert.equal((await databaseService.checkAndAwardAchievements('student')).some(a => a.id === 'six-seven'), false);
		await db.run('INSERT INTO user_progress VALUES (?, ?, ?, ?)', ['student', 'exercise-66', 1, 1]);
		assert.equal((await databaseService.checkAndAwardAchievements('student')).some(a => a.id === 'six-seven'), true);
		assert.equal((await databaseService.checkAndAwardAchievements('student')).some(a => a.id === 'six-seven'), false);
	} finally {
		databaseService.db = originalDb;
		await db.close();
	}
});
