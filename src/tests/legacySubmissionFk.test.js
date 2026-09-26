const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const DatabaseService = require('../services/databaseService').constructor;

test('legacy submission history gains relationship checks without deleting old rows', async () => {
	const service = new DatabaseService();
	service.db = await open({ filename: ':memory:', driver: sqlite3.Database });
	try {
		await service.db.exec(`
			CREATE TABLE submission_attempts (id INTEGER PRIMARY KEY, user_id INTEGER, exercise_id TEXT,
				created_at TEXT, passed INTEGER, test_count INTEGER, runtime_ms INTEGER,
				failure_category TEXT, failed_test_number INTEGER);
			INSERT INTO submission_attempts (id, user_id, exercise_id, passed, test_count, runtime_ms)
				VALUES (1, 999, 'historical', 0, 1, 1);
		`);
		await service.createTables();
		assert.equal((await service.db.get('SELECT COUNT(*) AS count FROM submission_attempts')).count, 1);
		await assert.rejects(service.db.run(`INSERT INTO submission_attempts
			(user_id, exercise_id, passed, test_count, runtime_ms) VALUES (999, 'missing', 0, 1, 1)`),
		/Unknown submission user/);
		await service.createLanguage({ id: 'bash', name: 'Bash' });
		await service.createChapter({ id: 'chapter', language_id: 'bash', name: 'Chapter' });
		await service.createExercise({ id: 'ex', chapter_id: 'chapter', title: 'Exercise' });
		const user = await service.createUser({ google_id: 'test', email: 'test@example.invalid', display_name: 'Test' });
		await service.db.run(`INSERT INTO submission_attempts
			(user_id, exercise_id, passed, test_count, runtime_ms) VALUES (?, 'ex', 1, 1, 1)`, user.id);
		await service.db.run('DELETE FROM users WHERE id = ?', user.id);
		assert.deepEqual((await service.db.all('SELECT id FROM submission_attempts')).map(row => row.id), [1]);
	} finally {
		service.cache.clear();
		await service.db.close();
	}
});
