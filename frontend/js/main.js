// frontend/js/main.js
import ApiService from './services/apiService.js';
import StorageService from './services/storageService.js';
import AuthComponent from './components/authComponent.js';
import ExerciseMenu from './components/exerciseMenu.js';
import TestResults from './components/testResults.js';
import Statistics from './components/statistics.js';
import { updateUrl, getExerciseIdFromUrl } from './utils/urlUtils.js';

/**
 * Main Application Class
 */
class ExerciseApp {
	constructor() {
		// Initialize services
		this.apiService = new ApiService();
		this.storageService = new StorageService();

		// Initialize components
		this.authComponent = new AuthComponent(this.apiService);
		this.exerciseMenu = new ExerciseMenu(this.storageService);
		this.testResults = new TestResults();
		this.statistics = new Statistics();

		// State
		this.currentExercise = null;
		this.codeEditor = null;
		this.exercises = [];

		// Make auth component globally accessible for button clicks
		window.authComponent = this.authComponent;

		this.init();
	}

	async init() {
		// Check authentication
		await this.authComponent.checkAuth();

		// Setup code editor
		this.setupCodeEditor();

		// Setup event listeners
		this.setupEventListeners();

		// Setup tabs
		this.setupTabs();

		// Load exercises
		await this.loadExercises();

		// Update progress display
		this.updateProgressDisplay();

		// Load exercise from URL if present
		const exerciseId = getExerciseIdFromUrl();
		if (exerciseId) {
			await this.loadExercise(exerciseId);
		}
	}

	setupCodeEditor() {
		const textarea = document.getElementById('code-editor');
		if (!textarea) return;

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

	setupTabs() {
		const testResultsTab = document.getElementById('test-results-tab');
		const testResultsContent = document.getElementById('test-results-content');
		const terminalContent = document.getElementById('terminal-content');

		if (testResultsTab) {
			testResultsTab.addEventListener('click', () => {
				testResultsTab.classList.add('active');
				if (testResultsContent) testResultsContent.style.display = 'block';
				if (terminalContent) terminalContent.style.display = 'none';
			});
		}
	}

	async loadExercises() {
		try {
			this.exercises = await this.apiService.getExercises();

			// Setup menu
			this.exerciseMenu.onExerciseSelect = (exerciseId) => this.loadExercise(exerciseId);
			this.exerciseMenu.populate(this.exercises);
		} catch (error) {
			console.error('Failed to load exercises:', error);
			if (error.message.includes('403')) {
				this.showVPNNotification();
			}
		}
	}

	async loadExercise(exerciseId) {
		try {
			const exercise = await this.apiService.getExercise(exerciseId);
			this.currentExercise = exercise;

			// Update URL
			updateUrl(exerciseId);

			// Update UI
			this.showExerciseView();
			document.getElementById('exercise-title').textContent = exercise.title;

			// Render description (markdown)
			const descriptionDiv = document.getElementById('exercise-description');
			descriptionDiv.innerHTML = marked.parse(exercise.description);

			// Load saved code or default
			const savedCode = this.storageService.getExerciseProgress(exerciseId)?.code;
			const startingCode = savedCode || '#!/bin/bash\n\n# Write your solution here\n';
			this.codeEditor.setValue(startingCode);

			// Refresh CodeMirror
			setTimeout(() => {
				this.codeEditor.refresh();
			}, 0);

			// Update UI
			this.updateCompletionStatus(exerciseId);
			this.exerciseMenu.setActive(exerciseId);
			this.testResults.displayNoResults();

			// Load statistics
			await this.loadStatistics(exerciseId);
		} catch (error) {
			console.error('Failed to load exercise:', error);
			this.testResults.displayError('Failed to load exercise');
		}
	}

	showExerciseView() {
		const welcomeScreen = document.getElementById('welcome-screen');
		const exerciseView = document.getElementById('exercise-view');

		if (welcomeScreen) welcomeScreen.style.display = 'none';
		if (exerciseView) exerciseView.style.display = 'block';
	}

	updateCompletionStatus(exerciseId) {
		const statusElement = document.getElementById('completion-status');
		if (!statusElement) return;

		const progress = this.storageService.getExerciseProgress(exerciseId);

		if (!progress) {
			statusElement.textContent = 'Not Started';
			statusElement.className = 'status-badge not-started';
		} else if (progress.completed) {
			statusElement.textContent = 'Completed';
			statusElement.className = 'status-badge completed';
		} else {
			statusElement.textContent = 'In Progress';
			statusElement.className = 'status-badge in-progress';
		}
	}

	async loadStatistics(exerciseId) {
		try {
			const stats = await this.apiService.getStatistics(exerciseId);
			this.statistics.display(stats);
		} catch (error) {
			console.error('Failed to load statistics:', error);
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
			const data = await this.apiService.runTests(this.currentExercise.id, code);

			// Display results
			this.testResults.display(data.results);

			// Display statistics
			if (data.statistics) {
				this.statistics.display(data.statistics);
			}

			// Update progress
			const allPassed = data.results.length > 0 && data.results.every(r => r.passed);
			this.updateProgress(this.currentExercise.id, code, allPassed);
		} catch (error) {
			this.testResults.displayError('Error running tests: ' + error.message);
			if (error.message.includes('403')) {
				this.showVPNNotification();
			}
		} finally {
			runButton.textContent = 'Run Tests';
			runButton.disabled = false;
		}
	}

	updateProgress(exerciseId, code, completed) {
		this.storageService.updateExerciseProgress(exerciseId, code, completed);
		this.updateCompletionStatus(exerciseId);
		this.updateProgressDisplay();
		this.exerciseMenu.populate(this.exercises); // Refresh to show completion
	}

	saveProgress() {
		if (!this.currentExercise) return;
		const code = this.codeEditor.getValue();
		const progress = this.storageService.getExerciseProgress(this.currentExercise.id);
		const completed = progress?.completed || false;
		this.storageService.updateExerciseProgress(this.currentExercise.id, code, completed);
	}

	updateProgressDisplay() {
		const progress = this.storageService.loadProgress();
		const totalExercises = this.exercises.length;
		const completedExercises = Object.values(progress).filter(p => p.completed).length;
		const percentage = totalExercises > 0 ? (completedExercises / totalExercises) * 100 : 0;

		const progressText = document.getElementById('progress-text');
		const progressFill = document.getElementById('progress-fill');

		if (progressText) {
			progressText.textContent = `Progress: ${completedExercises}/${totalExercises} exercises completed`;
		}
		if (progressFill) {
			progressFill.style.width = `${percentage}%`;
		}
	}

	resetCode() {
		if (!this.currentExercise) return;

		if (confirm('Are you sure you want to reset your code? This will remove all your changes.')) {
			const defaultCode = '#!/bin/bash\n\n# Write your solution here\n';
			this.codeEditor.setValue(defaultCode);
			this.updateProgress(this.currentExercise.id, defaultCode, false);
		}
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

	setupEventListeners() {
		const runTestsBtn = document.getElementById('run-tests');
		const resetCodeBtn = document.getElementById('reset-code');

		if (runTestsBtn) {
			runTestsBtn.addEventListener('click', () => this.runTests());
		}
		if (resetCodeBtn) {
			resetCodeBtn.addEventListener('click', () => this.resetCode());
		}

		// Handle browser back/forward
		window.addEventListener('popstate', () => {
			const exerciseId = getExerciseIdFromUrl();
			if (exerciseId) {
				this.loadExercise(exerciseId);
			}
		});
	}
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
	window.app = new ExerciseApp();
});

