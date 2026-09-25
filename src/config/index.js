// src/config/index.js
require('dotenv').config();
const path = require('path');

if (process.env.NODE_ENV === 'production' &&
	(!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'fallback-secret-change-in-production')) {
	throw new Error('SESSION_SECRET must be set to a unique value in production');
}

// Extract base path first so we can use it in config
const basePath = process.env.BASE_PATH || '';

const config = {
	// Server configuration
	server: {
		port: process.env.PORT || 3000,
		env: process.env.NODE_ENV || 'development',
		basePath: basePath // e.g., '/bitlab' for subdirectory deployment
	},

	// Session configuration
	session: {
		secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
		resave: false,
		saveUninitialized: false,
		cookie: {
			secure: process.env.NODE_ENV === 'production',
			maxAge: 24 * 60 * 60 * 1000 // 24 hours
		}
	},

	// Google OAuth configuration
	oauth: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
			callbackURL: process.env.CALLBACK_URL || `${basePath}/auth/google/callback`
		}
	},

	// Docker runner configuration
	docker: {
		image: process.env.RUNNER_IMAGE || 'bitlab-runner:latest',
		timeout: parseInt(process.env.PER_TEST_TIMEOUT_MS || '30000'),
		maxParallelTests: Math.max(1, parseInt(process.env.MAX_PARALLEL_TESTS || '2', 10)),
		maxQueuedRuns: Math.max(0, parseInt(process.env.MAX_QUEUED_RUNS || '20', 10)),
		runsPerMinute: Math.max(1, parseInt(process.env.RUNS_PER_MINUTE || '6', 10)),
		cpus: process.env.DOCKER_CPUS || '1',
		maxOutputBytes: Math.max(1024, parseInt(process.env.MAX_RUN_OUTPUT_BYTES || '65536', 10)),
		maxArchiveBytes: Math.max(1024, parseInt(process.env.MAX_ARCHIVE_BYTES || '67108864', 10)),
		maxArchiveExpandedBytes: Math.max(1024, parseInt(process.env.MAX_ARCHIVE_EXPANDED_BYTES || '67108864', 10)),
		maxArchiveMembers: Math.max(1, parseInt(process.env.MAX_ARCHIVE_MEMBERS || '1000', 10)),
		archiveInspectTimeoutMs: Math.max(1000, parseInt(process.env.ARCHIVE_INSPECT_TIMEOUT_MS || '10000', 10)),
		workspaceSize: process.env.DOCKER_WORKSPACE_SIZE || '64m',
		tmpSize: process.env.DOCKER_TMP_SIZE || '16m',
		maxExamArchiveBytes: Math.max(1024, parseInt(process.env.MAX_EXAM_ARCHIVE_BYTES || '33554432', 10)),
		maxExamUncompressedBytes: Math.max(1024, parseInt(process.env.MAX_EXAM_UNCOMPRESSED_BYTES || '33554432', 10)),
		maxExamFiles: Math.max(1, parseInt(process.env.MAX_EXAM_FILES || '500', 10)),
		maxExamDepth: Math.max(1, parseInt(process.env.MAX_EXAM_DEPTH || '8', 10)),
		memory: process.env.DOCKER_MEMORY || '256m',
		databaseMemory: process.env.DOCKER_DATABASE_MEMORY || '1g',
		databaseStorageSize: process.env.DOCKER_DATABASE_STORAGE_SIZE || '512m',
		databasePidsLimit: Math.max(1, parseInt(process.env.DOCKER_DATABASE_PIDS_LIMIT || '256', 10)),
		pidsLimit: parseInt(process.env.DOCKER_PIDS_LIMIT || '128')
	},

	// Paths configuration
	paths: {
		root: path.resolve(__dirname, '../..'),
		exercises: path.resolve(__dirname, '../../exercises-internal.json'),
		fixtures: path.resolve(__dirname, '../../fixtures'),
		frontend: path.resolve(__dirname, '../../frontend'),
		temp: process.env.TEMP_DIR || path.resolve(__dirname, '../../tmp')
	}
};

module.exports = config;

