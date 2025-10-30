// src/services/statisticsService.js
const databaseService = require('./databaseService');

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
		console.error('Error getting statistics from database:', error);
		// Return empty stats on error
		return {
			totalAttempts: 0,
			successfulAttempts: 0,
			failedAttempts: 0,
			lastAttempt: null,
			failureReasons: {}
		};
	}
}

/**
 * Get all statistics for a user or global statistics
 * @param {number} userId - User ID (optional)
 * @returns {Promise<Object>} Statistics object keyed by exercise ID
 */
async function getAllStatistics(userId = null) {
	try {
		if (userId) {
			// Get all user's progress from database
			const allProgress = await databaseService.db.all(`
				SELECT exercise_id, attempts, successful_attempts, failed_attempts, started_at
				FROM user_progress
				WHERE user_id = ?
			`, [userId]);

			const stats = {};
			allProgress.forEach(p => {
				stats[p.exercise_id] = {
					totalAttempts: p.attempts || 0,
					successfulAttempts: p.successful_attempts || 0,
					failedAttempts: p.failed_attempts || 0,
					lastAttempt: p.started_at,
					failureReasons: {}
				};
			});
			return stats;
		} else {
			// Get global statistics for all exercises
			const exercises = await databaseService.db.all(`
				SELECT DISTINCT exercise_id FROM user_progress
			`);

			const stats = {};
			for (const ex of exercises) {
				stats[ex.exercise_id] = await databaseService.getGlobalExerciseStatistics(ex.exercise_id);
			}
			return stats;
		}
	} catch (error) {
		console.error('Error getting all statistics from database:', error);
		return {};
	}
}

/**
 * Update statistics after a test run
 * Note: This now just returns the current stats since user_progress
 * is updated separately in the API route
 * @param {string} exerciseId - Exercise ID
 * @param {Array} results - Test results
 * @param {number} userId - User ID (optional)
 */
async function updateStatistics(exerciseId, results, userId = null) {
	// Statistics are now managed through user_progress table
	// This function just returns the current stats
	try {
		return await getExerciseStatistics(exerciseId, userId);
	} catch (error) {
		console.error('Error updating statistics:', error);
		return {
			totalAttempts: 0,
			successfulAttempts: 0,
			failedAttempts: 0,
			lastAttempt: null,
			failureReasons: {}
		};
	}
}

module.exports = {
	getExerciseStatistics,
	getAllStatistics,
	updateStatistics
};

