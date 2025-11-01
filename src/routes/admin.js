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
 * GET /api/admin/exercises
 * Get all exercises with full data including test cases (admin only)
 */
router.get('/exercises', async (req, res) => {
	try {
		const exercises = await exerciseService.loadExercisesInternal();
		res.json(exercises);
	} catch (error) {
		console.error('Error fetching exercises:', error);
		res.status(500).json({
			error: 'Failed to load exercises',
			detail: error.message
		});
	}
});

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

		console.log('Testing solution, script length:', solution.length);

		// Run the script using Docker
		const result = await dockerService.runScript(solution, []);

		console.log('Test result:', { exitCode: result.exitCode, stdoutLen: result.stdout.length });

		res.json({
			output: result.stdout + result.stderr,
			exitCode: result.exitCode
		});
	} catch (error) {
		console.error('Error testing solution:', error);
		res.status(500).json({
			error: 'Failed to test solution',
			detail: error.message,
			stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
		});
	}
});

/**
 * POST /api/admin/run-test-case
 * Run a test case with specific arguments, input, and fixtures
 */
router.post('/run-test-case', async (req, res) => {
	try {
		const { solution, arguments: args = [], input = [], fixtures = [] } = req.body;

		if (!solution || typeof solution !== 'string') {
			return res.status(400).json({ error: 'Missing solution script' });
		}

		console.log('Running test case:', { argsLen: args.length, inputLen: input.length, fixturesLen: fixtures.length });

		// Run the script using Docker with test case parameters
		const result = await dockerService.runScriptWithTestCase(solution, args, input, fixtures);

		console.log('Test case result:', { exitCode: result.exitCode, stdoutLen: result.stdout.length });

		res.json({
			output: result.stdout + result.stderr,
			exitCode: result.exitCode,
			timedOut: result.timedOut,
			error: result.error
		});
	} catch (error) {
		console.error('Error running test case:', error);
		res.status(500).json({
			error: 'Failed to run test case',
			detail: error.message,
			stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
			order: exerciseData.order // Frontend calculates the correct order
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
			order: exerciseData.order // Don't default to 0, let service layer handle it
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

/**
 * GET /api/admin/fixtures
 * Get list of all fixture files
 */
router.get('/fixtures', async (req, res) => {
	try {
		const files = await require('../services/databaseService').getFixtureFiles();
		res.json(files);
	} catch (error) {
		console.error('Error listing fixtures:', error);
		res.status(500).json({
			error: 'Failed to list fixture files',
			detail: error.message
		});
	}
});

/**
 * POST /api/admin/fixtures
 * Upload a new fixture file or create a folder
 */
router.post('/fixtures', async (req, res) => {
	try {
		const { filename, content, type = 'file' } = req.body;

		if (!filename) {
			return res.status(400).json({ error: 'Missing filename' });
		}

		if (type === 'file' && !content) {
			return res.status(400).json({ error: 'Missing content for file' });
		}

		// Validate filename (no path traversal)
		if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
			return res.status(400).json({ error: 'Invalid filename' });
		}

		// Validate type
		if (!['file', 'folder'].includes(type)) {
			return res.status(400).json({ error: 'Invalid type. Must be "file" or "folder"' });
		}

		const file = await require('../services/databaseService').createFixtureFile(filename, content, type);

		// Also save to fixtures directory for Docker access
		const filePath = path.join(config.paths.fixtures, filename);

		if (type === 'folder') {
			// Create directory
			await fs.mkdir(filePath, { recursive: true });
		} else {
			// Create file
			await fs.writeFile(filePath, content, 'utf8');
		}

		res.json({ success: true, filename, type });
	} catch (error) {
		console.error('Error uploading fixture:', error);
		res.status(500).json({
			error: 'Failed to upload file',
			detail: error.message
		});
	}
});

/**
 * GET /api/admin/fixtures/:filename
 * Get fixture file content
 */
router.get('/fixtures/:filename', async (req, res) => {
	try {
		const filename = req.params.filename;
		const file = await require('../services/databaseService').getFixtureFile(filename);

		if (!file) {
			return res.status(404).json({ error: 'File not found' });
		}

		res.json({ content: file.content });
	} catch (error) {
		console.error('Error reading fixture:', error);
		res.status(500).json({
			error: 'Failed to read file',
			detail: error.message
		});
	}
});

/**
 * DELETE /api/admin/fixtures/:filename
 * Delete a fixture file or folder
 */
router.delete('/fixtures/:filename', async (req, res) => {
	try {
		const filename = req.params.filename;

		// Validate filename (no path traversal)
		if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
			return res.status(400).json({ error: 'Invalid filename' });
		}

		// Get fixture info to determine type
		const fixture = await require('../services/databaseService').getFixtureFile(filename);

		await require('../services/databaseService').deleteFixtureFile(filename);

		// Also delete from fixtures directory
		const filePath = path.join(config.paths.fixtures, filename);
		try {
			const stat = await fs.stat(filePath);
			if (stat.isDirectory()) {
				await fs.rm(filePath, { recursive: true, force: true });
			} else {
				await fs.unlink(filePath);
			}
		} catch (err) {
			console.warn('File/folder not found in fixtures directory:', err.message);
		}

		res.json({ success: true });
	} catch (error) {
		console.error('Error deleting fixture:', error);
		res.status(500).json({
			error: 'Failed to delete file/folder',
			detail: error.message
		});
	}
});

/**
 * GET /api/admin/users
 * Get all users with their statistics
 */
router.get('/users', async (req, res) => {
	try {
		const databaseService = require('../services/databaseService');

		// Get all users
		const users = await databaseService.db.all(`
			SELECT 
				u.id,
				u.google_id,
				u.email,
				u.display_name,
				u.is_admin,
				u.created_at,
				u.last_login,
				COUNT(DISTINCT up.exercise_id) as total_attempts,
				SUM(CASE WHEN up.completed = 1 THEN 1 ELSE 0 END) as completed_count,
				SUM(up.attempts) as total_test_runs
			FROM users u
			LEFT JOIN user_progress up ON u.id = up.user_id
			GROUP BY u.id
			ORDER BY u.last_login DESC
		`);

		res.json(users);
	} catch (error) {
		console.error('Error fetching users:', error);
		res.status(500).json({
			error: 'Failed to fetch users',
			detail: error.message
		});
	}
});

/**
 * GET /api/admin/users/:id
 * Get detailed user information and progress
 */
router.get('/users/:id', async (req, res) => {
	try {
		const userId = parseInt(req.params.id);
		const databaseService = require('../services/databaseService');

		// Get user info
		const user = await databaseService.db.get('SELECT * FROM users WHERE id = ?', [userId]);

		if (!user) {
			return res.status(404).json({ error: 'User not found' });
		}

		// Get user's progress
		const progress = await databaseService.db.all(`
			SELECT 
				up.*,
				e.title as exercise_title,
				c.name as chapter_name,
				l.name as language_name
			FROM user_progress up
			JOIN exercises e ON up.exercise_id = e.id
			JOIN chapters c ON e.chapter_id = c.id
			JOIN languages l ON c.language_id = l.id
			WHERE up.user_id = ?
			ORDER BY up.started_at DESC
		`, [userId]);

		// Get statistics
		const stats = await databaseService.getUserStatistics(userId);

		res.json({
			user,
			progress,
			statistics: stats
		});
	} catch (error) {
		console.error('Error fetching user details:', error);
		res.status(500).json({
			error: 'Failed to fetch user details',
			detail: error.message
		});
	}
});

/**
 * PUT /api/admin/users/:id
 * Update user (e.g., make admin)
 */
router.put('/users/:id', async (req, res) => {
	try {
		const userId = parseInt(req.params.id);
		const { is_admin } = req.body;
		const databaseService = require('../services/databaseService');

		await databaseService.db.run(
			'UPDATE users SET is_admin = ? WHERE id = ?',
			[is_admin ? 1 : 0, userId]
		);

		const user = await databaseService.db.get('SELECT * FROM users WHERE id = ?', [userId]);

		res.json({ success: true, user });
	} catch (error) {
		console.error('Error updating user:', error);
		res.status(500).json({
			error: 'Failed to update user',
			detail: error.message
		});
	}
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user and their progress
 */
router.delete('/users/:id', async (req, res) => {
	try {
		const userId = parseInt(req.params.id);
		const databaseService = require('../services/databaseService');

		await databaseService.db.run('DELETE FROM users WHERE id = ?', [userId]);

		res.json({ success: true });
	} catch (error) {
		console.error('Error deleting user:', error);
		res.status(500).json({
			error: 'Failed to delete user',
			detail: error.message
		});
	}
});

module.exports = router;

