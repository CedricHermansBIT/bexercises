// src/middleware/errorHandler.js

/**
 * Custom error class for API errors with status codes
 */
class ApiError extends Error {
	constructor(message, statusCode = 500, details = null) {
		super(message);
		this.statusCode = statusCode;
		this.details = details;
		this.name = 'ApiError';
	}

	static badRequest(message, details = null) {
		return new ApiError(message, 400, details);
	}

	static unauthorized(message = 'Not authenticated') {
		return new ApiError(message, 401);
	}

	static forbidden(message = 'Access denied') {
		return new ApiError(message, 403);
	}

	static notFound(message = 'Resource not found') {
		return new ApiError(message, 404);
	}

	static internal(message = 'Internal server error', details = null) {
		return new ApiError(message, 500, details);
	}
}

/**
 * Wrapper for async route handlers to catch errors automatically
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function that catches errors
 */
function asyncHandler(fn) {
	return (req, res, next) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};
}

/**
 * Central error handling middleware
 * @param {Error} err - Error object
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} _next - Express next function
 */
function errorMiddleware(err, req, res, _next) {
	// Log the error
	console.error(`[Error] ${req.method} ${req.path}:`, err.message);
	if (process.env.NODE_ENV === 'development') {
		console.error(err.stack);
	}

	// Determine status code and message
	const statusCode = err.statusCode || 500;
	const message = err.message || 'Internal server error';

	// Build response
	const response = {
		error: message,
		...(err.details && { detail: err.details }),
		...(process.env.NODE_ENV === 'development' && statusCode === 500 && { stack: err.stack })
	};

	res.status(statusCode).json(response);
}

module.exports = {
	ApiError,
	asyncHandler,
	errorMiddleware
};

