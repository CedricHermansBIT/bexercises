const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const createPageAccess = require('../middleware/pageAccess');

test('page access is checked before static HTML for root, base-path and encoded requests', async () => {
    const app = express();
    app.use((req, _res, next) => {
        const role = req.headers['x-role'];
        req.user = role ? { id: 1, isAdmin: role === 'admin' } : null;
        req.isAuthenticated = () => !!req.user;
        next();
    });
    app.use(createPageAccess('/bitlab'));
    for (const prefix of ['', '/bitlab']) app.get(prefix + '/pages/admin/avatar.html', (_req, res) => res.redirect(302, '../avatar.html'));
    const config = require('../config');
    const previousBase = config.server.basePath;
    config.server.basePath = '/bitlab';
    app.use('/auth', (req, _res, next) => { req.logout = done => done(null); next(); }, require('../routes/auth'));
    config.server.basePath = previousBase;
    const frontend = path.join(__dirname, '../../frontend');
    app.use('/bitlab', express.static(frontend)); app.use(express.static(frontend));
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const get = (url, role) => fetch(origin + url, { redirect: 'manual', headers: role ? { 'x-role': role } : {} });
    try {
        for (const prefix of ['', '/bitlab']) {
            assert.equal((await get(prefix + '/pages/login.html')).status, 200);
            for (const page of ['languages', 'exercises', 'workspace', 'leaderboard', 'achievements', 'avatar', 'admin/index', 'admin/users', 'admin']) {
                const response = await get(`${prefix}/pages/${page}.html`);
                assert.equal(response.status, 302); assert.equal(response.headers.get('location'), '/bitlab/');
                assert.ok(!(await response.text()).includes('dashboard-grid'));
            }
            const studioAlias = await get(prefix + '/pages/admin/avatar.html', 'student');
            assert.equal(studioAlias.status, 302); assert.equal(studioAlias.headers.get('location'), '../avatar.html');
            const denied = await get(prefix + '/pages/admin/index.html', 'student');
            assert.equal(denied.status, 302); assert.equal(denied.headers.get('location'), prefix + '/pages/languages.html');
            const allowed = await get(prefix + '/pages/admin/index.html', 'admin');
            assert.equal(allowed.status, 200); assert.equal(allowed.headers.get('cache-control'), 'no-store');
            assert.ok((await allowed.text()).includes('admin-avatar-card'));
            assert.equal((await get(prefix + '/pages/avatar.html', 'student')).status, 200);
            for (const encoded of ['/pages/%61dmin/index.html', '/p%61ges/admin/index.html', '/pages%2Fadmin/index.html', '/pages//admin/index.html']) {
                assert.equal((await get(prefix + encoded)).status, 302);
                const response = await get(prefix + encoded, 'student');
                assert.equal(response.status, 302); assert.equal(response.headers.get('location'), prefix + '/pages/languages.html');
            }
            assert.equal((await get(prefix + '/styles.css')).status, 200);
            assert.equal((await get(prefix + '/favicon.ico')).status, 200);
        }
        const logout = await get('/auth/logout', 'student');
        assert.equal(logout.status, 302); assert.equal(logout.headers.get('location'), '/bitlab/');
        const upperBase = await get('/BITLAB/pages/admin/index.html', 'student');
        assert.equal(upperBase.status, 302); assert.equal(upperBase.headers.get('location'), '/bitlab/pages/languages.html');
        const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
        assert.ok(source.indexOf("app.use(require('./middleware/pageAccess')(basePath))") < source.indexOf('express.static('));
    } finally { await new Promise(resolve => server.close(resolve)); }
});
