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
		const stderrMatch = (result.actualStderr || '') === (result.expectedStderr || '') ? '✓' : '✗';
		const exitCodeMatch = result.exitCode === result.expectedExitCode ? '✓' : '✗';

		// Check validation match
		let validationMatch = null;
		if (result.usedValidation && result.expectedValidationOutput) {
			validationMatch = (result.actualValidationOutput || '').trim() === result.expectedValidationOutput.trim() ? '✓' : '✗';
		}

		// Check output files match
		let filesMatch = '✓';
		if (result.outputFiles && result.outputFiles.length > 0) {
			filesMatch = result.outputFiles.every(f => f.matches) ? '✓' : '✗';
		}

		// Build tabs HTML
		let tabsHtml = `
			<div class="result-tabs">
				<button class="result-tab active" data-tab="${tabId}-output">Output ${outputMatch}</button>
				${result.usedValidation && result.validationQuery ? `<button class="result-tab" data-tab="${tabId}-validation">Validation ${validationMatch || ''}</button>` : ''}
				<button class="result-tab" data-tab="${tabId}-stderr">Stderr ${stderrMatch}</button>
				${result.outputFiles && result.outputFiles.length > 0 ? `<button class="result-tab" data-tab="${tabId}-files">Files ${filesMatch}</button>` : ''}
				<button class="result-tab" data-tab="${tabId}-exit">Exit Code ${exitCodeMatch}</button>
			</div>
		`;

		// Build file comparison HTML
		let filesTabHtml = '';
		if (result.outputFiles && result.outputFiles.length > 0) {
			let filesContent = '<div class="files-comparison">';
			result.outputFiles.forEach(file => {
				const statusIcon = file.matches ? '✓' : '✗';
				const statusColor = file.matches ? 'var(--accent-green)' : 'var(--accent-red)';

				filesContent += `
					<div class="file-result" style="margin-bottom: 1rem; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 4px; border-left: 3px solid ${statusColor};">
						<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
							<strong>${this.escapeHtml(file.filename)}</strong>
							<span style="color: ${statusColor};">${statusIcon} ${file.matches ? 'Match' : 'Mismatch'}</span>
						</div>
						${file.exists ? `
							<div style="font-size: 0.85rem; color: var(--text-muted);">
								<div>Expected: <code style="background: var(--bg-primary); padding: 0.2rem 0.4rem; border-radius: 3px;">${this.escapeHtml(file.expectedHash || 'N/A')}</code></div>
								<div>Actual: <code style="background: var(--bg-primary); padding: 0.2rem 0.4rem; border-radius: 3px;">${this.escapeHtml(file.actualHash || 'N/A')}</code></div>
								<div>Size: ${file.size || 0} bytes</div>
							</div>
						` : `
							<div style="color: var(--accent-red); font-size: 0.85rem;">${file.error || 'File not found'}</div>
						`}
					</div>
				`;
			});
			filesContent += '</div>';

			filesTabHtml = `
				<div class="result-tab-content" id="${tabId}-files">
					${filesContent}
				</div>
			`;
		}

		// Build validation tab HTML
		let validationTabHtml = '';
		if (result.usedValidation && result.validationQuery) {
			const expectedValHtml = this.formatDatabaseOutput(result.expectedValidationOutput || '');
			const actualValHtml = this.formatDatabaseOutput(result.actualValidationOutput || '');

			validationTabHtml = `
				<div class="result-tab-content" id="${tabId}-validation">
					<p><strong>Validation Query:</strong></p>
					<pre><code>${this.escapeHtml(result.validationQuery)}</code></pre>
					<div class="output-comparison">
						<div class="output-section">
							<strong>Expected Result:</strong>
							${expectedValHtml}
						</div>
						<div class="output-section">
							<strong>Actual Result:</strong>
							${actualValHtml}
						</div>
					</div>
				</div>
			`;
		}

		// For database exercises, create a unified comparison view
		let outputTabContent;
		if (result.isDatabaseExercise) {
			outputTabContent = this.createDatabaseComparisonView(result.expectedOutput, result.actualOutput, result.passed);
		} else {
			outputTabContent = `
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
			`;
		}

		details.innerHTML = `
			<p><strong>Arguments:</strong> ${result.arguments.length > 0 ? result.arguments.join(', ') : '(none)'}</p>
			
			${tabsHtml}
			
			<div class="result-tab-content active" id="${tabId}-output">
				${outputTabContent}
			</div>
			
			${validationTabHtml}
			
			<div class="result-tab-content" id="${tabId}-stderr">
				<div class="output-comparison">
					<div class="output-section">
						<strong>Expected STDERR:</strong>
						<pre><code>${this.escapeHtml(result.expectedStderr || '')}</code></pre>
					</div>
					<div class="output-section">
						<strong>Actual STDERR:</strong>
						<pre><code>${this.escapeHtml(result.actualStderr || result.stderr || '')}</code></pre>
					</div>
				</div>
			</div>
			
			${filesTabHtml}
			
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
		// Setup main tabs (Output, Stderr, Exit Code, etc.)
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

		// Setup comparison view toggle buttons
		const toggleBtns = document.querySelectorAll('.comparison-toggle .toggle-btn');
		toggleBtns.forEach(btn => {
			btn.addEventListener('click', (e) => {
				const viewType = e.target.dataset.view;
				const container = e.target.closest('.db-comparison-container');

				// Update button states
				container.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
				e.target.classList.add('active');

				// Update view visibility
				container.querySelectorAll('.comparison-view').forEach(v => v.classList.remove('active'));
				container.querySelector(`.${viewType}-view`).classList.add('active');
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
				<pre style="white-space: pre-wrap; word-wrap: break-word;"><code>${this.escapeHtml(message)}</code></pre>
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
	 * Create a unified comparison view for database exercise outputs
	 * @param {string} expectedOutput - Expected output string
	 * @param {string} actualOutput - Actual output string
	 * @param {boolean} passed - Whether the test passed
	 * @returns {string} HTML for the comparison view
	 */
	createDatabaseComparisonView(expectedOutput, actualOutput, passed) {
		const expectedData = this.parseTableData(expectedOutput);
		const actualData = this.parseTableData(actualOutput);

		// If both parsed successfully as tables, show unified comparison
		if (expectedData && actualData) {
			return this.buildComparisonTable(expectedData, actualData, passed);
		}

		// Fallback to side-by-side pre blocks
		return `
			<div class="output-comparison">
				<div class="output-section">
					<strong>Expected Output:</strong>
					${this.formatDatabaseOutput(expectedOutput)}
				</div>
				<div class="output-section">
					<strong>Actual Output:</strong>
					${this.formatDatabaseOutput(actualOutput)}
				</div>
			</div>
		`;
	}

	/**
	 * Parse table data from output string
	 * @param {string} output - Output string
	 * @returns {Object|null} Parsed table data {headers, rows} or null
	 */
	parseTableData(output) {
		if (!output || !output.trim()) {
			return { headers: [], rows: [] };
		}

		const lines = output.trim().split('\n').filter(line => line.trim());
		if (lines.length === 0) {
			return { headers: [], rows: [] };
		}

		const firstLine = lines[0];

		// Try tab-separated
		if (lines.some(line => line.includes('\t'))) {
			const headers = firstLine.split('\t').map(h => h.trim());
			const rows = lines.slice(1).map(line => {
				const cells = line.split('\t').map(c => c.trim());
				while (cells.length < headers.length) cells.push('');
				return cells.slice(0, headers.length);
			});
			return { headers, rows };
		}

		// Try multi-space separated
		const multiSpacePattern = /\s{2,}/;
		if (multiSpacePattern.test(firstLine)) {
			const headers = firstLine.split(multiSpacePattern).map(h => h.trim()).filter(h => h);
			if (headers.length > 1) {
				const rows = lines.slice(1).map(line => {
					const cells = line.split(multiSpacePattern).map(c => c.trim()).filter(c => c);
					while (cells.length < headers.length) cells.push('');
					return cells;
				});
				return { headers, rows };
			}
		}

		return null;
	}

	/**
	 * Build a comparison table showing expected vs actual with diff highlighting
	 * @param {Object} expected - Expected data {headers, rows}
	 * @param {Object} actual - Actual data {headers, rows}
	 * @param {boolean} passed - Whether test passed
	 * @returns {string} HTML table
	 */
	buildComparisonTable(expected, actual, passed) {
		// Check if headers match
		const headersMatch = JSON.stringify(expected.headers) === JSON.stringify(actual.headers);
		const maxRows = Math.max(expected.rows.length, actual.rows.length);
		const maxCols = Math.max(expected.headers.length, actual.headers.length);

		let html = '<div class="db-comparison-container">';

		// Summary
		if (passed) {
			html += '<div class="comparison-summary match"><span>✓</span> Output matches expected</div>';
		} else {
			const rowDiff = actual.rows.length - expected.rows.length;
			const colDiff = actual.headers.length - expected.headers.length;
			let diffMsg = 'Output differs: ';
			const diffs = [];
			if (!headersMatch) diffs.push('columns differ');
			if (rowDiff !== 0) diffs.push(`${Math.abs(rowDiff)} row${Math.abs(rowDiff) !== 1 ? 's' : ''} ${rowDiff > 0 ? 'extra' : 'missing'}`);
			if (diffs.length === 0) diffs.push('values differ');
			diffMsg += diffs.join(', ');
			html += `<div class="comparison-summary mismatch"><span>✗</span> ${diffMsg}</div>`;
		}

		// Toggle buttons for view mode
		html += `
			<div class="comparison-toggle">
				<button class="toggle-btn active" data-view="unified">Unified View</button>
				<button class="toggle-btn" data-view="split">Split View</button>
			</div>
		`;

		// Unified view (default)
		html += '<div class="comparison-view unified-view active">';
		html += '<div class="sql-result-table"><table>';

		// Headers
		html += '<thead><tr>';
		for (let i = 0; i < maxCols; i++) {
			const expHeader = expected.headers[i] || '';
			const actHeader = actual.headers[i] || '';
			const headerMatch = expHeader === actHeader;
			const headerClass = headerMatch ? '' : 'cell-mismatch';
			html += `<th class="${headerClass}">${this.escapeHtml(actHeader || expHeader)}</th>`;
		}
		html += '</tr></thead>';

		// Rows
		html += '<tbody>';
		for (let r = 0; r < maxRows; r++) {
			const expRow = expected.rows[r] || [];
			const actRow = actual.rows[r] || [];
			const rowMissing = r >= actual.rows.length;
			const rowExtra = r >= expected.rows.length;

			let rowClass = '';
			if (rowMissing) rowClass = 'row-missing';
			else if (rowExtra) rowClass = 'row-extra';

			html += `<tr class="${rowClass}">`;
			for (let c = 0; c < maxCols; c++) {
				const expVal = expRow[c] || '';
				const actVal = actRow[c] || '';
				const cellMatch = expVal === actVal;

				let cellClass = '';
				let cellContent = this.escapeHtml(actVal || expVal);

				if (rowMissing) {
					cellClass = 'cell-missing';
					cellContent = `<span class="expected-val">${this.escapeHtml(expVal)}</span>`;
				} else if (rowExtra) {
					cellClass = 'cell-extra';
				} else if (!cellMatch) {
					cellClass = 'cell-mismatch';
					cellContent = `<span class="actual-val">${this.escapeHtml(actVal)}</span><span class="expected-hint">expected: ${this.escapeHtml(expVal)}</span>`;
				}

				html += `<td class="${cellClass}">${cellContent}</td>`;
			}
			html += '</tr>';
		}
		html += '</tbody></table></div></div>';

		// Split view
		html += '<div class="comparison-view split-view">';
		html += '<div class="split-panel"><strong>Expected Output:</strong>' + this.buildSimpleTable(expected) + '</div>';
		html += '<div class="split-panel"><strong>Actual Output:</strong>' + this.buildSimpleTable(actual) + '</div>';
		html += '</div>';

		html += '</div>';

		return html;
	}

	/**
	 * Build a simple table from parsed data
	 * @param {Object} data - Table data {headers, rows}
	 * @returns {string} HTML table
	 */
	buildSimpleTable(data) {
		if (!data || data.headers.length === 0) {
			return '<pre><code>(empty)</code></pre>';
		}

		let html = '<div class="sql-result-table"><table>';
		html += '<thead><tr>';
		data.headers.forEach(h => {
			html += `<th>${this.escapeHtml(h)}</th>`;
		});
		html += '</tr></thead><tbody>';
		data.rows.forEach(row => {
			html += '<tr>';
			row.forEach(cell => {
				html += `<td>${this.escapeHtml(cell)}</td>`;
			});
			html += '</tr>';
		});
		html += '</tbody></table></div>';
		return html;
	}

	/**
	 * Format SQL/database output as HTML table if it looks like tabular data
	 * @param {string} output - Raw text output
	 * @returns {string} HTML formatted output
	 */
	formatDatabaseOutput(output) {
		if (!output || !output.trim()) {
			return `<pre><code></code></pre>`;
		}

		const lines = output.trim().split('\n');

		// Skip empty lines at the start
		const nonEmptyLines = lines.filter(line => line.trim());
		if (nonEmptyLines.length === 0) {
			return `<pre><code></code></pre>`;
		}

		// Check if output looks like a pipe-bordered table (e.g., | col1 | col2 |)
		const hasTableBorders = nonEmptyLines.some(line => /^\|.*\|$/.test(line.trim()));

		if (hasTableBorders) {
			// Parse pipe-bordered table format
			const dataLines = nonEmptyLines.filter(line => {
				const trimmed = line.trim();
				return trimmed.startsWith('|') && !trimmed.match(/^[+\-|]+$/);
			});

			if (dataLines.length >= 1) {
				const parseRow = (line) => {
					return line.split('|')
						.slice(1, -1)
						.map(cell => cell.trim());
				};

				const headerRow = parseRow(dataLines[0]);
				const dataRows = dataLines.slice(1).map(parseRow);

				return this.buildTableHtml(headerRow, dataRows);
			}
		}

		// Check if it's tab-separated (MariaDB default output format)
		const firstLine = nonEmptyLines[0];
		const hasTab = nonEmptyLines.some(line => line.includes('\t'));

		if (hasTab) {
            console.log("Detected tab-separated output");
			const headerRow = firstLine.split('\t').map(h => h.trim());
			const dataRows = nonEmptyLines.slice(1)
				.map(line => {
					const cells = line.split('\t').map(cell => cell.trim());
					// Pad with empty cells if needed
					while (cells.length < headerRow.length) {
						cells.push('');
					}
					return cells.slice(0, headerRow.length);
				});

			// Always render as table if we have tabs
			return this.buildTableHtml(headerRow, dataRows);
		}

		// Check if columns are separated by 2+ spaces (common in SQL output)
		const multiSpacePattern = /\s{2,}/;
		if (multiSpacePattern.test(firstLine) && nonEmptyLines.length >= 1) {
			const headerRow = firstLine.split(multiSpacePattern).map(h => h.trim()).filter(h => h);

			if (headerRow.length > 1) {
				const dataRows = nonEmptyLines.slice(1)
					.map(line => {
						const cells = line.split(multiSpacePattern).map(cell => cell.trim()).filter(c => c);
						// Pad with empty cells if needed
						while (cells.length < headerRow.length) {
							cells.push('');
						}
						return cells;
					});

				return this.buildTableHtml(headerRow, dataRows);
			}
		}
        console.log("Output does not match table formats");
		// Not a table format, return as pre with overflow handling
		return `<div class="sql-output-wrapper"><pre><code>${this.escapeHtml(output)}</code></pre></div>`;
	}

	/**
	 * Build HTML table from header and data rows
	 * @param {Array} headerRow - Array of header strings
	 * @param {Array} dataRows - Array of arrays of cell strings
	 * @returns {string} HTML table
	 */
	buildTableHtml(headerRow, dataRows) {
		let tableHtml = '<div class="sql-result-table"><table>';
		tableHtml += '<thead><tr>';
		headerRow.forEach(header => {
			tableHtml += `<th>${this.escapeHtml(header)}</th>`;
		});
		tableHtml += '</tr></thead><tbody>';

		dataRows.forEach(row => {
			tableHtml += '<tr>';
			row.forEach(cell => {
				tableHtml += `<td>${this.escapeHtml(cell)}</td>`;
			});
			tableHtml += '</tr>';
		});

		tableHtml += '</tbody></table></div>';
		return tableHtml;
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

