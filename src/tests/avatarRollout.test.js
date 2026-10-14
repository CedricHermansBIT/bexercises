const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const database = require('../services/databaseService');
const { createAvatarService, DEFAULT_SELECTION } = require('../services/avatarService');

test('student ranking APIs expose equipped appearances while preserving cohort filtering and authentication', async () => {
    const previous = database.db;
    database.db = await open({ filename: ':memory:', driver: sqlite3.Database });
    let server;
    try {
        await database.createTables();
        await database.db.run(`INSERT INTO users(id,email,display_name,is_admin,is_archived) VALUES
            (1,'student@example.org','Student',0,0),(2,'teacher@example.org','Teacher',1,0),(3,'past@example.org','Archived',0,1)`);
        await database.db.run("INSERT INTO languages(id,name) VALUES('bash','Bash')");
        await database.db.run("INSERT INTO chapters(id,name,language_id) VALUES('chapter','Chapter','bash')");
        await database.db.run("INSERT INTO exercises(id,title,chapter_id) VALUES('ex','Exercise','chapter')");
        await database.db.run("INSERT INTO user_progress(user_id,exercise_id,completed,attempts) VALUES(1,'ex',1,2),(2,'ex',1,1),(3,'ex',1,1)");
        await database.db.run("INSERT INTO achievements(id,name,description,points) VALUES('preview','Preview','Test award',10)");
        await database.db.run("INSERT INTO user_achievements(user_id,achievement_id) VALUES(1,'preview'),(2,'preview'),(3,'preview')");
        const service = createAvatarService(database);
        await service.saveSelection(1, { ...DEFAULT_SELECTION, color: 'rose' });
        await service.saveLook(1, 1, { name: 'Private favourite', selection: DEFAULT_SELECTION });
        const app = express(); app.use(express.json());
        app.use((req, _res, next) => {
            const id = Number(req.headers['x-user']); req.user = id ? { id, isAdmin: id === 2 } : null;
            req.isAuthenticated = () => !!req.user; next();
        });
        app.use('/api', require('../routes/api'));
        app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: error.message }));
        server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
        const url = `http://127.0.0.1:${server.address().port}`;
        for (const endpoint of ['/api/leaderboard', '/api/leaderboard/bash', '/api/leaderboard-achievements']) {
            assert.equal((await fetch(url + endpoint)).status, 401);
            const response = await fetch(url + endpoint + '?includeAdmins=true', { headers: { 'x-user': '1' } });
            assert.equal(response.status, 200);
            const rows = await response.json(); assert.deepEqual(rows.map(row => row.id), [1]);
            assert.deepEqual(rows[0].avatar, { ...DEFAULT_SELECTION, color: 'rose' });
            assert.ok(!JSON.stringify(rows).includes('Private favourite'));
            assert.ok(!Object.hasOwn(rows[0], 'email')); assert.ok(!Object.hasOwn(rows[0], 'looks'));
            const adminRows = await (await fetch(url + endpoint + '?includeAdmins=true', { headers: { 'x-user': '2' } })).json();
            assert.deepEqual(adminRows.map(row => row.id).sort(), [1, 2]);
        }
        await database.db.run('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id IN (1,2)');
        assert.equal((await fetch(url + '/api/online-users')).status, 401);
        const online = await (await fetch(url + '/api/online-users', { headers: { 'x-user': '1' } })).json();
        assert.equal(online.count, 2);
        const student = online.users.find(user => user.displayName === 'Student');
        assert.deepEqual(student.avatar, { ...DEFAULT_SELECTION, color: 'rose' });
        assert.deepEqual(Object.keys(student).sort(), ['avatar', 'displayName', 'id', 'isAdmin', 'lastActivity']);
        assert.deepEqual(online.users.find(user => user.displayName === 'Teacher').avatar, DEFAULT_SELECTION);
        assert.ok(!JSON.stringify(online).includes('Private favourite'));
        assert.equal((await fetch(url + '/api/avatar/profiles/1')).status, 401);
        const profileResponse = await fetch(url + '/api/avatar/profiles/1', { headers: { 'x-user': '1' } });
        assert.equal(profileResponse.status, 200);
        assert.equal(profileResponse.headers.get('cache-control'), 'no-store');
        const profile = await profileResponse.json();
        assert.deepEqual(profile, { id: 1, displayName: 'Student', avatar: { ...DEFAULT_SELECTION, color: 'rose' },
            stats: { completed: 1, testRuns: 2, achievements: 1, points: 10 } });
        for (const id of ['2', '3', '999', '0', '1oops', '9007199254740993']) {
            assert.equal((await fetch(url + '/api/avatar/profiles/' + id, { headers: { 'x-user': '1' } })).status, 404);
        }
        const teacherProfile = await (await fetch(url + '/api/avatar/profiles/2', { headers: { 'x-user': '2' } })).json();
        assert.equal(teacherProfile.displayName, 'Teacher');
        assert.deepEqual(teacherProfile.stats, { completed: 1, testRuns: 1, achievements: 1, points: 10 });
        const appearance = await (await fetch(url + '/api/avatar/appearance', { headers: { 'x-user': '1' } })).json();
        assert.deepEqual(appearance, { selection: { ...DEFAULT_SELECTION, color: 'rose' } });
        assert.equal((await fetch(url + '/api/avatar/appearance')).status, 401);
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        database.cache.clear(); await database.db.close(); database.db = previous;
    }
});
