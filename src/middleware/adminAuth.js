// src/middleware/adminAuth.js
/**
 * Middleware to check if user is authenticated and has admin role
 */
function requireAdmin(req, res, next) {
	if (!req.user) {
		return res.status(401).json({ error: 'Authentication required' });
	}

	// Check if user has admin role
	// This can be based on email domain, specific emails, or a role field
	const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
	//const adminDomain = process.env.ADMIN_DOMAIN || '@howest.be'; // Example domain

	const isAdmin =
		req.user.role === 'admin' ||
		req.user.isAdmin === true ||
		adminEmails.includes(req.user.email); //||
		//req.user.email?.endsWith(adminDomain);

	if (!isAdmin) {
		return res.status(403).json({ error: 'Admin access required' });
	}

	next();
}

module.exports = requireAdmin;

