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
		const { solution, arguments: args = [], input = [], fixtures = [], outputFiles = [] } = req.body;

		if (!solution || typeof solution !== 'string') {
			return res.status(400).json({ error: 'Missing solution script' });
		}

		console.log('Running test case:', { argsLen: args.length, inputLen: input.length, fixturesLen: fixtures.length, outputFilesLen: outputFiles.length });

		// Run the script using Docker with test case parameters
		const result = await dockerService.runScriptWithTestCase(solution, args, input, fixtures);

		// Hash output files if specified
		let fileHashes = [];
		if (outputFiles && outputFiles.length > 0) {
			const { createTempScript, hashOutputFiles, removeRecursive } = require('../services/dockerService');
			const { tmpdir } = await createTempScript(solution);

			try {
				// Copy fixtures if needed
				if (fixtures && fixtures.length > 0) {
					const { copyFixtures } = require('../services/dockerService');
					await copyFixtures(tmpdir, fixtures);
				}

				// Run script to generate output files
				const { runScriptInContainer } = require('../services/dockerService');
				await runScriptInContainer(tmpdir, args, input, require('../config').docker.timeout);

				// Hash the specified output files
				fileHashes = await hashOutputFiles(tmpdir, outputFiles);
			} finally {
				await removeRecursive(tmpdir);
			}
		}

		console.log('Test case result:', { exitCode: result.exitCode, stdoutLen: result.stdout.length, fileHashesLen: fileHashes.length });

		res.json({
			output: result.stdout,
			stderr: result.stderr,
			exitCode: result.exitCode,
			timedOut: result.timedOut,
			error: result.error,
			fileHashes: fileHashes
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
 * POST /api/admin/fixtures/sync
 * Sync database with filesystem - remove orphaned entries
 */
router.post('/fixtures/sync', async (req, res) => {
	try {
		const databaseService = require('../services/databaseService');
		const allFiles = await databaseService.getFixtureFiles();

		let removedCount = 0;
		const removedFiles = [];

		for (const file of allFiles) {
			const filePath = path.join(config.paths.fixtures, file.filename);

			try {
				// Check if file/folder exists on filesystem
				await fs.stat(filePath);
				// File exists, keep it
			} catch (err) {
				// File doesn't exist on filesystem, remove from database
				await databaseService.deleteFixtureFile(file.filename);
				removedFiles.push(file.filename);
				removedCount++;
				console.log('Removed orphaned database entry:', file.filename);
			}
		}

		res.json({
			success: true,
			removedCount,
			removedFiles,
			message: `Removed ${removedCount} orphaned database entries`
		});
	} catch (error) {
		console.error('Error syncing fixtures:', error);
		res.status(500).json({
			error: 'Failed to sync fixtures',
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

		// Validate filename (no path traversal, but allow forward slashes for folder paths)
		if (filename.includes('..') || filename.includes('\\')) {
			return res.status(400).json({ error: 'Invalid filename - path traversal not allowed' });
		}

		// Validate type
		if (!['file', 'folder'].includes(type)) {
			return res.status(400).json({ error: 'Invalid type. Must be "file" or "folder"' });
		}

		// Also save to fixtures directory for Docker access
		const filePath = path.join(config.paths.fixtures, filename);

		if (type === 'folder') {
			// Create directory
			await fs.mkdir(filePath, { recursive: true });
		} else {
			// Create file - ensure parent directories exist
			const fileDir = path.dirname(filePath);
			await fs.mkdir(fileDir, { recursive: true });
			await fs.writeFile(filePath, content, 'utf8');
		}

		// Detect actual file permissions from filesystem
		let permissions = 'rwxr-xr-x'; // default
		try {
			const stats = await fs.stat(filePath);
			const mode = stats.mode;

			// Convert mode to rwx string
			permissions = [
				// Owner
				(mode & 0o400) ? 'r' : '-',
				(mode & 0o200) ? 'w' : '-',
				(mode & 0o100) ? 'x' : '-',
				// Group
				(mode & 0o040) ? 'r' : '-',
				(mode & 0o020) ? 'w' : '-',
				(mode & 0o010) ? 'x' : '-',
				// Others
				(mode & 0o004) ? 'r' : '-',
				(mode & 0o002) ? 'w' : '-',
				(mode & 0o001) ? 'x' : '-'
			].join('');
		} catch (err) {
			console.warn('Could not detect permissions for', filename, err.message);
		}

		// Create file in database with detected permissions
		const file = await require('../services/databaseService').createFixtureFile(filename, content, type, permissions);

		res.json({ success: true, filename, type, permissions });
	} catch (error) {
		console.error('Error uploading fixture:', error);
		res.status(500).json({
			error: 'Failed to upload file',
			detail: error.message
		});
	}
});

/**
 * DELETE /api/admin/fixtures/:filename(*)
 * Delete a fixture file or folder (supports paths with slashes)
 */
router.delete('/fixtures/:filename(*)', async (req, res) => {
	try {
		const filename = req.params.filename;

		if (!filename) {
			return res.status(400).json({ error: 'Filename required' });
		}

		// Validate filename (no path traversal)
		if (filename.includes('..') || filename.includes('\\')) {
			return res.status(400).json({ error: 'Invalid filename' });
		}

		const databaseService = require('../services/databaseService');

		// Normalize filename - remove trailing slash for directory check
		const normalizedFilename = filename.endsWith('/') ? filename.slice(0, -1) : filename;

		// Check if this is a directory on the filesystem
		const filePath = path.join(config.paths.fixtures, normalizedFilename);
		let isDirectory = false;

		try {
			const stat = await fs.stat(filePath);
			isDirectory = stat.isDirectory();
			console.log(`Filesystem check: ${normalizedFilename} is ${isDirectory ? 'directory' : 'file'}`);
		} catch (err) {
			// File/folder doesn't exist on filesystem, check database
			const fixture = await databaseService.getFixtureFile(normalizedFilename);
			isDirectory = fixture && fixture.type === 'folder';
			console.log(`Database check: ${normalizedFilename} is ${isDirectory ? 'directory' : 'file'}`);
		}

		// Delete from database
		if (isDirectory) {
			// Delete folder and ALL files/subfolders within it from database
			const allFiles = await databaseService.getFixtureFiles();
			const folderPrefix = normalizedFilename + '/';

			console.log(`Deleting folder ${normalizedFilename} and all files starting with ${folderPrefix}`);
			console.log(`Total files in database: ${allFiles.length}`);

			let deletedCount = 0;
			// Delete all files and subfolders that start with this path
			for (const file of allFiles) {
				if (file.filename.startsWith(folderPrefix) || file.filename === normalizedFilename || file.filename === normalizedFilename + '/') {
					await databaseService.deleteFixtureFile(file.filename);
					console.log('Deleted from database:', file.filename);
					deletedCount++;
				}
			}

			console.log(`Deleted ${deletedCount} items from database`);
		} else {
			// Delete single file from database
			console.log(`Deleting single file: ${normalizedFilename}`);
			await databaseService.deleteFixtureFile(normalizedFilename);
		}

		// Delete from fixtures directory
		try {
			const stat = await fs.stat(filePath);
			if (stat.isDirectory()) {
				await fs.rm(filePath, { recursive: true, force: true });
				console.log('Deleted folder from filesystem:', filePath);
			} else {
				await fs.unlink(filePath);
				console.log('Deleted file from filesystem:', filePath);
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
 * PUT /api/admin/fixtures/:filename(*)/permissions
 * Set file permissions (Linux rwx format) - supports paths with slashes
 */
router.put('/fixtures/:filename(*)/permissions', async (req, res) => {
	try {
		const filename = req.params.filename;
		const { permissions } = req.body;

		if (!permissions) {
			return res.status(400).json({ error: 'Permissions required' });
		}

		// Validate permissions format (rwxr-xr-x or similar)
		if (!/^[r\-][w\-][x\-][r\-][w\-][x\-][r\-][w\-][x\-]$/.test(permissions)) {
			return res.status(400).json({ error: 'Invalid permissions format. Use rwxr-xr-x format' });
		}

		// Convert rwx format to octal (e.g., 'rwxr-xr-x' -> '755')
		const permOctal = permissions.split('').reduce((acc, char, i) => {
			const group = Math.floor(i / 3);
			const bit = 2 - (i % 3);
			if (char !== '-') {
				acc[group] += Math.pow(2, bit);
			}
			return acc;
		}, [0, 0, 0]).join('');

		// Set permissions on the file in fixtures directory
		const filePath = path.join(config.paths.fixtures, filename);
		await fs.chmod(filePath, parseInt(permOctal, 8));

		// Update in database
		await require('../services/databaseService').updateFixturePermissions(filename, permissions);

		res.json({ success: true, permissions });
	} catch (error) {
		console.error('Error setting file permissions:', error);
		res.status(500).json({
			error: 'Failed to set permissions',
			detail: error.message
		});
	}
});

/**
 * GET /api/admin/fixtures/:filename(*)
 * Get fixture file content (supports paths with slashes) - MUST BE LAST
 */
router.get('/fixtures/:filename(*)', async (req, res) => {
	try {
		// Get the full path
		const filename = req.params.filename;

		if (!filename) {
			return res.status(400).json({ error: 'Filename required' });
		}

		// Skip if this looks like a special endpoint (permissions, contents, etc.)
		if (filename.endsWith('/permissions') || filename.endsWith('/contents') || filename.includes('/files/')) {
			return res.status(404).json({ error: 'Not found' });
		}

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
 * GET /api/admin/fixtures/:foldername/contents
 * Get the contents of a folder (list files inside)
 */
router.get('/fixtures/:foldername/contents', async (req, res) => {
	try {
		const foldername = req.params.foldername;

		// Validate foldername (no path traversal)
		if (foldername.includes('..') || foldername.includes('/') || foldername.includes('\\')) {
			return res.status(400).json({ error: 'Invalid foldername' });
		}

		// Check that the folder exists in database
		const fixture = await require('../services/databaseService').getFixtureFile(foldername);
		if (!fixture || fixture.type !== 'folder') {
			return res.status(404).json({ error: 'Folder not found' });
		}

		// Read the folder contents from filesystem
		const folderPath = path.join(config.paths.fixtures, foldername);

		try {
			const files = await fs.readdir(folderPath);
			const fileDetails = await Promise.all(files.map(async (filename) => {
				const filePath = path.join(folderPath, filename);
				const stats = await fs.stat(filePath);

				// Only include files, not subdirectories
				if (stats.isFile()) {
					return {
						name: filename,
						size: stats.size
					};
				}
				return null;
			}));

			// Filter out nulls (subdirectories)
			const filesOnly = fileDetails.filter(f => f !== null);

			res.json(filesOnly);
		} catch (err) {
			// Folder doesn't exist on filesystem
			if (err.code === 'ENOENT') {
				res.json([]); // Empty folder
			} else {
				throw err;
			}
		}
	} catch (error) {
		console.error('Error reading folder contents:', error);
		res.status(500).json({
			error: 'Failed to read folder contents',
			detail: error.message
		});
	}
});

/**
 * POST /api/admin/fixtures/:foldername/files
 * Upload a file to a folder
 */
router.post('/fixtures/:foldername/files', async (req, res) => {
	try {
		const foldername = req.params.foldername;
		const { filename, content } = req.body;

		// Validate foldername (no path traversal)
		if (foldername.includes('..') || foldername.includes('/') || foldername.includes('\\')) {
			return res.status(400).json({ error: 'Invalid foldername' });
		}

		// Validate filename (no path traversal or separators)
		if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
			return res.status(400).json({ error: 'Invalid filename' });
		}

		if (!content) {
			return res.status(400).json({ error: 'Missing content' });
		}

		// Check that the folder exists in database
		const fixture = await require('../services/databaseService').getFixtureFile(foldername);
		if (!fixture || fixture.type !== 'folder') {
			return res.status(404).json({ error: 'Folder not found' });
		}

		// Write the file to the folder
		const folderPath = path.join(config.paths.fixtures, foldername);
		const filePath = path.join(folderPath, filename);

		// Ensure folder exists
		await fs.mkdir(folderPath, { recursive: true });

		// Write the file
		await fs.writeFile(filePath, content, 'utf8');

		res.json({ success: true, filename });
	} catch (error) {
		console.error('Error uploading file to folder:', error);
		res.status(500).json({
			error: 'Failed to upload file to folder',
			detail: error.message
		});
	}
});

/**
 * DELETE /api/admin/fixtures/:foldername/files/:filename
 * Delete a file from a folder
 */
router.delete('/fixtures/:foldername/files/:filename', async (req, res) => {
	try {
		const foldername = req.params.foldername;
		const filename = req.params.filename;

		// Validate foldername (no path traversal)
		if (foldername.includes('..') || foldername.includes('/') || foldername.includes('\\')) {
			return res.status(400).json({ error: 'Invalid foldername' });
		}

		// Validate filename (no path traversal or separators)
		if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
			return res.status(400).json({ error: 'Invalid filename' });
		}

		// Check that the folder exists in database
		const fixture = await require('../services/databaseService').getFixtureFile(foldername);
		if (!fixture || fixture.type !== 'folder') {
			return res.status(404).json({ error: 'Folder not found' });
		}

		// Delete the file from the folder
		const folderPath = path.join(config.paths.fixtures, foldername);
		const filePath = path.join(folderPath, filename);

		await fs.unlink(filePath);

		res.json({ success: true });
	} catch (error) {
		console.error('Error deleting file from folder:', error);
		res.status(500).json({
			error: 'Failed to delete file from folder',
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

		// Get all users with enhanced statistics
		const users = await databaseService.db.all(`
			SELECT 
				u.id,
				u.google_id,
				u.email,
				u.display_name,
				u.is_admin,
				u.created_at,
				u.last_login,
				COALESCE(p.exercises_attempted, 0) as exercises_attempted,
				COALESCE(p.exercises_completed, 0) as exercises_completed,
				COALESCE(p.total_test_runs, 0) as total_test_runs,
				p.last_activity,
				COALESCE(a.achievements_unlocked, 0) as achievements_unlocked
			FROM users u
			LEFT JOIN (
				SELECT 
					user_id,
					COUNT(DISTINCT exercise_id) as exercises_attempted,
					SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as exercises_completed,
					SUM(attempts) as total_test_runs,
					MAX(last_submission_at) as last_activity
				FROM user_progress
				GROUP BY user_id
			) p ON u.id = p.user_id
			LEFT JOIN (
				SELECT 
					user_id,
					COUNT(DISTINCT achievement_id) as achievements_unlocked
				FROM user_achievements
				GROUP BY user_id
			) a ON u.id = a.user_id
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

		// Get user's progress with latest submission
		const progress = await databaseService.db.all(`
			SELECT 
				up.*,
				e.title as exercise_title,
				e.id as exercise_id,
				c.name as chapter_name,
				l.name as language_name
			FROM user_progress up
			JOIN exercises e ON up.exercise_id = e.id
			JOIN chapters c ON e.chapter_id = c.id
			JOIN languages l ON c.language_id = l.id
			WHERE up.user_id = ?
			ORDER BY up.started_at DESC
		`, [userId]);

		// Get user's achievements
		const achievements = await databaseService.db.all(`
			SELECT 
				ua.*,
				a.name as achievement_name,
				a.description as achievement_description,
				a.icon as achievement_icon,
				a.points
			FROM user_achievements ua
			JOIN achievements a ON ua.achievement_id = a.id
			WHERE ua.user_id = ?
			ORDER BY ua.earned_at DESC
		`, [userId]);

		// Get enhanced statistics
		const stats = await databaseService.getUserStatistics(userId);

		// Add total achievement points
		const achievementStats = await databaseService.db.get(`
			SELECT 
				COUNT(*) as total_achievements,
				COALESCE(SUM(a.points), 0) as total_points
			FROM user_achievements ua
			JOIN achievements a ON ua.achievement_id = a.id
			WHERE ua.user_id = ?
		`, [userId]);

		res.json({
			user,
			progress,
			achievements,
			statistics: {
				...stats,
				...achievementStats
			}
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

/**
 * GET /api/admin/notifications
 * Get all notifications (admin only)
 */
router.get('/notifications', async (req, res) => {
	try {
		const databaseService = require('../services/databaseService');
		const notifications = await databaseService.getAllNotifications();
		res.json(notifications);
	} catch (error) {
		console.error('Error fetching notifications:', error);
		res.status(500).json({
			error: 'Failed to fetch notifications',
			detail: error.message
		});
	}
});

/**
 * POST /api/admin/notifications
 * Create a new notification (admin only)
 */
router.post('/notifications', async (req, res) => {
	try {
		const databaseService = require('../services/databaseService');
		const { title, message, type, expires_at } = req.body;

		if (!title || !message) {
			return res.status(400).json({ error: 'Title and message are required' });
		}

		const notification = await databaseService.createNotification({
			title,
			message,
			type: type || 'info',
			created_by: req.user ? req.user.id : null,
			expires_at: expires_at || null
		});

		res.json(notification);
	} catch (error) {
		console.error('Error creating notification:', error);
		res.status(500).json({
			error: 'Failed to create notification',
			detail: error.message
		});
	}
});

/**
 * PUT /api/admin/notifications/:id
 * Update a notification (admin only)
 */
router.put('/notifications/:id', async (req, res) => {
	try {
		const databaseService = require('../services/databaseService');
		const notificationId = parseInt(req.params.id);
		const { title, message, type, expires_at, is_active } = req.body;

		const notification = await databaseService.updateNotification(notificationId, {
			title,
			message,
			type,
			expires_at,
			is_active
		});

		res.json(notification);
	} catch (error) {
		console.error('Error updating notification:', error);
		res.status(500).json({
			error: 'Failed to update notification',
			detail: error.message
		});
	}
});

/**
 * DELETE /api/admin/notifications/:id
 * Delete a notification (admin only)
 */
router.delete('/notifications/:id', async (req, res) => {
	try {
		const databaseService = require('../services/databaseService');
		const notificationId = parseInt(req.params.id);

		await databaseService.deleteNotification(notificationId);

		res.json({ success: true });
	} catch (error) {
		console.error('Error deleting notification:', error);
		res.status(500).json({
			error: 'Failed to delete notification',
			detail: error.message
		});
	}
});

/**
 * POST /api/admin/notifications/:id/deactivate
 * Deactivate a notification (admin only)
 */
router.post('/notifications/:id/deactivate', async (req, res) => {
	try {
		const databaseService = require('../services/databaseService');
		const notificationId = parseInt(req.params.id);

		await databaseService.deactivateNotification(notificationId);

		res.json({ success: true });
	} catch (error) {
		console.error('Error deactivating notification:', error);
		res.status(500).json({
			error: 'Failed to deactivate notification',
			detail: error.message
		});
	}
});

/**
 * POST /api/admin/exam-grader/grade
 * Grade exam submissions from a zip file with custom test configuration
 */
router.post('/exam-grader/grade', async (req, res) => {
	try {
		const { zipData, gradingConfig } = req.body;

		console.log('[ExamGrader API] Received grading request');
		console.log('[ExamGrader API] zipData length:', zipData ? zipData.length : 'undefined');
		console.log('[ExamGrader API] Tasks count:', gradingConfig?.tasks?.length);

		if (!zipData) {
			return res.status(400).json({ error: 'Missing zip file data' });
		}

		if (!gradingConfig || !gradingConfig.tasks) {
			return res.status(400).json({ error: 'Missing grading configuration' });
		}

		// Convert base64 to buffer
		const zipBuffer = Buffer.from(zipData, 'base64');
		console.log('[ExamGrader API] Zip buffer size:', zipBuffer.length, 'bytes');

		// Grade all submissions
		const examGraderService = require('../services/examGraderService');
		const results = await examGraderService.gradeExamSubmissions(zipBuffer, gradingConfig);

		console.log('[ExamGrader API] Grading complete. Results:', results.submissions?.length, 'submissions');
		res.json(results);
	} catch (error) {
		console.error('Error grading exam submissions:', error);
		res.status(500).json({
			error: 'Failed to grade submissions',
			detail: error.message,
			stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
		});
	}
});

/**
 * POST /api/admin/exam-grader/test-single
 * Test a single script against a solution with custom rules
 */
router.post('/exam-grader/test-single', async (req, res) => {
	try {
		const { studentScript, solutionScript, arguments: args = [], inputs = [], codeRules = [], fixtures = [], fixturePermissions = {}, expectedOutputFiles = [] } = req.body;

		if (!studentScript) {
			return res.status(400).json({ error: 'Missing student script' });
		}

		if (!solutionScript) {
			return res.status(400).json({ error: 'Missing solution script' });
		}

		const examGraderService = require('../services/examGraderService');
		const fs = require('fs').promises;
		const os = require('os');

		// Create temp files for both scripts
		const tempDir = await fs.mkdtemp(path.join(config.paths.temp, 'exam-test-'));

		try {
			const studentPath = path.join(tempDir, 'student.sh');
			const solutionPath = path.join(tempDir, 'solution.sh');

			await fs.writeFile(studentPath, studentScript, 'utf8');
			await fs.writeFile(solutionPath, solutionScript, 'utf8');

			// Compare outputs
			const comparison = await examGraderService.compareScriptOutputs(
				studentPath,
				solutionPath,
				args,
				inputs,
				fixtures,
				fixturePermissions,
				expectedOutputFiles
			);

			// Check code rules if provided
			let codeCheckResults = [];
			if (codeRules.length > 0) {
				codeCheckResults = await examGraderService.checkCodeRules(studentPath, codeRules);
			}

			res.json({
				comparison,
				codeChecks: codeCheckResults
			});
		} finally {
			// Clean up temp directory
			const { removeRecursive } = require('../services/dockerService');
			await removeRecursive(tempDir);
		}
	} catch (error) {
		console.error('Error testing single script:', error);
		res.status(500).json({
			error: 'Failed to test script',
			detail: error.message,
			stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
		});
	}
});

module.exports = router;

