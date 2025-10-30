// src/services/statisticsService.js
const fs = require('fs').promises;
const config = require('../config');

/**
 * Load statistics from JSON file
 * @returns {Promise<Object>} Statistics object
 */
async function loadStatistics() {
	try {
		const txt = await fs.readFile(config.paths.statistics, 'utf8');
		return JSON.parse(txt);
	} catch (err) {
        console.error('Failed to load statistics, returning empty stats:', err);
		// If file doesn't exist, return empty stats
		return {};
	}
}

/**
 * Save statistics to JSON file
 * @param {Object} stats - Statistics object to save
 */
async function saveStatistics(stats) {
	try {
		await fs.writeFile(config.paths.statistics, JSON.stringify(stats, null, 2), 'utf8');
	} catch (err) {
		console.error('Failed to save statistics:', err);
	}
}

/**
 * Get statistics for a specific exercise
 * @param {string} exerciseId - Exercise ID
 * @returns {Promise<Object>} Statistics for the exercise
 */
async function getExerciseStatistics(exerciseId) {
	const stats = await loadStatistics();
	return stats[exerciseId] || {
		totalAttempts: 0,
		successfulAttempts: 0,
		failedAttempts: 0,
		lastAttempt: null,
		failureReasons: {}
	};
}

/**
 * Update statistics after a test run
 * @param {string} exerciseId - Exercise ID
 * @param {Array} results - Test results
 */
async function updateStatistics(exerciseId, results) {
	const allPassed = results.every(r => r.passed);
	const stats = await loadStatistics();

	if (!stats[exerciseId]) {
		stats[exerciseId] = {
			totalAttempts: 0,
			successfulAttempts: 0,
			failedAttempts: 0,
			lastAttempt: null,
			failureReasons: {}
		};
	}

	stats[exerciseId].totalAttempts++;
	stats[exerciseId].lastAttempt = new Date().toISOString();

	if (allPassed) {
		stats[exerciseId].successfulAttempts++;
	} else {
		stats[exerciseId].failedAttempts++;

		// Track failure reasons
		const failedTests = results.filter(r => !r.passed);
		failedTests.forEach(test => {
			let reason = 'unknown';
			if (test.timedOut) {
				reason = 'timeout';
			} else if (test.exitCode !== test.expectedExitCode) {
				reason = 'wrong_exit_code';
			} else if (test.actualOutput !== test.expectedOutput) {
				reason = 'wrong_output';
			} else if (test.error) {
				reason = 'error';
			}
			stats[exerciseId].failureReasons[reason] = (stats[exerciseId].failureReasons[reason] || 0) + 1;
		});
	}

	await saveStatistics(stats);
	return stats[exerciseId];
}

module.exports = {
	loadStatistics,
	saveStatistics,
	getExerciseStatistics,
	updateStatistics
};

