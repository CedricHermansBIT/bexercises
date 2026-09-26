const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const databaseService = require('../services/databaseService');
const config = require('../config');
const { copyFixtures } = require('../services/dockerService');

test('replacing a fixture preserves its test association and applies stored permissions', async () => {
	const db = await open({ filename: ':memory:', driver: sqlite3.Database });
	const originalDb = databaseService.db;
	const originalFixtures = config.paths.fixtures;
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-fixture-test-'));
	try {
		await db.exec(`
			PRAGMA foreign_keys = ON;
			CREATE TABLE exercises (id TEXT PRIMARY KEY);
			CREATE TABLE test_cases (id INTEGER PRIMARY KEY, exercise_id TEXT, order_num INTEGER);
			CREATE TABLE fixture_files (id INTEGER PRIMARY KEY, filename TEXT UNIQUE, type TEXT,
				content TEXT, size INTEGER, permissions TEXT, updated_at TEXT);
			CREATE TABLE test_case_fixtures (test_case_id INTEGER, fixture_id INTEGER,
				FOREIGN KEY (fixture_id) REFERENCES fixture_files(id) ON DELETE CASCADE);
			INSERT INTO exercises VALUES ('ex');
			INSERT INTO test_cases VALUES (1, 'ex', 0);
		`);
		databaseService.db = db;
		await databaseService.createFixtureFile('seed.txt', 'before', 'file', 'rw-------');
		const original = await databaseService.getFixtureFile('seed.txt');
		await db.run('INSERT INTO test_case_fixtures VALUES (1, ?)', original.id);
		await databaseService.createFixtureFile('seed.txt', 'after', 'file', 'r--------');
		assert.equal((await databaseService.getFixtureFile('seed.txt')).id, original.id);
		const exercise = await databaseService.getExerciseWithTests('ex');
		assert.deepEqual(exercise.testCases[0].fixtures, ['seed.txt']);
		assert.deepEqual(exercise.testCases[0].fixturePermissions, { 'seed.txt': 'r--------' });
		const fixtureDir = path.join(root, 'fixtures');
		const workDir = path.join(root, 'work');
		await fs.mkdir(fixtureDir);
		await fs.mkdir(workDir);
		await fs.writeFile(path.join(fixtureDir, 'seed.txt'), 'after');
		config.paths.fixtures = fixtureDir;
		await copyFixtures(workDir, exercise.testCases[0].fixtures, exercise.testCases[0].fixturePermissions);
		assert.equal((await fs.stat(path.join(workDir, 'seed.txt'))).mode & 0o777, 0o400);
	} finally {
		databaseService.db = originalDb;
		config.paths.fixtures = originalFixtures;
		await db.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

test('nested fixture paths copy safely without escaping the workspace', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-nested-fixture-'));
	const oldFixtures = config.paths.fixtures;
	const fixtureDir = path.join(root, 'fixtures');
	const workDir = path.join(root, 'work');
	try {
		await fs.mkdir(path.join(fixtureDir, 'Scripts'), { recursive: true });
		await fs.mkdir(workDir);
		await fs.writeFile(path.join(fixtureDir, 'Scripts', 'placeholder_file.txt'), 'nested');
		config.paths.fixtures = fixtureDir;
		await copyFixtures(workDir, ['Scripts/placeholder_file.txt']);
		assert.equal(await fs.readFile(path.join(workDir, 'Scripts', 'placeholder_file.txt'), 'utf8'), 'nested');
		await assert.rejects(copyFixtures(workDir, ['../outside.txt']), /Invalid fixture path/);
		await fs.mkdir(path.join(root, 'outside'));
		await fs.writeFile(path.join(root, 'outside', 'secret.txt'), 'secret');
		await fs.symlink(path.join(root, 'outside'), path.join(fixtureDir, 'escape'));
		await assert.rejects(copyFixtures(workDir, ['escape/secret.txt']),
			/Fixture source escapes fixture directory/);
	} finally {
		config.paths.fixtures = oldFixtures;
		await fs.rm(root, { recursive: true, force: true });
	}
});
