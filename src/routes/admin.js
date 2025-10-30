// src/routes/admin.js
const express = require('express');
const requireAdmin = require('../middleware/adminAuth');
const exerciseService = require('../services/exerciseService');
const dockerService = require('../services/dockerService');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

/**
 * POST /api/admin/exercises/reorder
 * Reorder exercises (must be before :id routes to avoid conflicts)
 */
router.post('/exercises/reorder', async (req, res) => {
	try {
		const { exercises } = req.body;

		if (!exercises || !Array.isArray(exercises)) {
			return res.status(400).json({ error: 'Invalid exercises array' });
		}

		await exerciseService.reorderExercises(exercises);

		res.json({ success: true });
	} catch (error) {
		console.error('Error reordering exercises:', error);
		res.status(500).json({
			error: 'Failed to reorder exercises',
			detail: error.message
		});
	}
});

/**
 * GET /api/admin/exercises/:id/full
 * Get complete exercise with test cases (admin only)
 */
router.get('/exercises/:id/full', async (req, res) => {
	try {
		const exercise = await exerciseService.getExerciseWithTests(req.params.id);

		if (!exercise) {
			return res.status(404).json({ error: 'Exercise not found' });
		}

		res.json(exercise);
	} catch (error) {
		console.error('Error fetching exercise:', error);
		res.status(500).json({
			error: 'Failed to load exercise',
			detail: error.message
		});
	}
});

/**
 * POST /api/admin/test-solution
 * Test a solution script and return output
 */
router.post('/test-solution', async (req, res) => {
	try {
		const { solution } = req.body;

		if (!solution || typeof solution !== 'string') {
			return res.status(400).json({ error: 'Missing solution script' });
		}

		// Run the script using Docker
		const result = await dockerService.runScript(solution, []);

		res.json({
			output: result.stdout + result.stderr,
			exitCode: result.exitCode
		});
	} catch (error) {
		console.error('Error testing solution:', error);
		res.status(500).json({
			error: 'Failed to test solution',
			detail: error.message
		});
	}
});

/**
 * POST /api/admin/exercises
 * Create a new exercise
 */
router.post('/exercises', async (req, res) => {
	try {
		const exerciseData = req.body;

		// Validate required fields
		if (!exerciseData.id || !exerciseData.title || !exerciseData.solution) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		// Save fixture files if provided
		if (exerciseData.fixtures && Array.isArray(exerciseData.fixtures)) {
			for (const fixture of exerciseData.fixtures) {
				const fixturePath = path.join(config.paths.fixtures, fixture.name);
				await fs.writeFile(fixturePath, fixture.content, 'utf8');
			}
		}

		const exercise = {
			id: exerciseData.id,
			title: exerciseData.title,
			description: exerciseData.description || '',
			solution: exerciseData.solution,
			testCases: exerciseData.testCases || [],
			chapter: exerciseData.chapter || 'Additional exercises',
			order: exerciseData.order || 0
		};

		await exerciseService.createExercise(exercise);

		res.json({
			success: true,
			exercise: {
				id: exercise.id,
				title: exercise.title,
				chapter: exercise.chapter,
				order: exercise.order
			}
		});
	} catch (error) {
		console.error('Error creating exercise:', error);
		res.status(500).json({
			error: 'Failed to create exercise',
			detail: error.message
		});
	}
});

/**
 * PUT /api/admin/exercises/:id
 * Update an existing exercise
 */
router.put('/exercises/:id', async (req, res) => {
	try {
		const exerciseData = req.body;
		const exerciseId = req.params.id;

		// Save fixture files if provided
		if (exerciseData.fixtures && Array.isArray(exerciseData.fixtures)) {
			for (const fixture of exerciseData.fixtures) {
				const fixturePath = path.join(config.paths.fixtures, fixture.name);
				await fs.writeFile(fixturePath, fixture.content, 'utf8');
			}
		}

		const exercise = {
			id: exerciseData.id || exerciseId,
			title: exerciseData.title,
			description: exerciseData.description || '',
			solution: exerciseData.solution,
			testCases: exerciseData.testCases || [],
			chapter: exerciseData.chapter || 'Additional exercises',
			order: exerciseData.order || 0
		};

		await exerciseService.updateExercise(exerciseId, exercise);

		res.json({
			success: true,
			exercise: {
				id: exercise.id,
				title: exercise.title,
				chapter: exercise.chapter,
				order: exercise.order
			}
		});
	} catch (error) {
		console.error('Error updating exercise:', error);
		res.status(500).json({
			error: 'Failed to update exercise',
			detail: error.message
		});
	}
});

/**
 * DELETE /api/admin/exercises/:id
 * Delete an exercise
 */
router.delete('/exercises/:id', async (req, res) => {
	try {
		await exerciseService.deleteExercise(req.params.id);
		res.json({ success: true });
	} catch (error) {
		console.error('Error deleting exercise:', error);
		res.status(500).json({
			error: 'Failed to delete exercise',
			detail: error.message
		});
	}
});

module.exports = router;

