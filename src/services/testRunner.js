// src/services/testRunner.js
const {
	createTempScript,
	copyFixtures,
	runScriptInContainer,
	removeRecursive,
	normalizeOutput
} = require('./dockerService');
const config = require('../config');

/**
 * Run all tests for an exercise
 * @param {Object} exercise - Exercise object with test cases
 * @param {string} script - User's script code
 * @returns {Promise<Array>} Array of test results
 */
async function runTests(exercise, script) {
	const { tmpdir } = await createTempScript(script);
	const results = [];

	try {
		for (let i = 0; i < exercise.testCases.length; i++) {
			const tc = exercise.testCases[i];
            console.log(tc.fixtures);
			// Copy any fixtures needed for this test case
			if (tc.fixtures && Array.isArray(tc.fixtures)) {
				await copyFixtures(tmpdir, tc.fixtures, tc.fixturePermissions);
			}

			// Run script with arguments and inputs
			const r = await runScriptInContainer(
				tmpdir,
				tc.arguments || [],
				tc.input || [],
				config.docker.timeout
			);

			// Compare output - normalize both expected and actual
			const expected = normalizeOutput(tc.expectedOutput || '').trim();
			const actual = normalizeOutput(r.stdout).trim();
			const expectedExitCode = (tc.expectedExitCode != null) ? tc.expectedExitCode : 0;

			const passed = (!r.timedOut)
				&& (r.exitCode !== null)
				&& (String(r.exitCode) === String(expectedExitCode))
				&& (actual === expected);

			results.push({
				testNumber: i + 1,
				arguments: tc.arguments || [],
				expectedOutput: expected,
				expectedExitCode: expectedExitCode,
				actualOutput: actual,
				stderr: r.stderr,
				exitCode: r.exitCode,
				timedOut: r.timedOut,
				error: r.error,
				passed
			});
		}
	} finally {
		// Cleanup
		try {
			await removeRecursive(tmpdir);
		} catch (e) {
			console.error('Cleanup failed:', e);
		}
	}

	return results;
}

module.exports = {
	runTests
};

