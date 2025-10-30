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
        this.testCases = [];
        this.fixtureFiles = [];
        this.reorderMode = false;
        this.originalOrder = null;

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
        const addListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            } else {
                console.warn(`Element with id '${id}' not found`);
            }
        };

        addListener('back-to-languages', 'click', () => {
            window.location.href = './languages.html';
        });

        addListener('new-exercise-btn', 'click', () => {
            this.createNewExercise();
        });

        addListener('new-chapter-btn', 'click', () => {
            this.createNewChapter();
        });

        addListener('test-solution-btn', 'click', () => {
            this.testSolution();
        });

        addListener('save-exercise-btn', 'click', () => {
            this.saveExercise();
        });

        addListener('cancel-edit-btn', 'click', () => {
            this.cancelEdit();
        });

        addListener('modify-solution-btn', 'click', () => {
            this.modifyProceed();
        });

        addListener('discard-btn', 'click', () => {
            this.discardExercise();
        });

        addListener('add-test-case-btn', 'click', () => {
            this.addTestCase();
        });

        addListener('upload-fixtures-btn', 'click', () => {
            const fixtureInput = document.getElementById('fixture-files');
            if (fixtureInput) fixtureInput.click();
        });

        addListener('fixture-files', 'change', (e) => {
            this.handleFixtureUpload(e);
        });

        addListener('exercise-chapter', 'change', (e) => {
            this.handleChapterChange(e);
        });

        addListener('reorder-mode-btn', 'click', () => {
            this.toggleReorderMode();
        });

        addListener('save-order-btn', 'click', () => {
            this.saveNewOrder();
        });

        addListener('cancel-order-btn', 'click', () => {
            this.cancelReorder();
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
            chapterDiv.dataset.chapter = chapter;
            chapterDiv.innerHTML = `<div class="group-title">${chapter}</div>`;

            chapters[chapter].sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(ex => {
                const item = document.createElement('div');
                item.className = 'exercise-item';
                item.dataset.id = ex.id;
                item.dataset.chapter = chapter;
                item.draggable = this.reorderMode;

                const dragHandleDisplay = this.reorderMode ? 'inline' : 'none';
                const actionsDisplay = this.reorderMode ? 'none' : 'flex';

                item.innerHTML = `
                    <span class="drag-handle" style="display: ${dragHandleDisplay}">⋮⋮</span>
                    <span class="exercise-name">${ex.order}. ${ex.title}</span>
                    <div class="exercise-actions" style="display: ${actionsDisplay}">
                        <button class="icon-btn" data-action="edit" data-id="${ex.id}" title="Edit">
                            <span>✎</span>
                        </button>
                        <button class="icon-btn delete" data-action="delete" data-id="${ex.id}" title="Delete">
                            <span>🗑</span>
                        </button>
                    </div>
                `;

                if (this.reorderMode) {
                    this.addDragListeners(item);
                }

                chapterDiv.appendChild(item);
            });

            list.appendChild(chapterDiv);
        });

        if (!this.reorderMode) {
            // Add event listeners for edit/delete
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
    }

    createNewExercise() {
        this.currentExercise = null;
        this.testCases = [];
        this.fixtureFiles = [];

        document.getElementById('editor-title').textContent = 'New Exercise';
        document.getElementById('exercise-id').value = '';
        document.getElementById('exercise-id').disabled = false;
        document.getElementById('exercise-title').value = '';
        document.getElementById('exercise-chapter').value = 'Shell scripting';
        document.getElementById('exercise-order').value = '';
        document.getElementById('exercise-description').value = '';
        this.solutionEditor.setValue('#!/bin/bash\n\n# Write the solution here\n');

        this.renderTestCases();
        this.renderFixtures();
        this.updateChapterOptions();

        document.getElementById('admin-welcome').style.display = 'none';
        document.getElementById('exercise-editor').style.display = 'block';
        document.getElementById('test-preview').style.display = 'none';

        // Refresh CodeMirror after display to fix rendering
        setTimeout(() => {
            this.solutionEditor.refresh();
        }, 100);
    }

    createNewChapter() {
        const chapterName = prompt('Enter the name for the new chapter:');

        if (!chapterName || !chapterName.trim()) {
            return; // User cancelled or entered empty name
        }

        const trimmedName = chapterName.trim();

        // Check if chapter already exists
        const existingChapters = new Set();
        this.exercises.forEach(ex => {
            if (ex.chapter) existingChapters.add(ex.chapter);
        });

        if (existingChapters.has(trimmedName)) {
            alert(`Chapter "${trimmedName}" already exists!`);
            return;
        }

        // Create a placeholder exercise for the new chapter
        // This ensures the chapter appears in the list
        alert(`Chapter "${trimmedName}" created! You can now create exercises in this chapter.`);

        // Open new exercise form with the new chapter selected
        this.createNewExercise();

        // Update chapter dropdown and select the new chapter
        this.updateChapterOptions();
        const select = document.getElementById('exercise-chapter');

        // Add the new chapter to the dropdown
        const option = document.createElement('option');
        option.value = trimmedName;
        option.textContent = trimmedName;
        select.insertBefore(option, select.querySelector('[value="__new__"]'));
        select.value = trimmedName;
    }

    async editExercise(id) {
        try {
            const exercise = await this.apiService.getExerciseWithTests(id);
            this.currentExercise = exercise;
            this.testCases = exercise.testCases || [];
            this.fixtureFiles = exercise.fixtures || [];

            document.getElementById('editor-title').textContent = 'Edit Exercise';
            document.getElementById('exercise-id').value = exercise.id;
            document.getElementById('exercise-id').disabled = true;
            document.getElementById('exercise-title').value = exercise.title;
            document.getElementById('exercise-chapter').value = exercise.chapter || 'Shell scripting';
            document.getElementById('exercise-order').value = exercise.order || '';
            document.getElementById('exercise-description').value = exercise.description;
            this.solutionEditor.setValue(exercise.solution);

            this.renderTestCases();
            this.renderFixtures();
            this.updateChapterOptions();

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
        const chapterSelect = document.getElementById('exercise-chapter');
        const newChapterInput = document.getElementById('new-chapter-input');
        let chapter = chapterSelect.value;

        if (chapter === '__new__') {
            chapter = newChapterInput.value.trim();
            if (!chapter) {
                alert('Please enter a chapter name');
                return;
            }
        }

        const exerciseData = {
            id: document.getElementById('exercise-id').value.trim(),
            title: document.getElementById('exercise-title').value.trim(),
            chapter: chapter,
            order: parseInt(document.getElementById('exercise-order').value) || 0,
            description: document.getElementById('exercise-description').value.trim(),
            solution: this.solutionEditor.getValue(),
            testCases: this.testCases,
            fixtures: this.fixtureFiles
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

    // Test Cases Management
    addTestCase() {
        this.testCases.push({
            arguments: [],
            expectedOutput: '',
            expectedExitCode: 0,
            stdin: ''
        });
        this.renderTestCases();
    }

    removeTestCase(index) {
        this.testCases.splice(index, 1);
        this.renderTestCases();
    }

    renderTestCases() {
        const container = document.getElementById('test-cases-container');
        if (!container) {
            console.warn('test-cases-container not found');
            return;
        }

        container.innerHTML = '';

        this.testCases.forEach((testCase, index) => {
            const testCaseDiv = document.createElement('div');
            testCaseDiv.className = 'test-case-item';
            testCaseDiv.innerHTML = `
                <div class="test-case-header">
                    <span>Test Case ${index + 1}</span>
                    <button type="button" class="icon-btn delete" data-index="${index}">
                        <span>🗑</span>
                    </button>
                </div>
                <div class="test-case-fields">
                    <div class="form-group-inline">
                        <label>Arguments (comma-separated)</label>
                        <input type="text" class="form-input" data-field="arguments" data-index="${index}" 
                               value="${(testCase.arguments || []).join(', ')}" placeholder="arg1, arg2, arg3">
                    </div>
                    <div class="form-group-inline">
                        <label>STDIN Input (one per line)</label>
                        <textarea class="form-input" data-field="input" data-index="${index}" 
                                  rows="3" placeholder="Line 1\nLine 2\nLine 3">${(testCase.input || []).join('\n')}</textarea>
                    </div>
                    <div class="form-group-inline">
                        <label>Fixture Files (comma-separated filenames)</label>
                        <input type="text" class="form-input" data-field="fixtures" data-index="${index}" 
                               value="${(testCase.fixtures || []).join(', ')}" placeholder="file1.txt, file2.csv">
                    </div>
                    <div class="form-group-inline">
                        <label>Expected Output (auto-filled when testing)</label>
                        <textarea class="form-input" data-field="expectedOutput" data-index="${index}" 
                                  rows="3" placeholder="Run tests to populate..." readonly style="background: #2a2a2a;">${testCase.expectedOutput || ''}</textarea>
                    </div>
                    <div class="form-group-inline">
                        <label>Expected Exit Code (auto-filled when testing)</label>
                        <input type="number" class="form-input" data-field="expectedExitCode" data-index="${index}" 
                               value="${testCase.expectedExitCode || 0}" readonly style="background: #2a2a2a;">
                    </div>
                </div>
            `;
            container.appendChild(testCaseDiv);
        });

        // Add event listeners
        container.querySelectorAll('[data-field]').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;
                let value = e.target.value;

                if (field === 'arguments' || field === 'fixtures') {
                    value = value.split(',').map(s => s.trim()).filter(s => s);
                } else if (field === 'input') {
                    value = value.split('\n').filter(s => s !== '');
                } else if (field === 'expectedExitCode') {
                    value = parseInt(value) || 0;
                }

                this.testCases[index][field] = value;
            });
        });

        container.querySelectorAll('.icon-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('button').dataset.index);
                this.removeTestCase(index);
            });
        });
    }

    // Fixture Files Management
    async handleFixtureUpload(e) {
        const files = Array.from(e.target.files);
        for (const file of files) {
            const content = await this.readFileAsText(file);
            this.fixtureFiles.push({
                name: file.name,
                content: content
            });
        }
        this.renderFixtures();
        e.target.value = ''; // Reset input
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    removeFixture(index) {
        this.fixtureFiles.splice(index, 1);
        this.renderFixtures();
    }

    renderFixtures() {
        const list = document.getElementById('fixture-list');
        if (!list) {
            console.warn('fixture-list not found');
            return;
        }

        list.innerHTML = '';

        if (this.fixtureFiles.length === 0) {
            list.innerHTML = '<p class="no-fixtures">No fixtures uploaded</p>';
            return;
        }

        this.fixtureFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'fixture-item';
            item.innerHTML = `
                <span class="fixture-name">📄 ${file.name}</span>
                <button type="button" class="icon-btn delete" data-index="${index}">
                    <span>🗑</span>
                </button>
            `;
            list.appendChild(item);
        });

        list.querySelectorAll('.icon-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('button').dataset.index);
                this.removeFixture(index);
            });
        });
    }

    // Chapter Management
    handleChapterChange(e) {
        const select = e.target;
        const newChapterInput = document.getElementById('new-chapter-input');

        if (select.value === '__new__') {
            newChapterInput.style.display = 'block';
            newChapterInput.focus();
        } else {
            newChapterInput.style.display = 'none';
        }
    }

    updateChapterOptions() {
        const select = document.getElementById('exercise-chapter');
        const chapters = new Set();

        this.exercises.forEach(ex => {
            if (ex.chapter) chapters.add(ex.chapter);
        });

        const currentValue = select.value;
        select.innerHTML = '';

        Array.from(chapters).sort().forEach(chapter => {
            const option = document.createElement('option');
            option.value = chapter;
            option.textContent = chapter;
            select.appendChild(option);
        });

        const newOption = document.createElement('option');
        newOption.value = '__new__';
        newOption.textContent = '+ Create New Chapter';
        select.appendChild(newOption);

        if (currentValue && currentValue !== '__new__') {
            select.value = currentValue;
        }
    }

    // Drag & Drop Reordering
    toggleReorderMode() {
        this.reorderMode = !this.reorderMode;

        if (this.reorderMode) {
            this.originalOrder = JSON.parse(JSON.stringify(this.exercises));
            document.getElementById('reorder-mode-btn').classList.add('active');
            document.getElementById('reorder-actions').style.display = 'flex';
        } else {
            document.getElementById('reorder-mode-btn').classList.remove('active');
            document.getElementById('reorder-actions').style.display = 'none';
        }

        this.populateExerciseList();
    }

    addDragListeners(item) {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.dataset.id);
            item.classList.add('dragging');
        });

        item.addEventListener('dragend', (e) => {
            item.classList.remove('dragging');
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dragging = document.querySelector('.dragging');
            const group = item.closest('.exercise-group');

            if (dragging && dragging.dataset.chapter === item.dataset.chapter) {
                const siblings = [...group.querySelectorAll('.exercise-item:not(.dragging)')];
                const nextSibling = siblings.find(sibling => {
                    const box = sibling.getBoundingClientRect();
                    return e.clientY < box.top + box.height / 2;
                });

                if (nextSibling) {
                    group.insertBefore(dragging, nextSibling);
                } else {
                    group.appendChild(dragging);
                }
            }
        });
    }

    async saveNewOrder() {
        const newOrder = [];
        const groups = document.querySelectorAll('.exercise-group');

        groups.forEach(group => {
            const chapter = group.dataset.chapter;
            const items = group.querySelectorAll('.exercise-item');

            items.forEach((item, index) => {
                const id = item.dataset.id;
                const exercise = this.exercises.find(ex => ex.id === id);
                if (exercise) {
                    newOrder.push({
                        ...exercise,
                        order: index + 1,
                        chapter: chapter
                    });
                }
            });
        });

        try {
            await this.apiService.reorderExercises(newOrder);
            this.exercises = newOrder;
            this.toggleReorderMode();
            alert('Order saved successfully!');
        } catch (error) {
            alert('Failed to save order: ' + error.message);
        }
    }

    cancelReorder() {
        this.exercises = this.originalOrder;
        this.originalOrder = null;
        this.toggleReorderMode();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AdminPage();
});