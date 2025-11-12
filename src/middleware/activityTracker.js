// src/middleware/activityTracker.js
const databaseService = require('../services/databaseService');

/**
 * Middleware to track user activity
 * Updates last_activity timestamp for authenticated users
 */
function trackUserActivity(req, res, next) {
	// Only track if user is authenticated
	if (req.user && req.user.id) {
		// Don't await - update asynchronously to not slow down requests
		databaseService.updateUserActivity(req.user.id).catch(err => {
			console.error('Failed to update user activity:', err);
		});
	}
	next();
}

module.exports = trackUserActivity;

