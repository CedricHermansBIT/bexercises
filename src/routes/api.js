// src/routes/api.js
const express = require('express');
const exerciseService = require('../services/exerciseService');
const statisticsService = require('../services/statisticsService');
const testRunner = require('../services/testRunner');
const databaseService = require('../services/databaseService');

const router = express.Router();

/**
 * GET /api/exercises
 * Get all exercises (without test cases)
 */
router.get('/exercises', async (req, res) => {
	try {
		const exercises = await exerciseService.getAllExercises();
		res.json(exercises);
	} catch (error) {
		console.error('Error fetching exercises:', error);
		res.status(500).json({ error: 'Failed to load exercises' });
	}
});

/**
 * GET /api/languages
 * Get all available programming languages
 */
router.get('/languages', async (req, res) => {
	try {
		const languages = await databaseService.getLanguages();
		res.json(languages);
	} catch (error) {
		console.error('Error fetching languages:', error);
		res.status(500).json({ error: 'Failed to load languages' });
	}
});

/**
 * GET /api/exercises/:id
 * Get a single exercise by ID (without test cases)
 */
router.get('/exercises/:id', async (req, res) => {
	try {
		const exercise = await exerciseService.getExerciseById(req.params.id);

		if (!exercise) {
			return res.status(404).json({ error: 'Exercise not found' });
		}

		res.json(exercise);
	} catch (error) {
		console.error('Error fetching exercise:', error);
		res.status(500).json({ error: 'Failed to load exercise' });
	}
});

/**
 * POST /api/exercises/:id/run
 * Run tests for an exercise
 */
router.post('/exercises/:id/run', async (req, res) => {
	try {
		const { script } = req.body;

		if (!script || typeof script !== 'string') {
			return res.status(400).json({ error: 'Missing script in request body' });
		}

		const exercise = await exerciseService.getExerciseWithTests(req.params.id);

		if (!exercise) {
			return res.status(404).json({ error: 'Exercise not found' });
		}

		// Run tests
		const results = await testRunner.runTests(exercise, script);

		// Calculate if all tests passed
		const allPassed = results.every(r => r.passed);

		// Save user progress if authenticated
		if (req.user && req.user.id) {
			// Get progress before saving to check attempts
			const progressBefore = await databaseService.getUserProgress(req.user.id, req.params.id);

			await databaseService.saveUserProgress(req.user.id, req.params.id, {
				completed: allPassed,
				last_submission: script
			});

			// Check for achievements
			const newAchievements = [];

			if (allPassed) {
				// Get current progress to check attempts
				const progressAfter = await databaseService.getUserProgress(req.user.id, req.params.id);

				// Check general achievements (exercises completed, first try)
				const generalAchievements = await databaseService.checkAndAwardAchievements(req.user.id);
				newAchievements.push(...generalAchievements);

				// Check time-based achievements
				const timeAchievements = await databaseService.checkTimeBasedAchievements(req.user.id);
				newAchievements.push(...timeAchievements);

				// Check persistence achievements
				const persistenceAchievements = await databaseService.checkPersistenceAchievements(
					req.user.id,
					progressAfter.attempts
				);
				newAchievements.push(...persistenceAchievements);

				// Check speed achievements (exercises per hour/day)
				const speedAchievements = await databaseService.checkSpeedAchievements(req.user.id);
				newAchievements.push(...speedAchievements);

				// Check streak achievements (consecutive days)
				const streakAchievements = await databaseService.checkStreakAchievements(req.user.id);
				newAchievements.push(...streakAchievements);

				// Check chapter completion achievements
				const chapterAchievements = await databaseService.checkChapterAchievements(req.user.id, req.params.id);
				newAchievements.push(...chapterAchievements);
			}

			// Get user-specific statistics from database
			const statistics = await statisticsService.getExerciseStatistics(req.params.id, req.user.id);
			res.json({ results, statistics, newAchievements });
		} else {
			// For non-authenticated users, return global statistics
			const statistics = await statisticsService.updateStatistics(req.params.id, results);
			res.json({ results, statistics });
		}
	} catch (error) {
		console.error('Error running tests:', error);
		res.status(500).json({
			error: 'Internal error',
			detail: error.message
		});
	}
});

/**
 * GET /api/statistics/:id?
 * Get statistics for an exercise or all exercises
 */
router.get('/statistics/:id?', async (req, res) => {
	try {
		const { id } = req.params;
		const userId = req.user ? req.user.id : null;

		if (id) {
			// Get statistics for specific exercise
			const stats = await statisticsService.getExerciseStatistics(id, userId);
			res.json(stats);
		} else {
			// Get all statistics
			const stats = await statisticsService.getAllStatistics(userId);
			res.json(stats);
		}
	} catch (error) {
		console.error(`Error fetching statistics:`, error);
		res.status(500).json({ error: 'Failed to load statistics' });
	}
});

/**
 * GET /api/leaderboard/:languageId?
 * Get leaderboard data, optionally filtered by language
 */
router.get('/leaderboard/:languageId?', async (req, res) => {
	try {
		const { languageId } = req.params;
		const leaderboard = await databaseService.getLeaderboard(languageId);
		res.json(leaderboard);
	} catch (error) {
		console.error('Error fetching leaderboard:', error);
		res.status(500).json({ error: 'Failed to load leaderboard' });
	}
});

/**
 * GET /api/leaderboard-achievements
 * Get achievement points leaderboard
 */
router.get('/leaderboard-achievements', async (req, res) => {
	try {
		const leaderboard = await databaseService.getAchievementLeaderboard();
		res.json(leaderboard);
	} catch (error) {
		console.error('Error fetching achievement leaderboard:', error);
		res.status(500).json({ error: 'Failed to load achievement leaderboard' });
	}
});

/**
 * GET /api/achievements
 * Get all available achievements
 */
router.get('/achievements', async (req, res) => {
	try {
		const achievements = await databaseService.getAllAchievements();
		res.json(achievements);
	} catch (error) {
		console.error('Error fetching achievements:', error);
		res.status(500).json({ error: 'Failed to load achievements' });
	}
});

/**
 * GET /api/achievements/user
 * Get current user's achievements and progress
 */
router.get('/achievements/user', async (req, res) => {
	try {
		if (!req.user || !req.user.id) {
			return res.status(401).json({ error: 'Not authenticated' });
		}

		const progress = await databaseService.getUserAchievementProgress(req.user.id);
		const points = await databaseService.getUserAchievementPoints(req.user.id);

		res.json({ achievements: progress, totalPoints: points });
	} catch (error) {
		console.error('Error fetching user achievements:', error);
		res.status(500).json({ error: 'Failed to load user achievements' });
	}
});

/**
 * POST /api/achievements/unlock/:achievementId
 * Manually unlock a specific achievement (for easter eggs)
 */
router.post('/achievements/unlock/:achievementId', async (req, res) => {
	try {
		if (!req.user || !req.user.id) {
			return res.status(401).json({ error: 'Not authenticated' });
		}

		const { achievementId } = req.params;

		// Check if achievement exists and is an easter egg type
		const achievement = await databaseService.db.get(
			'SELECT * FROM achievements WHERE id = ? AND requirement_type = ?',
			[achievementId, 'easter_egg']
		);

		if (!achievement) {
			return res.status(404).json({ error: 'Achievement not found or not unlockable' });
		}

		// Check if user already has this achievement
		const existing = await databaseService.db.get(
			'SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?',
			[req.user.id, achievementId]
		);

		if (existing) {
			return res.json({ message: 'Achievement already unlocked', achievement });
		}

		// Award the achievement
		await databaseService.awardAchievement(req.user.id, achievementId);

		res.json({ message: 'Achievement unlocked!', achievement });
	} catch (error) {
		console.error('Error unlocking achievement:', error);
		res.status(500).json({ error: 'Failed to unlock achievement' });
	}
});

/**
 * GET /api/notifications
 * Get active notifications
 */
router.get('/notifications', async (req, res) => {
	try {
		const notifications = await databaseService.getActiveNotifications();
		res.json(notifications);
	} catch (error) {
		console.error('Error fetching notifications:', error);
		res.status(500).json({ error: 'Failed to load notifications' });
	}
});

/**
 * GET /api/exercises/stats/global
 * Get global statistics for all exercises (completion counts, average tries)
 */
router.get('/exercises/stats/global', async (req, res) => {
	try {
		const stats = await databaseService.getAllExercisesGlobalStats();
		res.json(stats);
	} catch (error) {
		console.error('Error fetching global exercise stats:', error);
		res.status(500).json({ error: 'Failed to load exercise statistics' });
	}
});

module.exports = router;
