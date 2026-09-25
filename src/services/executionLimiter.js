const config = require('../config');

const attempts = new Map();
const waiting = [];
let active = 0;

function checkRateLimit(userId, now = Date.now()) {
	const windowMs = 60_000;
	const limit = config.docker.runsPerMinute;
	const recent = (attempts.get(userId) || []).filter(time => now - time < windowMs);
	if (recent.length >= limit) {
		attempts.set(userId, recent);
		return false;
	}
	recent.push(now);
	attempts.set(userId, recent);
	// Remove inactive users so this map does not grow without bound.
	for (const [id, times] of attempts) {
		if (times[times.length - 1] < now - windowMs) attempts.delete(id);
	}
	return true;
}

function drain() {
	while (active < config.docker.maxParallelTests && waiting.length) {
		const job = waiting.shift();
		active++;
		Promise.resolve().then(job.work).then(job.resolve, job.reject).finally(() => {
			active--;
			drain();
		});
	}
}

function enqueue(work) {
	if (waiting.length >= config.docker.maxQueuedRuns) {
		const error = new Error('Execution queue is full. Try again shortly.');
		error.statusCode = 503;
		return Promise.reject(error);
	}
	return new Promise((resolve, reject) => {
		waiting.push({ work, resolve, reject });
		drain();
	});
}

module.exports = { checkRateLimit, enqueue };
