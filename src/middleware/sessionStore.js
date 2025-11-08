// src/middleware/sessionStore.js
const session = require('express-session');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

/**
 * SQLite session store for express-session using the sqlite package
 */
class SqliteSessionStore extends session.Store {
	constructor(options = {}) {
		super(options);
		this.db = null;
		this.dbPath = options.dbPath || path.join(__dirname, '../../data/sessions.db');
		this.tableName = options.tableName || 'sessions';
		this.cleanupInterval = options.cleanupInterval || 15 * 60 * 1000; // 15 minutes
		this.initPromise = this.initialize();
	}

	async initialize() {
		try {
			// Open database connection
			this.db = await sqlite.open({
				filename: this.dbPath,
				driver: sqlite3.Database
			});

			// Create sessions table
			await this.db.exec(`
				CREATE TABLE IF NOT EXISTS ${this.tableName} (
					sid TEXT PRIMARY KEY,
					sess TEXT NOT NULL,
					expired INTEGER NOT NULL
				)
			`);

			// Create index on expired column for faster cleanup
			await this.db.exec(`
				CREATE INDEX IF NOT EXISTS idx_sessions_expired 
				ON ${this.tableName}(expired)
			`);

			console.log('✅ Session store initialized');

			// Start cleanup interval
			this.startCleanup();
		} catch (error) {
			console.error('❌ Failed to initialize session store:', error);
			throw error;
		}
	}

	/**
	 * Start periodic cleanup of expired sessions
	 */
	startCleanup() {
		this.cleanupTimer = setInterval(async () => {
			try {
				const now = Date.now();
				const result = await this.db.run(
					`DELETE FROM ${this.tableName} WHERE expired < ?`,
					[now]
				);
				if (result.changes > 0) {
					console.log(`🧹 Cleaned up ${result.changes} expired sessions`);
				}
			} catch (error) {
				console.error('Error cleaning up sessions:', error);
			}
		}, this.cleanupInterval);
	}

	/**
	 * Get a session
	 */
	async get(sid, callback) {
		try {
			await this.initPromise;
			const row = await this.db.get(
				`SELECT sess FROM ${this.tableName} WHERE sid = ? AND expired > ?`,
				[sid, Date.now()]
			);

			if (row) {
				callback(null, JSON.parse(row.sess));
			} else {
				callback(null, null);
			}
		} catch (error) {
			callback(error);
		}
	}

	/**
	 * Set a session
	 */
	async set(sid, session, callback) {
		try {
			await this.initPromise;
			const maxAge = session.cookie.maxAge || 86400000; // Default 24 hours
			const expired = Date.now() + maxAge;
			const sess = JSON.stringify(session);

			await this.db.run(
				`INSERT OR REPLACE INTO ${this.tableName} (sid, sess, expired) VALUES (?, ?, ?)`,
				[sid, sess, expired]
			);

			callback(null);
		} catch (error) {
			callback(error);
		}
	}

	/**
	 * Destroy a session
	 */
	async destroy(sid, callback) {
		try {
			await this.initPromise;
			await this.db.run(
				`DELETE FROM ${this.tableName} WHERE sid = ?`,
				[sid]
			);
			callback(null);
		} catch (error) {
			callback(error);
		}
	}

	/**
	 * Get all sessions
	 */
	async all(callback) {
		try {
			await this.initPromise;
			const rows = await this.db.all(
				`SELECT sess FROM ${this.tableName} WHERE expired > ?`,
				[Date.now()]
			);

			const sessions = rows.map(row => JSON.parse(row.sess));
			callback(null, sessions);
		} catch (error) {
			callback(error);
		}
	}

	/**
	 * Get session count
	 */
	async length(callback) {
		try {
			await this.initPromise;
			const row = await this.db.get(
				`SELECT COUNT(*) as count FROM ${this.tableName} WHERE expired > ?`,
				[Date.now()]
			);
			callback(null, row.count);
		} catch (error) {
			callback(error);
		}
	}

	/**
	 * Clear all sessions
	 */
	async clear(callback) {
		try {
			await this.initPromise;
			await this.db.run(`DELETE FROM ${this.tableName}`);
			callback(null);
		} catch (error) {
			callback(error);
		}
	}

	/**
	 * Touch a session to update expiration
	 */
	async touch(sid, session, callback) {
		try {
			await this.initPromise;
			const maxAge = session.cookie.maxAge || 86400000;
			const expired = Date.now() + maxAge;

			await this.db.run(
				`UPDATE ${this.tableName} SET expired = ? WHERE sid = ?`,
				[expired, sid]
			);

			callback(null);
		} catch (error) {
			callback(error);
		}
	}

	/**
	 * Close the database connection
	 */
	async close() {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
		}
		if (this.db) {
			await this.db.close();
		}
	}
}

module.exports = SqliteSessionStore;

