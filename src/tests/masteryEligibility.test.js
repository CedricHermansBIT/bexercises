const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const DatabaseService = require('../services/databaseService').constructor;

async function setup() {
    const service = new DatabaseService();
    service.db = await open({ filename: ':memory:', driver: sqlite3.Database });
    await service.createTables();
    await service.db.run("INSERT INTO users (id, email) VALUES (1, 'student@example.org')");
    for (const [id, enabled] of [['published', true], ['locked', false]]) {
        await service.createLanguage({ id, name: id, enabled });
        await service.createChapter({ id, name: id, language_id: id });
        await service.createExercise({ id, chapter_id: id, title: id, solution: 'true' });
    }
    return service;
}
async function complete(db, exercise) {
    await db.db.run('INSERT OR REPLACE INTO user_progress (user_id, exercise_id, completed) VALUES (1, ?, 1)', [exercise]);
    return db.checkChapterAchievements(1, exercise);
}

test('Complete Mastery ignores locked languages and grants its reward once', async () => {
    const db = await setup();
    try {
        const awarded = await complete(db, 'published');
        assert.ok(awarded.some(a => a.id === 'all-chapters'));
        assert.equal((await db.db.get("SELECT COUNT(*) AS n FROM user_progress WHERE exercise_id = 'locked'")).n, 0);
        assert.ok(!(await db.checkChapterAchievements(1, 'published')).some(a => a.id === 'all-chapters'));
    } finally { db.cache.clear(); await db.db.close(); }
});

test('newly published chapters must be completed before Complete Mastery is awarded', async () => {
    const db = await setup();
    try {
        await db.updateLanguage('locked', { enabled: true });
        assert.ok(!(await complete(db, 'published')).some(a => a.id === 'all-chapters'));
        assert.ok((await complete(db, 'locked')).some(a => a.id === 'all-chapters'));
    } finally { db.cache.clear(); await db.db.close(); }
});

test('an empty published curriculum cannot award Complete Mastery', async () => {
    const db = await setup();
    try {
        await db.updateLanguage('published', { enabled: false });
        assert.ok(!(await complete(db, 'locked')).some(a => a.id === 'all-chapters'));
    } finally { db.cache.clear(); await db.db.close(); }
});
