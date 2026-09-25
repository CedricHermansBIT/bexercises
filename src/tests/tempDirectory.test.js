const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createTempDirectory } = require('../utils/tempDirectory');

test('temp directory creation works when the configured parent does not exist', async () => {
	const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-temp-test-'));
	const missingRoot = path.join(parent, 'nested', 'tmp');
	try {
		const dir = await createTempDirectory('bex-db-', missingRoot);
		assert.equal(path.dirname(dir), missingRoot);
		assert.equal((await fs.stat(dir)).isDirectory(), true);
	} finally {
		await fs.rm(parent, { recursive: true, force: true });
	}
});
