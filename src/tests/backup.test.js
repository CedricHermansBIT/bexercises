const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

test('online backup restores committed WAL data and fixture files', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-backup-test-'));
	try {
		await fs.mkdir(path.join(root, 'data'));
		await fs.mkdir(path.join(root, 'fixtures'));
		await fs.writeFile(path.join(root, 'fixtures', 'seed.txt'), 'fixture contents');
		const db = await open({ filename: path.join(root, 'data', 'exercises.db'), driver: sqlite3.Database });
		let snapshot;
		try {
			await db.exec('PRAGMA journal_mode = WAL; CREATE TABLE exercises (id TEXT); INSERT INTO exercises VALUES (\'wal-row\');');
			const result = spawnSync('bash', [path.join(__dirname, '../scripts/backup.sh')], {
				encoding: 'utf8', env: { ...process.env, BITLAB_ROOT: root, BITLAB_BACKUP_DIR: path.join(root, 'backups') }
			});
			assert.equal(result.status, 0, result.stderr);
			snapshot = result.stdout.trim();
		} finally {
			await db.close();
		}
		const restored = await open({ filename: path.join(snapshot, 'exercises.db'), driver: sqlite3.Database });
		try {
			assert.equal((await restored.get('SELECT id FROM exercises')).id, 'wal-row');
		} finally {
			await restored.close();
		}
		const extractDir = path.join(root, 'restored');
		await fs.mkdir(extractDir);
		const extraction = spawnSync('tar', ['-C', extractDir, '-xzf', path.join(snapshot, 'fixtures.tar.gz')], { encoding: 'utf8' });
		assert.equal(extraction.status, 0, extraction.stderr);
		assert.equal(await fs.readFile(path.join(extractDir, 'fixtures', 'seed.txt'), 'utf8'), 'fixture contents');
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});
