const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const DatabaseService = require('../services/databaseService').constructor;
const migrate = require('../scripts/migrateToDatabase');

test('JSON migration links fixtures on a fresh database', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-migration-'));
	const fixturesDir = path.join(root, 'fixtures');
	const jsonPath = path.join(root, 'exercises.json');
	const service = new DatabaseService();
	try {
		await fs.mkdir(fixturesDir);
		await fs.writeFile(path.join(fixturesDir, 'seed.txt'), 'seed contents');
		await fs.writeFile(jsonPath, JSON.stringify([{
			id: 'migration-fixture', chapter: 'Chapter One', title: 'Fixture exercise',
			description: '', solution: 'cat seed.txt',
			testCases: [{ fixtures: ['seed.txt'], expectedOutput: 'seed contents' }]
		}]));
		service.db = await open({ filename: ':memory:', driver: sqlite3.Database });
		await service.db.exec('PRAGMA foreign_keys = ON');
		await service.createTables();
		await migrate({ service, jsonPath, fixturesDir, initialize: false, close: false });
		const exercise = await service.getExerciseWithTests('migration-fixture');
		assert.deepEqual(exercise.testCases[0].fixtures, ['seed.txt']);
	} finally {
		service.cache.clear();
		if (service.db) await service.db.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
