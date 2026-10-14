const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const DatabaseService = require('../services/databaseService').constructor;
const { createAvatarService, DEFAULT_SELECTION } = require('../services/avatarService');
const { migrateAvatarRewards, REWARD_MOVES } = require('../services/avatarAchievements');
const { getAvatarProgress, progressFor } = require('../services/avatarProgressService');

async function setup(t) {
    const database = new DatabaseService();
    database.db = await open({ filename: ':memory:', driver: sqlite3.Database });
    await database.db.exec('PRAGMA foreign_keys = ON');
    await database.createTables();
    await database.db.run("INSERT INTO users(id,email) VALUES(1,'one@example.org'),(2,'two@example.org')");
    t.after(async () => { database.cache.clear(); await database.db.close(); });
    return { database, service: createAvatarService(database) };
}

test('custom appearance and personality achievements award once, refresh rewards and reject locked saves', async t => {
    const { database, service } = await setup(t);
    assert.deepEqual((await service.getState(1)).newAchievements, []);
    assert.deepEqual((await service.saveSelection(1, DEFAULT_SELECTION)).newAchievements, []);
    await assert.rejects(service.saveSelection(1, { ...DEFAULT_SELECTION, outfit: 'party-dress' }), /Unlock/);
    assert.equal(await database.getUserAchievementPoints(1), 0);
    const custom = { ...DEFAULT_SELECTION, color: 'rose' };
    const state = await service.saveSelection(1, custom);
    assert.deepEqual(state.newAchievements.map(a => a.id), ['made-it-mine']);
    assert.equal(state.catalog.find(i => i.id === 'star-pin').unlocked, true);
    assert.deepEqual((await service.saveSelection(1, custom)).newAchievements, []);
    const idle = { ...custom, idle: 'idle-confident' };
    assert.deepEqual((await service.saveSelection(1, idle)).newAchievements, []);
    const stats = await getAvatarProgress(database.db, 1);
    assert.equal(progressFor({ requirement_type: 'avatar_personality', requirement_value: 2 }, stats).current, 1);
    const animated = await service.saveSelection(1, { ...idle, celebration: 'cel-dance' });
    assert.deepEqual(animated.newAchievements.map(a => a.id), ['main-character-energy']);
    for (const id of ['studio-headset', 'golden']) assert.equal(animated.catalog.find(i => i.id === id).unlocked, true);
    assert.equal(await database.getUserAchievementPoints(1), 20);
    assert.deepEqual((await service.getState(1)).newAchievements, []);
    assert.equal(await database.getUserAchievementPoints(2), 0);
});

test('curator counts distinct visible looks, not names, repeated saves or different gestures', async t => {
    const { database, service } = await setup(t);
    for (let slot = 1; slot <= 3; slot++) await service.saveLook(1, slot, { name: `Look ${slot}`, selection: { ...DEFAULT_SELECTION, idle: slot === 2 ? 'idle-confident' : 'idle-relaxed' } });
    let state = await service.getState(1);
    assert.equal(state.catalog.find(i => i.id === 'party-dress').unlocked, false);
    let stats = await getAvatarProgress(database.db, 1);
    assert.equal(progressFor({ requirement_type: 'avatar_looks_saved', requirement_value: 3 }, stats).current, 1);
    await service.saveLook(1, 2, { name: 'Pink', selection: { ...DEFAULT_SELECTION, color: 'rose' } });
    state = await service.saveLook(1, 3, { name: 'Hoodie', selection: { ...DEFAULT_SELECTION, outfit: 'hoodie' } });
    assert.deepEqual(state.newAchievements.map(a => a.id), ['wardrobe-curator']);
    assert.deepEqual(state.selection, DEFAULT_SELECTION);
    for (const id of ['party-dress', 'tulle-skirt', 'starlight-dress']) assert.equal(state.catalog.find(i => i.id === id).unlocked, true);
    assert.deepEqual((await service.saveLook(1, 3, { name: 'Renamed', selection: { ...DEFAULT_SELECTION, outfit: 'hoodie' } })).newAchievements, []);
    await service.deleteLook(1, 3);
    state = await service.getState(1);
    assert.equal(state.catalog.find(i => i.id === 'party-dress').unlocked, true);
    assert.equal(await database.getUserAchievementPoints(1), 20);
});

test('reward reassignment removes legacy unlocks and equipped items once, without removing old achievements', async t => {
    const { database, service } = await setup(t);
    await database.db.run("DELETE FROM data_migrations WHERE id = 'avatar-achievement-rewards-v1'");
    for (const id of ['quick-learner', 'dedicated', 'first-steps', 'chapter-complete']) await database.awardAchievement(1, id);
    for (const [item] of REWARD_MOVES) await database.db.run('INSERT INTO user_avatar_unlocks(user_id,item_id) VALUES(1,?)', [item]);
    await database.db.run('INSERT INTO user_avatars(user_id,selection) VALUES(1,?)', [JSON.stringify({ ...DEFAULT_SELECTION, outfit: 'party-dress', pants: 'tulle-skirt', color: 'golden', audio: 'studio-headset', jewellery: 'star-pin' })]);
    await database.withWriteTransaction(() => migrateAvatarRewards(database.db));
    assert.deepEqual((await service.getAppearances([1])).get(1), DEFAULT_SELECTION);
    assert.equal((await database.db.get('SELECT COUNT(*) AS n FROM user_avatar_unlocks WHERE user_id=1')).n, 0);
    assert.equal((await database.getUserAchievements(1)).length, 4);
    let state = await service.getState(1);
    for (const [id] of REWARD_MOVES) assert.equal(state.catalog.find(i => i.id === id).unlocked, false);
    state = await service.saveSelection(1, { ...DEFAULT_SELECTION, color: 'rose' });
    await database.withWriteTransaction(() => migrateAvatarRewards(database.db));
    assert.equal((await service.getState(1)).catalog.find(i => i.id === 'star-pin').unlocked, true);
    await database.awardAchievement(2, 'quick-learner');
    assert.equal((await service.getState(2)).catalog.find(i => i.id === 'party-dress').unlocked, false);
});

test('existing avatar customisations receive achievements on opening the studio without repeat points', async t => {
    const { database, service } = await setup(t);
    await database.db.run('INSERT INTO user_avatars(user_id,selection) VALUES(1,?)', [JSON.stringify({ ...DEFAULT_SELECTION, hair: 'bob', idle: 'idle-shy', celebration: 'cel-bow' })]);
    const state = await service.getState(1);
    assert.deepEqual(state.newAchievements.map(a => a.id), ['made-it-mine', 'main-character-energy']);
    assert.deepEqual((await service.getState(1)).newAchievements, []);
    assert.equal(await database.getUserAchievementPoints(1), 20);
});
