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
			driver: sqlite3.Database
		});

		// Enable foreign keys
		await this.db.run('PRAGMA foreign_keys = ON');

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
				PRIMARY KEY (user_id, exercise_id),
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
				FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
			)
		`);

		// Fixture files table
		await this.db.exec(`
			CREATE TABLE IF NOT EXISTS fixture_files (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				filename TEXT UNIQUE NOT NULL,
				content TEXT,
				size INTEGER,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`);

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

		// Create indexes for better performance
		await this.db.exec(`
			CREATE INDEX IF NOT EXISTS idx_chapters_language ON chapters(language_id);
			CREATE INDEX IF NOT EXISTS idx_exercises_chapter ON exercises(chapter_id);
			CREATE INDEX IF NOT EXISTS idx_test_cases_exercise ON test_cases(exercise_id);
			CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
			CREATE INDEX IF NOT EXISTS idx_user_progress_exercise ON user_progress(exercise_id);
			CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id);
		`);
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

		// Parse JSON fields
		exercise.testCases = testCases.map(tc => ({
			...tc,
			arguments: tc.arguments ? JSON.parse(tc.arguments) : [],
			input: tc.input ? JSON.parse(tc.input) : []
		}));

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
				await this.db.run(`
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
			}
		}

		return this.getExerciseWithTests(id);
	}

	async updateExercise(id, data) {
		const { title, description, solution, order_num, testCases } = data;
		
		await this.db.run(`
			UPDATE exercises 
			SET title = ?, description = ?, solution = ?, order_num = ?, updated_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`, [title, description, solution, order_num, id]);

		// Delete and recreate test cases
		if (testCases && Array.isArray(testCases)) {
			await this.db.run('DELETE FROM test_cases WHERE exercise_id = ?', [id]);
			
			for (let i = 0; i < testCases.length; i++) {
				const tc = testCases[i];
				await this.db.run(`
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
					attempts = attempts + 1
				WHERE user_id = ? AND exercise_id = ?
			`, [completed ? 1 : 0, last_submission, completed ? 1 : 0, userId, exerciseId]);
		} else {
			await this.db.run(`
				INSERT INTO user_progress (user_id, exercise_id, completed, last_submission, completed_at, attempts)
				VALUES (?, ?, ?, ?, ?, 1)
			`, [userId, exerciseId, completed ? 1 : 0, last_submission, completed ? new Date().toISOString() : null]);
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

	async createFixtureFile(filename, content) {
		const size = Buffer.byteLength(content, 'utf8');
		await this.db.run(`
			INSERT OR REPLACE INTO fixture_files (filename, content, size, updated_at)
			VALUES (?, ?, ?, CURRENT_TIMESTAMP)
		`, [filename, content, size]);
		return this.getFixtureFile(filename);
	}

	async deleteFixtureFile(filename) {
		await this.db.run('DELETE FROM fixture_files WHERE filename = ?', [filename]);
	}

	/**
	 * Close the database connection
	 */
	async close() {
		if (this.db) {
			await this.db.close();
		}
	}
}

// Create singleton instance
const databaseService = new DatabaseService();

module.exports = databaseService;

