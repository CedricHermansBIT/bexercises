// src/middleware/cors.js

/**
 * CORS middleware configuration
 */
function corsMiddleware(req, res, next) {
	const allowedOrigin = process.env.CORS_ORIGIN;
	if (allowedOrigin && req.headers.origin === allowedOrigin) {
		res.header('Access-Control-Allow-Origin', allowedOrigin);
		res.header('Access-Control-Allow-Credentials', 'true');
		res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
		res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		res.vary('Origin');
	}

	if (req.method === 'OPTIONS') {
		return allowedOrigin && req.headers.origin === allowedOrigin ? res.sendStatus(204) : res.sendStatus(403);
	}

	next();
}

module.exports = corsMiddleware;

