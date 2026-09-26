const { parentPort, workerData } = require('node:worker_threads');

try {
	const { content, rules } = workerData;
	const results = rules.map(rule => {
		const regex = new RegExp(rule.pattern, rule.flags || '');
		const match = regex.test(content);
		return {
			description: rule.description,
			pattern: rule.pattern,
			passed: match,
			points: match ? rule.points : 0,
			maxPoints: rule.points
		};
	});
	parentPort.postMessage({ results });
} catch (error) {
	parentPort.postMessage({ error: error.message });
}
