// src/services/dockerService.js
const { spawn } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

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
 * @param {string} languageId - Language identifier (e.g., 'bash', 'python')
 * @returns {Promise<Object>} Object with tmpdir, scriptPath, languageConfig, and scriptFilename
 */
async function createTempScript(scriptContents, languageId = 'bash') {
	const langConfig = await getLanguageConfig(languageId);
	const normalized = String(scriptContents).replace(/\r\n/g, '\n');
	const tmpdir = await fs.mkdtemp(path.join(config.paths.temp, 'bex-'));

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
async function runScriptInContainer(tmpdir, scriptFilename, languageConfig, args = [], inputs = [], timeoutMs = config.docker.timeout) {
	return new Promise((resolve) => {
		const containerWorkdir = '/home/runner';
		const interpreter = languageConfig.interpreter;
		const dockerImage = languageConfig.dockerImage;

		let shellCommand;
		if (inputs && Array.isArray(inputs) && inputs.length > 0) {
			const escapedInputs = inputs.map(line => line.replace(/'/g, "'\\''"));
			const inputString = escapedInputs.join('\\n') + '\\n';
			shellCommand = `printf '%b' '${inputString}' | ${interpreter} ./${scriptFilename} "$@"`;
		} else {
			shellCommand = `${interpreter} ./${scriptFilename} "$@" < /dev/null`;
		}

		const dockerArgs = [
			'run', '--rm',
			'--network', 'none',
			'--memory', config.docker.memory,
			'--pids-limit', config.docker.pidsLimit.toString(),
			'-v', `${tmpdir}:${containerWorkdir}:rw`,
			'-w', containerWorkdir,
			'--entrypoint', '/bin/sh',
			dockerImage,
			'-c',
			shellCommand,
			'--',
			...args
		];

        // Check if docker is installed, if not check if podman is available and use it as a drop-in replacement (not hardcoded paths)
        let dockerCmd = 'docker';
        const isDockerAvailable = (() => {
            try {
                const which = require('which');
                which.sync('docker');
                return true;
            } catch (e) {
                return false;
            }
        }
        )();
        if (!isDockerAvailable) {
            const isPodmanAvailable = (() => {
                try {
                    const which = require('which');
                    which.sync('podman');
                    return true;
                } catch (e) {
                    return false;
                }
            }
            )();
            if (isPodmanAvailable) {
                dockerCmd = 'podman';
                console.log('Docker not found, using Podman as a drop-in replacement.');
            } else {
                throw new Error('Neither Docker nor Podman is installed or found in PATH.');
            }
        }

		const docker = spawn(dockerCmd, dockerArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

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
		await removeRecursive(tmpdir);
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
		await removeRecursive(tmpdir);
	}
}

/**
 * Compute SHA-256 hash of a file
 * @param {string} filePath - Path to file
 * @returns {Promise<string>} Hex string of SHA-256 hash
 */
async function hashFile(filePath) {
	return new Promise((resolve, reject) => {
		const hash = crypto.createHash('sha256');
		const stream = fsSync.createReadStream(filePath);

		stream.on('data', (data) => hash.update(data));
		stream.on('end', () => resolve(hash.digest('hex')));
		stream.on('error', reject);
	});
}

/**
 * Hash multiple output files from a directory
 * @param {string} tmpdir - Temporary directory where files were created
 * @param {Array<string>} filenames - Array of filenames to hash
 * @returns {Promise<Array<Object>>} Array of {filename, sha256, exists, error}
 */
async function hashOutputFiles(tmpdir, filenames = []) {
	const results = [];

	for (const filename of filenames) {
		const filePath = path.join(tmpdir, filename);

		try {
			if (!fsSync.existsSync(filePath)) {
				results.push({
					filename,
					sha256: null,
					exists: false,
					error: 'File not found'
				});
				continue;
			}

			const stat = await fs.stat(filePath);
			if (!stat.isFile()) {
				results.push({
					filename,
					sha256: null,
					exists: false,
					error: 'Not a file (might be a directory)'
				});
				continue;
			}

			const hash = await hashFile(filePath);
			results.push({
				filename,
				sha256: hash,
				exists: true,
				size: stat.size
			});
		} catch (error) {
			results.push({
				filename,
				sha256: null,
				exists: false,
				error: error.message
			});
		}
	}

	return results;
}

module.exports = {
	normalizeOutput,
	removeRecursive,
	createTempScript,
	copyFixtures,
	runScriptInContainer,
	runScript,
	runScriptWithTestCase,
	hashFile,
	hashOutputFiles,
	getLanguageConfig,
	getLanguageConfigSync,
	LANGUAGE_CONFIG
};
