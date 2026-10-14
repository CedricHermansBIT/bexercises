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
        const selection = { ...DEFAULT_SELECTION, character: 'sprout', outfit: 'hoodie', color: 'rose', skin: 'skin-deep', hair: 'curls',
            hairColor: 'hair-copper', pantsColor: 'pants-plum', shoesColor: 'shoes-mint' };
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
        const service = createAvatarService(db);
        assert.equal((await service.getState(1)).catalog.find(item => item.id === 'fox').unlocked, false);
        for (const id of ['helpful-nudge', 'first-steps', 'quick-learner', 'persistent']) await db.awardAchievement(1, id);
        const points = await db.getUserAchievementPoints(1);
        const state = await service.getState(1);
        assert.equal(state.completed, 5);
        for (const id of ['fox', 'lab-coat', 'headphones', 'glasses']) assert.equal(state.catalog.find(item => item.id === id).unlocked, true);
        assert.equal(state.catalog.find(item => item.id === 'crown').unlocked, false);
        const selection = { ...DEFAULT_SELECTION, character: 'fox', outfit: 'lab-coat', accessory: 'glasses', color: 'mint' };
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
    assert.ok(rendered.includes('character-robot.png'));
    assert.ok(!rendered.includes('<svg'));
    assert.ok(renderAvatar({ ...DEFAULT_SELECTION, color: '<script>' }, 'Color', 'color').includes('background-color:rgb(97,162,221)'));
    assert.ok(renderAvatar({ ...DEFAULT_SELECTION, character: 'fox' }).includes('character-fox.png'));
    assert.ok(renderAvatar({ ...DEFAULT_SELECTION, outfit: 'lab-coat' }, 'Coat', 'outfit').includes('outfit-lab-coat.png'));
});

test('Blender wardrobe exports all modular selections and local thumbnails', async () => {
    const data = fs.readFileSync('frontend/assets/avatars/wardrobe.glb');
    assert.equal(data.toString('utf8', 0, 4), 'glTF');
    assert.equal(data.readUInt32LE(4), 2);
    assert.equal(data.readUInt32LE(8), data.length);
    assert.ok(data.length < 2 * 1024 * 1024);
    const jsonLength = data.readUInt32LE(12);
    const gltf = JSON.parse(data.subarray(20, 20 + jsonLength).toString());
    assert.ok(gltf.buffers.every(buffer => !buffer.uri));
    const ids = gltf.nodes.filter(node => node.extras?.avatar_slot).map(node => node.extras.avatar_id).sort();
    assert.deepEqual(ids, ['crop', 'curls', 'bob', 'bun', 'mohawk', 'braid', 'robot', 'sprout', 'fox', 'cat', 'tee', 'hoodie', 'lab-coat', 'space-suit', 'glasses', 'headphones', 'crown'].sort());
    assert.ok(gltf.materials.some(material => material.name === 'Skin'));
    const { CATALOG } = require('../services/avatarService');
    for (const item of CATALOG.filter(item => ['character', 'outfit', 'accessory', 'hair'].includes(item.slot))) {
        const png = fs.readFileSync(`frontend/assets/avatars/${item.slot}-${item.id}.png`);
        assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    }
    assert.equal(fs.readFileSync('src/avatar-models/wardrobe.blend').toString('ascii', 0, 7), 'BLENDER');
});

test('3D selections toggle model groups and apply only trusted skin and clothing palettes', async () => {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const bundle = fs.readFileSync('frontend/js/vendor/avatar3d.bundle.js', 'utf8');
    const { applyAvatarSelection } = await import(`data:text/javascript;base64,${Buffer.from(bundle).toString('base64')}`);
    const data = fs.readFileSync('frontend/assets/avatars/wardrobe.glb');
    const { scene } = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.length), '');
    const chosen = { ...DEFAULT_SELECTION, character: 'fox', hair: 'braid', outfit: 'lab-coat', accessory: 'crown', color: 'rose',
        skin: 'skin-deep', hairColor: 'hair-copper', pantsColor: 'pants-plum', shoesColor: 'shoes-mint' };
    applyAvatarSelection(scene, chosen);
    const active = [];
    scene.traverse(object => { if (object.userData.avatar_slot && object.visible) active.push(object.userData.avatar_id); });
    assert.deepEqual(active.sort(), ['fox', 'braid', 'lab-coat', 'crown'].sort());
    const paletteSource = fs.readFileSync('frontend/js/utils/avatarRenderer.js', 'utf8');
    const { AVATAR_PALETTES } = await import(`data:text/javascript;base64,${Buffer.from(paletteSource).toString('base64')}`);
    const slots = { Skin: 'skin', Hair: 'hairColor', Wardrobe: 'color', Denim: 'pantsColor', Shoes: 'shoesColor' };
    const checked = new Set();
    scene.traverse(object => {
        if (!object.isMesh) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            const slot = slots[material.name];
            if (slot) { assert.deepEqual(material.color.toArray(), AVATAR_PALETTES[slot][chosen[slot]]); checked.add(slot); }
        }
    });
    assert.equal(checked.size, 5);
    applyAvatarSelection(scene, DEFAULT_SELECTION);
    const original = [];
    scene.traverse(object => { if (object.userData.avatar_slot && object.visible) original.push(object.userData.avatar_id); });
    assert.deepEqual(original.sort(), ['robot', 'crop', 'tee'].sort());
});


test('legacy saved avatars keep their look and old clients preserve new customization', async () => {
    const db = await database();
    try {
        const legacy = { character: 'cat', outfit: 'tee', accessory: 'none', color: 'sky' };
        await db.db.run('INSERT INTO user_avatars (user_id, selection) VALUES (1, ?)', [JSON.stringify(legacy)]);
        await db.db.run("INSERT INTO user_avatar_unlocks (user_id, item_id) VALUES (1, 'cat')");
        const service = createAvatarService(db);
        const state = await service.getState(1);
        assert.equal(state.selection.hair, 'bun');
        assert.equal(state.selection.skin, 'skin-brown');
        assert.equal(state.catalog.find(item => item.id === 'bun').unlocked, true);
        await service.saveSelection(1, { ...state.selection, skin: 'skin-olive', pantsColor: 'pants-sand' });
        const updated = await service.saveSelection(1, { ...legacy, color: 'mint' });
        assert.equal(updated.selection.skin, 'skin-olive');
        assert.equal(updated.selection.pantsColor, 'pants-sand');
        assert.equal(updated.selection.hair, 'bun');
        await assert.rejects(service.saveSelection(1, { ...legacy, skin: 'skin-fair' }), /complete/);
    } finally { db.cache.clear(); await db.db.close(); }
});

test('special styles require the named earned achievement and remain unlocked permanently', async () => {
    const db = await database();
    try {
        const service = createAvatarService(db);
        const before = await service.getState(1);
        assert.match(before.catalog.find(item => item.id === 'mohawk').requirement, /Comeback Kid/);
        await assert.rejects(service.saveSelection(1, { ...DEFAULT_SELECTION, hair: 'mohawk' }), /Unlock/);
        await assert.rejects(service.saveSelection(1, { ...DEFAULT_SELECTION, hairColor: 'hair-silver' }), /Unlock/);
        await db.awardAchievement(1, 'comeback-kid');
        await db.awardAchievement(1, 'flawless');
        const look = { ...DEFAULT_SELECTION, hair: 'mohawk', hairColor: 'hair-silver' };
        await service.saveSelection(1, look);
        const reward = (await service.getState(1)).catalog.find(item => item.id === 'mohawk').reward;
        assert.equal(reward.id, 'comeback-kid');
        await db.db.run('DELETE FROM user_achievements WHERE user_id = 1');
        assert.deepEqual((await service.saveSelection(1, look)).selection, look);
    } finally { db.cache.clear(); await db.db.close(); }
});
