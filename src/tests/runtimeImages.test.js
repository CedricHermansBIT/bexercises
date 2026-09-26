const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const DatabaseService = require('../services/databaseService').constructor;
const images = require('../config/runtimeImages');

test('new languages use versioned runtime defaults without rewriting existing choices', async () => {
	const service = new DatabaseService();
	service.db = await open({ filename: ':memory:', driver: sqlite3.Database });
	try {
		await service.createTables();
		for (const id of ['bash', 'python', 'javascript', 'mariadb', 'mongodb', 'r', 'php']) {
			const language = await service.createLanguage({ id, name: id });
			assert.equal(language.docker_image, images[id]);
		}
		await service.db.run('UPDATE languages SET docker_image = ? WHERE id = ?', 'custom/bash:1', 'bash');
		await service.createTables();
		assert.equal((await service.db.get('SELECT docker_image FROM languages WHERE id = ?', 'bash')).docker_image, 'custom/bash:1');
	} finally {
		service.cache.clear();
		await service.db.close();
	}
});
