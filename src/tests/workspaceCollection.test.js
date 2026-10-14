const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { collectContainerWorkspace } = require('../services/dockerService');

async function fakeRuntime(root, archive) {
    const runtime = path.join(root, 'runtime');
    await fs.writeFile(runtime, '#!/usr/bin/env node\nprocess.stdout.write(require("node:fs").readFileSync(' + JSON.stringify(archive) + '));\n');
    await fs.chmod(runtime, 0o755);
    return runtime;
}

test('workspace collection preserves files with spaces and rejects oversized archives', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-collection-'));
    try {
        const input = path.join(root, 'input'), output = path.join(root, 'output');
        await fs.mkdir(input); await fs.mkdir(output);
        await fs.writeFile(path.join(input, 'result file.txt'), 'generated');
        const archive = path.join(root, 'archive.tar');
        assert.equal(spawnSync('tar', ['-C', input, '-cf', archive, '.']).status, 0);
        const runtime = await fakeRuntime(root, archive);
        const collected = await collectContainerWorkspace(runtime, 'unused', '/home/runner', output);
        assert.equal(collected.exitCode, 0, collected.stderr);
        assert.equal(await fs.readFile(path.join(output, 'result file.txt'), 'utf8'), 'generated');
        const limited = await collectContainerWorkspace(runtime, 'unused', '/home/runner', output, 15000, 1024);
        assert.equal(limited.outputLimited, true);
        assert.notEqual(limited.exitCode, 0);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('workspace extraction cannot write through an archive symlink to an outside directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-collection-link-'));
    try {
        const input = path.join(root, 'input'), output = path.join(root, 'output'), outside = path.join(root, 'outside');
        await fs.mkdir(input); await fs.mkdir(output); await fs.mkdir(outside);
        await fs.symlink(outside, path.join(input, 'escape'));
        const archive = path.join(root, 'archive.tar');
        assert.equal(spawnSync('tar', ['-C', input, '-cf', archive, 'escape']).status, 0);
        await fs.unlink(path.join(input, 'escape')); await fs.mkdir(path.join(input, 'escape'));
        await fs.writeFile(path.join(input, 'escape', 'injected.txt'), 'unsafe');
        assert.equal(spawnSync('tar', ['-C', input, '-rf', archive, 'escape/injected.txt']).status, 0);
        const result = await collectContainerWorkspace(await fakeRuntime(root, archive), 'unused', '/home/runner', output);
        assert.notEqual(result.exitCode, 0);
        await assert.rejects(fs.readFile(path.join(outside, 'injected.txt')), { code: 'ENOENT' });
    } finally { await fs.rm(root, { recursive: true, force: true }); }
});
