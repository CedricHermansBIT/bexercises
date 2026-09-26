const executionLimiter = require('../services/executionLimiter');

const executionRoutes = new Set([
	'/test-solution', '/run-test-case', '/exam-grader/grade', '/exam-grader/test-single'
]);

module.exports = function adminExecutionQueue(req, res, next) {
	if (req.method !== 'POST' || !executionRoutes.has(req.path)) return next();
	executionLimiter.enqueue(() => new Promise(resolve => {
		if (res.destroyed) return resolve();
		res.once('finish', resolve);
		res.once('close', resolve);
		next();
	})).catch(error => {
		if (!res.headersSent && !res.destroyed) {
			res.status(error.statusCode || 503).json({ error: error.message });
		} else {
			next(error);
		}
	});
};
