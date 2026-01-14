// src/routes/api.js
const express = require('express');
const exerciseService = require('../services/exerciseService');
const statisticsService = require('../services/statisticsService');
const testRunner = require('../services/testRunner');
const databaseService = require('../services/databaseService');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /api/exercises
 * Get all exercises (without test cases)
 * Optional query param: ?language=bash to filter by language or ?chapter=1 to filter by chapter
 */
router.get('/exercises', asyncHandler(async (req, res) => {
	const languageId = req.query.language;
	const chapter = req.query.chapter;

	let exercises;
	if (languageId) {
		exercises = await exerciseService.getExercisesByLanguage(languageId);
	} else if (chapter) {
		exercises = await exerciseService.getExercisesByChapter(chapter);
	} else {
		exercises = await exerciseService.getAllExercises();
	}
	res.json(exercises);
}));

/**
 * GET /api/languages
 * Get all available programming languages
 * Returns all languages (including disabled) to everyone
 * Disabled languages will be shown but not clickable for non-admin users (handled in frontend)
 */
router.get('/languages', asyncHandler(async (req, res) => {
	const languages = await databaseService.getLanguages(true);
	res.json(languages);
}));

/**
 * GET /api/exercises/:id
 * Get a single exercise by ID (without test cases)
 */
router.get('/exercises/:id', asyncHandler(async (req, res) => {
	const exercise = await exerciseService.getExerciseById(req.params.id);
	if (!exercise) {
		throw ApiError.notFound('Exercise not found');
	}
	res.json(exercise);
}));

/**
 * POST /api/exercises/:id/run
 * Run tests for an exercise
 */
router.post('/exercises/:id/run', asyncHandler(async (req, res) => {
	const { script, timezone } = req.body;

	if (!script || typeof script !== 'string') {
		throw ApiError.badRequest('Missing script in request body');
	}

	const exercise = await exerciseService.getExerciseWithTests(req.params.id);
	if (!exercise) {
		throw ApiError.notFound('Exercise not found');
	}

	// Run tests
	const results = await testRunner.runTests(exercise, script);
	const allPassed = results.every(r => r.passed);

	// Save user progress if authenticated
	if (req.user && req.user.id) {
		await databaseService.saveUserProgress(req.user.id, req.params.id, {
			completed: allPassed,
			last_submission: script
		});

		// Check for achievements
		const newAchievements = [];

		if (allPassed) {
			const progressAfter = await databaseService.getUserProgress(req.user.id, req.params.id);

			// Check all achievement types in parallel for better performance
			const [
				generalAchievements,
				timeAchievements,
				persistenceAchievements,
				speedAchievements,
				streakAchievements,
				chapterAchievements
			] = await Promise.all([
				databaseService.checkAndAwardAchievements(req.user.id),
				databaseService.checkTimeBasedAchievements(req.user.id, timezone),
				databaseService.checkPersistenceAchievements(req.user.id, progressAfter.attempts),
				databaseService.checkSpeedAchievements(req.user.id),
				databaseService.checkStreakAchievements(req.user.id),
				databaseService.checkChapterAchievements(req.user.id, req.params.id)
			]);

			newAchievements.push(
				...generalAchievements,
				...timeAchievements,
				...persistenceAchievements,
				...speedAchievements,
				...streakAchievements,
				...chapterAchievements
			);
		}

		const statistics = await statisticsService.getExerciseStatistics(req.params.id, req.user.id);
		res.json({ results, statistics, newAchievements });
	} else {
		const statistics = await statisticsService.updateStatistics(req.params.id, results);
		res.json({ results, statistics });
	}
}));

/**
 * GET /api/statistics/:id?
 * Get statistics for an exercise or all exercises
 */
router.get('/statistics/:id?', asyncHandler(async (req, res) => {
	const { id } = req.params;
	const userId = req.user ? req.user.id : null;

	const stats = id
		? await statisticsService.getExerciseStatistics(id, userId)
		: await statisticsService.getAllStatistics(userId);
	res.json(stats);
}));

/**
 * GET /api/leaderboard/:languageId?
 * Get leaderboard data, optionally filtered by language
 */
router.get('/leaderboard/:languageId?', asyncHandler(async (req, res) => {
	const leaderboard = await databaseService.getLeaderboard(req.params.languageId);
	res.json(leaderboard);
}));

/**
 * GET /api/leaderboard-achievements
 * Get achievement points leaderboard
 */
router.get('/leaderboard-achievements', asyncHandler(async (req, res) => {
	const leaderboard = await databaseService.getAchievementLeaderboard();
	res.json(leaderboard);
}));

/**
 * GET /api/achievements
 * Get all available achievements
 */
router.get('/achievements', asyncHandler(async (req, res) => {
	const achievements = await databaseService.getAllAchievements();
	res.json(achievements);
}));

/**
 * GET /api/achievements/user
 * Get current user's achievements and progress
 */
router.get('/achievements/user', asyncHandler(async (req, res) => {
	if (!req.user || !req.user.id) {
		throw ApiError.unauthorized();
	}

	const [progress, points] = await Promise.all([
		databaseService.getUserAchievementProgress(req.user.id),
		databaseService.getUserAchievementPoints(req.user.id)
	]);

	res.json({ achievements: progress, totalPoints: points });
}));

/**
 * POST /api/achievements/unlock/:achievementId
 * Manually unlock a specific achievement (for easter eggs)
 */
router.post('/achievements/unlock/:achievementId', asyncHandler(async (req, res) => {
	if (!req.user || !req.user.id) {
		throw ApiError.unauthorized();
	}

	const { achievementId } = req.params;

	// Check if achievement exists and is an easter egg type
	const achievement = await databaseService.db.get(
		'SELECT * FROM achievements WHERE id = ? AND requirement_type = ?',
		[achievementId, 'easter_egg']
	);

	if (!achievement) {
		throw ApiError.notFound('Achievement not found or not unlockable');
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
}));

/**
 * GET /api/notifications
 * Get active notifications
 */
router.get('/notifications', asyncHandler(async (req, res) => {
	const notifications = await databaseService.getActiveNotifications();
	res.json(notifications);
}));

/**
 * GET /api/exercises/stats/global
 * Get global statistics for all exercises (completion counts, average tries)
 */
router.get('/exercises/stats/global', asyncHandler(async (req, res) => {
	const stats = await databaseService.getAllExercisesGlobalStats();
	res.json(stats);
}));

/**
 * GET /api/progress
 * Get current user's progress for all exercises
 */
router.get('/progress', asyncHandler(async (req, res) => {
	if (!req.user || !req.user.id) {
		throw ApiError.unauthorized();
	}

	const progressRecords = await databaseService.db.all(`
		SELECT exercise_id, completed, last_submission_at, completed_at, attempts
		FROM user_progress
		WHERE user_id = ?
	`, [req.user.id]);

	// Convert to a map for easy lookup using reduce for better performance
	const progressMap = progressRecords.reduce((map, record) => {
		map[record.exercise_id] = {
			completed: record.completed === 1,
			lastSubmissionAt: record.last_submission_at,
			completedAt: record.completed_at,
			attempts: record.attempts
		};
		return map;
	}, {});

	res.json(progressMap);
}));

/**
 * GET /api/progress/language/:languageId
 * Get current user's progress for a specific language
 */
router.get('/progress/language/:languageId', asyncHandler(async (req, res) => {
	if (!req.user || !req.user.id) {
		throw ApiError.unauthorized();
	}

	const progressRecords = await databaseService.getUserProgressByLanguage(req.user.id, req.params.languageId);
	res.json(progressRecords);
}));

/**
 * GET /api/online-users
 * Get list of users currently online (active in last hour)
 */
router.get('/online-users', asyncHandler(async (req, res) => {
	const onlineUsers = await databaseService.getOnlineUsers(60);

	res.json({
		count: onlineUsers.length,
		users: onlineUsers.map(u => ({
			displayName: u.display_name,
			isAdmin: u.is_admin === 1,
			lastActivity: u.last_activity
		}))
	});
}));

module.exports = router;
