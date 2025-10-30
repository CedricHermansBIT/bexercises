// src/services/dockerService.js
const { spawn } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const config = require('../config');

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
	if (fs.rm) {
		return fs.rm(targetPath, { recursive: true, force: true });
	}

	if (fs.rmdir) {
		try {
			return fs.rmdir(targetPath, { recursive: true });
		} catch (e) {
			// Fall through to manual removal
            console.error('fs.rmdir recursive failed, falling back to manual removal:', e);
		}
	}

	// Manual recursive delete (safe fallback)
	async function _rmDirRecursive(p) {
		const entries = await fs.readdir(p);
		await Promise.all(entries.map(async (entry) => {
			const full = path.join(p, entry);
			const stat = await fs.lstat(full);
			if (stat.isDirectory()) {
				await _rmDirRecursive(full);
			} else {
				await fs.unlink(full);
			}
		}));
		await fs.rmdir(p);
	}

	try {
		await _rmDirRecursive(targetPath);
	} catch (err) {
		if (err.code !== 'ENOENT') throw err;
	}
}

/**
 * Create a temporary script file
 * @param {string} scriptContents - Script content
 * @returns {Promise<Object>} Object with tmpdir and scriptPath
 */
async function createTempScript(scriptContents) {
	const normalized = String(scriptContents).replace(/\r\n/g, '\n');
	const tmpdir = await fs.mkdtemp(path.join(config.paths.temp, 'bex-'));

	await fs.chmod(tmpdir, 0o755);

	const scriptPath = path.join(tmpdir, 'script.sh');

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

	return { tmpdir, scriptPath };
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

	for (const fixtureName of fixtures) {
		const sourcePath = path.join(config.paths.fixtures, fixtureName);
		const destPath = path.join(tmpdir, fixtureName);

		console.log(`[copyFixtures] Attempting to copy: ${sourcePath} -> ${destPath}`);

		try {
			if (!fsSync.existsSync(sourcePath)) {
				console.warn(`Fixture file not found: ${sourcePath}`);
				continue;
			}

			console.log(`[copyFixtures] Source exists on disk, copying from filesystem...`);
			await fs.copyFile(sourcePath, destPath);

			let mode;
			if (fixturePermissions && fixturePermissions[fixtureName] !== undefined) {
				mode = fixturePermissions[fixtureName];
			} else {
				const stat = await fs.stat(sourcePath);
				mode = stat.mode;
			}
			await fs.chmod(destPath, mode);

			copiedFiles.push(fixtureName);
			console.log(`✓ Copied fixture: ${fixtureName} -> ${destPath}`);

			// Verify the file exists in destination
			if (fsSync.existsSync(destPath)) {
				console.log(`✓ Verified: ${destPath} exists in tmpdir`);
			} else {
				console.error(`✗ File not found after copy: ${destPath}`);
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
 * @param {Array} args - Command line arguments
 * @param {Array} inputs - Input lines for stdin
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Object>} Result object with stdout, stderr, exitCode, etc.
 */
async function runScriptInContainer(tmpdir, args = [], inputs = [], timeoutMs = config.docker.timeout) {
	return new Promise((resolve) => {
		const containerWorkdir = '/home/runner';
		const containerScript = 'script.sh';

		let shellCommand;
		if (inputs && Array.isArray(inputs) && inputs.length > 0) {
			const escapedInputs = inputs.map(line => line.replace(/'/g, "'\\''"));
			const inputString = escapedInputs.join('\\n') + '\\n';
			shellCommand = `printf '%b' '${inputString}' | bash ./${containerScript} "$@"`;
		} else {
			shellCommand = `bash ./${containerScript} "$@" < /dev/null`;
		}

		const dockerArgs = [
			'run', '--rm',
			'--network', 'none',
			'--memory', config.docker.memory,
			'--pids-limit', config.docker.pidsLimit.toString(),
			'-v', `${tmpdir}:${containerWorkdir}:rw`,
			'-w', containerWorkdir,
			'--entrypoint', '/bin/bash',
			config.docker.image,
			'-c',
			shellCommand,
			'--',
			...args
		];

		const docker = spawn('docker', dockerArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

		let stdout = '';
		let stderr = '';
		let timedOut = false;

		docker.stdout.on('data', (d) => {
			stdout += d.toString();
		});

		docker.stderr.on('data', (d) => {
			stderr += d.toString();
		});

		const killTimer = setTimeout(() => {
			timedOut = true;
			try {
				docker.kill('SIGKILL');
			} catch (e) {
				// Ignore
                console.error('Error killing docker process:', e);
			}
		}, timeoutMs);

		docker.on('error', (err) => {
			clearTimeout(killTimer);
			resolve({
				stdout: normalizeOutput(stdout),
				stderr: normalizeOutput(stderr),
				exitCode: null,
				timedOut,
				error: err.message
			});
		});

		docker.on('close', (code, _signal) => {
			clearTimeout(killTimer);
			const exitCode = timedOut ? -1 : code;
			resolve({
				stdout: normalizeOutput(stdout),
				stderr: normalizeOutput(stderr),
				exitCode,
				timedOut,
				error: null
			});
		});
	});
}

/**
 * Run a script with arguments (simplified for testing)
 * @param {string} script - Script content
 * @param {Array<string>} args - Command line arguments
 * @returns {Promise<Object>} Execution result
 */
async function runScript(script, args = []) {
	const { tmpdir, scriptPath } = await createTempScript(script);

	try {
		const result = await runScriptInContainer(tmpdir, args, [], config.docker.timeout);
		return result;
	} finally {
		await removeRecursive(tmpdir);
	}
}

/**
 * Run a script with test case (arguments, input, fixtures)
 * @param {string} script - Script content
 * @param {Array<string>} args - Command line arguments
 * @param {Array<string>} inputs - STDIN inputs
 * @param {Array<string>} fixtureNames - Fixture filenames to copy
 * @returns {Promise<Object>} Execution result
 */
async function runScriptWithTestCase(script, args = [], inputs = [], fixtureNames = []) {
	const { tmpdir, scriptPath } = await createTempScript(script);

	try {
		// Copy fixture files if specified
		if (fixtureNames && fixtureNames.length > 0) {
			await copyFixtures(tmpdir, fixtureNames);
		}

		const result = await runScriptInContainer(tmpdir, args, inputs, config.docker.timeout);
		return result;
	} finally {
		await removeRecursive(tmpdir);
	}
}

module.exports = {
	normalizeOutput,
	removeRecursive,
	createTempScript,
	copyFixtures,
	runScriptInContainer,
	runScript,
	runScriptWithTestCase
};
