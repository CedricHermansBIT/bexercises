// src/services/databaseService.js
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs').promises;

class DatabaseService {
	constructor() {
		this.db = null;
	}

	/**
	 * Initialize the database connection and create tables
	 */
	async init() {
		const dbPath = path.join(__dirname, '../../data/exercises.db');
		
		// Ensure data directory exists
		await fs.mkdir(path.dirname(dbPath), { recursive: true });

		this.db = await open({
			filename: dbPath,
			driver: sqlite3.Database,
			mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
		});

		// Enable foreign keys
		await this.db.run('PRAGMA foreign_keys = ON');

		// Set journal mode for better concurrency
		await this.db.run('PRAGMA journal_mode = WAL');

		await this.createTables();
		console.log('Database initialized successfully');
	}

	/**
	 * Create all database tables
	 */
	async createTables() {
		// Languages table
		await this.db.exec(`
			CREATE TABLE IF NOT EXISTS languages (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				description TEXT,
				icon_svg TEXT,
				order_num INTEGER DEFAULT 0,
				enabled BOOLEAN DEFAULT 1,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`);

		// Chapters table
		await this.db.exec(`
			CREATE TABLE IF NOT EXISTS chapters (
				id TEXT PRIMARY KEY,
				language_id TEXT NOT NULL,
				name TEXT NOT NULL,
				description TEXT,
				order_num INTEGER DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (language_id) REFERENCES languages(id) ON DELETE CASCADE
			)
		`);

		// Exercises table
		await this.db.exec(`
			CREATE TABLE IF NOT EXISTS exercises (
				id TEXT PRIMARY KEY,
				chapter_id TEXT NOT NULL,
				title TEXT NOT NULL,
				description TEXT,
				solution TEXT,
				order_num INTEGER DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
			)
		`);

		// Test cases table
		await this.db.exec(`
			CREATE TABLE IF NOT EXISTS test_cases (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				exercise_id TEXT NOT NULL,
				arguments TEXT, -- JSON array
				input TEXT, -- JSON array
				expected_output TEXT,
				expected_exit_code INTEGER DEFAULT 0,
				order_num INTEGER DEFAULT 0,
				FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
			)
		`);

		// Users table
		await this.db.exec(`
			CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				google_id TEXT UNIQUE,
				email TEXT,
				display_name TEXT,
				is_admin BOOLEAN DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				last_login DATETIME
			)
		`);

		// User progress table
		await this.db.exec(`
			CREATE TABLE IF NOT EXISTS user_progress (
				user_id INTEGER NOT NULL,
				exercise_id TEXT NOT NULL,
				completed BOOLEAN DEFAULT 0,
				last_submission TEXT,
				started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				completed_at DATETIME,
				attempts INTEGER DEFAULT 0,
				successful_attempts INTEGER DEFAULT 0,
				failed_attempts INTEGER DEFAULT 0,
				PRIMARY KEY (user_id, exercise_id),
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
				FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
			)
		`);

		// Add new columns if they don't exist (for existing databases)
		try {
			await this.db.exec(`ALTER TABLE user_progress ADD COLUMN successful_attempts INTEGER DEFAULT 0`);
		} catch (e) {
			// Column already exists
		}
		try {
			await this.db.exec(`ALTER TABLE user_progress ADD COLUMN failed_attempts INTEGER DEFAULT 0`);
		} catch (e) {
			// Column already exists
		}

		// Migrate existing data: if completed=1, set successful_attempts=1, failed_attempts=attempts-1
		// if completed=0, set failed_attempts=attempts
		await this.db.exec(`
			UPDATE user_progress 
			SET successful_attempts = CASE WHEN completed = 1 AND successful_attempts = 0 THEN 1 ELSE successful_attempts END,
				failed_attempts = CASE 
					WHEN failed_attempts = 0 AND completed = 1 THEN attempts - 1
					WHEN failed_attempts = 0 AND completed = 0 THEN attempts
					ELSE failed_attempts
				END
			WHERE successful_attempts = 0 OR failed_attempts = 0
		`);

		// Fixture files table
		await this.db.exec(`
			CREATE TABLE IF NOT EXISTS fixture_files (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				filename TEXT UNIQUE NOT NULL,
				type TEXT DEFAULT 'file' CHECK(type IN ('file', 'folder')),
				content TEXT,
				size INTEGER,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`);

		// Add type column if it doesn't exist (migration for existing databases)
		try {
			await this.db.exec(`
				ALTER TABLE fixture_files ADD COLUMN type TEXT DEFAULT 'file' CHECK(type IN ('file', 'folder'))
			`);
		} catch (err) {
			// Column already exists, ignore
			if (!err.message.includes('duplicate column')) {
				console.warn('Error adding type column to fixture_files:', err.message);
			}
		}

		// Test case fixtures junction table
		await this.db.exec(`
			CREATE TABLE IF NOT EXISTS test_case_fixtures (
				test_case_id INTEGER NOT NULL,
				fixture_id INTEGER NOT NULL,
				PRIMARY KEY (test_case_id, fixture_id),
				FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE,
				FOREIGN KEY (fixture_id) REFERENCES fixture_files(id) ON DELETE CASCADE
			)
		`);

		// Achievements table
		await this.db.exec(`
			CREATE TABLE IF NOT EXISTS achievements (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				description TEXT,
				icon TEXT,
				category TEXT,
				points INTEGER DEFAULT 0,
				requirement_type TEXT,
				requirement_value INTEGER,
				hidden BOOLEAN DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`);

		// User achievements junction table
		await this.db.exec(`
			CREATE TABLE IF NOT EXISTS user_achievements (
				user_id INTEGER NOT NULL,
				achievement_id TEXT NOT NULL,
				earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				progress INTEGER DEFAULT 0,
				PRIMARY KEY (user_id, achievement_id),
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
				FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
			)
		`);

		// Create indexes for better performance
		await this.db.exec(`
			CREATE INDEX IF NOT EXISTS idx_chapters_language ON chapters(language_id);
			CREATE INDEX IF NOT EXISTS idx_exercises_chapter ON exercises(chapter_id);
			CREATE INDEX IF NOT EXISTS idx_test_cases_exercise ON test_cases(exercise_id);
			CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
			CREATE INDEX IF NOT EXISTS idx_user_progress_exercise ON user_progress(exercise_id);
			CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id);
			CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
			CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
		`);

		// Seed default achievements
		await this.seedDefaultAchievements();
	}

	/**
	 * Seed default achievements
	 */
	async seedDefaultAchievements() {
		const defaultAchievements = [
			// Getting Started
			{ id: 'first-steps', name: 'First Steps', description: 'Complete your first exercise', icon: '🎯', category: 'getting-started', points: 10, requirement_type: 'exercises_completed', requirement_value: 1 },
			{ id: 'quick-learner', name: 'Quick Learner', description: 'Complete 5 exercises', icon: '📚', category: 'progress', points: 25, requirement_type: 'exercises_completed', requirement_value: 5 },
			{ id: 'dedicated', name: 'Dedicated', description: 'Complete 10 exercises', icon: '💪', category: 'progress', points: 50, requirement_type: 'exercises_completed', requirement_value: 10 },
			{ id: 'master', name: 'Master', description: 'Complete 25 exercises', icon: '🏆', category: 'progress', points: 100, requirement_type: 'exercises_completed', requirement_value: 25 },
			{ id: 'legendary', name: 'Legendary', description: 'Complete 50 exercises', icon: '👑', category: 'progress', points: 250, requirement_type: 'exercises_completed', requirement_value: 50 },

			// Perfect Scores
			{ id: 'perfectionist', name: 'Perfectionist', description: 'Complete an exercise on the first try', icon: '✨', category: 'skill', points: 20, requirement_type: 'first_try_completions', requirement_value: 1 },
			{ id: 'flawless', name: 'Flawless', description: 'Complete 5 exercises on first try', icon: '💎', category: 'skill', points: 50, requirement_type: 'first_try_completions', requirement_value: 5 },
			{ id: 'untouchable', name: 'Untouchable', description: 'Complete 10 exercises on first try', icon: '🌟', category: 'skill', points: 100, requirement_type: 'first_try_completions', requirement_value: 10 },

			// Persistence
			{ id: 'persistent', name: 'Persistent', description: 'Complete an exercise after 10+ attempts', icon: '🔥', category: 'persistence', points: 30, requirement_type: 'persistent_completion', requirement_value: 1 },
			{ id: 'never-give-up', name: 'Never Give Up', description: 'Complete an exercise after 20+ attempts', icon: '💪', category: 'persistence', points: 50, requirement_type: 'persistent_completion_20', requirement_value: 1 },

			// Speed
			{ id: 'speed-demon', name: 'Speed Demon', description: 'Complete 3 exercises in one hour', icon: '⚡', category: 'speed', points: 40, requirement_type: 'exercises_per_hour', requirement_value: 3 },
			{ id: 'marathon-runner', name: 'Marathon Runner', description: 'Complete 10 exercises in one day', icon: '🏃', category: 'speed', points: 75, requirement_type: 'exercises_per_day', requirement_value: 10 },

			// Time-based
			{ id: 'night-owl', name: 'Night Owl', description: 'Complete an exercise between midnight and 5 AM', icon: '🦉', category: 'time', points: 15, requirement_type: 'night_completion', requirement_value: 1 },
			{ id: 'early-bird', name: 'Early Bird', description: 'Complete an exercise between 5 AM and 8 AM', icon: '🐦', category: 'time', points: 15, requirement_type: 'morning_completion', requirement_value: 1 },

			// Streaks
			{ id: 'streak-starter', name: 'Streak Starter', description: 'Complete exercises on 3 consecutive days', icon: '📅', category: 'streak', points: 30, requirement_type: 'daily_streak', requirement_value: 3 },
			{ id: 'committed', name: 'Committed', description: 'Complete exercises on 7 consecutive days', icon: '🔥', category: 'streak', points: 70, requirement_type: 'daily_streak', requirement_value: 7 },
			{ id: 'unstoppable', name: 'Unstoppable', description: 'Complete exercises on 30 consecutive days', icon: '🌟', category: 'streak', points: 200, requirement_type: 'daily_streak', requirement_value: 30 },

			// Chapter Completion
			{ id: 'chapter-complete', name: 'Chapter Master', description: 'Complete all exercises in a chapter', icon: '📖', category: 'mastery', points: 50, requirement_type: 'chapter_complete', requirement_value: 1 },
			{ id: 'all-chapters', name: 'Complete Mastery', description: 'Complete all chapters', icon: '🎓', category: 'mastery', points: 500, requirement_type: 'all_chapters_complete', requirement_value: 1 },
		];

		for (const achievement of defaultAchievements) {
			try {
				await this.db.run(`
					INSERT OR IGNORE INTO achievements (id, name, description, icon, category, points, requirement_type, requirement_value, hidden)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				`, [
					achievement.id,
					achievement.name,
					achievement.description,
					achievement.icon,
					achievement.category,
					achievement.points,
					achievement.requirement_type,
					achievement.requirement_value,
					achievement.hidden || 0
				]);
			} catch (e) {
				// Achievement already exists
			}
		}
	}

	// ============= Language Methods =============

	async getLanguages() {
		return this.db.all(`
			SELECT * FROM languages 
			WHERE enabled = 1 
			ORDER BY order_num, name
		`);
	}

	async getLanguage(id) {
		return this.db.get('SELECT * FROM languages WHERE id = ?', [id]);
	}

	async createLanguage(data) {
		const { id, name, description, icon_svg, order_num, enabled } = data;
		await this.db.run(`
			INSERT INTO languages (id, name, description, icon_svg, order_num, enabled)
			VALUES (?, ?, ?, ?, ?, ?)
		`, [id, name, description || null, icon_svg || null, order_num || 0, enabled !== false ? 1 : 0]);
		return this.getLanguage(id);
	}

	// ============= Chapter Methods =============

	async getChaptersByLanguage(languageId) {
		return this.db.all(`
			SELECT * FROM chapters 
			WHERE language_id = ? 
			ORDER BY order_num, name
		`, [languageId]);
	}

	async getChapter(id) {
		return this.db.get('SELECT * FROM chapters WHERE id = ?', [id]);
	}

	async createChapter(data) {
		const { id, language_id, name, description, order_num } = data;
		await this.db.run(`
			INSERT INTO chapters (id, language_id, name, description, order_num)
			VALUES (?, ?, ?, ?, ?)
		`, [id, language_id, name, description || null, order_num || 0]);
		return this.getChapter(id);
	}

	async updateChapter(id, data) {
		const { name, description, order_num } = data;
		await this.db.run(`
			UPDATE chapters 
			SET name = ?, description = ?, order_num = ?
			WHERE id = ?
		`, [name, description, order_num, id]);
		return this.getChapter(id);
	}

	// ============= Exercise Methods =============

	async getExercisesByChapter(chapterId) {
		return this.db.all(`
			SELECT * FROM exercises 
			WHERE chapter_id = ? 
			ORDER BY order_num, title
		`, [chapterId]);
	}

	async getExercisesByLanguage(languageId) {
		return this.db.all(`
			SELECT e.*, c.name as chapter_name, c.order_num as chapter_order
			FROM exercises e
			JOIN chapters c ON e.chapter_id = c.id
			WHERE c.language_id = ?
			ORDER BY c.order_num, e.order_num
		`, [languageId]);
	}

	async getExercise(id) {
		return this.db.get('SELECT * FROM exercises WHERE id = ?', [id]);
	}

	async getExerciseWithTests(id) {
		const exercise = await this.getExercise(id);
		if (!exercise) return null;

		const testCases = await this.db.all(`
			SELECT * FROM test_cases 
			WHERE exercise_id = ? 
			ORDER BY order_num
		`, [id]);

		// Parse JSON fields and convert to camelCase, fetch fixtures
		const testCasesWithFixtures = await Promise.all(testCases.map(async (tc) => {
			// Get fixtures for this test case
			const fixtures = await this.db.all(`
				SELECT f.filename 
				FROM fixture_files f
				JOIN test_case_fixtures tcf ON f.id = tcf.fixture_id
				WHERE tcf.test_case_id = ?
			`, [tc.id]);

			return {
				id: tc.id,
				arguments: tc.arguments ? JSON.parse(tc.arguments) : [],
				input: tc.input ? JSON.parse(tc.input) : [],
				expectedOutput: tc.expected_output || '',
				expectedExitCode: tc.expected_exit_code != null ? tc.expected_exit_code : 0,
				fixtures: fixtures.map(f => f.filename),
				fixturePermissions: {} // TODO: Add permissions column if needed
			};
		}));

		exercise.testCases = testCasesWithFixtures;
		return exercise;
	}

	async createExercise(data) {
		const { id, chapter_id, title, description, solution, order_num, testCases } = data;
		
		await this.db.run(`
			INSERT INTO exercises (id, chapter_id, title, description, solution, order_num)
			VALUES (?, ?, ?, ?, ?, ?)
		`, [id, chapter_id, title, description || null, solution, order_num || 0]);

		// Insert test cases if provided
		if (testCases && Array.isArray(testCases)) {
			for (let i = 0; i < testCases.length; i++) {
				const tc = testCases[i];
				const result = await this.db.run(`
					INSERT INTO test_cases (exercise_id, arguments, input, expected_output, expected_exit_code, order_num)
					VALUES (?, ?, ?, ?, ?, ?)
				`, [
					id,
					JSON.stringify(tc.arguments || []),
					JSON.stringify(tc.input || []),
					tc.expectedOutput || '',
					tc.expectedExitCode || 0,
					i
				]);

				const testCaseId = result.lastID;

				// Link fixtures to this test case
				if (tc.fixtures && Array.isArray(tc.fixtures)) {
					for (const fixtureName of tc.fixtures) {
						// Ensure fixture exists in fixture_files table
						const fixture = await this.getFixtureFile(fixtureName);
						if (fixture) {
							await this.db.run(`
								INSERT OR IGNORE INTO test_case_fixtures (test_case_id, fixture_id)
								VALUES (?, ?)
							`, [testCaseId, fixture.id]);
						}
					}
				}
			}
		}

		return this.getExerciseWithTests(id);
	}

	async updateExercise(id, data) {
		const { title, description, solution, order_num, chapter_id, testCases } = data;

		// Build the UPDATE query dynamically based on what's provided
		const updates = [];
		const values = [];

		if (title !== undefined) {
			updates.push('title = ?');
			values.push(title);
		}
		if (description !== undefined) {
			updates.push('description = ?');
			values.push(description);
		}
		if (solution !== undefined) {
			updates.push('solution = ?');
			values.push(solution);
		}
		if (order_num !== undefined) {
			updates.push('order_num = ?');
			values.push(order_num);
		}
		if (chapter_id !== undefined) {
			updates.push('chapter_id = ?');
			values.push(chapter_id);
		}

		updates.push('updated_at = CURRENT_TIMESTAMP');
		values.push(id);

		await this.db.run(`
			UPDATE exercises 
			SET ${updates.join(', ')}
			WHERE id = ?
		`, values);

		// Delete and recreate test cases
		if (testCases && Array.isArray(testCases)) {
			await this.db.run('DELETE FROM test_cases WHERE exercise_id = ?', [id]);
			
			for (let i = 0; i < testCases.length; i++) {
				const tc = testCases[i];
				const result = await this.db.run(`
					INSERT INTO test_cases (exercise_id, arguments, input, expected_output, expected_exit_code, order_num)
					VALUES (?, ?, ?, ?, ?, ?)
				`, [
					id,
					JSON.stringify(tc.arguments || []),
					JSON.stringify(tc.input || []),
					tc.expectedOutput || '',
					tc.expectedExitCode || 0,
					i
				]);

				const testCaseId = result.lastID;

				// Link fixtures to this test case
				if (tc.fixtures && Array.isArray(tc.fixtures)) {
					for (const fixtureName of tc.fixtures) {
						// Ensure fixture exists in fixture_files table
						const fixture = await this.getFixtureFile(fixtureName);
						if (fixture) {
							await this.db.run(`
								INSERT OR IGNORE INTO test_case_fixtures (test_case_id, fixture_id)
								VALUES (?, ?)
							`, [testCaseId, fixture.id]);
						}
					}
				}
			}
		}

		return this.getExerciseWithTests(id);
	}

	async deleteExercise(id) {
		await this.db.run('DELETE FROM exercises WHERE id = ?', [id]);
	}

	async reorderExercises(exercises) {
		for (const ex of exercises) {
			await this.db.run(`
				UPDATE exercises 
				SET chapter_id = ?, order_num = ?
				WHERE id = ?
			`, [ex.chapter_id || ex.chapter, ex.order, ex.id]);
		}
	}

	// ============= User Methods =============

	async getUserByGoogleId(googleId) {
		return this.db.get('SELECT * FROM users WHERE google_id = ?', [googleId]);
	}

	async createUser(data) {
		const { google_id, email, display_name, is_admin } = data;
		const result = await this.db.run(`
			INSERT INTO users (google_id, email, display_name, is_admin, last_login)
			VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
		`, [google_id, email, display_name, is_admin ? 1 : 0]);
		
		return this.db.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
	}

	async updateUserLogin(userId) {
		await this.db.run(`
			UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
		`, [userId]);
	}

	// ============= User Progress Methods =============

	async getUserProgress(userId, exerciseId) {
		return this.db.get(`
			SELECT * FROM user_progress 
			WHERE user_id = ? AND exercise_id = ?
		`, [userId, exerciseId]);
	}

	async getUserProgressByLanguage(userId, languageId) {
		return this.db.all(`
			SELECT up.*, e.title, c.name as chapter_name
			FROM user_progress up
			JOIN exercises e ON up.exercise_id = e.id
			JOIN chapters c ON e.chapter_id = c.id
			WHERE up.user_id = ? AND c.language_id = ?
		`, [userId, languageId]);
	}

	async saveUserProgress(userId, exerciseId, data) {
		const { completed, last_submission } = data;
		
		const existing = await this.getUserProgress(userId, exerciseId);
		
		if (existing) {
			await this.db.run(`
				UPDATE user_progress 
				SET completed = ?, 
					last_submission = ?, 
					completed_at = CASE WHEN ? = 1 AND completed = 0 THEN CURRENT_TIMESTAMP ELSE completed_at END,
					attempts = attempts + 1,
					successful_attempts = successful_attempts + CASE WHEN ? = 1 THEN 1 ELSE 0 END,
					failed_attempts = failed_attempts + CASE WHEN ? = 0 THEN 1 ELSE 0 END
				WHERE user_id = ? AND exercise_id = ?
			`, [completed ? 1 : 0, last_submission, completed ? 1 : 0, completed ? 1 : 0, completed ? 1 : 0, userId, exerciseId]);
		} else {
			await this.db.run(`
				INSERT INTO user_progress (user_id, exercise_id, completed, last_submission, completed_at, attempts, successful_attempts, failed_attempts)
				VALUES (?, ?, ?, ?, ?, 1, ?, ?)
			`, [userId, exerciseId, completed ? 1 : 0, last_submission, completed ? new Date().toISOString() : null, completed ? 1 : 0, completed ? 0 : 1]);
		}
	}

	async getUserStatistics(userId) {
		const stats = await this.db.get(`
			SELECT 
				COUNT(*) as total_attempts,
				SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as total_completed,
				AVG(attempts) as avg_attempts
			FROM user_progress
			WHERE user_id = ?
		`, [userId]);

		const byLanguage = await this.db.all(`
			SELECT 
				c.language_id,
				l.name as language_name,
				COUNT(DISTINCT e.id) as total_exercises,
				SUM(CASE WHEN up.completed = 1 THEN 1 ELSE 0 END) as completed_exercises
			FROM exercises e
			JOIN chapters c ON e.chapter_id = c.id
			JOIN languages l ON c.language_id = l.id
			LEFT JOIN user_progress up ON e.id = up.exercise_id AND up.user_id = ?
			GROUP BY c.language_id, l.name
		`, [userId]);

		return { ...stats, byLanguage };
	}

	// ============= Fixture File Methods =============

	async getFixtureFiles() {
		return this.db.all('SELECT * FROM fixture_files ORDER BY filename');
	}

	async getFixtureFile(filename) {
		return this.db.get('SELECT * FROM fixture_files WHERE filename = ?', [filename]);
	}

	async createFixtureFile(filename, content, type = 'file') {
		const size = type === 'file' ? Buffer.byteLength(content || '', 'utf8') : 0;
		await this.db.run(`
			INSERT OR REPLACE INTO fixture_files (filename, type, content, size, updated_at)
			VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
		`, [filename, type, type === 'file' ? content : null, size]);
		return this.getFixtureFile(filename);
	}

	async deleteFixtureFile(filename) {
		await this.db.run('DELETE FROM fixture_files WHERE filename = ?', [filename]);
	}

	// ============= Exercise Statistics Methods =============

	/**
	 * Get statistics for a specific user and exercise
	 * @param {number} userId - User ID
	 * @param {string} exerciseId - Exercise ID
	 * @returns {Promise<Object>} Statistics object
	 */
	async getExerciseStatistics(userId, exerciseId) {
		const progress = await this.getUserProgress(userId, exerciseId);

		if (!progress) {
			return {
				totalAttempts: 0,
				successfulAttempts: 0,
				failedAttempts: 0,
				lastAttempt: null,
				failureReasons: {}
			};
		}

		return {
			totalAttempts: progress.attempts || 0,
			successfulAttempts: progress.successful_attempts || 0,
			failedAttempts: progress.failed_attempts || 0,
			lastAttempt: progress.started_at,
			failureReasons: {} // Can be enhanced later to track specific failure types
		};
	}

	/**
	 * Get global statistics for an exercise (all users)
	 * @param {string} exerciseId - Exercise ID
	 * @returns {Promise<Object>} Aggregated statistics
	 */
	async getGlobalExerciseStatistics(exerciseId) {
		const stats = await this.db.get(`
			SELECT 
				COUNT(*) as total_users,
				SUM(attempts) as total_attempts,
				SUM(successful_attempts) as total_successful,
				SUM(failed_attempts) as total_failed,
				AVG(attempts) as avg_attempts
			FROM user_progress
			WHERE exercise_id = ?
		`, [exerciseId]);

		return {
			totalAttempts: stats.total_attempts || 0,
			successfulAttempts: stats.total_successful || 0,
			failedAttempts: stats.total_failed || 0,
			totalUsers: stats.total_users || 0,
			avgAttempts: Math.round(stats.avg_attempts || 0),
			failureReasons: {}
		};
	}

	/**
	 * Get leaderboard data
	 * @param {string|null} languageId - Optional language ID to filter by
	 * @returns {Promise<Array>} Leaderboard data
	 */
	async getLeaderboard(languageId = null) {
		let query;
		const params = [];

		if (languageId) {
			query = `
				SELECT
					u.id,
					u.display_name,
					COUNT(DISTINCT CASE WHEN up.completed = 1 THEN up.exercise_id END) as completed_count,
					SUM(up.attempts) as total_attempts
				FROM users u
				JOIN user_progress up ON u.id = up.user_id
				JOIN exercises e ON up.exercise_id = e.id
				JOIN chapters c ON e.chapter_id = c.id
				WHERE c.language_id = ?
				GROUP BY u.id, u.display_name
				ORDER BY completed_count DESC, total_attempts ASC
				LIMIT 100
			`;
			params.push(languageId);
		} else {
			query = `
				SELECT
					u.id,
					u.display_name,
					COUNT(DISTINCT CASE WHEN up.completed = 1 THEN up.exercise_id END) as completed_count,
					SUM(up.attempts) as total_attempts
				FROM users u
				JOIN user_progress up ON u.id = up.user_id
				GROUP BY u.id, u.display_name
				ORDER BY completed_count DESC, total_attempts ASC
				LIMIT 100
			`;
		}

		return this.db.all(query, params);
	}

	/**
	 * Get achievement points leaderboard
	 * @param {string|null} languageId - Optional language ID (not used for achievement leaderboard, but kept for consistency)
	 * @returns {Promise<Array>} Leaderboard data ranked by achievement points
	 */
	async getAchievementLeaderboard() {
		const query = `
			SELECT
				u.id,
				u.display_name,
				COALESCE(SUM(a.points), 0) as total_points,
				COUNT(ua.achievement_id) as achievements_earned,
				(SELECT COUNT(*) FROM achievements) as total_achievements
			FROM users u
			LEFT JOIN user_achievements ua ON u.id = ua.user_id
			LEFT JOIN achievements a ON ua.achievement_id = a.id
			GROUP BY u.id, u.display_name
			HAVING total_points > 0
			ORDER BY total_points DESC, achievements_earned DESC
			LIMIT 100
		`;

		return this.db.all(query);
	}

	// ============= Achievement Methods =============

	/**
	 * Get all achievements
	 */
	async getAllAchievements() {
		return this.db.all('SELECT * FROM achievements ORDER BY category, points');
	}

	/**
	 * Get user's earned achievements
	 */
	async getUserAchievements(userId) {
		return this.db.all(`
			SELECT a.*, ua.earned_at, ua.progress
			FROM achievements a
			JOIN user_achievements ua ON a.id = ua.achievement_id
			WHERE ua.user_id = ?
			ORDER BY ua.earned_at DESC
		`, [userId]);
	}

	/**
	 * Get user's achievement progress (including unearned)
	 */
	async getUserAchievementProgress(userId) {
		return this.db.all(`
			SELECT 
				a.*,
				ua.earned_at,
				ua.progress,
				CASE WHEN ua.earned_at IS NOT NULL THEN 1 ELSE 0 END as earned
			FROM achievements a
			LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
			ORDER BY earned DESC, a.category, a.points
		`, [userId]);
	}

	/**
	 * Award achievement to user
	 */
	async awardAchievement(userId, achievementId, progress = 100) {
		try {
			await this.db.run(`
				INSERT OR REPLACE INTO user_achievements (user_id, achievement_id, progress, earned_at)
				VALUES (?, ?, ?, CURRENT_TIMESTAMP)
			`, [userId, achievementId, progress]);
			return true;
		} catch (e) {
			console.error('Error awarding achievement:', e);
			return false;
		}
	}

	/**
	 * Close the database connection
	 */
	async updateAchievementProgress(userId, achievementId, progress) {
		await this.db.run(`
			INSERT OR REPLACE INTO user_achievements (user_id, achievement_id, progress)
			VALUES (?, ?, ?)
		`, [userId, achievementId, progress]);
	}

	/**
	 * Get user's total achievement points
	 */
	async getUserAchievementPoints(userId) {
		const result = await this.db.get(`
			SELECT COALESCE(SUM(a.points), 0) as total_points
			FROM achievements a
			JOIN user_achievements ua ON a.id = ua.achievement_id
			WHERE ua.user_id = ?
		`, [userId]);
		return result.total_points || 0;
	}

	/**
	 * Check and award achievements for a user
	 */
	async checkAndAwardAchievements(userId) {
		const newAchievements = [];

		// Get user stats
		const completedCount = await this.db.get(`
			SELECT COUNT(*) as count FROM user_progress WHERE user_id = ? AND completed = 1
		`, [userId]);
		const totalCompleted = completedCount.count;

		const firstTryCount = await this.db.get(`
			SELECT COUNT(*) as count FROM user_progress 
			WHERE user_id = ? AND completed = 1 AND attempts = 1
		`, [userId]);
		const firstTryCompletions = firstTryCount.count;

		// Check exercises_completed achievements
		const completionAchievements = await this.db.all(`
			SELECT * FROM achievements 
			WHERE requirement_type = 'exercises_completed' 
			AND requirement_value <= ?
			AND id NOT IN (SELECT achievement_id FROM user_achievements WHERE user_id = ?)
		`, [totalCompleted, userId]);

		for (const achievement of completionAchievements) {
			await this.awardAchievement(userId, achievement.id);
			newAchievements.push(achievement);
		}

		// Check first_try_completions achievements
		const firstTryAchievements = await this.db.all(`
			SELECT * FROM achievements 
			WHERE requirement_type = 'first_try_completions' 
			AND requirement_value <= ?
			AND id NOT IN (SELECT achievement_id FROM user_achievements WHERE user_id = ?)
		`, [firstTryCompletions, userId]);

		for (const achievement of firstTryAchievements) {
			await this.awardAchievement(userId, achievement.id);
			newAchievements.push(achievement);
		}

		return newAchievements;
	}

	/**
	 * Check time-based achievements (night owl, early bird)
	 */
	async checkTimeBasedAchievements(userId) {
		const hour = new Date().getHours();
		const newAchievements = [];

		// Night Owl (midnight to 5 AM)
		if (hour >= 0 && hour < 5) {
			const hasAchievement = await this.db.get(`
				SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = 'night-owl'
			`, [userId]);

			if (!hasAchievement) {
				await this.awardAchievement(userId, 'night-owl');
				const achievement = await this.db.get(`SELECT * FROM achievements WHERE id = 'night-owl'`);
				newAchievements.push(achievement);
			}
		}

		// Early Bird (5 AM to 8 AM)
		if (hour >= 5 && hour < 8) {
			const hasAchievement = await this.db.get(`
				SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = 'early-bird'
			`, [userId]);

			if (!hasAchievement) {
				await this.awardAchievement(userId, 'early-bird');
				const achievement = await this.db.get(`SELECT * FROM achievements WHERE id = 'early-bird'`);
				newAchievements.push(achievement);
			}
		}

		return newAchievements;
	}

	/**
	 * Check persistence achievements
	 */
	async checkPersistenceAchievements(userId, attempts) {
		const newAchievements = [];

		// Persistent (10+ attempts)
		if (attempts >= 10) {
			const hasAchievement = await this.db.get(`
				SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = 'persistent'
			`, [userId]);

			if (!hasAchievement) {
				await this.awardAchievement(userId, 'persistent');
				const achievement = await this.db.get(`SELECT * FROM achievements WHERE id = 'persistent'`);
				newAchievements.push(achievement);
			}
		}

		// Never Give Up (20+ attempts)
		if (attempts >= 20) {
			const hasAchievement = await this.db.get(`
				SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = 'never-give-up'
			`, [userId]);

			if (!hasAchievement) {
				await this.awardAchievement(userId, 'never-give-up');
				const achievement = await this.db.get(`SELECT * FROM achievements WHERE id = 'never-give-up'`);
				newAchievements.push(achievement);
			}
		}

		return newAchievements;
	}

	/**
	 * Check speed achievements (exercises per hour/day)
	 */
	async checkSpeedAchievements(userId) {
		const newAchievements = [];
		const now = new Date();

		// Check exercises completed in the last hour
		const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
		const lastHourCompletions = await this.db.get(`
			SELECT COUNT(*) as count 
			FROM user_progress 
			WHERE user_id = ? 
			AND completed = 1 
			AND completed_at >= ?
		`, [userId, oneHourAgo.toISOString()]);

		if (lastHourCompletions.count >= 3) {
			const hasAchievement = await this.db.get(`
				SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = 'speed-demon'
			`, [userId]);

			if (!hasAchievement) {
				await this.awardAchievement(userId, 'speed-demon');
				const achievement = await this.db.get(`SELECT * FROM achievements WHERE id = 'speed-demon'`);
				newAchievements.push(achievement);
			}
		}

		// Check exercises completed today
		const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
		const todayCompletions = await this.db.get(`
			SELECT COUNT(*) as count 
			FROM user_progress 
			WHERE user_id = ? 
			AND completed = 1 
			AND completed_at >= ?
		`, [userId, todayStart]);

		if (todayCompletions.count >= 10) {
			const hasAchievement = await this.db.get(`
				SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = 'marathon-runner'
			`, [userId]);

			if (!hasAchievement) {
				await this.awardAchievement(userId, 'marathon-runner');
				const achievement = await this.db.get(`SELECT * FROM achievements WHERE id = 'marathon-runner'`);
				newAchievements.push(achievement);
			}
		}

		return newAchievements;
	}

	/**
	 * Check streak achievements (consecutive days)
	 */
	async checkStreakAchievements(userId) {
		const newAchievements = [];

		// Get all days with completions, ordered by date
		const completionDays = await this.db.all(`
			SELECT DISTINCT DATE(completed_at) as completion_date
			FROM user_progress
			WHERE user_id = ? AND completed = 1
			ORDER BY completion_date DESC
		`, [userId]);

		if (completionDays.length === 0) return newAchievements;

		// Calculate current streak
		let currentStreak = 1;
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		for (let i = 0; i < completionDays.length - 1; i++) {
			const currentDate = new Date(completionDays[i].completion_date);
			const nextDate = new Date(completionDays[i + 1].completion_date);

			// Check if dates are consecutive
			const diffDays = Math.floor((currentDate - nextDate) / (1000 * 60 * 60 * 24));

			if (diffDays === 1) {
				currentStreak++;
			} else {
				break;
			}
		}

		// Check if streak is current (includes today or yesterday)
		const mostRecentDate = new Date(completionDays[0].completion_date);
		const daysSinceLastCompletion = Math.floor((today - mostRecentDate) / (1000 * 60 * 60 * 24));

		if (daysSinceLastCompletion > 1) {
			currentStreak = 0; // Streak broken
		}

		// Award streak achievements
		const streakAchievements = [
			{ id: 'streak-starter', days: 3 },
			{ id: 'committed', days: 7 },
			{ id: 'unstoppable', days: 30 }
		];

		for (const streakAch of streakAchievements) {
			if (currentStreak >= streakAch.days) {
				const hasAchievement = await this.db.get(`
					SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?
				`, [userId, streakAch.id]);

				if (!hasAchievement) {
					await this.awardAchievement(userId, streakAch.id);
					const achievement = await this.db.get(`SELECT * FROM achievements WHERE id = ?`, [streakAch.id]);
					newAchievements.push(achievement);
				}
			}
		}

		return newAchievements;
	}

	/**
	 * Check chapter and mastery achievements
	 */
	async checkChapterAchievements(userId, exerciseId) {
		const newAchievements = [];

		// Get the chapter of the completed exercise
		const exercise = await this.db.get(`
			SELECT e.*, c.language_id 
			FROM exercises e
			JOIN chapters c ON e.chapter_id = c.id
			WHERE e.id = ?
		`, [exerciseId]);

		if (!exercise) return newAchievements;

		// Check if all exercises in this chapter are completed
		const chapterProgress = await this.db.get(`
			SELECT 
				COUNT(*) as total_exercises,
				SUM(CASE WHEN up.completed = 1 THEN 1 ELSE 0 END) as completed_exercises
			FROM exercises e
			LEFT JOIN user_progress up ON e.id = up.exercise_id AND up.user_id = ?
			WHERE e.chapter_id = ?
		`, [userId, exercise.chapter_id]);

		if (chapterProgress.total_exercises === chapterProgress.completed_exercises) {
			// Chapter completed!
			const hasChapterAchievement = await this.db.get(`
				SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = 'chapter-complete'
			`, [userId]);

			if (!hasChapterAchievement) {
				await this.awardAchievement(userId, 'chapter-complete');
				const achievement = await this.db.get(`SELECT * FROM achievements WHERE id = 'chapter-complete'`);
				newAchievements.push(achievement);
			}

			// Check if ALL chapters are now complete
			const allChaptersProgress = await this.db.get(`
				SELECT 
					COUNT(DISTINCT c.id) as total_chapters,
					COUNT(DISTINCT CASE 
						WHEN chapter_stats.total = chapter_stats.completed THEN c.id 
					END) as completed_chapters
				FROM chapters c
				JOIN exercises e ON c.id = e.chapter_id
				LEFT JOIN (
					SELECT 
						e2.chapter_id,
						COUNT(*) as total,
						SUM(CASE WHEN up2.completed = 1 THEN 1 ELSE 0 END) as completed
					FROM exercises e2
					LEFT JOIN user_progress up2 ON e2.id = up2.exercise_id AND up2.user_id = ?
					GROUP BY e2.chapter_id
				) as chapter_stats ON c.id = chapter_stats.chapter_id
				WHERE c.language_id = ?
			`, [userId, exercise.language_id]);

			if (allChaptersProgress.total_chapters === allChaptersProgress.completed_chapters) {
				const hasAllChaptersAchievement = await this.db.get(`
					SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = 'all-chapters'
				`, [userId]);

				if (!hasAllChaptersAchievement) {
					await this.awardAchievement(userId, 'all-chapters');
					const achievement = await this.db.get(`SELECT * FROM achievements WHERE id = 'all-chapters'`);
					newAchievements.push(achievement);
				}
			}
		}

		return newAchievements;
	}

	/**
	 * Close the database connection
	 */
	async closeDatabase() {
		if (this.db) {
			await this.db.close();
			console.log('Database connection closed');
		}
	}
}

const databaseService = new DatabaseService();

module.exports = databaseService;
