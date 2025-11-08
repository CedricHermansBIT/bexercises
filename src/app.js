// src/app.js
const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const session = require('express-session');
const passport = require('passport');
const path = require('path');

const config = require('./config');
const { configurePassport } = require('./middleware/auth');
const SqliteSessionStore = require('./middleware/sessionStore');
const corsMiddleware = require('./middleware/cors');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

/**
 * Create and configure Express application
 */
function createApp() {
	const app = express();
	const basePath = config.server.basePath || '';

	// Logging
	app.use(morgan('combined'));

	// Body parsing - increased limit to support large file/folder uploads
	app.use(bodyParser.json({ limit: '50mb' }));
	// Session configuration with SQLite store
	const sessionStore = new SqliteSessionStore({
		dbPath: path.join(config.paths.root, 'data', 'sessions.db'),
		tableName: 'sessions',
		cleanupInterval: 15 * 60 * 1000 // Clean up expired sessions every 15 minutes
	});

	app.use(session({
		...config.session,
		store: sessionStore
	}));
	// Session configuration
	app.use(session(config.session));

	// Initialize Passport
	app.use(passport.initialize());
	app.use(passport.session());
	configurePassport();

	// Serve static files from frontend directory with correct MIME types
	// This must come BEFORE CORS to avoid issues with module loading
	const staticOptions = {
		setHeaders: (res, path) => {
			// Set correct MIME type for JavaScript modules
			if (path.endsWith('.js')) {
				res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
			}
		}
	};

	// Mount static files at basePath
	if (basePath) {
		app.use(basePath, express.static(config.paths.frontend, staticOptions));
	}
	// Also mount at root (for reverse proxy that strips path, or when no basePath)
	app.use('/', express.static(config.paths.frontend, staticOptions));

	// CORS - applied to API routes
	app.use(`${basePath}/api`, corsMiddleware);
	app.use(`${basePath}/auth`, corsMiddleware);
	if (basePath) {
		app.use('/api', corsMiddleware);
		app.use('/auth', corsMiddleware);
	}

	// Routes - mount with basePath
	app.use(`${basePath}/auth`, authRoutes);
	app.use(`${basePath}/api/admin`, adminRoutes);
	app.use(`${basePath}/api`, apiRoutes);

	// If basePath is set, also mount at root for reverse proxy scenarios
	// where the proxy strips the base path
	if (basePath) {
		app.use('/auth', authRoutes);
		app.use('/api/admin', adminRoutes);
		app.use('/api', apiRoutes);
	}

	// Expose config endpoint for frontend (both paths)
	app.get(`${basePath}/api/config`, (req, res) => {
		res.json({
			basePath: basePath
		});
	});
	if (basePath) {
		app.get('/api/config', (req, res) => {
			res.json({
				basePath: basePath
			});
		});
	}

	// Error handling middleware
	app.use((err, req, res, _next) => {
		console.error('Unhandled error:', err);
		res.status(500).json({
			error: 'Internal server error',
			message: config.server.env === 'development' ? err.message : undefined
		});
	});

	return app;
}

module.exports = createApp;

