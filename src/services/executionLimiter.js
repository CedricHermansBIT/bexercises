const config = require('../config');

const attempts = new Map();
const waiting = [];
const inFlightUsers = new Set();
let active = 0;

function rejected(message, statusCode) {
	const error = new Error(message);
	error.statusCode = statusCode;
	return Promise.reject(error);
}

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
			if (job.userId !== null) inFlightUsers.delete(job.userId);
			drain();
		});
	}
}

function enqueue(work, userId = null) {
	if (userId !== null && inFlightUsers.has(userId)) {
		return rejected('A run is already in progress for this user.', 429);
	}
	if (active >= config.docker.maxParallelTests && waiting.length >= config.docker.maxQueuedRuns) {
		return rejected('Execution queue is full. Try again shortly.', 503);
	}
	if (userId !== null && !checkRateLimit(userId)) {
		return rejected('Run limit reached. Try again in a minute.', 429);
	}
	if (userId !== null) inFlightUsers.add(userId);
	return new Promise((resolve, reject) => {
		waiting.push({ work, resolve, reject, userId });
		drain();
	});
}

function getStatus() {
	return { active, queued: waiting.length, capacity: config.docker.maxParallelTests,
		queueLimit: config.docker.maxQueuedRuns };
}

module.exports = { checkRateLimit, enqueue, getStatus };
