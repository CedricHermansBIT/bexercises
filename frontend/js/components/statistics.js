// frontend/js/components/statistics.js
/**
 * Statistics Component
 */
class Statistics {
	constructor() {
		this.container = document.getElementById('statistics-panel');
	}

	/**
	 * Display statistics
	 * @param {Object} stats - Statistics object
	 */
	display(stats) {
		if (!this.container) return;

		const successRate = stats.totalAttempts > 0
			? ((stats.successfulAttempts / stats.totalAttempts) * 100).toFixed(1)
			: 0;

		let failureBreakdown = '';
		if (stats.failedAttempts > 0 && stats.failureReasons) {
			const reasons = Object.entries(stats.failureReasons)
				.map(([reason, count]) => {
					const icon = this.getFailureIcon(reason);
					const label = this.getFailureLabel(reason);
					return `<div class="failure-reason">${icon} ${label}: ${count}</div>`;
				})
				.join('');
			failureBreakdown = `<div class="failure-breakdown">${reasons}</div>`;
		}

		this.container.innerHTML = `
			<div class="stats-content">
				<h4>📊 Exercise Statistics</h4>
				<div class="stats-grid">
					<div class="stat-item">
						<span class="stat-label">Total Attempts:</span>
						<span class="stat-value">${stats.totalAttempts}</span>
					</div>
					<div class="stat-item">
						<span class="stat-label">Success Rate:</span>
						<span class="stat-value">${successRate}%</span>
					</div>
					<div class="stat-item success">
						<span class="stat-label">✓ Successful:</span>
						<span class="stat-value">${stats.successfulAttempts}</span>
					</div>
					<div class="stat-item failed">
						<span class="stat-label">✗ Failed:</span>
						<span class="stat-value">${stats.failedAttempts}</span>
					</div>
				</div>
				${failureBreakdown}
			</div>
		`;
	}

	/**
	 * Get failure icon
	 * @param {string} reason - Failure reason
	 * @returns {string} Icon emoji
	 */
	getFailureIcon(reason) {
		const icons = {
			'timeout': '⏱️',
			'wrong_exit_code': '🚪',
			'wrong_output': '📝',
			'wrong_stderr': '📣',
			'output_limit': '📦',
			'configuration_error': '🛠️',
			'error': '❌',
			'unknown': '❓'
		};
		return icons[reason] || '❓';
	}

	/**
	 * Get failure label
	 * @param {string} reason - Failure reason
	 * @returns {string} Human-readable label
	 */
	getFailureLabel(reason) {
		const labels = {
			'timeout': 'Timeout',
			'wrong_exit_code': 'Wrong Exit Code',
			'wrong_output': 'Wrong Output',
			'wrong_stderr': 'Wrong Error Output',
			'output_limit': 'Output Limit',
			'configuration_error': 'Exercise Configuration',
			'error': 'Error',
			'unknown': 'Unknown'
		};
		return labels[reason] || 'Other';
	}
}

export default Statistics;

