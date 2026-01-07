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
const {
    startMariaDBContainer,
    startMongoDBContainer,
    executeMariaDBQuery,
    executeMongoDBQuery
} = require('./databaseContainerService');
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
    const results = [];

    // Determine if this is a database exercise
    const isDatabaseExercise = exercise.exercise_type === 'database';

    // Map 'sql' to 'mariadb' for backwards compatibility
    const effectiveLanguageId = languageId === 'sql' ? 'mariadb' : languageId;

    // Log for debugging
    console.log(`[TestRunner] Exercise: ${exercise.id}, Language: ${languageId} (effective: ${effectiveLanguageId}), Exercise Type: ${exercise.exercise_type}, Is Database Exercise: ${isDatabaseExercise}`);

    // For database exercises, we don't need to create a script file since we use executeMariaDBQuery/executeMongoDBQuery
    // For regular exercises, create the temp script as usual
    let tmpdir, scriptFilename, languageConfig;

    if (isDatabaseExercise && (effectiveLanguageId === 'mariadb' || effectiveLanguageId === 'mongodb')) {
        // Create a temp directory without the user script (to avoid it being executed during DB init)
        tmpdir = await fs.mkdtemp(path.join(config.paths.temp, 'bex-db-'));
        await fs.chmod(tmpdir, 0o777);
        scriptFilename = null; // No script file for database exercises
        languageConfig = null;
        console.log(`[Database] Created temp directory without script file: ${tmpdir}`);
    } else {
        const tempScript = await createTempScript(script, languageId);
        tmpdir = tempScript.tmpdir;
        scriptFilename = tempScript.scriptFilename;
        languageConfig = tempScript.languageConfig;
    }

    // Check if we need to start a database container
    const needsDatabaseContainer = isDatabaseExercise && (effectiveLanguageId === 'mariadb' || effectiveLanguageId === 'mongodb');
    let dbContainer = null;

    // Keep track of fixture files and script to avoid deleting them
    const protectedFiles = new Set();
    if (scriptFilename) {
        protectedFiles.add(scriptFilename);
    }

    try {
        // Start database container if needed (will be reused across test cases)
        if (needsDatabaseContainer) {
            // Get language configuration including docker_image
            const databaseService = require('./databaseService');
            const language = await databaseService.getLanguage(languageId);
            if (!language) {
                throw new Error(`Language not found: ${languageId}`);
            }

            // Use docker_image from language config, with fallback defaults
            const dockerImage = language.docker_image || (effectiveLanguageId === 'mariadb' ? 'mariadb:latest' : 'mongo:latest');

            // Collect all fixtures from all test cases for initial DB setup
            const allFixtures = [];
            for (const tc of exercise.testCases) {
                if (tc.fixtures && Array.isArray(tc.fixtures)) {
                    // Only include SQL/JS/JSON/BSON fixtures for database initialization
                    tc.fixtures.forEach(f => {
                        if ((effectiveLanguageId === 'mariadb' && f.endsWith('.sql')) ||
                            (effectiveLanguageId === 'mongodb' && (f.endsWith('.js') || f.endsWith('.json') || f.endsWith('.bson')))) {
                            if (!allFixtures.includes(f)) {
                                allFixtures.push(f);
                            }
                        }
                    });
                }
            }

            console.log(`[Database] Starting ${effectiveLanguageId} container with fixtures:`, allFixtures);

            if (effectiveLanguageId === 'mariadb') {
                dbContainer = await startMariaDBContainer(tmpdir, allFixtures, dockerImage);
            } else if (effectiveLanguageId === 'mongodb') {
                dbContainer = await startMongoDBContainer(tmpdir, allFixtures, dockerImage);
            }
            if (dbContainer)
            console.log(`[Database] Container ready:`, dbContainer.containerName);
        }

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

            let r;
            // Run script - use database container if available, otherwise use regular container
            if (dbContainer) {
                console.log(`[Database] Executing user query in container`);
                // Read the user's script
                const userQuery = script.trim();

                if (effectiveLanguageId === 'mariadb') {
                    r = await executeMariaDBQuery(dbContainer, userQuery);
                } else if (effectiveLanguageId === 'mongodb') {
                    r = await executeMongoDBQuery(dbContainer, userQuery);
                }
            } else {
                // Regular execution for non-database exercises
                r = await runScriptInContainer(
                    tmpdir,
                    scriptFilename,
                    languageConfig,
                    tc.arguments || [],
                    tc.input || [],
                    config.docker.timeout
                );
            }

            // Determine expected output
            let expected = normalizeOutput(tc.expectedOutput || '').trim();
            let expectedStderr = normalizeOutput(tc.expectedStderr || '').trim();
            let expectedExitCode = (tc.expectedExitCode != null) ? tc.expectedExitCode : 0;

            // For database exercises with validation queries, run the validation query AFTER user script
            // to check the actual database state rather than just the command output
            let validationOutput = null;
            if (isDatabaseExercise && tc.validationQuery) {
                try {
                    console.log(`Running validation query to check database state: ${tc.validationQuery}`);

                    if (dbContainer) {
                        // Use the same database container - validation query runs in the same DB instance
                        let validationResult;
                        if (effectiveLanguageId === 'mariadb') {
                            validationResult = await executeMariaDBQuery(dbContainer, tc.validationQuery);
                        } else if (effectiveLanguageId === 'mongodb') {
                            validationResult = await executeMongoDBQuery(dbContainer, tc.validationQuery);
                        }

                        validationOutput = normalizeOutput(validationResult.stdout).trim();
                        console.log(`Validation query returned: ${validationOutput}`);
                    } else {
                        // Fallback to combined script approach for other databases
                        const combinedScript = script + '\n' + tc.validationQuery;
                        const { tmpdir: valTmpdir, scriptFilename: valScriptFilename, languageConfig: valLangConfig } = await createTempScript(combinedScript, languageId);

                        try {
                            // Copy fixtures if needed
                            if (tc.fixtures && Array.isArray(tc.fixtures)) {
                                await copyFixtures(valTmpdir, tc.fixtures, tc.fixturePermissions);
                            }

                            // Run the combined script
                            const validationResult = await runScriptInContainer(
                                valTmpdir,
                                valScriptFilename,
                                valLangConfig,
                                tc.arguments || [],
                                tc.input || [],
                                config.docker.timeout
                            );

                            // Use validation query output as the actual output to compare
                            validationOutput = normalizeOutput(validationResult.stdout).trim();

                            console.log(`Validation query returned: ${validationOutput}`);
                            console.log(`Expected database state: ${expected}`);
                        } finally {
                            // Cleanup validation temp dir
                            await removeRecursive(valTmpdir);
                        }
                    }
                } catch (err) {
                    console.error('Failed to run validation query:', err);
                }
            }

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
            // For display: always show the user's actual query output
            const actualUserOutput = normalizeOutput(r.stdout).trim();
            const actualStderr = normalizeOutput(r.stderr || '').trim();

            // For comparison: use validation output if present, otherwise user output
            const actualForComparison = validationOutput !== null ? validationOutput : actualUserOutput;

            // For validation queries, compare against expected validation output, otherwise use expected output
            const expectedForComparison = (validationOutput !== null && tc.expectedValidationOutput)
                ? tc.expectedValidationOutput.trim()
                : expected;

            // For database exercises, focus primarily on stdout (data returned)
            // stderr and exit codes are less critical as database tools often output logs to stderr
            let passed;
            if (isDatabaseExercise) {
                // Database exercises: only check stdout and timeout, ignore stderr and exit codes
                // If validation query is present, we're checking database state instead of command output
                passed = (!r.timedOut)
                    && (actualForComparison === expectedForComparison)
                    && outputFilesMatch;
            } else {
                // Programming exercises: check all outputs including stderr and exit codes
                passed = (!r.timedOut)
                    && (r.exitCode !== null)
                    && (String(r.exitCode) === String(expectedExitCode))
                    && (actualForComparison === expected)
                    && (actualStderr === expectedStderr)
                    && outputFilesMatch;
            }

            results.push({
                testNumber: i + 1,
                arguments: tc.arguments || [],
                expectedOutput: expected,
                expectedStderr: expectedStderr,
                expectedExitCode: expectedExitCode,
                actualOutput: actualUserOutput,  // Show user's query output, not validation output
                actualStderr: actualStderr,
                stderr: r.stderr,
                exitCode: r.exitCode,
                timedOut: r.timedOut,
                error: r.error,
                outputFiles: outputFilesResult,
                validationQuery: tc.validationQuery || null,
                expectedValidationOutput: tc.expectedValidationOutput || null,
                actualValidationOutput: validationOutput,
                usedValidation: validationOutput !== null,
                isDatabaseExercise: isDatabaseExercise,
                passed
            });
        }
    } finally {
        // Cleanup database container if started
        if (dbContainer && dbContainer.cleanup) {
            try {
                console.log(`[Database] Cleaning up container...`);
                await dbContainer.cleanup();
            } catch (e) {
                console.error('Database container cleanup failed:', e.message);
            }
        }

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

