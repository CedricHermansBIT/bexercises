// frontend/js/main.js
import ApiService from './services/apiService.js';
import StorageService from './services/storageService.js';
import AuthComponent from './components/authComponent.js';
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
		this.testResults = new TestResults();
		this.statistics = new Statistics();

		// State
		this.currentLanguage = 'bash'; // Default language
		this.currentExercise = null;
		this.codeEditor = null;
		this.exercises = [];

		// Make auth component globally accessible for button clicks
		window.authComponent = this.authComponent;

		this.init();
	}

	async init() {
		// Update time displays
		this.updateTime();
		setInterval(() => this.updateTime(), 1000);

		// Setup screens
		this.setupScreens();

		// Check authentication
		await this.authComponent.checkAuth();

		// Setup code editor
		this.setupCodeEditor();

		// Setup event listeners
		this.setupEventListeners();

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

	updateTime() {
		const now = new Date();
		const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
		const timeElements = document.querySelectorAll('.system-time');
		timeElements.forEach(el => el.textContent = timeString);
	}

	setupScreens() {
		// Get screen elements
		this.languageScreen = document.getElementById('language-screen');
		this.loginScreen = document.getElementById('login-screen');
		this.selectionScreen = document.getElementById('selection-screen');
		this.workspaceScreen = document.getElementById('workspace-screen');
		// Back to languages button
		const backToLanguagesBtn = document.getElementById('back-to-languages');
		if (backToLanguagesBtn) {
			backToLanguagesBtn.addEventListener('click', () => {
				this.showScreen('language');
				window.history.pushState({}, '', '/');
			});
		}

		// Back to selection button
		// Back button
		const backBtn = document.getElementById('back-to-selection');
		if (backBtn) {
			backBtn.addEventListener('click', () => {
				this.showScreen('selection');
				// Clear URL
				window.history.pushState({}, '', '/');
			});
		}
		// Language selection cards
		const languageCards = document.querySelectorAll('.language-card:not(.coming-soon)');
		languageCards.forEach(card => {
			card.addEventListener('click', () => {
				const language = card.dataset.language;
				this.selectLanguage(language);
			});
		});


		// Filter buttons
		const filterBtns = document.querySelectorAll('.filter-btn');
		filterBtns.forEach(btn => {
			btn.addEventListener('click', (e) => {
				filterBtns.forEach(b => b.classList.remove('active'));
				e.target.classList.add('active');
				this.filterExercises(e.target.dataset.filter);
			});
		});
	}
	selectLanguage(language) {
		this.currentLanguage = language;

		// Update language title in topbar
		const languageTitle = document.getElementById('language-title');
		if (languageTitle) {
			languageTitle.textContent = language;
		}

		// Load exercises for this language
		this.loadExercises();

		// Show selection screen
		this.showScreen('selection');
	}


	showScreen(screenName) {
		// Hide all screens
		document.querySelectorAll('.screen').forEach(screen => {
			screen.classList.remove('active');
		});

		// Show requested screen
		const screen = document.getElementById(`${screenName}-screen`);
		if (screen) {
			screen.classList.add('active');
		}
	}

	filterExercises(filter) {
		const cards = document.querySelectorAll('.exercise-card');
		const progress = this.storageService.loadProgress();

		cards.forEach(card => {
			const exerciseId = card.dataset.exerciseId;
			const isCompleted = progress[exerciseId]?.completed || false;

			if (filter === 'all') {
				card.style.display = 'block';
			// Update bash exercise count on language screen
			const bashCount = document.getElementById('bash-count');
			if (bashCount) {
				bashCount.textContent = `${this.exercises.length} exercises`;
			}

			} else if (filter === 'completed' && isCompleted) {
				card.style.display = 'block';
			} else if (filter === 'pending' && !isCompleted) {
				card.style.display = 'block';
			} else {
				card.style.display = 'none';
			}
		});
	}

	setupCodeEditor() {
		const textarea = document.getElementById('code-editor');
		if (!textarea) return;

		this.codeEditor = CodeMirror.fromTextArea(textarea, {
			mode: 'shell',
			theme: 'dracula',
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

	async loadExercises() {
		try {
			this.exercises = await this.apiService.getExercises();

			// Populate exercise cards
			this.populateExerciseCards();

			// Update progress
			this.updateProgressDisplay();
		} catch (error) {
			console.error('Failed to load exercises:', error);
			if (error.message.includes('403')) {
				this.showVPNNotification();
			}
		}
	}

	populateExerciseCards() {
		const grid = document.getElementById('exercises-grid');
		if (!grid) return;

		grid.innerHTML = '';
		const progress = this.storageService.loadProgress();

		this.exercises.forEach(exercise => {
			const isCompleted = progress[exercise.id]?.completed || false;
			const card = this.createExerciseCard(exercise, isCompleted);
			grid.appendChild(card);
		});
	}

	createExerciseCard(exercise, isCompleted) {
		const card = document.createElement('div');
		card.className = `exercise-card ${isCompleted ? 'completed' : ''}`;
		card.dataset.exerciseId = exercise.id;

		// Extract first paragraph from description
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = marked.parse(exercise.description);
		const firstP = tempDiv.querySelector('p')?.textContent || exercise.description.substring(0, 150);

		card.innerHTML = `
			<div class="card-header">
				<div>
					<div class="card-title">${exercise.title}</div>
				</div>
				<span class="card-badge ${isCompleted ? 'completed' : 'not-started'}">
					${isCompleted ? '✓ completed' : '○ pending'}
				</span>
			</div>
			<div class="card-description">${firstP}</div>
			<div class="card-footer">
				<span class="card-meta">${exercise.chapter || 'exercise'}</span>
				<span class="card-arrow">→</span>
			</div>
		`;

		card.addEventListener('click', () => {
			this.loadExercise(exercise.id);
		});

		return card;
	}

	async loadExercise(exerciseId) {
		try {
			const exercise = await this.apiService.getExercise(exerciseId);
			this.currentExercise = exercise;

			// Update URL
			updateUrl(exerciseId);

			// Show workspace screen
			this.showScreen('workspace');

			// Update topbar title
			const topbarTitle = document.getElementById('exercise-title-topbar');
			if (topbarTitle) {
				topbarTitle.textContent = exercise.title;
			}

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
			}, 100);

			// Update completion status
			this.updateCompletionStatus(exerciseId);
			this.testResults.displayNoResults();

			// Load statistics
			await this.loadStatistics(exerciseId);
		} catch (error) {
			console.error('Failed to load exercise:', error);
			this.testResults.displayError('Failed to load exercise');
		}
	}

	updateCompletionStatus(exerciseId) {
		const statusElement = document.getElementById('completion-status');
		if (!statusElement) return;

		const progress = this.storageService.getExerciseProgress(exerciseId);

		if (!progress) {
			statusElement.textContent = 'not started';
			statusElement.className = 'status-indicator';
		} else if (progress.completed) {
			statusElement.textContent = '✓ completed';
			statusElement.className = 'status-indicator completed';
		} else {
			statusElement.textContent = '○ in progress';
			statusElement.className = 'status-indicator in-progress';
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
		runButton.textContent = '⟳ running...';
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
			runButton.innerHTML = '<span>󰐊</span> run tests';
			runButton.disabled = false;
		}
	}

	updateProgress(exerciseId, code, completed) {
		this.storageService.updateExerciseProgress(exerciseId, code, completed);
		this.updateCompletionStatus(exerciseId);
		this.updateProgressDisplay();
		this.populateExerciseCards(); // Refresh cards to show completion status
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
			progressText.textContent = `${completedExercises}/${totalExercises} completed`;
		}
		if (progressFill) {
			progressFill.style.width = `${percentage}%`;
		}
	}

	resetCode() {
		if (!this.currentExercise) return;

		if (confirm('Reset your code? This will remove all your changes.')) {
			const defaultCode = '#!/bin/bash\n\n# Write your solution here\n';
			this.codeEditor.setValue(defaultCode);
			this.updateProgress(this.currentExercise.id, defaultCode, false);
		}
	}

	showVPNNotification() {
		alert('VPN Connection Required\n\nAccess to the exercises requires a VPN connection to the organization network.\nPlease connect to your VPN and refresh the page.');
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

