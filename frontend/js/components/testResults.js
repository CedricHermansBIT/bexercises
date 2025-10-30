// frontend/js/components/testResults.js
/**
 * Test Results Component
 */
class TestResults {
	constructor() {
		this.resultsContainer = document.getElementById('test-results');
	}

	/**
	 * Display test results
	 * @param {Array} results - Array of test result objects
	 */
	display(results) {
		if (!this.resultsContainer) return;

		this.resultsContainer.innerHTML = '';

		if (results.length === 0) {
			this.resultsContainer.innerHTML = '<p class="no-results">No test cases available for this exercise.</p>';
			return;
		}

		// Add summary
		const passedCount = results.filter(r => r.passed).length;
		const summary = this.createSummary(passedCount, results.length);
		this.resultsContainer.appendChild(summary);

		// Add individual test results
		results.forEach(result => {
			const testDiv = this.createTestResult(result);
			this.resultsContainer.appendChild(testDiv);
		});

		// Setup tab switching
		this.setupTabs();
	}

	/**
	 * Create summary element
	 * @param {number} passed - Number of passed tests
	 * @param {number} total - Total number of tests
	 * @returns {HTMLElement} Summary element
	 */
	createSummary(passed, total) {
		const summary = document.createElement('div');
		summary.className = 'test-summary';
		summary.innerHTML = `<h4>Summary: ${passed}/${total} tests passed</h4>`;
		return summary;
	}

	/**
	 * Create test result element
	 * @param {Object} result - Test result object
	 * @returns {HTMLElement} Test result element
	 */
	createTestResult(result) {
		const testDiv = document.createElement('div');
		testDiv.className = `test-result ${result.passed ? 'passed' : 'failed'}`;

		const title = document.createElement('h4');
		const statusIcon = result.passed ? '✓' : '✗';
		title.innerHTML = `<span class="status-icon">${statusIcon}</span> Test ${result.testNumber}: ${result.passed ? 'PASSED' : 'FAILED'}`;
		testDiv.appendChild(title);

		const details = this.createTestDetails(result);
		testDiv.appendChild(details);

		return testDiv;
	}

	/**
	 * Create test details element
	 * @param {Object} result - Test result object
	 * @returns {HTMLElement} Test details element
	 */
	createTestDetails(result) {
		const details = document.createElement('div');
		details.className = 'test-details';

		const tabId = `test-${result.testNumber}`;
		const outputMatch = result.actualOutput === result.expectedOutput ? '✓' : '✗';
		const stderrMatch = (!result.stderr || result.stderr.trim() === '') ? '✓' : '⚠';
		const exitCodeMatch = result.exitCode === result.expectedExitCode ? '✓' : '✗';

		details.innerHTML = `
			<p><strong>Arguments:</strong> ${result.arguments.length > 0 ? result.arguments.join(', ') : '(none)'}</p>
			
			<div class="result-tabs">
				<button class="result-tab active" data-tab="${tabId}-output">Output ${outputMatch}</button>
				<button class="result-tab" data-tab="${tabId}-stderr">Stderr ${stderrMatch}</button>
				<button class="result-tab" data-tab="${tabId}-exit">Exit Code ${exitCodeMatch}</button>
			</div>
			
			<div class="result-tab-content active" id="${tabId}-output">
				<div class="output-comparison">
					<div class="output-section">
						<strong>Expected Output:</strong>
						<pre><code>${this.escapeHtml(result.expectedOutput)}</code></pre>
					</div>
					<div class="output-section">
						<strong>Actual Output:</strong>
						<pre><code>${this.escapeHtml(result.actualOutput)}</code></pre>
					</div>
				</div>
			</div>
			
			<div class="result-tab-content" id="${tabId}-stderr">
				<strong>Standard Error:</strong>
				<pre><code>${this.escapeHtml(result.stderr || '(no stderr output)')}</code></pre>
			</div>
			
			<div class="result-tab-content" id="${tabId}-exit">
				<p><strong>Expected Exit Code:</strong> ${result.expectedExitCode}</p>
				<p><strong>Actual Exit Code:</strong> ${result.exitCode}</p>
				${result.error ? `<p class="error"><strong>Error:</strong> ${result.error}</p>` : ''}
			</div>
		`;

		return details;
	}

	/**
	 * Setup tab switching for results
	 */
	setupTabs() {
		const tabs = document.querySelectorAll('.result-tab');
		tabs.forEach(tab => {
			tab.addEventListener('click', (e) => {
				const targetId = e.target.dataset.tab;
				const parent = e.target.closest('.test-details');

				// Remove active from all tabs and contents in this test
				parent.querySelectorAll('.result-tab').forEach(t => t.classList.remove('active'));
				parent.querySelectorAll('.result-tab-content').forEach(c => c.classList.remove('active'));

				// Add active to clicked tab and its content
				e.target.classList.add('active');
				document.getElementById(targetId).classList.add('active');
			});
		});
	}

	/**
	 * Display error message
	 * @param {string} message - Error message
	 */
	displayError(message) {
		if (!this.resultsContainer) return;
		this.resultsContainer.innerHTML = `
			<div class="test-result failed">
				<h4>Error</h4>
				<p>${message}</p>
			</div>
		`;
	}

	/**
	 * Display no results message
	 */
	displayNoResults() {
		if (!this.resultsContainer) return;
		this.resultsContainer.innerHTML = '<p class="no-results">$ ./solution.sh - waiting for execution...</p>';
	}

	/**
	 * Escape HTML to prevent XSS
	 * @param {string} text - Text to escape
	 * @returns {string} Escaped text
	 */
	escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}
}

export default TestResults;

