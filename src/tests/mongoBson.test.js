const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const config = require('../config');
const { startMongoDBContainer, executeMongoDBQuery } = require('../services/databaseContainerService');

function oneDocumentBson() {
	const key = Buffer.from('name\0');
	const value = Buffer.from('Alice\0');
	const document = Buffer.alloc(4 + 1 + key.length + 4 + value.length + 1);
	document.writeInt32LE(document.length, 0);
	document[4] = 0x02;
	key.copy(document, 5);
	document.writeInt32LE(value.length, 5 + key.length);
	value.copy(document, 9 + key.length);
	return document;
}

test('MongoDB restores BSON fixtures into the test database', {
	skip: process.env.RUN_CONTAINER_TESTS !== '1' ? 'Set RUN_CONTAINER_TESTS=1 for container integration tests' : false
}, async () => {
	const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-bson-fixture-'));
	const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-bson-work-'));
	const originalFixtures = config.paths.fixtures;
	let container;
	try {
		await fs.chmod(workDir, 0o777);
		await fs.writeFile(path.join(fixtureDir, 'people.bson'), oneDocumentBson());
		config.paths.fixtures = fixtureDir;
		container = await startMongoDBContainer(workDir, ['people.bson']);
		const result = await executeMongoDBQuery(container, 'db.people.findOne({}, { _id: 0, name: 1 }).name');
		assert.equal(result.exitCode, 0);
		assert.match(result.stdout, /Alice/);
	} finally {
		config.paths.fixtures = originalFixtures;
		if (container) await container.cleanup();
		await fs.rm(workDir, { recursive: true, force: true });
		await fs.rm(fixtureDir, { recursive: true, force: true });
	}
});

test('MongoDB imports large JSON fixtures without loading them through mongosh', {
	skip: process.env.RUN_CONTAINER_TESTS !== '1' ? 'Set RUN_CONTAINER_TESTS=1 for container integration tests' : false
}, async () => {
	const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-large-json-fixture-'));
	const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-large-json-work-'));
	const originalFixtures = config.paths.fixtures;
	let container;
	try {
		await fs.chmod(workDir, 0o777);
		const documents = Array.from({ length: 12000 }, (_, index) => ({ index, payload: 'x'.repeat(90) }));
		await fs.writeFile(path.join(fixtureDir, 'large.json'), JSON.stringify(documents));
		config.paths.fixtures = fixtureDir;
		container = await startMongoDBContainer(workDir, ['large.json']);
		const result = await executeMongoDBQuery(container, 'db.large.countDocuments({})');
		assert.equal(result.exitCode, 0);
		assert.match(result.stdout, /12000/);
	} finally {
		config.paths.fixtures = originalFixtures;
		if (container) await container.cleanup();
		await fs.rm(workDir, { recursive: true, force: true });
		await fs.rm(fixtureDir, { recursive: true, force: true });
	}
});
