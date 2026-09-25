const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const databaseService = require('../services/databaseService');
const exerciseService = require('../services/exerciseService');

test('chapter exercise API reports chapter and language names correctly', async () => {
	const db = await open({ filename: ':memory:', driver: sqlite3.Database });
	const original = databaseService.db;
	try {
		await db.exec(`
			CREATE TABLE languages (id TEXT PRIMARY KEY, name TEXT);
			CREATE TABLE chapters (id TEXT PRIMARY KEY, language_id TEXT, name TEXT);
			CREATE TABLE exercises (id TEXT PRIMARY KEY, chapter_id TEXT, title TEXT,
				description TEXT, order_num INTEGER);
			INSERT INTO languages VALUES ('bash', 'Shell scripting');
			INSERT INTO chapters VALUES ('loops', 'bash', 'Loops');
			INSERT INTO exercises VALUES ('for-loop', 'loops', 'For loops', '', 1);
		`);
		databaseService.db = db;
		const [exercise] = await exerciseService.getExercisesByChapter('loops');
		assert.equal(exercise.chapter, 'Loops');
		assert.equal(exercise.language_id, 'bash');
		assert.equal(exercise.language, 'Shell scripting');
	} finally {
		databaseService.cache.clear();
		databaseService.db = original;
		await db.close();
	}
});
