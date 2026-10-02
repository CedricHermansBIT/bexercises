const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const databaseService = require('../services/databaseService');
const activity = require('../services/activityService');

test('activity migration preserves records and reports local practice days without counting reruns as completions', async () => {
	const db = await open({ filename: ':memory:', driver: sqlite3.Database });
	const originalDb = databaseService.db;
	const originalDomain = process.env.ADMIN_DOMAIN;
	let server;
	try {
		process.env.ADMIN_DOMAIN = '@school.example';
		await db.exec(`
			CREATE TABLE users (id INTEGER PRIMARY KEY, display_name TEXT, email TEXT, is_admin INTEGER, is_archived INTEGER);
			CREATE TABLE languages (id TEXT, name TEXT, order_num INTEGER);
			CREATE TABLE chapters (id TEXT, name TEXT, language_id TEXT, order_num INTEGER);
			CREATE TABLE exercises (id TEXT, title TEXT, chapter_id TEXT);
			CREATE TABLE user_progress (user_id INTEGER, exercise_id TEXT, completed INTEGER, completed_at TEXT, last_submission TEXT);
			CREATE TABLE submission_attempts (id INTEGER PRIMARY KEY, user_id INTEGER, exercise_id TEXT, created_at TEXT,
				passed INTEGER, runtime_ms INTEGER, failure_category TEXT, failed_test_number INTEGER);
			INSERT INTO users VALUES (1, 'Alice', 'alice@students.example', 0, 0),
				(2, 'Inactive', 'inactive@students.example', 0, 0),
				(3, 'Archived', 'archived@students.example', 0, 1),
				(4, 'Domain admin', 'teacher@school.example', 0, 0);
			INSERT INTO languages VALUES ('bash', 'Bash', 1), ('python', 'Python', 2);
			INSERT INTO chapters VALUES ('c1', 'Basics', 'bash', 1), ('c2', 'Python basics', 'python', 1);
			INSERT INTO exercises VALUES ('e1', 'First exercise', 'c1'), ('e2', 'Second exercise', 'c2');
			INSERT INTO user_progress VALUES (1, 'e1', 1, '2026-03-29 21:59:59', 'private code');
			INSERT INTO submission_attempts VALUES
				(1, 1, 'e1', '2026-03-28T23:30:00Z', 0, 12, 'output_differs', 1),
				(2, 1, 'e1', '2026-03-29T21:59:59Z', 1, 13, NULL, NULL),
				(3, 1, 'e1', '2026-03-29T21:59:59.500Z', 1, 14, NULL, NULL),
				(4, 1, 'e1', '2026-03-29T22:00:00Z', 1, 15, NULL, NULL),
				(5, 1, 'e2', '2026-03-29T12:00:00Z', 0, 16, 'configuration_error', 1),
				(6, 3, 'e1', '2026-03-29T12:00:00Z', 1, 17, NULL, NULL),
				(7, 4, 'e1', '2026-03-29T12:00:00Z', 1, 18, NULL, NULL);
		`);
		databaseService.db = db;
		const before = await db.all('SELECT * FROM submission_attempts');
		await activity.ensureActivityIndexes(db);
		await activity.ensureActivityIndexes(db);
		assert.deepEqual(await db.all('SELECT * FROM submission_attempts'), before);
		assert.equal((await db.get('SELECT last_submission FROM user_progress')).last_submission, 'private code');
		const query = { start: '2026-03-29', end: '2026-03-29', timezone: 'Europe/Brussels' };
		const report = await activity.getActivity(query);
		assert.deepEqual(report.summary, { students: 2, activeStudents: 1, submissions: 4, configurationErrors: 1, firstCompletions: 1 });
		assert.equal(report.daily[0].activeStudents, 1);
		assert.equal(report.students[0].practiceDays, 1);
		assert.equal(report.students[0].exercisesAttempted, 1);
		assert.equal(report.students[1].submissions, 0);
		assert.equal(report.exercises.find(ex => ex.id === 'e2').activeStudents, 0);
		assert.equal((await activity.getActivity({ ...query, includeArchived: 'true' })).summary.students, 3);
		assert.equal((await activity.getActivity({ ...query, language: 'python' })).summary.submissions, 1);
		assert.equal((await activity.getActivity({ ...query, chapter: 'c1' })).summary.submissions, 3);
		const detail = await activity.getActivity(query, '1');
		assert.equal(detail.timeline.length, 4);
		assert.equal(detail.timeline[0].id, 3);
		assert.ok(!JSON.stringify(detail).includes('private code'));
		await assert.rejects(activity.getActivity(query, '4'), { statusCode: 404 });
		for (const invalid of [{ end: 'bad' }, { start: '2026-02-30' }, { timezone: 'invalid' },
			{ start: '2025-01-01', end: '2026-01-02' }]) {
			assert.throws(() => activity.validateOptions(invalid), { statusCode: 400 });
		}
		await db.exec(`INSERT INTO submission_attempts VALUES
			(8, 1, 'e1', '2026-10-24T22:30:00Z', 0, 1, 'output_differs', 1),
			(9, 1, 'e1', '2026-10-25T00:30:00Z', 1, 1, NULL, NULL),
			(10, 1, 'e1', '2026-10-25T01:30:00Z', 1, 1, NULL, NULL),
			(11, 1, 'e1', '2026-10-25T22:59:59Z', 1, 1, NULL, NULL),
			(12, 1, 'e1', '2026-10-25T23:00:00Z', 1, 1, NULL, NULL)`);
		const autumn = await activity.getActivity({ start: '2026-10-25', end: '2026-10-25', timezone: 'Europe/Brussels' });
		assert.equal(autumn.summary.submissions, 4);
		assert.equal(autumn.students[0].practiceDays, 1);
		const emptyDays = await activity.getActivity({ start: '2026-10-20', end: '2026-10-26', timezone: 'Europe/Brussels' });
		assert.equal(emptyDays.daily.length, 7);
		assert.equal(emptyDays.daily[0].submissions, 0);
		const app = express();
		app.use((req, _res, next) => {
			if (req.headers['x-role'] === 'student') req.user = { email: 'student@students.example' };
			if (req.headers['x-role'] === 'admin') req.user = { email: 'teacher@school.example' };
			next();
		});
		app.use('/api/admin', require('../routes/admin'));
		app.use(require('../middleware/errorHandler').errorMiddleware);
		server = app.listen(0);
		const url = `http://127.0.0.1:${server.address().port}/api/admin/activity`;
		for (const endpoint of ['', '/filters', '/students/1']) {
			assert.equal((await fetch(url + endpoint)).status, 401);
			assert.equal((await fetch(url + endpoint, { headers: { 'x-role': 'student' } })).status, 403);
			assert.equal((await fetch(url + endpoint, { headers: { 'x-role': 'admin' } })).status, 200);
		}
	} finally {
		if (server) await new Promise(resolve => server.close(resolve));
		databaseService.db = originalDb;
		if (originalDomain === undefined) delete process.env.ADMIN_DOMAIN;
		else process.env.ADMIN_DOMAIN = originalDomain;
		await db.close();
	}
});
