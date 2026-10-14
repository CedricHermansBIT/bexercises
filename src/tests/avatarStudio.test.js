const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const DatabaseService = require('../services/databaseService').constructor;
const { createAvatarService, DEFAULT_SELECTION, validateSelection } = require('../services/avatarService');
const createAvatarRouter = require('../routes/avatar');

async function setup() {
    const database = new DatabaseService();
    database.db = await open({ filename: ':memory:', driver: sqlite3.Database });
    await database.db.exec('PRAGMA foreign_keys = ON'); await database.createTables();
    await database.db.run("INSERT INTO users (id, email, is_admin) VALUES (1, 'one@example.org', 1), (2, 'two@example.org', 1), (3, 'student@example.org', 0)");
    return { database, service: createAvatarService(database), close: async () => { database.cache.clear(); await database.db.close(); } };
}

test('five named looks are account-scoped, persist, replace and delete without equipping', async () => {
    const { service, database, close } = await setup();
    try {
        const look = { ...DEFAULT_SELECTION, color: 'rose', idle: 'idle-shy', celebration: 'cel-dance' };
        for (let slot = 1; slot <= 5; slot++) await service.saveLook(1, slot, { name: `Look ${slot}`, selection: look });
        assert.equal((await service.getState(1)).looks.length, 5);
        assert.deepEqual((await service.getState(1)).selection, DEFAULT_SELECTION);
        assert.equal((await service.getState(2)).looks.length, 0);
        await service.saveLook(1, 2, { name: 'Exam mode', selection: { ...look, color: 'slate' } });
        const stored = (await service.getState(1)).looks.find(l => l.slot === 2);
        assert.equal(stored.name, 'Exam mode'); assert.equal(stored.selection.color, 'slate');
        await service.deleteLook(2, 2); assert.equal((await service.getState(1)).looks.length, 5);
        await service.deleteLook(1, 2); assert.equal((await service.getState(1)).looks.length, 4);
        await assert.rejects(service.saveLook(1, 6, { name: 'Extra', selection: look }), /Invalid saved look/);
        await assert.rejects(service.saveLook(1, 1, { name: ' ', selection: look }), /Invalid saved look/);
        await assert.rejects(service.saveLook(1, 1, { name: 'x'.repeat(41), selection: look }), /Invalid saved look/);
        await assert.rejects(service.saveLook(1, 1, { name: 'Locked', selection: { ...look, hat: 'space-helmet' } }), /Unlock/);
        await database.db.run('DELETE FROM users WHERE id = 1');
        assert.equal((await database.db.get('SELECT COUNT(*) AS n FROM user_avatar_looks')).n, 0);
    } finally { await close(); }
});

test('old one-accessory records migrate to independent slots without losing their unlocks', async () => {
    for (const [id, slot] of [['headphones', 'audio'], ['wings', 'back'], ['lightning', 'jewellery'], ['crown', 'hat']]) {
        const old = { character: 'robot', outfit: 'tee', accessory: id, color: 'sky', skin: 'skin-warm', hair: 'crop', hairColor: 'hair-black', pantsColor: 'pants-navy', shoesColor: 'shoes-cream', hat: 'hat-none' };
        const migrated = validateSelection(old); assert.equal(migrated[slot], id); assert.equal(migrated.accessory, 'none');
    }
    const { service, database, close } = await setup();
    try {
        await database.awardAchievement(1, 'helpful-nudge'); await database.awardAchievement(1, 'persistent'); await database.awardAchievement(1, 'unstoppable');
        const layered = { ...DEFAULT_SELECTION, accessory: 'glasses', audio: 'headphones', back: 'wings', jewellery: 'jewel-none' };
        assert.deepEqual((await service.saveSelection(1, layered)).selection, layered);
        await service.saveSelection(1, { character: 'robot', outfit: 'hoodie', accessory: 'none', color: 'mint' });
        const state = await service.getState(1); assert.equal(state.selection.audio, 'headphones'); assert.equal(state.selection.back, 'wings');
    } finally { await close(); }
});

test('next unlocks use real attempts and first-try counters and do not grant achievements', async () => {
    const { service, database, close } = await setup();
    try {
        await database.createLanguage({ id: 'bash', name: 'Bash' }); await database.createChapter({ id: 'one', name: 'One', language_id: 'bash' });
        for (const id of ['a', 'b']) await database.createExercise({ id, chapter_id: 'one', title: id, solution: 'true' });
        await database.db.run("INSERT INTO user_progress (user_id, exercise_id, attempts, attempts_to_completion, completed, completed_at) VALUES (1, 'a', 20, 1, 1, CURRENT_TIMESTAMP), (1, 'b', 37, NULL, 0, NULL)");
        const before = await database.getUserAchievementPoints(1); const state = await service.getState(1);
        const nice = state.catalog.find(i => i.id === 'glasses-69'); assert.equal(nice.progress, 57); assert.equal(nice.target, 69); assert.match(nice.progressLabel, /12 more test runs/); assert.equal(nice.unlocked, false);
        const flawless = state.catalog.find(i => i.id === 'hair-silver'); assert.equal(flawless.progress, 1); assert.equal(flawless.target, 5);
        assert.ok(state.nextUnlocks.length > 0); assert.ok(!state.nextUnlocks.some(i => i.secret));
        assert.equal(await database.getUserAchievementPoints(1), before);
        await database.db.run("UPDATE user_progress SET attempts = 30 WHERE exercise_id = 'a'");
        assert.equal((await service.getState(1)).catalog.find(i => i.id === 'hair-silver').progress, 1);
    } finally { await close(); }
});

test('language rewards require the matching mastery achievement and remain permanently wearable', async () => {
    const { service, database, close } = await setup();
    try {
        for (const id of ['python', 'bash', 'sql']) await database.createLanguage({ id, name: id });
        await database.awardAchievement(1, 'language-master-python');
        let state = await service.getState(1);
        assert.equal(state.catalog.find(i => i.id === 'python-snake').unlocked, true);
        assert.equal(state.catalog.find(i => i.id === 'terminal-pack').unlocked, false);
        assert.equal(state.catalog.find(i => i.id === 'database-hat').unlocked, false);
        const look = { ...DEFAULT_SELECTION, companion: 'python-snake' }; await service.saveSelection(1, look);
        await database.db.run('DELETE FROM user_achievements WHERE user_id = 1');
        state = await service.saveSelection(1, look); assert.equal(state.selection.companion, 'python-snake');
    } finally { await close(); }
});

test('saved-look API allows students and rejects extra fields and locked gear; deleting cannot target another account', async () => {
    const { database, close } = await setup(); const app = express(); app.use(express.json());
    app.use((req, _res, next) => { const id = Number(req.headers['x-user']); req.user = id ? { id, is_admin: id !== 3 ? 1 : 0 } : null; req.isAuthenticated = () => !!req.user; next(); });
    app.use('/avatar', createAvatarRouter(database)); app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: error.message }));
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/avatar/looks/1`;
    const put = (id, body) => fetch(url, { method: 'PUT', headers: { 'x-user': String(id), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    try {
        assert.equal((await put(0, { name: 'One', selection: DEFAULT_SELECTION })).status, 401);
        assert.equal((await put(3, { name: 'One', selection: DEFAULT_SELECTION })).status, 200);
        assert.equal((await put(3, { name: 'Locked', selection: { ...DEFAULT_SELECTION, back: 'wings' } })).status, 400);
        assert.equal((await put(1, { name: 'One', selection: DEFAULT_SELECTION, userId: 2 })).status, 400);
        assert.equal((await put(1, { name: 'One', selection: { ...DEFAULT_SELECTION, back: 'wings' } })).status, 400);
        assert.equal((await put(1, { name: 'One', selection: DEFAULT_SELECTION })).status, 200);
        assert.equal((await fetch(url, { method: 'DELETE', headers: { 'x-user': '2' } })).status, 200);
        assert.equal((await database.db.get('SELECT COUNT(*) AS n FROM user_avatar_looks WHERE user_id = 1')).n, 1);
    } finally { await new Promise(resolve => server.close(resolve)); await close(); }
});

test('unlock speed counters and awards agree for SQLite and ISO submission timestamps', async () => {
    const { service, database, close } = await setup();
    try {
        await database.createLanguage({ id: 'bash', name: 'Bash' });
        await database.createChapter({ id: 'speed', name: 'Speed', language_id: 'bash' });
        const time = new Date(Date.now() - 600000).toISOString();
        for (const [id, stamp] of [['a', time], ['b', time.replace('T', ' ').slice(0, 19)], ['c', time]]) {
            await database.createExercise({ id, chapter_id: 'speed', title: id, solution: 'true' });
            await database.db.run('INSERT INTO user_progress (user_id, exercise_id, completed, attempts, completed_at) VALUES (1, ?, 1, 1, ?)', [id, stamp]);
        }
        const item = (await service.getState(1)).catalog.find(i => i.id === 'lightning');
        assert.equal(item.progress, 3); assert.equal(item.target, 3); assert.equal(item.unlocked, false);
        assert.ok((await database.checkSpeedAchievements(1)).some(a => a.id === 'speed-demon'));
        assert.equal((await service.getState(1)).catalog.find(i => i.id === 'lightning').unlocked, true);
    } finally { await close(); }
});
