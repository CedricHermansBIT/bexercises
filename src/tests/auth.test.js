const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const express = require('express');
const { isAdmin } = require('../middleware/adminRole');
const { resolveSessionUser } = require('../middleware/auth');
const databaseService = require('../services/databaseService');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

test('returning OAuth users refresh stored email and display name', async () => {
	const db = await open({ filename: ':memory:', driver: sqlite3.Database });
	const original = databaseService.db;
	try {
		await db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, display_name TEXT); INSERT INTO users VALUES (1, 'old@example.org', 'Old name')");
		databaseService.db = db;
		const user = await databaseService.updateUserProfile(1, 'new@school.example', 'New name');
		assert.equal(user.email, 'new@school.example');
		assert.equal(user.display_name, 'New name');
	} finally {
		databaseService.db = original;
		await db.close();
	}
});

test('admin resolution applies the configured email and domain rules', () => {
	const oldEmails = process.env.ADMIN_EMAILS;
	const oldDomain = process.env.ADMIN_DOMAIN;
	try {
		process.env.ADMIN_EMAILS = 'teacher@example.org';
		process.env.ADMIN_DOMAIN = '@school.example';
		assert.equal(isAdmin({ email: 'TEACHER@example.org' }), true);
		assert.equal(isAdmin({ email: 'student@school.example' }), true);
		assert.equal(isAdmin({ email: 'student@example.org' }), false);
	} finally {
		if (oldEmails === undefined) delete process.env.ADMIN_EMAILS;
		else process.env.ADMIN_EMAILS = oldEmails;
		if (oldDomain === undefined) delete process.env.ADMIN_DOMAIN;
		else process.env.ADMIN_DOMAIN = oldDomain;
	}
});

test('session user reload ignores stale admin privileges', async () => {
	const original = databaseService.getUserById;
	const oldEmails = process.env.ADMIN_EMAILS;
	const oldDomain = process.env.ADMIN_DOMAIN;
	try {
		delete process.env.ADMIN_EMAILS;
		delete process.env.ADMIN_DOMAIN;
		let role = 1;
		databaseService.getUserById = async () => ({
			id: 7, google_id: 'google-7', email: 'user@example.org',
			display_name: 'User', is_admin: role
		});
		assert.equal((await resolveSessionUser(7)).isAdmin, true);
		role = 0;
		assert.equal((await resolveSessionUser({ id: 7, isAdmin: true })).isAdmin, false);
	} finally {
		databaseService.getUserById = original;
		if (oldEmails === undefined) delete process.env.ADMIN_EMAILS;
		else process.env.ADMIN_EMAILS = oldEmails;
		if (oldDomain === undefined) delete process.env.ADMIN_DOMAIN;
		else process.env.ADMIN_DOMAIN = oldDomain;
	}
});

test('production rejects the known fallback session secret', () => {
	const result = spawnSync(process.execPath, ['-e', "require('./src/config')"], {
		cwd: require('node:path').resolve(__dirname, '../..'),
		env: { ...process.env, NODE_ENV: 'production', SESSION_SECRET: 'fallback-secret-change-in-production' },
		encoding: 'utf8'
	});
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /SESSION_SECRET/);
});

test('anonymous requests cannot read student names from the API', async () => {
	const app = express();
	app.use((req, _res, next) => { req.isAuthenticated = () => false; next(); });
	app.use('/api', require('../routes/api'));
	const server = app.listen(0);
	try {
		for (const endpoint of ['/api/leaderboard', '/api/leaderboard-achievements', '/api/online-users']) {
			const response = await fetch(`http://127.0.0.1:${server.address().port}${endpoint}`);
			assert.equal(response.status, 401, endpoint);
		}
	} finally {
		await new Promise(resolve => server.close(resolve));
	}
});
