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
const trackUserActivity = require('./middleware/activityTracker');
const { errorMiddleware } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

/**
 * Create and configure Express application
 */
function createApp() {
	const app = express();
	const basePath = config.server.basePath || '';

	// Helper function to mount middleware/routes at both basePath and root
	const mountAtBothPaths = (path, handler) => {
		app.use(`${basePath}${path}`, handler);
		if (basePath) {
			app.use(path, handler);
		}
	};

	// Helper for config endpoint
	const configHandler = (req, res) => {
		res.json({ basePath });
	};

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
	mountAtBothPaths('/api', corsMiddleware);
	mountAtBothPaths('/auth', corsMiddleware);

	// Activity tracking - update last_activity for authenticated users
	mountAtBothPaths('/api', trackUserActivity);

	// Routes - mount with basePath and at root for reverse proxy scenarios
	mountAtBothPaths('/auth', authRoutes);
	mountAtBothPaths('/api/admin', adminRoutes);
	mountAtBothPaths('/api', apiRoutes);

	// Expose config endpoint for frontend (both paths)
	app.get(`${basePath}/api/config`, configHandler);
	if (basePath) {
		app.get('/api/config', configHandler);
	}

	// Centralized error handling middleware
	app.use(errorMiddleware);

	return app;
}

module.exports = createApp;

