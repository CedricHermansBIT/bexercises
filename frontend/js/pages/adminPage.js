import ApiService from '../services/apiService.js';
import AuthComponent from '../components/authComponent.js';

class AdminPage {
    constructor() {
        this.apiService = new ApiService();
        this.authComponent = new AuthComponent(this.apiService);

        window.authComponent = this.authComponent;

        this.exercises = [];
        this.currentExercise = null;
        this.solutionEditor = null;
        this.testOutput = null;

        this.init();
    }

    async init() {
        // Check authentication - REQUIRED
        const isAuthenticated = await this.authComponent.checkAuth();
        if (!isAuthenticated) {
            window.location.href = './login.html';
            return;
        }

        // Check admin privileges
        if (!this.authComponent.isAdmin()) {
            alert('Access denied. Admin privileges required.');
            window.location.href = './languages.html';
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

        // Load exercises
        await this.loadExercises();
    }

    updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        document.getElementById('system-time').textContent = timeString;
    }

    setupCodeEditor() {
        const textarea = document.getElementById('exercise-solution');
        this.solutionEditor = CodeMirror.fromTextArea(textarea, {
            mode: 'shell',
            theme: 'dracula',
            lineNumbers: true,
            indentUnit: 4,
            lineWrapping: true
        });
    }

    setupEventListeners() {
        document.getElementById('back-to-languages').addEventListener('click', () => {
            window.location.href = './languages.html';
        });

        document.getElementById('new-exercise-btn').addEventListener('click', () => {
            this.createNewExercise();
        });

        document.getElementById('test-solution-btn').addEventListener('click', () => {
            this.testSolution();
        });

        document.getElementById('save-exercise-btn').addEventListener('click', () => {
            this.saveExercise();
        });

        document.getElementById('cancel-edit-btn').addEventListener('click', () => {
            this.cancelEdit();
        });

        document.getElementById('modify-solution-btn').addEventListener('click', () => {
            this.modifyProceed();
        });

        document.getElementById('discard-btn').addEventListener('click', () => {
            this.discardExercise();
        });
    }

    setupLogout() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.authComponent.logout();
            });
        }

        // Toggle dropdown
        const userMenu = document.getElementById('user-menu-admin');
        if (userMenu) {
            userMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenu.classList.toggle('active');
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            const userMenu = document.getElementById('user-menu-admin');
            if (userMenu) {
                userMenu.classList.remove('active');
            }
        });
    }

    async loadExercises() {
        try {
            this.exercises = await this.apiService.getExercises();
            this.populateExerciseList();
        } catch (error) {
            console.error('Failed to load exercises:', error);
        }
    }

    populateExerciseList() {
        const list = document.getElementById('exercises-list');
        list.innerHTML = '';

        // Group by chapter
        const chapters = {};
        this.exercises.forEach(ex => {
            const chapter = ex.chapter || 'Uncategorized';
            if (!chapters[chapter]) chapters[chapter] = [];
            chapters[chapter].push(ex);
        });

        Object.keys(chapters).sort().forEach(chapter => {
            const chapterDiv = document.createElement('div');
            chapterDiv.className = 'exercise-group';
            chapterDiv.innerHTML = `<div class="group-title">${chapter}</div>`;

            chapters[chapter].sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(ex => {
                const item = document.createElement('div');
                item.className = 'exercise-item';
                item.innerHTML = `
                    <span class="exercise-name">${ex.order}. ${ex.title}</span>
                    <div class="exercise-actions">
                        <button class="icon-btn" data-action="edit" data-id="${ex.id}" title="Edit">
                            <span>✎</span>
                        </button>
                        <button class="icon-btn delete" data-action="delete" data-id="${ex.id}" title="Delete">
                            <span>🗑</span>
                        </button>
                    </div>
                `;
                chapterDiv.appendChild(item);
            });

            list.appendChild(chapterDiv);
        });

        // Add event listeners
        list.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').dataset.id;
                this.editExercise(id);
            });
        });

        list.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').dataset.id;
                this.deleteExercise(id);
            });
        });
    }

    createNewExercise() {
        this.currentExercise = null;
        document.getElementById('editor-title').textContent = 'New Exercise';
        document.getElementById('exercise-id').value = '';
        document.getElementById('exercise-id').disabled = false;
        document.getElementById('exercise-title').value = '';
        document.getElementById('exercise-chapter').value = 'Shell scripting';
        document.getElementById('exercise-order').value = '';
        document.getElementById('exercise-description').value = '';
        this.solutionEditor.setValue('#!/bin/bash\n\n# Write the solution here\n');

        document.getElementById('admin-welcome').style.display = 'none';
        document.getElementById('exercise-editor').style.display = 'block';
        document.getElementById('test-preview').style.display = 'none';

        // Refresh CodeMirror after display to fix rendering
        setTimeout(() => {
            this.solutionEditor.refresh();
        }, 100);
    }

    async editExercise(id) {
        try {
            const exercise = await this.apiService.getExercise(id);
            this.currentExercise = exercise;

            document.getElementById('editor-title').textContent = 'Edit Exercise';
            document.getElementById('exercise-id').value = exercise.id;
            document.getElementById('exercise-id').disabled = true;
            document.getElementById('exercise-title').value = exercise.title;
            document.getElementById('exercise-chapter').value = exercise.chapter || 'Shell scripting';
            document.getElementById('exercise-order').value = exercise.order || '';
            document.getElementById('exercise-description').value = exercise.description;
            this.solutionEditor.setValue(exercise.solution);

            document.getElementById('admin-welcome').style.display = 'none';
            document.getElementById('exercise-editor').style.display = 'block';
            document.getElementById('test-preview').style.display = 'none';

            // Refresh CodeMirror after display to fix rendering
            setTimeout(() => {
                this.solutionEditor.refresh();
            }, 100);
        } catch (error) {
            alert('Failed to load exercise: ' + error.message);
        }
    }

    async deleteExercise(id) {
        if (!confirm('Are you sure you want to delete this exercise?')) return;

        try {
            await this.apiService.deleteExercise(id);
            await this.loadExercises();
            if (this.currentExercise?.id === id) {
                this.cancelEdit();
            }
        } catch (error) {
            alert('Failed to delete exercise: ' + error.message);
        }
    }

    async testSolution() {
        const solution = this.solutionEditor.getValue();

        if (!solution.trim()) {
            alert('Please enter a solution script');
            return;
        }

        const testBtn = document.getElementById('test-solution-btn');
        testBtn.innerHTML = '<span>⟳</span> Testing...';
        testBtn.disabled = true;

        try {
            const result = await this.apiService.testExerciseSolution(solution);

            this.testOutput = result.output;

            document.getElementById('test-output').innerHTML = `
                <pre>${this.escapeHtml(result.output)}</pre>
                ${result.exitCode !== undefined ? `<div class="exit-code">Exit Code: ${result.exitCode}</div>` : ''}
            `;

            document.getElementById('test-preview').style.display = 'block';
            document.getElementById('save-exercise-btn').textContent =
                this.currentExercise ? '󰆓 Update Exercise' : '󰆓 Create Exercise';
        } catch (error) {
            alert('Failed to test solution: ' + error.message);
        } finally {
            testBtn.innerHTML = '<span>󰐊</span> Test Solution';
            testBtn.disabled = false;
        }
    }

    async saveExercise() {
        const exerciseData = {
            id: document.getElementById('exercise-id').value.trim(),
            title: document.getElementById('exercise-title').value.trim(),
            chapter: document.getElementById('exercise-chapter').value,
            order: parseInt(document.getElementById('exercise-order').value) || 0,
            description: document.getElementById('exercise-description').value.trim(),
            solution: this.solutionEditor.getValue(),
            expectedOutput: this.testOutput
        };

        // Validation
        if (!exerciseData.id || !exerciseData.title || !exerciseData.description || !exerciseData.solution) {
            alert('Please fill in all required fields');
            return;
        }

        if (!/^[a-z0-9-]+$/.test(exerciseData.id)) {
            alert('Exercise ID must contain only lowercase letters, numbers, and hyphens');
            return;
        }

        if (!this.testOutput) {
            alert('Please test the solution first');
            return;
        }

        const saveBtn = document.getElementById('save-exercise-btn');
        saveBtn.disabled = true;

        try {
            if (this.currentExercise) {
                await this.apiService.updateExercise(exerciseData.id, exerciseData);
            } else {
                await this.apiService.createExercise(exerciseData);
            }

            alert('Exercise saved successfully!');
            await this.loadExercises();
            this.cancelEdit();
        } catch (error) {
            alert('Failed to save exercise: ' + error.message);
        } finally {
            saveBtn.disabled = false;
        }
    }

    modifyProceed() {
        document.getElementById('test-preview').style.display = 'none';
        // Refresh CodeMirror after hiding preview
        setTimeout(() => {
            this.solutionEditor.refresh();
            this.solutionEditor.focus();
        }, 100);
    }

    discardExercise() {
        if (confirm('Discard all changes?')) {
            this.cancelEdit();
        }
    }

    cancelEdit() {
        this.currentExercise = null;
        this.testOutput = null;
        document.getElementById('exercise-editor').style.display = 'none';
        document.getElementById('admin-welcome').style.display = 'flex';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AdminPage();
});

