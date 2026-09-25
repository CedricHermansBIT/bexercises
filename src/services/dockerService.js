// src/services/dockerService.js
const { spawn } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const { createTempDirectory } = require('../utils/tempDirectory');

/**
 * Detect whether to use docker or podman
 * @returns {string} 'docker' or 'podman'
 * @throws {Error} If neither is available
 */
function getContainerCommand() {
	const which = require('which');
	try {
		which.sync('docker');
		return 'docker';
	} catch (e) {
		try {
			which.sync('podman');
			console.log('Docker not found, using Podman as a drop-in replacement.');
			return 'podman';
		} catch (e2) {
			throw new Error('Neither Docker nor Podman is installed or found in PATH.');
		}
	}
}

/**
 * Language configuration for execution
 * Maps language IDs to their runtime properties
 * FALLBACK CONFIG - Database is the primary source
 */
const LANGUAGE_CONFIG = {
	bash: {
		extension: '.sh',
		interpreter: 'bash',
		dockerImage: 'alpine:latest',
		shebang: '#!/bin/bash'
	},
	python: {
		extension: '.py',
		interpreter: 'python3',
		dockerImage: 'python:3.11-alpine',
		shebang: '#!/usr/bin/env python3'
	},
	javascript: {
		extension: '.js',
		interpreter: 'node',
		dockerImage: 'node:18-alpine',
		shebang: '#!/usr/bin/env node'
	},
};

/**
 * Get language configuration from database or fallback
 * @param {string} languageId - Language identifier
 * @returns {Promise<Object>} Language configuration
 */
async function getLanguageConfig(languageId) {
	try {
		const databaseService = require('./databaseService');
		const language = await databaseService.getLanguage(languageId);

		if (language) {
			return {
				extension: language.file_extension || '.sh',
				interpreter: language.interpreter || 'bash',
				dockerImage: language.docker_image || 'alpine:latest',
				shebang: `#!/usr/bin/env ${language.interpreter || 'bash'}`
			};
		}
	} catch (error) {
		console.warn(`Failed to load language config from database for ${languageId}:`, error.message);
	}

	// Fallback to hardcoded config
	const config = LANGUAGE_CONFIG[languageId];
	if (!config) {
		console.warn(`Unknown language: ${languageId}, defaulting to bash`);
		return LANGUAGE_CONFIG.bash;
	}
	return config;
}

/**
 * Get language configuration synchronously (for compatibility)
 * @param {string} languageId - Language identifier
 * @returns {Object} Language configuration (fallback only)
 */
function getLanguageConfigSync(languageId) {
	const config = LANGUAGE_CONFIG[languageId];
	if (!config) {
		console.warn(`Unknown language: ${languageId}, defaulting to bash`);
		return LANGUAGE_CONFIG.bash;
	}
	return config;
}

/**
 * Normalize output by converting CRLF to LF
 * @param {string} s - String to normalize
 * @returns {string} Normalized string
 */
function normalizeOutput(s) {
	if (s === null || s === undefined) return '';
	return s.replace(/\r\n/g, '\n');
}

/**
 * Recursively remove a directory
 * @param {string} targetPath - Path to remove
 */
async function removeRecursive(targetPath) {
	try {
		await fs.rm(targetPath, { recursive: true, force: true, maxRetries: 3 });
	} catch (err) {
		if (err.code !== 'EACCES' && err.code !== 'EPERM') throw err;
		await chmodRecursive(targetPath, 0o777);
		await fs.rm(targetPath, { recursive: true, force: true, maxRetries: 3 });
	}
}

/**
 * Restore permissions only on regular files and directories. Never follow a
 * symlink while cleaning up student-generated output.
 */
async function chmodRecursive(targetPath, mode) {
	let stat;
	try {
		stat = await fs.lstat(targetPath);
	} catch (err) {
		if (err.code === 'ENOENT') return;
		throw err;
	}
	if (stat.isSymbolicLink()) return;
	if (!stat.isDirectory() && !stat.isFile()) return;
	await fs.chmod(targetPath, mode);
	if (stat.isDirectory()) {
		for (const entry of await fs.readdir(targetPath)) {
			await chmodRecursive(path.join(targetPath, entry), mode);
		}
	}
}

/**
 * Create a temporary script file
 * @param {string} scriptContents - Script content
 * @param {string} languageId - Language identifier (e.g., 'bash', 'python')
 * @returns {Promise<Object>} Object with tmpdir, scriptPath, languageConfig, and scriptFilename
 */
async function createTempScript(scriptContents, languageId = 'bash') {
	const langConfig = await getLanguageConfig(languageId);
	const normalized = String(scriptContents).replace(/\r\n/g, '\n');
	const tmpdir = await createTempDirectory('bex-');

	await fs.chmod(tmpdir, 0o777);

	const scriptFilename = `script${langConfig.extension}`;
	const scriptPath = path.join(tmpdir, scriptFilename);

	// Defensive: if something exists at scriptPath remove it
	try {
		if (fsSync.existsSync(scriptPath)) {
			const st = fsSync.lstatSync(scriptPath);
			if (st.isDirectory()) {
				await removeRecursive(scriptPath);
			} else {
				await fs.unlink(scriptPath);
			}
		}
	} catch (err) {
		// Log but continue
        console.error(`Error cleaning up existing script path ${scriptPath}:`, err.message);
	}

	await fs.mkdir(path.dirname(scriptPath), { recursive: true });
	await fs.writeFile(scriptPath, normalized, { encoding: 'utf8', flag: 'w' });
	await fs.chmod(scriptPath, 0o777);

	// Verify it's a file
	const finalStat = fsSync.lstatSync(scriptPath);
	if (!finalStat.isFile()) {
		throw new Error(`Failed to create script file at ${scriptPath} (not a regular file)`);
	}

	return { tmpdir, scriptPath, languageConfig: langConfig, scriptFilename };
}

/**
 * Copy fixture files to temp directory
 * @param {string} tmpdir - Temporary directory
 * @param {Array} fixtures - Array of fixture filenames
 * @param {Object} fixturePermissions - Object mapping filename to permissions
 * @returns {Promise<Array>} Array of copied fixture names
 */
async function copyFixtures(tmpdir, fixtures = [], fixturePermissions = {}) {
	const copiedFiles = [];
	console.log(`[copyFixtures] tmpdir: ${tmpdir}, fixtures:`, fixtures);
	console.log(`[copyFixtures] fixtures path: ${config.paths.fixtures}`);

	/**
	 * Recursively copy a directory
	 */
	async function copyDirRecursive(src, dest) {
		await fs.mkdir(dest, { recursive: true });
		const entries = await fs.readdir(src, { withFileTypes: true });

		for (const entry of entries) {
			const srcPath = path.join(src, entry.name);
			const destPath = path.join(dest, entry.name);

			if (entry.isDirectory()) {
				await copyDirRecursive(srcPath, destPath);
			} else {
				await fs.copyFile(srcPath, destPath);
				// Preserve permissions
				const stat = await fs.stat(srcPath);
				await fs.chmod(destPath, stat.mode);
			}
		}
	}

	for (const fixtureName of fixtures) {
		const sourcePath = path.join(config.paths.fixtures, fixtureName);
		const destPath = path.join(tmpdir, fixtureName);

		console.log(`[copyFixtures] Attempting to copy: ${sourcePath} -> ${destPath}`);

		try {
			if (!fsSync.existsSync(sourcePath)) {
				console.warn(`Fixture file/folder not found: ${sourcePath}`);
				continue;
			}

			const stat = await fs.stat(sourcePath);

			if (stat.isDirectory()) {
				// Copy directory recursively with all its contents
				console.log(`[copyFixtures] Source is a directory, copying recursively...`);
				await copyDirRecursive(sourcePath, destPath);

				// Set permissions on the root folder
				let mode = fixturePermissions[fixtureName] !== undefined
					? fixturePermissions[fixtureName]
					: stat.mode;
				await fs.chmod(destPath, mode);

				copiedFiles.push(fixtureName);
				console.log(`✓ Copied folder with contents: ${fixtureName} -> ${destPath}`);
			} else {
				// Copy file
				console.log(`[copyFixtures] Source exists on disk, copying from filesystem...`);
				await fs.copyFile(sourcePath, destPath);

				let mode;
				if (fixturePermissions && fixturePermissions[fixtureName] !== undefined) {
					mode = fixturePermissions[fixtureName];
				} else {
					mode = stat.mode;
				}
				await fs.chmod(destPath, mode);

				copiedFiles.push(fixtureName);
				console.log(`✓ Copied fixture: ${fixtureName} -> ${destPath}`);
			}

			// Verify the file/folder exists in destination
			if (fsSync.existsSync(destPath)) {
				console.log(`✓ Verified: ${destPath} exists in tmpdir`);
			} else {
				console.error(`✗ File/folder not found after copy: ${destPath}`);
			}
		} catch (err) {
			console.error(`Error copying fixture ${fixtureName}:`, err.message, err.stack);
		}
	}

	if (fixtures.length > 0 && copiedFiles.length === 0) {
		console.warn('Warning: No fixtures were successfully copied');
	}

	console.log(`[copyFixtures] Copied ${copiedFiles.length} of ${fixtures.length} files`);
	return copiedFiles;
}

/**
 * Run a script in a Docker container
 * @param {string} tmpdir - Temporary directory with script
 * @param {string} scriptFilename - Name of the script file (e.g., 'script.sh', 'script.py')
 * @param {Object} languageConfig - Language configuration object
 * @param {Array} args - Command line arguments
 * @param {Array} inputs - Input lines for stdin
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Object>} Result object with stdout, stderr, exitCode, etc.
 */
function runContainerCommand(runtime, args, timeoutMs, maxOutputBytes, onAbort = () => {}) {
	return new Promise((resolve) => {
		const proc = spawn(runtime, args, { stdio: ['ignore', 'pipe', 'pipe'] });
		const output = { stdout: [], stderr: [] };
		let bytes = 0;
		let timedOut = false;
		let outputLimited = false;
		let settled = false;
		const abort = () => {
			try { onAbort(); } catch (error) { console.error('Container abort failed:', error); }
			proc.kill('SIGKILL');
		};
		const append = (stream, data) => {
			const remaining = maxOutputBytes - bytes;
			if (remaining <= 0) return;
			const chunk = Buffer.from(data).subarray(0, remaining);
			output[stream].push(chunk);
			bytes += chunk.length;
			if (bytes >= maxOutputBytes) {
				outputLimited = true;
				abort();
			}
		};
		proc.stdout.on('data', data => append('stdout', data));
		proc.stderr.on('data', data => append('stderr', data));
		const timer = setTimeout(() => { timedOut = true; abort(); }, Math.max(1, timeoutMs));
		const finish = (code, error = null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve({
				stdout: normalizeOutput(Buffer.concat(output.stdout).toString('utf8')),
				stderr: normalizeOutput(Buffer.concat(output.stderr).toString('utf8')),
				exitCode: timedOut || outputLimited ? -1 : code,
				timedOut, outputLimited, error
			});
		};
		proc.on('close', code => finish(code, outputLimited ? 'Output limit exceeded' : null));
		proc.on('error', error => finish(null, error.message));
	});
}

/**
 * Run a script in a bounded, private workspace. Inputs are mounted read-only;
 * the script only writes to container tmpfs mounts. Copy output back while the
 * container is still running so file grading sees its final filesystem state.
 */
async function runScriptInContainer(tmpdir, scriptFilename, languageConfig, args = [], inputs = [], timeoutMs = config.docker.timeout) {
	const containerName = `bex-run-${crypto.randomUUID()}`;
	const containerWorkdir = '/home/runner';
	const containerInputs = '/tmp/.bitlab-inputs';
	const runtime = getContainerCommand();
	const deadline = Date.now() + timeoutMs;
	let outputDir = null;
	const cleanup = () => {
		const removal = spawn(runtime, runtime === 'podman'
			? ['rm', '-f', '-t', '0', containerName]
			: ['rm', '-f', containerName], { stdio: 'ignore' });
		removal.on('error', error => console.error(`Failed to remove ${containerName}:`, error));
	};
	let shellCommand;
	if (inputs && Array.isArray(inputs) && inputs.length > 0) {
		const escapedInputs = inputs.map(line => line.replace(/'/g, "'\\''"));
		const inputString = escapedInputs.join('\\n') + '\\n';
		shellCommand = `printf '%b' '${inputString}' | ${languageConfig.interpreter} ./${scriptFilename} "$@"`;
	} else {
		shellCommand = `${languageConfig.interpreter} ./${scriptFilename} "$@" < /dev/null`;
	}
	try {
		const start = await runContainerCommand(runtime, [
			'run', '-d', '--name', containerName,
			'--label', 'bitlab.managed=true', '--label', `bitlab.created=${Date.now()}`,
			'--network', 'none', '--read-only',
			'--memory', config.docker.memory, '--cpus', config.docker.cpus,
			'--pids-limit', String(config.docker.pidsLimit),
			'--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
			'--user', '1000:1000', '--env', `HOME=${containerWorkdir}`,
			'--tmpfs', `${containerWorkdir}:rw,size=${config.docker.workspaceSize},mode=1777`,
			'--tmpfs', `/tmp:rw,size=${config.docker.tmpSize},mode=1777`,
			'--tmpfs', `/var/tmp:rw,size=${config.docker.tmpSize},mode=1777`,
			'-v', `${tmpdir}:${containerInputs}:ro`,
			'--entrypoint', '/bin/sh', languageConfig.dockerImage,
			'-c', 'while :; do sleep 3600; done'
		], Math.max(1, deadline - Date.now()), config.docker.maxOutputBytes, cleanup);
		if (start.error || start.timedOut || start.outputLimited || start.exitCode !== 0) {
			return { ...start, exitCode: null, error: start.error || start.stderr || 'Container failed to start' };
		}
		// Preserve fixture creation order. Some existing exercises compare the
		// unsorted output of find(1), which follows directory entry order.
		const inputEntries = await Promise.all((await fs.readdir(tmpdir)).map(async name => {
			const stat = await fs.lstat(path.join(tmpdir, name), { bigint: true });
			return { name, created: stat.birthtimeNs, inode: stat.ino };
		}));
		inputEntries.sort((a, b) => a.created < b.created ? -1
			: a.created > b.created ? 1
				: a.inode < b.inode ? -1 : a.inode > b.inode ? 1 : a.name.localeCompare(b.name));
		const staged = await runContainerCommand(runtime, [
			'exec', '-w', containerWorkdir, containerName, '/bin/sh', '-c',
			`for file do cp -R "${containerInputs}/$file" . || exit 125; done`, '--',
			...inputEntries.reverse().map(entry => entry.name)
		], Math.max(1, deadline - Date.now()), config.docker.maxOutputBytes, cleanup);
		if (staged.exitCode !== 0 || staged.error || staged.timedOut || staged.outputLimited) {
			return { ...staged, exitCode: null,
				error: staged.error || staged.stderr || 'Could not stage input files' };
		}
		const result = await runContainerCommand(runtime, [
			'exec', '-w', containerWorkdir, containerName,
			'/bin/sh', '-c', shellCommand, '--', ...args
		], Math.max(1, deadline - Date.now()), config.docker.maxOutputBytes, cleanup);
		if (result.timedOut || result.outputLimited || result.error) return result;

		outputDir = await fs.mkdtemp(path.join(path.dirname(tmpdir), 'bex-output-'));
		const copied = await runContainerCommand(runtime, [
			'cp', `${containerName}:${containerWorkdir}/.`, outputDir
		], 15000, config.docker.maxOutputBytes, cleanup);
		if (copied.exitCode !== 0 || copied.error || copied.timedOut || copied.outputLimited) {
			return { ...result, exitCode: null,
				error: copied.error || copied.stderr || 'Could not collect output files' };
		}
		await fs.chmod(outputDir, 0o777);
		await fs.rm(tmpdir, { recursive: true, force: true });
		await fs.rename(outputDir, tmpdir);
		outputDir = null;
		return result;
	} finally {
		// An early timeout may race container creation, so retry after the CLI exits.
		const removed = await runContainerCommand(runtime, runtime === 'podman'
			? ['rm', '-f', '-t', '0', containerName]
			: ['rm', '-f', containerName], 10000, 4096);
		if (removed.error || (removed.exitCode !== 0 && !/no such container|no container with name/i.test(removed.stderr))) {
			console.error(`Failed to remove ${containerName}:`, removed.error || removed.stderr);
		}
		if (outputDir) await fs.rm(outputDir, { recursive: true, force: true });
	}
}

/**
 * Run a script with arguments (simplified for testing)
 * @param {string} script - Script content
 * @param {string} languageId - Language identifier (e.g., 'bash', 'python')
 * @param {Array<string>} args - Command line arguments
 * @returns {Promise<Object>} Execution result
 */
async function runScript(script, languageId = 'bash', args = []) {
	const { tmpdir, scriptFilename, languageConfig } = await createTempScript(script, languageId);

	try {
		const result = await runScriptInContainer(tmpdir, scriptFilename, languageConfig, args, [], config.docker.timeout);
		return result;
	} finally {
		try {
			await removeRecursive(tmpdir);
		} catch (err) {
			console.error('Failed to cleanup tmpdir:', tmpdir, '-', err.message);
		}
	}
}

/**
 * Run a script with test case (arguments, input, fixtures)
 * @param {string} script - Script content
 * @param {string} languageId - Language identifier (e.g., 'bash', 'python')
 * @param {Array<string>} args - Command line arguments
 * @param {Array<string>} inputs - STDIN inputs
 * @param {Array<string>} fixtureNames - Fixture filenames to copy
 * @returns {Promise<Object>} Execution result
 */
async function runScriptWithTestCase(script, languageId = 'bash', args = [], inputs = [], fixtureNames = []) {
	const { tmpdir, scriptFilename, languageConfig } = await createTempScript(script, languageId);

	try {
		// Copy fixture files if specified
		if (fixtureNames && fixtureNames.length > 0) {
			await copyFixtures(tmpdir, fixtureNames);
		}

		const result = await runScriptInContainer(tmpdir, scriptFilename, languageConfig, args, inputs, config.docker.timeout);
		return result;
	} finally {
		try {
			await removeRecursive(tmpdir);
		} catch (err) {
			console.error('Failed to cleanup tmpdir:', tmpdir, '-', err.message);
		}
	}
}

/**
 * Compute SHA-256 hash of a file
 * @param {string} filePath - Path to file
 * @returns {Promise<string>} Hex string of SHA-256 hash
 */
async function hashFile(filePath) {
	// Check if file is a tar.gz archive
	const isTarGz = filePath.endsWith('.tar.gz') || filePath.endsWith('.tgz');

	if (isTarGz) {
		// Hash member names and their uncompressed contents, avoiding tar/gzip
		// timestamps while detecting changed file contents.
		const members = await new Promise((resolve, reject) => {
			const listing = spawn('tar', ['-tzf', filePath]);
			let names = '';
			listing.stdout.on('data', data => { names += data.toString(); });
			listing.on('error', reject);
			listing.on('close', code => code === 0
				? resolve(names.trimEnd().split('\n').filter(Boolean).sort())
				: reject(new Error(`Failed to list tar contents: exit code ${code}`)));
		});
		const hash = crypto.createHash('sha256');
		for (const member of members) {
			hash.update(`member\0${member}\0`);
			if (member.endsWith('/')) continue;
			await new Promise((resolve, reject) => {
				const extract = spawn('tar', ['-xOzf', filePath, '--', member]);
				extract.stdout.on('data', data => hash.update(data));
				extract.on('error', reject);
				extract.on('close', code => code === 0
					? resolve()
					: reject(new Error(`Failed to read tar member: ${member}`)));
			});
			hash.update('\0');
		}
		return hash.digest('hex');
	}

	// For regular files, hash the content normally
	return new Promise((resolve, reject) => {
		const hash = crypto.createHash('sha256');
		const stream = fsSync.createReadStream(filePath);

		stream.on('data', (data) => hash.update(data));
		stream.on('end', () => resolve(hash.digest('hex')));
		stream.on('error', reject);
	});
}

/**
 * Hash a directory's recursive filesystem state. Each nested entry contributes
 * its relative path, type, and either its file contents or link destination.
 * This makes empty and non-empty directories distinguishable while avoiding
 * following symbolic links (and therefore symlink cycles).
 * @param {string} directoryPath - Directory to inspect
 * @returns {Promise<string>} SHA-256 hash of the directory state
 */
async function inspectDirectoryState(directoryPath) {
	const hash = crypto.createHash('sha256');
	const entriesState = [];

	async function visit(currentPath, relativePath = '') {
		const entries = await fs.readdir(currentPath, { withFileTypes: true });
		entries.sort((a, b) => a.name.localeCompare(b.name));

		for (const entry of entries) {
			const entryPath = path.join(currentPath, entry.name);
			const entryRelativePath = path.join(relativePath, entry.name);
			const stat = await fs.lstat(entryPath);
			const type = stat.isFile() ? 'file'
				: stat.isDirectory() ? 'directory'
					: stat.isSymbolicLink() ? 'link'
						: 'other';
			const entryState = { path: entryRelativePath, type };

			hash.update(`${type}\0${entryRelativePath}\0`);
			if (type === 'file') {
				entryState.sha256 = await hashFile(entryPath);
				hash.update(entryState.sha256);
			} else if (type === 'link') {
				entryState.linkTarget = await fs.readlink(entryPath);
				hash.update(entryState.linkTarget);
			} else if (type === 'directory') {
				await visit(entryPath, entryRelativePath);
			}
			hash.update('\0');
			entriesState.push(entryState);
		}
	}

	await visit(directoryPath);
	return { sha256: hash.digest('hex'), entries: entriesState };
}

async function hashDirectoryState(directoryPath) {
	const state = await inspectDirectoryState(directoryPath);
	return state.sha256;
}

/**
 * Inspect output paths from a directory. Regular files are hashed; directories
 * and symbolic links are recorded by type so callers can verify the complete
 * filesystem state produced by a solution.
 * @param {string} tmpdir - Temporary directory where files were created
 * @param {Array<string>} filenames - Array of filenames to hash
 * @returns {Promise<Array<Object>>} Array of path state objects
 */
async function hashOutputFiles(tmpdir, filenames = []) {
	const results = [];

	for (const filename of filenames) {
		const filePath = path.join(tmpdir, filename);

		try {
			// lstat deliberately does not follow symlinks. A link is a valid
			// expected output state, including when its target is not present.
			const stat = await fs.lstat(filePath);
			const type = stat.isFile() ? 'file'
				: stat.isDirectory() ? 'directory'
					: stat.isSymbolicLink() ? 'link'
						: 'other';
			const result = { filename, type, sha256: null, exists: true, size: stat.size };

			if (type === 'file') {
				result.sha256 = await hashFile(filePath);
			} else if (type === 'directory') {
				const directoryState = await inspectDirectoryState(filePath);
				result.sha256 = directoryState.sha256;
				result.entries = directoryState.entries;
			} else if (type === 'link') {
				result.linkTarget = await fs.readlink(filePath);
			}

			results.push(result);
		} catch (error) {
			results.push({
				filename,
				sha256: null,
				type: null,
				exists: false,
				error: error.code === 'ENOENT' ? 'Path not found' : error.message
			});
		}
	}

	return results;
}

module.exports = {
	getContainerCommand,
	normalizeOutput,
	removeRecursive,
	createTempScript,
	copyFixtures,
	runScriptInContainer,
	runScript,
	runScriptWithTestCase,
	hashFile,
	hashDirectoryState,
	inspectDirectoryState,
	hashOutputFiles,
	getLanguageConfig,
	getLanguageConfigSync,
	LANGUAGE_CONFIG
};
