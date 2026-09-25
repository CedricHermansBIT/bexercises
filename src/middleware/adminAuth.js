// src/middleware/adminAuth.js
const { isAdmin } = require('./adminRole');

/**
 * Middleware to check if user is authenticated and has admin role
 */
function requireAdmin(req, res, next) {
	if (!req.user) {
		return res.status(401).json({ error: 'Authentication required' });
	}

	if (!isAdmin(req.user)) {
		return res.status(403).json({ error: 'Admin access required' });
	}

	next();
}

module.exports = requireAdmin;

