// frontend/js/pages/workspacePage.js
import ApiService from '../services/apiService.js';
import StorageService from '../services/storageService.js';
import AuthComponent from '../components/authComponent.js';
import TestResults from '../components/testResults.js';
import Statistics from '../components/statistics.js';

class WorkspacePage {
    constructor() {
        this.apiService = new ApiService();
        this.storageService = new StorageService();
        this.authComponent = new AuthComponent(this.apiService);
        this.testResults = new TestResults();
        this.statistics = new Statistics();

        // Make auth component globally accessible
        window.authComponent = this.authComponent;

        this.currentExercise = null;
        this.codeEditor = null;

        this.init();
    }

    async init() {
        // Check authentication - REQUIRED
        const isAuthenticated = await this.authComponent.checkAuth();
        if (!isAuthenticated) {
            window.location.href = './login.html';
            return;
        }

        // Update time display
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);

        // Setup code editor
        this.setupCodeEditor();

        // Setup event listeners
        this.setupEventListeners();

        // Setup logout
        this.setupLogout();

        // Get exercise ID from URL or session storage
        const urlParams = new URLSearchParams(window.location.search);
        const exerciseId = urlParams.get('exercise') || sessionStorage.getItem('selectedExercise');

        if (exerciseId) {
            await this.loadExercise(exerciseId);
        } else {
            // Redirect back to exercises page if no exercise selected
            window.location.href = './exercises.html';
        }
    }

    updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const timeElements = document.querySelectorAll('.system-time');
        timeElements.forEach(el => el.textContent = timeString);
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

    setupEventListeners() {
        // Back to selection button
        const backBtn = document.getElementById('back-to-selection');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = './exercises.html';
            });
        }

        // Run tests button
        const runTestsBtn = document.getElementById('run-tests');
        if (runTestsBtn) {
            runTestsBtn.addEventListener('click', () => this.runTests());
        }

        // Reset code button
        const resetCodeBtn = document.getElementById('reset-code');
        if (resetCodeBtn) {
            resetCodeBtn.addEventListener('click', () => this.resetCode());
        }
    }

    setupLogout() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.authComponent.logout();
            });
        }

        // Toggle dropdown
        const userMenu = document.getElementById('user-menu-workspace');
        if (userMenu) {
            userMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenu.classList.toggle('active');
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            const userMenu = document.getElementById('user-menu-workspace');
            if (userMenu) {
                userMenu.classList.remove('active');
            }
        });
    }

    async loadExercise(exerciseId) {
        try {
            const exercise = await this.apiService.getExercise(exerciseId);
            this.currentExercise = exercise;

            // Update URL
            const newUrl = `./workspace.html?exercise=${exerciseId}`;
            window.history.replaceState({}, '', newUrl);

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
        runButton.innerHTML = '<span>⟳</span> running...';
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
    }

    saveProgress() {
        if (!this.currentExercise) return;
        const code = this.codeEditor.getValue();
        const progress = this.storageService.getExerciseProgress(this.currentExercise.id);
        const completed = progress?.completed || false;
        this.storageService.updateExerciseProgress(this.currentExercise.id, code, completed);
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
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WorkspacePage();
});

