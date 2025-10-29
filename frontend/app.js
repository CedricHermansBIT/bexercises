/**
 * Main application logic for the Bash Programming Exercises website
 * Now using real bash execution with interactive terminal
 */
class ExerciseApp {
	constructor() {
		this.currentExercise = null;
		this.codeEditor = null;
		this.progress = this.loadProgress();
		this.currentUser = null;

		this.init();
	}

	async init() {
		// Check authentication first
		await this.checkAuth();

		this.setupCodeEditor();
		this.populateExerciseMenu();
		this.updateProgressDisplay();
		this.setupEventListeners();
		this.setupTabs();

		// Load first exercise if none selected
		const urlParams = new URLSearchParams(window.location.search);
		const exerciseId = urlParams.get('exercise');
		if (exerciseId) {
			this.loadExercise(exerciseId);
		}
	}

	// Authentication methods
	async checkAuth() {
		try {
			const response = await fetch('/auth/user');
			const data = await response.json();
			this.currentUser = data.user;
			this.updateAuthUI(data.user);
		} catch (error) {
			console.error('Auth check failed:', error);
			this.updateAuthUI(null);
		}
	}

	updateAuthUI(user) {
		const authSection = document.getElementById('auth-section');
		if (user) {
			authSection.innerHTML = `
				<div class="user-info">
					${user.picture ? `<img src="${user.picture}" alt="${user.name}" class="user-avatar">` : ''}
					<span class="user-name">${user.name || user.email}</span>
					<button onclick="app.logout()" class="btn-auth">Logout</button>
				</div>
			`;
		} else {
			authSection.innerHTML = `
				<button onclick="app.login()" class="btn-auth btn-google">
					<svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
						<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
						<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
						<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
						<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
						<path fill="none" d="M0 0h48v48H0z"/>
					</svg>
					Sign in with Google
				</button>
			`;
		}
	}

	login() {
		window.location.href = 'http://localhost:3000/auth/google';
	}

	logout() {
		if (confirm('Are you sure you want to logout?')) {
			window.location.href = '../auth/logout';
		}
	}

	setupTabs() {
		const testResultsTab = document.getElementById('test-results-tab');
		//const terminalTab = document.getElementById('terminal-tab');
		const testResultsContent = document.getElementById('test-results-content');
		const terminalContent = document.getElementById('terminal-content');

		testResultsTab.addEventListener('click', () => {
			testResultsTab.classList.add('active');
			//terminalTab.classList.remove('active');
			testResultsContent.style.display = 'block';
			terminalContent.style.display = 'none';
		});

		//terminalTab.addEventListener('click', () => {
		//	terminalTab.classList.add('active');
		//	testResultsTab.classList.remove('active');
		//	testResultsContent.style.display = 'none';
		//	terminalContent.style.display = 'block';

			// Initialize terminal when first shown
		//	this.initializeTerminal();
		//});
	}

	initializeTerminal() {
		const terminalContainer = document.getElementById('terminal');
		if (terminalContainer && !terminalContainer.hasChildNodes()) {
			this.bashRunner.mountTerminal(terminalContainer);
			this.bashRunner.writeToTerminal('Welcome to the interactive bash terminal!\r\nType commands to test your scripts.\r\n\r\n$ ');
		}
	}

	setupCodeEditor() {
		const textarea = document.getElementById('code-editor');
		this.codeEditor = CodeMirror.fromTextArea(textarea, {
			mode: 'shell',
			theme: 'monokai',
			lineNumbers: true,
			indentUnit: 4,
			lineWrapping: true,
			autoCloseBrackets: true,
			matchBrackets: true
		});

		// Auto-save code changes
		this.codeEditor.on('change', () => {
			if (this.currentExercise) {
				this.saveProgress();
			}
		});
	}

	async populateExerciseMenu() {
		const menu = document.getElementById('exercise-menu');
		menu.innerHTML = '';

		// fetch exercise list from server
		try {
			const resp = await fetch('/api/exercises');
			if (!resp.ok) {
				if (resp.status === 403) {
					this.showVPNNotification();
				}
				throw new Error('Failed to fetch exercises');
			}
			const exercisesFromServer = await resp.json();

			// Group exercises by chapter
			const chapters = {};
			exercisesFromServer.forEach(exercise => {
				const chapter = exercise.chapter || 'Uncategorized';
				if (!chapters[chapter]) {
					chapters[chapter] = [];
				}
				chapters[chapter].push(exercise);
			});

			// Sort exercises within each chapter by order
			Object.keys(chapters).forEach(chapter => {
				chapters[chapter].sort((a, b) => (a.order || 999) - (b.order || 999));
			});

			// Render chapters in order: Shell scripting first, then others
			const chapterOrder = ['Shell scripting', 'Additional exercises'];
			const remainingChapters = Object.keys(chapters).filter(c => !chapterOrder.includes(c));
			const allChapters = [...chapterOrder, ...remainingChapters].filter(c => chapters[c]);

			allChapters.forEach(chapterName => {
				const chapterHeader = document.createElement('li');
				chapterHeader.className = 'chapter-header';
				chapterHeader.innerHTML = `<h3>${chapterName}</h3>`;
				menu.appendChild(chapterHeader);

				chapters[chapterName].forEach((exercise, index) => {
					const li = document.createElement('li');
					const link = document.createElement('a');
					link.href = '#';
					link.className = 'exercise-item';
					link.innerHTML = `<span class="exercise-number">${index + 1}.</span> ${exercise.title}`;
					link.dataset.exerciseId = exercise.id;

					if (this.progress[exercise.id]?.completed) {
						link.classList.add('completed');
					}

					link.addEventListener('click', (e) => {
						e.preventDefault();
						this.loadExercise(exercise.id);
					});

					li.appendChild(link);
					menu.appendChild(li);
				});
			});
		} catch (err) {
			console.error(err);
			document.getElementById('exercise-menu').innerHTML = '<li>Error loading exercises</li>';
		}
	}

	async loadExercise(exerciseId) {
		// fetch metadata from server
		try {
			const resp = await fetch(`/api/exercises/${encodeURIComponent(exerciseId)}`);
			if (!resp.ok) return;
			const exercise = await resp.json();
			this.currentExercise = exercise;
			//console.log(exercise);
			// update url, UI, description and code editor as before
			const url = new URL(window.location);
			url.searchParams.set('exercise', exerciseId);
			window.history.pushState({}, '', url);

		document.getElementById('welcome-screen').style.display = 'none';
		document.getElementById('exercise-view').style.display = 'block';
		document.getElementById('exercise-title').textContent = exercise.title;

		const descriptionDiv = document.getElementById('exercise-description');
		descriptionDiv.innerHTML = marked.parse(exercise.description);

		// Load saved code or default
		const savedCode = this.progress[exerciseId]?.code;
		const startingCode = savedCode || '#!/bin/bash\n\n# Write your solution here\n';
		this.codeEditor.setValue(startingCode);
		
		// Refresh CodeMirror to fix layout after showing the exercise view
		setTimeout(() => {
			this.codeEditor.refresh();
		}, 0);

		this.updateCompletionStatus(exerciseId);
		document.querySelectorAll('.exercise-item').forEach(item => item.classList.remove('active'));
		const active = document.querySelector(`[data-exercise-id="${exerciseId}"]`);
		if (active) active.classList.add('active');

		document.getElementById('test-results').innerHTML = '<p class="no-results">Run tests to see results here.</p>';
		
		// Load and display statistics for this exercise
		this.loadExerciseStatistics(exerciseId);

	} catch (err) {
		console.error(err);
		this.displayError('Failed to load exercise metadata');
	}
	}

	updateCompletionStatus(exerciseId) {
		const statusElement = document.getElementById('completion-status');
		const progress = this.progress[exerciseId];

		if (!progress) {
			statusElement.textContent = 'Not Started';
			statusElement.className = 'status-badge not-started';
		} else if (progress.completed) {
			statusElement.textContent = 'Completed';
			statusElement.className = 'status-badge completed';
		} else {
			statusElement.textContent = 'In Progress'; statusElement.className = 'status-badge in-progress'; 
		} 
	} 

	async runTests() {
		if (!this.currentExercise) return;

		const code = this.codeEditor.getValue();
		const runButton = document.getElementById('run-tests');

		// Show loading state
		runButton.textContent = 'Running...';
		runButton.disabled = true;

		try {
			// Post script to server (server runs tests using its copy of test cases)
			const resp = await fetch(`/api/exercises/${encodeURIComponent(this.currentExercise.id)}/run`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ script: code })
			});

			if (!resp.ok) {
				const err = await resp.json().catch(()=>({ error: 'unknown' }));
				this.displayError(`Server error: ${resp.status} ${err.error || ''}`);
				return;
			}

			const data = await resp.json();
			//console.log(data);
			const results = data.results || [];
			// Adapt display
			// Map server results to the format your existing displayTestResults expects:
			const mapped = results.map(r => ({
				testNumber: r.testNumber,
				arguments: r.arguments || [],
				expectedOutput: r.expectedOutput,
				expectedExitCode: r.expectedExitCode,
				actualOutput: r.actualOutput,
				exitCode: r.exitCode,
				stderr: r.stderr || '',
				error: r.error || (r.timedOut ? 'TIMEOUT' : null),
				passed: r.passed
			}));

			this.displayTestResults(mapped);
			
			// Update statistics display
			if (data.statistics) {
				this.displayStatistics(data.statistics);
			}

			const allPassed = mapped.length > 0 && mapped.every(tt => tt.passed);
			this.updateExerciseProgress(this.currentExercise.id, code, allPassed);

		} catch (error) {
			this.displayError('Error running tests: ' + error.message);
		} finally {
			runButton.textContent = 'Run Tests';
			runButton.disabled = false;
		}
	}

	async testInteractive() {
		if (!this.currentExercise) return;

		// Switch to terminal tab
		document.getElementById('terminal-tab').click();

		// Initialize terminal if not already done
		this.initializeTerminal();

		// Run the script in the terminal
		const code = this.codeEditor.getValue();
		const args = ['arg1', 'arg2']; // Default test arguments

		try {
			this.bashRunner.clearTerminal();
			this.bashRunner.writeToTerminal('Running your script...\r\n');

			const result = await this.bashRunner.executeScript(code, args);
			this.bashRunner.writeToTerminal(result.output);
			this.bashRunner.writeToTerminal(`\r\nExit code: ${result.exitCode}\r\n$ `);
		} catch (error) {
			this.bashRunner.writeToTerminal(`Error: ${error.message}\r\n$ `);
		}
	}

	runScriptInTerminal() {
		if (!this.currentExercise) return;

		const code = this.codeEditor.getValue();
		// Get arguments from a simple prompt for now
		const argsInput = prompt('Enter arguments (space-separated):') || '';
		const args = argsInput.trim() ? argsInput.split(' ') : [];

		this.bashRunner.executeScript(code, args)
			.then(result => {
				this.bashRunner.writeToTerminal('\r\n' + result.output);
				this.bashRunner.writeToTerminal(`\r\nExit code: ${result.exitCode}\r\n$ `);
			})
			.catch(error => {
				this.bashRunner.writeToTerminal(`\r\nError: ${error.message}\r\n$ `);
			});
	}

	clearTerminal() {
		this.bashRunner.clearTerminal();
		this.bashRunner.writeToTerminal('$ ');
	}

	displayTestResults(results) {
		const resultsContainer = document.getElementById('test-results');
		resultsContainer.innerHTML = '';

		if (results.length === 0) {
			resultsContainer.innerHTML = '<p class="no-results">No test cases available for this exercise.</p>';
			return;
		}

		results.forEach(result => {
			const testDiv = document.createElement('div');
			testDiv.className = `test-result ${result.passed ? 'passed' : 'failed'}`;

			const title = document.createElement('h4');
			const statusIcon = result.passed ? '✓' : '✗';
			title.innerHTML = `<span class="status-icon">${statusIcon}</span> Test ${result.testNumber}: ${result.passed ? 'PASSED' : 'FAILED'}`;
			testDiv.appendChild(title);

			const details = document.createElement('div');
			details.className = 'test-details';

			const tabId = `test-${result.testNumber}`;
			details.innerHTML = `
				<p><strong>Arguments:</strong> ${result.arguments.length > 0 ? result.arguments.join(', ') : '(none)'}</p>
				
				<div class="result-tabs">
					<button class="result-tab active" data-tab="${tabId}-output">Output ${result.actualOutput === result.expectedOutput ? '✓' : '✗'}</button>
					<button class="result-tab" data-tab="${tabId}-stderr">Stderr ${(!result.stderr || result.stderr.trim() === '') ? '✓' : '⚠'}</button>
					<button class="result-tab" data-tab="${tabId}-exit">Exit Code ${result.exitCode === result.expectedExitCode ? '✓' : '✗'}</button>
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
			`;

			testDiv.appendChild(details);
			resultsContainer.appendChild(testDiv);
		});

		// Add summary
		const passedCount = results.filter(r => r.passed).length;
		const summary = document.createElement('div');
		summary.className = 'test-summary';
		summary.innerHTML = `<h4>Summary: ${passedCount}/${results.length} tests passed</h4>`;
		resultsContainer.insertBefore(summary, resultsContainer.firstChild);

		// Add tab switching functionality
		this.setupResultTabs();
	}

	setupResultTabs() {
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

	showVPNNotification() {
		const notification = document.createElement('div');
		notification.className = 'vpn-notification';
		notification.innerHTML = `
			<div class="vpn-notification-content">
				<h3>🔒 VPN Connection Required</h3>
				<p>Access to the exercises requires a VPN connection to the organization network.</p>
				<p>Please connect to your VPN and refresh the page.</p>
				<button onclick="location.reload()">Refresh Page</button>
			</div>
		`;
		document.body.appendChild(notification);
	}

	displayStatistics(stats) {
		const statsContainer = document.getElementById('statistics-panel');
		if (!statsContainer) return;

		const successRate = stats.totalAttempts > 0 
			? ((stats.successfulAttempts / stats.totalAttempts) * 100).toFixed(1)
			: 0;

		let failureBreakdown = '';
		if (stats.failedAttempts > 0 && stats.failureReasons) {
			const reasons = Object.entries(stats.failureReasons)
				.map(([reason, count]) => {
					const icon = {
						'timeout': '⏱️',
						'wrong_exit_code': '🚪',
						'wrong_output': '📝',
						'error': '❌',
						'unknown': '❓'
					}[reason] || '❓';
					const label = {
						'timeout': 'Timeout',
						'wrong_exit_code': 'Wrong Exit Code',
						'wrong_output': 'Wrong Output',
						'error': 'Error',
						'unknown': 'Unknown'
					}[reason] || reason;
					return `<div class="failure-reason">${icon} ${label}: ${count}</div>`;
				})
				.join('');
			failureBreakdown = `<div class="failure-breakdown">${reasons}</div>`;
		}

		statsContainer.innerHTML = `
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

	async loadExerciseStatistics(exerciseId) {
		try {
			const resp = await fetch(`/api/statistics/${encodeURIComponent(exerciseId)}`);
			if (!resp.ok) return;
			const stats = await resp.json();
			this.displayStatistics(stats);
		} catch (err) {
			console.error('Failed to load statistics:', err);
		}
	}

	displayError(message) {
		const resultsContainer = document.getElementById('test-results');
		if (message.includes('403') || message.includes('Forbidden')) {
			this.showVPNNotification();
		}
		resultsContainer.innerHTML = `<div class="test-result failed"><h4>Error</h4><p>${message}</p></div>`;
	}

	escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	resetCode() {
		if (confirm('Are you sure you want to reset your code? This will remove all your changes.')) {
			this.codeEditor.setValue('#!/bin/bash\n\n# Write your solution here\n');
			this.updateExerciseProgress(this.currentExercise.id, '#!/bin/bash\n\n# Write your solution here\n', false);
			this.saveProgress();
		}
	}

	showSolution() {
		if (!this.currentExercise) return;

		if (confirm('Are you sure you want to see the solution? This will replace your current code.')) {
			this.codeEditor.setValue(this.currentExercise.solution);
			this.saveProgress();
		}
	}

	updateExerciseProgress(exerciseId, code, completed) {
		if (!this.progress[exerciseId]) {
			this.progress[exerciseId] = {};
		}

		this.progress[exerciseId].code = code;
		this.progress[exerciseId].completed = completed;
		this.progress[exerciseId].lastModified = new Date().toISOString();

		this.saveProgress();
		this.updateCompletionStatus(exerciseId);
		this.updateProgressDisplay();
		this.populateExerciseMenu(); // Refresh to show completion status
	}

	saveProgress() {
		localStorage.setItem('bash-exercises-progress', JSON.stringify(this.progress));
	}

	loadProgress() {
		const saved = localStorage.getItem('bash-exercises-progress');
		return saved ? JSON.parse(saved) : {};
	}

	updateProgressDisplay() {
		const totalExercises = exercises.length;
		const completedExercises = Object.values(this.progress).filter(p => p.completed).length;
		const percentage = totalExercises > 0 ? (completedExercises / totalExercises) * 100 : 0;

		document.getElementById('progress-text').textContent =
			`Progress: ${completedExercises}/${totalExercises} exercises completed`;
		document.getElementById('progress-fill').style.width = `${percentage}%`;
	}

	setupEventListeners() {
		document.getElementById('run-tests').addEventListener('click', () => this.runTests());
		//document.getElementById('test-interactive').addEventListener('click', () => this.testInteractive());
		document.getElementById('reset-code').addEventListener('click', () => this.resetCode());
		//document.getElementById('show-solution').addEventListener('click', () => this.showSolution());

		// Terminal controls
		//document.getElementById('clear-terminal').addEventListener('click', () => this.clearTerminal());
		//document.getElementById('run-script').addEventListener('click', () => this.runScriptInTerminal());

		// Handle browser back/forward
		window.addEventListener('popstate', () => {
			const urlParams = new URLSearchParams(window.location.search);
			const exerciseId = urlParams.get('exercise');
			if (exerciseId) {
				this.loadExercise(exerciseId);
			}
		});
	}
}

// Initialize the app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
	app = new ExerciseApp();
});
