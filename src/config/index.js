// src/config/index.js
require('dotenv').config();
const path = require('path');

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
		maxParallelTests: parseInt(process.env.MAX_PARALLEL_TESTS || '4'),
		memory: process.env.DOCKER_MEMORY || '256m',
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

