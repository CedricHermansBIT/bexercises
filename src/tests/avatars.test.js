const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const DatabaseService = require('../services/databaseService').constructor;
const { createAvatarService, DEFAULT_SELECTION } = require('../services/avatarService');
const createAvatarRouter = require('../routes/avatar');
const fs = require('node:fs');

async function database() {
    const service = new DatabaseService();
    service.db = await open({ filename: ':memory:', driver: sqlite3.Database });
    await service.db.exec('PRAGMA foreign_keys = ON');
    await service.createTables();
    await service.db.run("INSERT INTO users (id, email, is_admin) VALUES (1, 'admin@example.org', 1), (2, 'student@example.org', 0), (3, 'admin2@example.org', 1)");
    return service;
}

test('avatar selections round trip, reject locked and unknown items, and belong to their account', async () => {
    const db = await database();
    try {
        const service = createAvatarService(db);
        assert.deepEqual((await service.getState(1)).selection, DEFAULT_SELECTION);
        const selection = { character: 'sprout', outfit: 'hoodie', accessory: 'none', color: 'rose' };
        assert.deepEqual((await service.saveSelection(1, selection)).selection, selection);
        assert.deepEqual((await service.getState(1)).selection, selection);
        assert.deepEqual((await service.getState(3)).selection, DEFAULT_SELECTION);
        await assert.rejects(service.saveSelection(1, { ...selection, character: 'fox' }), /Unlock/);
        await assert.rejects(service.saveSelection(1, { ...selection, outfit: '<script>' }), /Unknown/);
        await assert.rejects(service.saveSelection(1, { ...selection, userId: 3 }), /Choose/);
        assert.deepEqual((await service.getState(1)).selection, selection);
    } finally { db.cache.clear(); await db.db.close(); }
});

test('completion and earned achievement unlocks persist without awarding points or changing progress', async () => {
    const db = await database();
    try {
        await db.createLanguage({ id: 'bash', name: 'Bash' });
        await db.createChapter({ id: 'one', language_id: 'bash', name: 'One' });
        for (let i = 0; i < 5; i++) {
            await db.createExercise({ id: `ex-${i}`, chapter_id: 'one', title: 'Exercise', solution: 'true' });
            await db.db.run('INSERT INTO user_progress (user_id, exercise_id, completed) VALUES (1, ?, 1)', [`ex-${i}`]);
        }
        await db.awardAchievement(1, 'helpful-nudge');
        const points = await db.getUserAchievementPoints(1);
        const service = createAvatarService(db);
        const state = await service.getState(1);
        assert.equal(state.completed, 5);
        for (const id of ['fox', 'lab-coat', 'headphones', 'glasses']) assert.equal(state.catalog.find(item => item.id === id).unlocked, true);
        assert.equal(state.catalog.find(item => item.id === 'crown').unlocked, false);
        const selection = { character: 'fox', outfit: 'lab-coat', accessory: 'glasses', color: 'mint' };
        await service.saveSelection(1, selection);
        assert.equal(await db.getUserAchievementPoints(1), points);
        assert.equal((await db.db.get('SELECT COUNT(*) AS n FROM user_progress WHERE user_id = 1 AND completed = 1')).n, 5);
        await db.db.run('DELETE FROM user_progress WHERE user_id = 1');
        await db.db.run('DELETE FROM user_achievements WHERE user_id = 1');
        const after = await service.getState(1);
        assert.equal(after.catalog.find(item => item.id === 'fox').unlocked, true);
        assert.equal(after.catalog.find(item => item.id === 'glasses').unlocked, true);
        assert.deepEqual((await service.saveSelection(1, selection)).selection, selection);
        assert.equal((await service.getState(3)).catalog.find(item => item.id === 'fox').unlocked, false);
    } finally { db.cache.clear(); await db.db.close(); }
});

test('avatar API requires admin authentication and cannot equip items for another account', async () => {
    const db = await database();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        const id = Number(req.headers['x-user']); req.user = id ? { id, is_admin: id === 1 || id === 3 ? 1 : 0 } : null; next();
    });
    app.use('/avatar', createAvatarRouter(db));
    app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ error: err.message }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/avatar`;
    try {
        assert.equal((await fetch(url)).status, 401);
        assert.equal((await fetch(url, { headers: { 'x-user': '2' } })).status, 403);
        const put = (user, body) => fetch(url, { method: 'PUT', headers: { 'x-user': String(user), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        assert.equal((await put(2, DEFAULT_SELECTION)).status, 403);
        assert.equal((await put(1, { ...DEFAULT_SELECTION, accessory: 'crown' })).status, 400);
        assert.equal((await put(1, { ...DEFAULT_SELECTION, userId: 3 })).status, 400);
        assert.equal((await put(1, { ...DEFAULT_SELECTION, color: 'violet' })).status, 200);
        assert.equal((await (await fetch(url, { headers: { 'x-user': '1' } })).json()).selection.color, 'violet');
        assert.equal((await (await fetch(url, { headers: { 'x-user': '3' } })).json()).selection.color, 'sky');
        const source = fs.readFileSync('src/app.js', 'utf8');
        assert.ok(source.indexOf("mountAtBothPaths('/pages/admin/avatar.html', requireAdmin)") < source.indexOf('express.static('));
        assert.ok(source.includes("mountAtBothPaths('/pages/admin/avatar.html', requireAdmin)"));
    } finally { await new Promise(resolve => server.close(resolve)); db.cache.clear(); await db.db.close(); }
});

test('avatar renderer falls back to trusted colors and escapes accessible labels', async () => {
    const source = fs.readFileSync('frontend/js/utils/avatarRenderer.js', 'utf8');
    const { renderAvatar } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const rendered = renderAvatar({ ...DEFAULT_SELECTION, color: '<script>' }, '"><script>bad</script>');
    assert.ok(!rendered.includes('<script>'));
    assert.ok(rendered.includes('&lt;script&gt;'));
    assert.ok(rendered.includes('#5f9ff5'));
    assert.ok(renderAvatar({ ...DEFAULT_SELECTION, character: 'fox', outfit: 'lab-coat', accessory: 'crown' }).includes('<svg'));
});
