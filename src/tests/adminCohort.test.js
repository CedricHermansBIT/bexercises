const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const databaseService = require('../services/databaseService');

test('domain admins stay out of student rankings and bulk archiving', async () => {
	const db = await open({ filename: ':memory:', driver: sqlite3.Database });
	const originalDb = databaseService.db;
	const originalDomain = process.env.ADMIN_DOMAIN;
	let server;
	try {
		process.env.ADMIN_DOMAIN = '@school.example';
		await db.exec(`
			CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, display_name TEXT,
				is_admin INTEGER, is_archived INTEGER DEFAULT 0, archived_at TEXT, last_activity TEXT);
			CREATE TABLE user_progress (user_id INTEGER, exercise_id TEXT, completed INTEGER, attempts INTEGER);
			CREATE TABLE achievements (id TEXT PRIMARY KEY, points INTEGER);
			CREATE TABLE user_achievements (user_id INTEGER, achievement_id TEXT);
			INSERT INTO users VALUES (1, 'teacher@school.example', 'Teacher', 0, 0, NULL, '2026-09-25 12:00:00');
			INSERT INTO users VALUES (2, 'student@other.example', 'Student', 0, 0, NULL, '2026-09-25 12:00:00');
			INSERT INTO user_progress VALUES (1, 'ex', 1, 1), (2, 'ex', 1, 1);
			INSERT INTO achievements VALUES ('a', 10);
			INSERT INTO user_achievements VALUES (1, 'a'), (2, 'a');
		`);
		databaseService.db = db;
		assert.deepEqual((await databaseService.getLeaderboard()).map(row => row.display_name), ['Student']);
		assert.deepEqual((await databaseService.getAchievementLeaderboard()).map(row => row.display_name), ['Student']);
		assert.equal((await databaseService.getLeaderboard())[0].email, undefined);
		const app = express();
		app.use((req, _res, next) => { req.user = { isAdmin: true }; next(); });
		app.use('/api/admin', require('../routes/admin'));
		server = app.listen(0);
		const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/users/archive-active`, { method: 'POST' });
		assert.equal(response.status, 200);
		assert.equal((await db.get('SELECT is_archived FROM users WHERE id = 1')).is_archived, 0);
		assert.equal((await db.get('SELECT is_archived FROM users WHERE id = 2')).is_archived, 1);
	} finally {
		if (server) await new Promise(resolve => server.close(resolve));
		databaseService.db = originalDb;
		if (originalDomain === undefined) delete process.env.ADMIN_DOMAIN;
		else process.env.ADMIN_DOMAIN = originalDomain;
		await db.close();
	}
});
