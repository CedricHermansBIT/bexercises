const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const databaseService = require('../services/databaseService');
const exerciseService = require('../services/exerciseService');

test('draft API preserves empty code without changing graded progress', async () => {
	const db = await open({ filename: ':memory:', driver: sqlite3.Database });
	const originalDb = databaseService.db;
	const originalExercise = exerciseService.getExerciseById;
	let authenticated = true;
	let server;
	try {
		await db.exec(`
			CREATE TABLE user_drafts (user_id TEXT, exercise_id TEXT, code TEXT,
				updated_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, exercise_id));
			CREATE TABLE user_progress (user_id TEXT, exercise_id TEXT, completed INTEGER,
				attempts INTEGER, last_submission TEXT, last_submission_at TEXT);
		`);
		databaseService.db = db;
		exerciseService.getExerciseById = async id => id === 'exercise' ? { id } : null;
		const app = express();
		app.use(express.json());
		app.use((req, _res, next) => {
			req.isAuthenticated = () => authenticated;
			req.user = { id: 'student' };
			next();
		});
		app.use('/api', require('../routes/api'));
		app.use(require('../middleware/errorHandler').errorMiddleware);
		server = app.listen(0);
		const url = `http://127.0.0.1:${server.address().port}/api/exercises/exercise/draft`;
		authenticated = false;
		assert.equal((await fetch(url)).status, 401);
		authenticated = true;
		const saved = await fetch(url, {
			method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: '' })
		});
		assert.equal(saved.status, 200);
		assert.equal((await fetch(url).then(response => response.json())).code, '');
		assert.equal((await db.get('SELECT COUNT(*) AS count FROM user_progress')).count, 0);
		assert.equal((await fetch(url, {
			method: 'PUT', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ code: 'x'.repeat(65537) })
		})).status, 400);
	} finally {
		if (server) await new Promise(resolve => server.close(resolve));
		exerciseService.getExerciseById = originalExercise;
		databaseService.db = originalDb;
		await db.close();
	}
});
