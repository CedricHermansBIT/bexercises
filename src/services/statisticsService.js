// src/services/statisticsService.js
const fs = require('fs').promises;
const config = require('../config');
const databaseService = require('./databaseService');

/**
 * Load statistics from JSON file (legacy fallback)
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
 * Save statistics to JSON file (legacy fallback)
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
 * @param {number} userId - User ID (optional, if not provided returns global stats)
 * @returns {Promise<Object>} Statistics for the exercise
 */
async function getExerciseStatistics(exerciseId, userId = null) {
	try {
		if (userId) {
			// Get user-specific statistics from database
			return await databaseService.getExerciseStatistics(userId, exerciseId);
		} else {
			// Get global statistics from database
			return await databaseService.getGlobalExerciseStatistics(exerciseId);
		}
	} catch (error) {
		console.error('Error getting statistics from database, falling back to file:', error);
		// Fallback to file-based statistics
		const stats = await loadStatistics();
		return stats[exerciseId] || {
			totalAttempts: 0,
			successfulAttempts: 0,
			failedAttempts: 0,
			lastAttempt: null,
			failureReasons: {}
		};
	}
}

/**
 * Update statistics after a test run
 * @param {string} exerciseId - Exercise ID
 * @param {Array} results - Test results
 * @param {number} userId - User ID (optional)
 */
async function updateStatistics(exerciseId, results, userId = null) {
	const allPassed = results.every(r => r.passed);

	// If user is authenticated, statistics are already saved via user_progress
	// in the API route, so we just return the current stats
	if (userId) {
		try {
			return await databaseService.getExerciseStatistics(userId, exerciseId);
		} catch (error) {
			console.error('Error updating statistics in database:', error);
		}
	}

	// Legacy file-based statistics (for backward compatibility)
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

