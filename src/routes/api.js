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
			await databaseService.saveUserProgress(req.user.id, req.params.id, {
				completed: allPassed,
				last_submission: script
			});

			// Get user-specific statistics from database
			const statistics = await statisticsService.getExerciseStatistics(req.params.id, req.user.id);
			res.json({ results, statistics });
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

module.exports = router;
