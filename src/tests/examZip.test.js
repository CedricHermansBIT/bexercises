const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const config = require('../config');
const { inspectZip, scanSubmissionFiles } = require('../services/examGraderService');

test('submission scanner finds root and nested scripts and rejects links', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-exam-scan-'));
	try {
		await fs.mkdir(path.join(root, 'student', 'nested'), { recursive: true });
		await fs.writeFile(path.join(root, 'root.sh'), 'echo root');
		await fs.writeFile(path.join(root, 'student', 'nested', 'answer.sh'), 'echo nested');
		assert.deepEqual((await scanSubmissionFiles(root)).map(file => file.filename),
			['root.sh', path.join('student', 'nested', 'answer.sh')]);
		await fs.symlink('/etc/passwd', path.join(root, 'student', 'link'));
		await assert.rejects(scanSubmissionFiles(root), /Unsafe extracted file/);
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});

test('ZIP preflight rejects symlinks and oversized uncompressed files', async t => {
	if (spawnSync('zip', ['-v']).status !== 0) return t.skip('zip is unavailable');
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-exam-zip-'));
	try {
		await fs.symlink('/etc/passwd', path.join(root, 'link.sh'));
		const linkZip = path.join(root, 'link.zip');
		assert.equal(spawnSync('zip', ['-yq', linkZip, 'link.sh'], { cwd: root }).status, 0);
		assert.throws(() => inspectZip(require('node:fs').readFileSync(linkZip)), /symlink/);

		await fs.writeFile(path.join(root, 'large.sh'), Buffer.alloc(config.docker.maxExamUncompressedBytes + 1));
		const largeZip = path.join(root, 'large.zip');
		assert.equal(spawnSync('zip', ['-q', largeZip, 'large.sh'], { cwd: root }).status, 0);
		assert.throws(() => inspectZip(require('node:fs').readFileSync(largeZip)), /uncompressed size limit/);
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});
