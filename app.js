/**
 * Main application logic for the Bash Programming Exercises website
 * Now using real bash execution with interactive terminal
 */
class ExerciseApp {
    constructor() {
        this.currentExercise = null;
        this.codeEditor = null;
        this.testRunner = new TestRunner();
        this.bashRunner = new BashRunner();
        this.progress = this.loadProgress();

        this.init();
    }

    init() {
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

    setupTabs() {
        const testResultsTab = document.getElementById('test-results-tab');
        const terminalTab = document.getElementById('terminal-tab');
        const testResultsContent = document.getElementById('test-results-content');
        const terminalContent = document.getElementById('terminal-content');

        testResultsTab.addEventListener('click', () => {
            testResultsTab.classList.add('active');
            terminalTab.classList.remove('active');
            testResultsContent.style.display = 'block';
            terminalContent.style.display = 'none';
        });

        terminalTab.addEventListener('click', () => {
            terminalTab.classList.add('active');
            testResultsTab.classList.remove('active');
            testResultsContent.style.display = 'none';
            terminalContent.style.display = 'block';

            // Initialize terminal when first shown
            this.initializeTerminal();
        });
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

    populateExerciseMenu() {
        const menu = document.getElementById('exercise-menu');
        menu.innerHTML = '';

        exercises.forEach(exercise => {
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'exercise-item';
            link.textContent = exercise.title;
            link.dataset.exerciseId = exercise.id;

            // Add completion status
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
    }

    loadExercise(exerciseId) {
        const exercise = exercises.find(ex => ex.id === exerciseId);
        if (!exercise) return;

        this.currentExercise = exercise;

        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('exercise', exerciseId);
        window.history.pushState({}, '', url);

        // Update UI
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('exercise-view').style.display = 'block';
        document.getElementById('exercise-title').textContent = exercise.title;

        // Load description
        const descriptionDiv = document.getElementById('exercise-description');
        descriptionDiv.innerHTML = marked.parse(exercise.description);

        // Load saved code or start with template
        const savedCode = this.progress[exerciseId]?.code;
        const startingCode = savedCode || '#!/bin/bash\n\n# Write your solution here\n';
        this.codeEditor.setValue(startingCode);

        // Update completion status
        this.updateCompletionStatus(exerciseId);

        // Update active menu item
        document.querySelectorAll('.exercise-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-exercise-id="${exerciseId}"]`).classList.add('active');

        // Clear previous test results
        document.getElementById('test-results').innerHTML = '<p class="no-results">Run tests to see results here.</p>';
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
            statusElement.textContent = 'In Progress';
            statusElement.className = 'status-badge in-progress';
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
            const results = await this.testRunner.runTests(code, this.currentExercise.testCases);
            console.log('Test results:', results);
            this.displayTestResults(results);

            // Update progress
            const allPassed = results.every(result => result.passed);
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
            title.textContent = `Test ${result.testNumber}: ${result.passed ? 'PASSED' : 'FAILED'}`;
            testDiv.appendChild(title);

            const details = document.createElement('div');
            details.className = 'test-details';

            details.innerHTML = `
                <p><strong>Arguments:</strong> ${result.arguments.join(', ')}</p>
                <p><strong>Expected Output:</strong></p>
                <pre><code>${this.escapeHtml(result.expectedOutput)}</code></pre>
                <p><strong>Actual Output:</strong></p>
                <pre><code>${this.escapeHtml(result.actualOutput)}</code></pre>
                ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ''}
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
    }

    displayError(message) {
        const resultsContainer = document.getElementById('test-results');
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
        document.getElementById('test-interactive').addEventListener('click', () => this.testInteractive());
        document.getElementById('reset-code').addEventListener('click', () => this.resetCode());
        document.getElementById('show-solution').addEventListener('click', () => this.showSolution());

        // Terminal controls
        document.getElementById('clear-terminal').addEventListener('click', () => this.clearTerminal());
        document.getElementById('run-script').addEventListener('click', () => this.runScriptInTerminal());

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
document.addEventListener('DOMContentLoaded', () => {
    new ExerciseApp();
});
