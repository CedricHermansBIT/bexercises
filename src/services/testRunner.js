// src/services/testRunner.js
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const {
	createTempScript,
	copyFixtures,
	runScriptInContainer,
	removeRecursive,
	normalizeOutput,
	hashOutputFiles
} = require('./dockerService');
const config = require('../config');

/**
 * Whitelist of allowed commands for command substitution
 * Only these commands can be executed for security
 */
const ALLOWED_COMMANDS = [
	'date',
	'whoami',
	'hostname',
	'pwd',
	'echo'
];

/**
 * Validate and sanitize command for substitution
 * @param {string} command - Command to validate
 * @returns {boolean} Whether command is allowed
 */
function isCommandAllowed(command) {
	const trimmed = command.trim();

	// Check if command starts with one of the allowed commands
	for (const allowed of ALLOWED_COMMANDS) {
		if (trimmed === allowed || trimmed.startsWith(`${allowed} `)) {
			return true;
		}
	}

	return false;
}

/**
 * Expand command substitutions in a string
 * Supports $(command) syntax for dynamic values
 * SECURITY: Only whitelisted commands are allowed
 * @param {string} str - String with potential command substitutions
 * @returns {string} String with substitutions expanded
 */
function expandCommandSubstitution(str) {
	if (!str || typeof str !== 'string') {
		return str;
	}

	// Match $(command) patterns
	const pattern = /\$\(([^)]+)\)/g;

	return str.replace(pattern, (match, command) => {
		try {
			// SECURITY: Check if command is whitelisted
			if (!isCommandAllowed(command)) {
				console.warn(`[SECURITY] Blocked non-whitelisted command substitution: ${command}`);
				console.warn(`[SECURITY] Allowed commands: ${ALLOWED_COMMANDS.join(', ')}`);
				// Return placeholder instead of executing
				return '[BLOCKED_COMMAND]';
			}

			// Execute the command and get output
			// On Windows, use cmd.exe if bash is not available
			const isWindows = process.platform === 'win32';
			const shell = isWindows ? process.env.ComSpec || 'cmd.exe' : '/bin/bash';

			// Log command execution for audit trail
			console.log(`[AUDIT] Executing whitelisted command substitution: ${command}`);

			const result = execSync(command, {
				encoding: 'utf8',
				timeout: 5000, // 5 second timeout for safety
				shell: shell
			});
			return result.trim();
		} catch (error) {
			console.warn(`Failed to expand command substitution: ${command}`, error.message);
			// Return the original match if execution fails
			return match;
		}
	});
}

/**
 * Run all tests for an exercise
 * @param {Object} exercise - Exercise object with test cases
 * @param {string} script - User's script code
 * @returns {Promise<Array>} Array of test results
 */
async function runTests(exercise, script) {
	// Get language from exercise, default to 'bash' for backwards compatibility
	const languageId = exercise.language_id || exercise.language || 'bash';
	const { tmpdir, scriptFilename, languageConfig } = await createTempScript(script, languageId);
	const results = [];

	// Keep track of fixture files and script to avoid deleting them
	const protectedFiles = new Set([scriptFilename]);

	try {
		for (let i = 0; i < exercise.testCases.length; i++) {
			const tc = exercise.testCases[i];
			console.log(`\n=== Test Case ${i + 1}/${exercise.testCases.length} ===`);
			console.log(`Fixtures:`, tc.fixtures);

			// Clean up output files from previous test case (but keep fixtures and script)
			if (i > 0) {
				try {
					const entries = await fs.readdir(tmpdir);
					for (const entry of entries) {
						// Don't delete script or fixtures
						if (!protectedFiles.has(entry)) {
							const fullPath = path.join(tmpdir, entry);
							try {
								const stat = await fs.stat(fullPath);
								if (stat.isFile()) {
									await fs.unlink(fullPath);
								} else if (stat.isDirectory()) {
									// Only delete if it's not a fixture directory
									if (!protectedFiles.has(entry)) {
										await removeRecursive(fullPath);
									}
								}
							} catch (err) {
								console.warn(`Failed to delete ${entry}:`, err.message);
							}
						}
					}
				} catch (err) {
					console.error('Failed to clean tmpdir between tests:', err);
				}
			}

			// Copy any fixtures needed for this test case
			if (tc.fixtures && Array.isArray(tc.fixtures)) {
				await copyFixtures(tmpdir, tc.fixtures, tc.fixturePermissions);
				// Mark fixtures as protected
				tc.fixtures.forEach(f => protectedFiles.add(f));
			}

			// Run script with arguments and inputs
			const r = await runScriptInContainer(
				tmpdir,
				scriptFilename,
				languageConfig,
				tc.arguments || [],
				tc.input || [],
				config.docker.timeout
			);

			// Determine expected output
			let expected = normalizeOutput(tc.expectedOutput || '').trim();
			let expectedStderr = normalizeOutput(tc.expectedStderr || '').trim();
			let expectedExitCode = (tc.expectedExitCode != null) ? tc.expectedExitCode : 0;

			// If test case uses dynamic output, run the exercise solution to get expected output
			if (tc.useDynamicOutput && exercise.solution) {
				try {
					const { tmpdir: solutionTmpdir, scriptFilename: solutionScriptFilename, languageConfig: solutionLangConfig } = await createTempScript(exercise.solution, languageId);

					// Copy same fixtures to solution temp dir
					if (tc.fixtures && Array.isArray(tc.fixtures)) {
						await copyFixtures(solutionTmpdir, tc.fixtures, tc.fixturePermissions);
					}

					const solutionResult = await runScriptInContainer(
						solutionTmpdir,
						solutionScriptFilename,
						solutionLangConfig,
						tc.arguments || [],
						tc.input || [],
						config.docker.timeout
					);

					// Use solution's output as expected
					expected = normalizeOutput(solutionResult.stdout).trim();
					expectedStderr = normalizeOutput(solutionResult.stderr || '').trim();
					expectedExitCode = solutionResult.exitCode;

					// Cleanup solution temp dir
					await removeRecursive(solutionTmpdir);
				} catch (err) {
					console.error('Failed to run solution script for dynamic output:', err);
					// Fall back to stored expected output
				}
			}

			// Hash output files if specified
			let outputFilesResult = [];
			let outputFilesMatch = true;
			if (tc.expectedOutputFiles && tc.expectedOutputFiles.length > 0) {
				// Expand command substitutions in filenames (e.g., $(date +%Y%m%d))
				const expandedFiles = tc.expectedOutputFiles.map(f => ({
					...f,
					filename: expandCommandSubstitution(f.filename)
				}));

				const filenames = expandedFiles.map(f => f.filename);
				const actualFileHashes = await hashOutputFiles(tmpdir, filenames);

				// Compare each file's hash
				outputFilesResult = actualFileHashes.map((actual) => {
					const expected = expandedFiles.find(e => e.filename === actual.filename);
					const hashMatches = expected && actual.sha256 === expected.sha256;

					if (!hashMatches) {
						outputFilesMatch = false;
					}

					return {
						filename: actual.filename,
						expectedHash: expected ? expected.sha256 : null,
						actualHash: actual.sha256,
						exists: actual.exists,
						size: actual.size,
						error: actual.error,
						matches: hashMatches
					};
				});
			}

			// Compare output - normalize both expected and actual
			const actual = normalizeOutput(r.stdout).trim();
			const actualStderr = normalizeOutput(r.stderr || '').trim();

			const passed = (!r.timedOut)
				&& (r.exitCode !== null)
				&& (String(r.exitCode) === String(expectedExitCode))
				&& (actual === expected)
				&& (actualStderr === expectedStderr)
				&& outputFilesMatch;

			results.push({
				testNumber: i + 1,
				arguments: tc.arguments || [],
				expectedOutput: expected,
				expectedStderr: expectedStderr,
				expectedExitCode: expectedExitCode,
				actualOutput: actual,
				actualStderr: actualStderr,
				stderr: r.stderr,
				exitCode: r.exitCode,
				timedOut: r.timedOut,
				error: r.error,
				outputFiles: outputFilesResult,
				passed
			});
		}
	} finally {
		// Cleanup - don't let cleanup errors affect the test results
		try {
			await removeRecursive(tmpdir);
		} catch (e) {
			console.error('Cleanup failed for tmpdir:', tmpdir, '-', e.message);
			// Try one more time with a delay
			setTimeout(async () => {
				try {
					await removeRecursive(tmpdir);
				} catch (retryErr) {
					console.error('Retry cleanup also failed:', retryErr.message);
				}
			}, 1000);
		}
	}

	return results;
}

module.exports = {
	runTests
};

