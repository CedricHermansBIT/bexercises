const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const databaseService = require('../services/databaseService');
const exerciseService = require('../services/exerciseService');
const fs = require('node:fs');
const vm = require('node:vm');

test('hint openings are authenticated, valid, and award points once even with concurrent requests', async () => {
 const db = await open({filename: ':memory:', driver: sqlite3.Database});
 const originalDb = databaseService.db;
 const originalGet = exerciseService.getExerciseById;
 let server;
 try {
  await db.exec(`
   CREATE TABLE achievements (id TEXT PRIMARY KEY, name TEXT, description TEXT, icon TEXT, category TEXT, points INTEGER, requirement_type TEXT, requirement_value INTEGER, hidden INTEGER);
   CREATE TABLE user_achievements (user_id INTEGER, achievement_id TEXT, progress INTEGER, earned_at TEXT, PRIMARY KEY(user_id, achievement_id));
   CREATE TABLE languages (id TEXT, name TEXT, order_num INTEGER);
  `);
  databaseService.db = db;
  await databaseService.seedDefaultAchievements();
  exerciseService.getExerciseById = async id => id === 'with-hint' ? {description: '### Hint\nTry a loop.'} : id === 'no-hint' ? {description: '### Task\nWork.'} : null;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {req.user = req.headers['x-user'] ? {id: Number(req.headers['x-user'])} : null; req.isAuthenticated = () => !!req.user; next();});
  app.use('/api', require('../routes/api'));
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({error: error.message}));
  server = app.listen(0);
  const post = (id, user) => fetch(`http://127.0.0.1:${server.address().port}/api/exercises/${id}/hint-opened`, {method: 'POST', headers: {'Content-Type': 'application/json', ...(user ? {'x-user': String(user)} : {})}, body: JSON.stringify({userId: 99})});
  assert.equal((await post('with-hint')).status, 401);
  assert.equal((await post('missing', 1)).status, 404);
  assert.equal((await post('no-hint', 1)).status, 400);
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM user_achievements')).n, 0);
  const responses = await Promise.all([post('with-hint', 1), post('with-hint', 1)]);
  assert.ok(responses.every(r => r.status === 200));
  const data = await Promise.all(responses.map(r => r.json()));
  assert.equal(data.filter(r => r.achievement).length, 1);
  assert.equal(data.find(r => r.achievement).achievement.name, 'Helpful Nudge');
  assert.equal(await databaseService.getUserAchievementPoints(1), 10);
  const original = await db.get('SELECT * FROM user_achievements WHERE user_id = 1');
  assert.equal((await (await post('with-hint', 1)).json()).achievement, null);
  assert.deepEqual(await db.get('SELECT * FROM user_achievements WHERE user_id = 1'), original);
  assert.equal((await (await post('with-hint', 2)).json()).achievement.id, 'helpful-nudge');
  assert.equal(await databaseService.getUserAchievementPoints(99), 0);
 } finally {
  if (server) await new Promise(resolve => server.close(resolve));
  exerciseService.getExerciseById = originalGet;
  databaseService.db = originalDb;
  databaseService.cache.clear();
  await db.close();
 }
});

test('workspace records an opening once, suppresses duplicate notifications, and can retry failures', async () => {
 const notifications = [];
 const context = vm.createContext({document: {addEventListener() {}}, console: {error() {}}, showAchievementNotifications: values => notifications.push(...values)});
 const source = fs.readFileSync('frontend/js/pages/workspacePage.js', 'utf8').replace(/^import .*;\r?\n/gm, '');
 vm.runInContext(source + '\nglobalThis.Page = WorkspacePage;', context);
 const page = Object.create(context.Page.prototype);
 page.currentExercise = {id: 'with-hint'};
 let requests = 0, finish;
 page.apiService = {recordHintOpened: async id => {assert.equal(id, 'with-hint'); requests++; return new Promise(resolve => {finish = resolve;});}};
 const first = page.recordHintOpened();
 await page.recordHintOpened();
 assert.equal(requests, 1);
 finish({achievement: {id: 'helpful-nudge'}});
 await first;
 await page.recordHintOpened();
 assert.equal(requests, 1);
 assert.equal(notifications.length, 1);
 page.hintAchievementRecorded = false;
 page.apiService.recordHintOpened = async () => {throw Error('Temporary failure');};
 await page.recordHintOpened();
 assert.equal(page.hintAchievementRecorded, false);
 page.apiService.recordHintOpened = async () => ({achievement: null});
 await page.recordHintOpened();
 assert.equal(page.hintAchievementRecorded, true);
 assert.equal(notifications.length, 1);
});
