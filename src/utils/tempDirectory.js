const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../config');

async function createTempDirectory(prefix, root = config.paths.temp) {
	await fs.mkdir(root, { recursive: true });
	return fs.mkdtemp(path.join(root, prefix));
}

module.exports = { createTempDirectory };
