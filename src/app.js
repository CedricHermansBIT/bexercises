// src/app.js
const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const session = require('express-session');
const passport = require('passport');

const config = require('./config');
const { configurePassport } = require('./middleware/auth');
const corsMiddleware = require('./middleware/cors');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

/**
 * Create and configure Express application
 */
function createApp() {
	const app = express();

	// Logging
	app.use(morgan('combined'));

	// Body parsing
	app.use(bodyParser.json({ limit: '200kb' }));

	// Session configuration
	app.use(session(config.session));

	// Initialize Passport
	app.use(passport.initialize());
	app.use(passport.session());
	configurePassport();

	// Serve static files from frontend directory with correct MIME types
	// This must come BEFORE CORS to avoid issues with module loading
	app.use(express.static(config.paths.frontend, {
		setHeaders: (res, path) => {
			// Set correct MIME type for JavaScript modules
			if (path.endsWith('.js')) {
				res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
			}
		}
	}));

	// CORS - applied to API routes
	app.use('/api', corsMiddleware);
	app.use('/auth', corsMiddleware);

	// Routes
	app.use('/auth', authRoutes);
	app.use('/api/admin', adminRoutes);
	app.use('/api', apiRoutes);

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
