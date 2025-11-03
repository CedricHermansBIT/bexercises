// frontend/js/pages/admin/exercisesPage.js
import ApiService from '../../services/apiService.js';
import AuthComponent from '../../components/authComponent.js';
import NotificationBanner from '../../components/notificationBanner.js';
import { navigateTo } from '../../utils/navigationUtils.js';
import { setupAdminCommon, escapeHtml } from './adminUtils.js';
import { setFavicon } from '../../utils/faviconUtils.js';

class ExercisesPage {
    constructor() {
        this.apiService = new ApiService();
        this.authComponent = new AuthComponent(this.apiService);
        this.notificationBanner = new NotificationBanner();

        window.authComponent = this.authComponent;

        this.exercises = [];
        this.languages = [];
        this.currentExercise = null;
        this.solutionEditor = null;
        this.testCases = [];
        this.reorderMode = false;
        this.originalOrder = null;
        this.selectedLanguage = 'all';
        this.pendingChapterLanguage = null;
        this.pendingChapterName = null;
        this.availableFiles = [];

        this.init();
    }

    async init() {
        // Check authentication
        const isAuthenticated = await this.authComponent.checkAuth();
        if (!isAuthenticated) {
            navigateTo('login.html');
            return;
        }

        // Check admin privileges
        if (!this.authComponent.isAdmin()) {
            alert('Access denied. Admin privileges required.');
            navigateTo('languages.html');
            return;
        }

        setFavicon();

        // Initialize notification banner
        await this.notificationBanner.init();

        // Setup common admin functionality
        setupAdminCommon(this.authComponent);

        // Setup code editor
        this.setupCodeEditor();

        // Load data
        await this.loadLanguages();
        await this.loadExercises();
        await this.loadFiles();

        // Setup event listeners
        this.setupEventListeners();
    }

    setupCodeEditor() {
        const textarea = document.getElementById('exercise-solution');
        if (textarea && window.CodeMirror) {
            // Determine initial theme based on current mode
            const currentTheme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
            const editorTheme = currentTheme === 'dark' ? 'dracula' : 'default';

            this.solutionEditor = CodeMirror.fromTextArea(textarea, {
                mode: 'shell',
                theme: editorTheme,
                lineNumbers: true,
                autoCloseBrackets: true,
                matchBrackets: true,
                indentUnit: 4,
                tabSize: 4,
                lineWrapping: true
            });

            // Listen for theme changes and update CodeMirror theme
            window.addEventListener('themechange', (e) => {
                const newTheme = e.detail.theme === 'dark' ? 'dracula' : 'default';
                this.solutionEditor.setOption('theme', newTheme);
            });
        }
    }

    setupEventListeners() {
        // Exercise management
        document.getElementById('new-exercise-btn')?.addEventListener('click', () => {
            this.createNewExercise();
        });

        document.getElementById('new-chapter-btn')?.addEventListener('click', () => {
            this.createNewChapter();
        });

        document.getElementById('reorder-mode-btn')?.addEventListener('click', () => {
            this.toggleReorderMode();
        });

        document.getElementById('save-order-btn')?.addEventListener('click', () => {
            this.saveReorder();
        });

        document.getElementById('cancel-order-btn')?.addEventListener('click', () => {
            this.cancelReorder();
        });

        document.getElementById('bulk-verify-btn')?.addEventListener('click', () => {
            this.openBulkVerification();
        });

        document.getElementById('close-verify-modal')?.addEventListener('click', () => {
            this.closeBulkVerification();
        });

        document.getElementById('close-verify-btn')?.addEventListener('click', () => {
            this.closeBulkVerification();
        });

        // Editor actions
        document.getElementById('save-exercise-btn')?.addEventListener('click', () => {
            this.saveExercise();
        });

        document.getElementById('test-solution-btn')?.addEventListener('click', () => {
            this.testSolution();
        });

        document.getElementById('discard-btn')?.addEventListener('click', () => {
            this.discardChanges();
        });

        // Test cases
        document.getElementById('add-test-case-btn')?.addEventListener('click', () => {
            this.addTestCase();
        });

        // Chapter selection
        document.getElementById('exercise-chapter')?.addEventListener('change', (e) => {
            this.handleChapterChange(e);
        });

        // Language selector
        document.getElementById('admin-language-select')?.addEventListener('change', (e) => {
            this.selectedLanguage = e.target.value;
            this.populateExerciseList();
        });
    }

    async loadLanguages() {
        try {
            this.languages = await this.apiService.getLanguages();
            this.populateLanguageSelector();
        } catch (error) {
            console.error('Failed to load languages:', error);
        }
    }

    populateLanguageSelector() {
        const select = document.getElementById('admin-language-select');
        if (!select) return;

        const languageOptions = this.languages.map(lang =>
            `<option value="${lang.id}">${lang.name}</option>`
        ).join('');

        select.innerHTML = `<option value="all">All Languages</option>${languageOptions}`;
        select.value = this.selectedLanguage;
    }

    async loadExercises() {
        try {
            this.exercises = await this.apiService.getAdminExercises();
            this.populateExerciseList();
        } catch (error) {
            console.error('Failed to load exercises:', error);
        }
    }

    async loadFiles() {
        try {
            this.availableFiles = await this.apiService.getFixtureFiles();
        } catch (error) {
            console.error('Failed to load files:', error);
            this.availableFiles = [];
        }
    }

    populateExerciseList() {
        const list = document.getElementById('exercises-list');
        list.innerHTML = '';

        // Filter exercises by selected language
        const filteredExercises = this.selectedLanguage === 'all'
            ? this.exercises
            : this.exercises.filter(ex => {
                return ex.language_id === this.selectedLanguage ||
                       (ex.chapter_id && ex.chapter_id.startsWith(this.selectedLanguage));
            });

        if (filteredExercises.length === 0) {
            list.innerHTML = '<p class="no-files">No exercises found for this language</p>';
            return;
        }

        const chaptersMap = new Map();
        filteredExercises.forEach(ex => {
            const chapter = ex.chapter || 'Uncategorized';
            if (!chaptersMap.has(chapter)) {
                chaptersMap.set(chapter, {
                    exercises: [],
                    order: ex.chapter_order || 0,
                    language: ex.language || 'Unknown'
                });
            }
            chaptersMap.get(chapter).exercises.push(ex);
        });

        const sortedChapters = Array.from(chaptersMap.entries())
            .sort((a, b) => a[1].order - b[1].order);

        sortedChapters.forEach(([chapter, chapterData]) => {
            const chapterDiv = document.createElement('div');
            chapterDiv.className = 'exercise-group';
            chapterDiv.dataset.chapter = chapter;

            const languageTag = this.selectedLanguage === 'all' && chapterData.language
                ? `<span class="chapter-language-tag">${chapterData.language}</span>`
                : '';

            chapterDiv.innerHTML = `<div class="group-title">${chapter} ${languageTag}</div>`;

            chapterData.exercises.sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(ex => {
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

        document.getElementById('editor-title').textContent = 'New Exercise';
        document.getElementById('exercise-id').value = '';
        document.getElementById('exercise-id').disabled = false;
        document.getElementById('exercise-title').value = '';
        document.getElementById('exercise-chapter').value = 'Shell scripting';
        document.getElementById('exercise-description').value = '';
        this.solutionEditor.setValue('#!/bin/bash\n\n# Write the solution here\n');

        this.renderTestCases();
        this.updateChapterOptions();

        document.getElementById('admin-welcome').style.display = 'none';
        document.getElementById('exercise-editor').style.display = 'block';
        document.getElementById('test-preview').style.display = 'none';

        // Reset save button text
        document.getElementById('save-exercise-btn').textContent = 'Save Exercise';

        setTimeout(() => {
            this.solutionEditor.refresh();
        }, 100);
    }

    createNewChapter() {
        // Determine language for new chapter
        let languageId = this.selectedLanguage;

        if (languageId === 'all') {
            if (this.languages.length === 0) {
                alert('No languages available. Please create a language first.');
                return;
            }

            const languageOptions = this.languages.map((lang, idx) =>
                `${idx + 1}. ${lang.name}`
            ).join('\n');

            const choice = prompt(`Select a language for the new chapter:\n${languageOptions}\n\nEnter the number:`);

            if (!choice) return;

            const choiceNum = parseInt(choice);
            if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > this.languages.length) {
                alert('Invalid selection');
                return;
            }

            languageId = this.languages[choiceNum - 1].id;
        }

        const chapterName = prompt('Enter the name for the new chapter:');

        if (!chapterName || !chapterName.trim()) {
            return;
        }

        const trimmedName = chapterName.trim();

        // Check if chapter already exists for this language
        const existingChapters = new Set();
        this.exercises.forEach(ex => {
            if (ex.language_id === languageId && ex.chapter) {
                existingChapters.add(ex.chapter);
            }
        });

        if (existingChapters.has(trimmedName)) {
            alert(`Chapter "${trimmedName}" already exists for this language!`);
            return;
        }

        alert(`Chapter "${trimmedName}" created! You can now create exercises in this chapter.`);

        this.pendingChapterLanguage = languageId;
        this.pendingChapterName = trimmedName;

        this.createNewExercise();

        this.updateChapterOptions();
        const select = document.getElementById('exercise-chapter');

        const option = document.createElement('option');
        option.value = trimmedName;
        option.textContent = trimmedName;
        option.dataset.languageId = languageId;
        select.insertBefore(option, select.querySelector('[value="__new__"]'));
        select.value = trimmedName;
    }

    async editExercise(id) {
        try {
            const exercise = await this.apiService.getExerciseWithTests(id);
            this.currentExercise = exercise;
            this.testCases = exercise.testCases || [];

            document.getElementById('editor-title').textContent = 'Edit Exercise';
            document.getElementById('exercise-id').value = exercise.id;
            document.getElementById('exercise-id').disabled = true;
            document.getElementById('exercise-title').value = exercise.title;
            document.getElementById('exercise-chapter').value = exercise.chapter || 'Shell scripting';
            document.getElementById('exercise-description').value = exercise.description;
            this.solutionEditor.setValue(exercise.solution);

            this.renderTestCases();
            this.updateChapterOptions();

            document.getElementById('admin-welcome').style.display = 'none';
            document.getElementById('exercise-editor').style.display = 'block';
            document.getElementById('test-preview').style.display = 'none';

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

        if (this.testCases.length === 0) {
            alert('Please add at least one test case before testing');
            return;
        }

        const testBtn = document.getElementById('test-solution-btn');
        testBtn.innerHTML = '<span>⟳</span> Testing...';
        testBtn.disabled = true;

        try {
            let resultsHtml = '';

            for (let i = 0; i < this.testCases.length; i++) {
                const testCase = this.testCases[i];

                // Use fixtures from the test case (populated from database)
                const fixtures = testCase.fixtures || [];

                resultsHtml += `<div class="test-case-result"><h4>Test Case ${i + 1}</h4>`;

                const result = await this.apiService.runTestCase(solution, {
                    arguments: testCase.arguments || [],
                    input: testCase.input || [],
                    fixtures: fixtures,
                    outputFiles: testCase.outputFiles || []
                });

                this.testCases[i].expectedOutput = result.output;
                this.testCases[i].expectedStderr = result.stderr || '';
                this.testCases[i].expectedExitCode = result.exitCode;

                // Store file hashes if any output files were specified
                if (result.fileHashes && result.fileHashes.length > 0) {
                    this.testCases[i].expectedOutputFiles = result.fileHashes.map(fh => ({
                        filename: fh.filename,
                        sha256: fh.sha256
                    }));
                }

                let fileHashesHtml = '';
                if (result.fileHashes && result.fileHashes.length > 0) {
                    fileHashesHtml = '<p><strong>Output Files:</strong></p>';
                    result.fileHashes.forEach(fh => {
                        const status = fh.exists ? '✓' : '✗';
                        const color = fh.exists ? 'var(--accent-green)' : 'var(--accent-red)';
                        fileHashesHtml += `
                            <div style="margin: 0.5rem 0; padding: 0.5rem; background: var(--bg-tertiary); border-radius: 4px;">
                                <span style="color: ${color};">${status}</span> <strong>${escapeHtml(fh.filename)}</strong><br>
                                ${fh.exists ? `
                                    <small style="color: var(--text-muted);">SHA-256: ${fh.sha256}</small><br>
                                    <small style="color: var(--text-muted);">Size: ${fh.size} bytes</small>
                                ` : `<small style="color: var(--accent-red);">${fh.error || 'File not found'}</small>`}
                            </div>
                        `;
                    });
                }

                resultsHtml += `
                    <div class="test-result-details">
                        <p><strong>Arguments:</strong> ${(testCase.arguments || []).join(', ') || '(none)'}</p>
                        <p><strong>Input:</strong> ${(testCase.input || []).length} lines</p>
                        <p><strong>Fixtures Used:</strong> ${fixtures.join(', ') || '(none)'}</p>
                        ${fileHashesHtml}
                        <p><strong>Output:</strong></p>
                        <pre class="test-output-preview">${escapeHtml(result.output)}</pre>
                        <p><strong>STDERR:</strong></p>
                        <pre class="test-output-preview">${escapeHtml(result.stderr || '')}</pre>
                        <p><strong>Exit Code:</strong> ${result.exitCode}</p>
                    </div>
                `;

                resultsHtml += '</div>';
            }

            this.renderTestCases();

            document.getElementById('test-results-container').innerHTML = resultsHtml;
            document.getElementById('test-preview').style.display = 'block';
            document.getElementById('save-exercise-btn').textContent =
                this.currentExercise ? 'Update Exercise' : 'Create Exercise';
        } catch (error) {
            alert('Failed to test solution: ' + error.message);
        } finally {
            testBtn.innerHTML = '<span>Test Solution</span>';
            testBtn.disabled = false;
        }
    }

    async saveExercise() {
        const id = document.getElementById('exercise-id').value.trim();
        const title = document.getElementById('exercise-title').value.trim();
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

        const description = document.getElementById('exercise-description').value.trim();
        const solution = this.solutionEditor.getValue();

        // Calculate order for new exercises or preserve for updates
        let order;
        if (this.currentExercise) {
            // Preserve current order when editing
            order = this.currentExercise.order;
        } else {
            // For new exercises, find the highest order in the selected chapter and add 1
            const exercisesInChapter = this.exercises.filter(ex => ex.chapter === chapter);
            if (exercisesInChapter.length > 0) {
                const maxOrder = Math.max(...exercisesInChapter.map(ex => ex.order || 0));
                order = maxOrder + 1;
            } else {
                // First exercise in this chapter
                order = 1;
            }
        }

        const exerciseData = {
            id,
            title,
            chapter,
            order,
            description,
            solution,
            testCases: this.testCases
        };

        if (!id || !title || !description || !solution) {
            alert('Please fill in all required fields');
            return;
        }

        if (!/^[a-z0-9-]+$/.test(id)) {
            alert('Exercise ID must contain only lowercase letters, numbers, and hyphens');
            return;
        }

        if (this.testCases.length === 0) {
            alert('Please add at least one test case');
            return;
        }

        // Check if all test cases have been tested (have expected output and exit code)
        const untestedCases = this.testCases.filter(tc =>
            tc.expectedOutput === undefined || tc.expectedStderr === undefined || tc.expectedExitCode === undefined
        );

        if (untestedCases.length > 0) {
            alert('Please test the solution before saving. Click "Test Solution" to generate expected outputs for all test cases.');
            return;
        }

        const saveBtn = document.getElementById('save-exercise-btn');
        saveBtn.disabled = true;

        try {
            if (this.currentExercise) {
                await this.apiService.updateExercise(id, exerciseData);
            } else {
                await this.apiService.createExercise(exerciseData);
            }

            alert('Exercise saved successfully!');
            await this.loadExercises();
            this.discardChanges();
        } catch (error) {
            alert('Failed to save exercise: ' + error.message);
        } finally {
            saveBtn.disabled = false;
        }
    }

    discardChanges() {
        if (confirm('Discard all changes?')) {
            this.cancelEdit();
        }
    }

    formatOutputFiles(files) {
        if (!files || files.length === 0) return '';
        return files.map(f => `${f.filename}: ${f.sha256 ? f.sha256.substring(0, 16) + '...' : 'N/A'}`).join('\n');
    }

    modifyProceed() {
        document.getElementById('test-preview').style.display = 'none';
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
        document.getElementById('exercise-editor').style.display = 'none';
        document.getElementById('admin-welcome').style.display = 'flex';
    }

    // Test Cases Management
    addTestCase() {
        this.testCases.push({
            arguments: [],
            input: [],
            fixtures: [],
            outputFiles: [],
            expectedOutput: '',
            expectedStderr: '',
            expectedOutputFiles: [],
            expectedExitCode: 0,
            useDynamicOutput: false
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

            // Build fixture files options
            const fixtureOptions = this.availableFiles.map(f => {
                const isSelected = (testCase.fixtures || []).includes(f.filename);
                return `<option value="${f.filename}" ${isSelected ? 'selected' : ''}>${f.filename}</option>`;
            }).join('');

            testCaseDiv.innerHTML = `
                <div class="test-case-header">
                    <span>Test Case ${index + 1}</span>
                    <button type="button" class="icon-btn delete" data-index="${index}">
                        <span>🗑</span>
                    </button>
                </div>
                <div class="test-case-fields">
                    <div class="form-group-inline">
                        <label>Fixture Files (files needed for this test)</label>
                        <select multiple class="form-input fixture-select" data-field="fixtures" data-index="${index}"
                                 style="min-height: 80px;">
                            ${fixtureOptions || '<option disabled>No files available - upload files first</option>'}
                        </select>
                        <small style="color: var(--text-muted); font-size: 0.85rem;">Hold Ctrl/Cmd to select multiple files</small>
                    </div>
                    <div class="form-group-inline">
                        <label>Arguments (comma-separated, include filenames)</label>
                        <input type="text" class="form-input" data-field="arguments" data-index="${index}"
                                value="${(testCase.arguments || []).join(', ')}" placeholder="arg1, arg2, file.txt">
                    </div>
                    <div class="form-group-inline">
                        <label>STDIN Input (one per line)</label>
                        <textarea class="form-input" data-field="input" data-index="${index}"
                                   rows="3" placeholder="Line 1\nLine 2\nLine 3">${(testCase.input || []).join('\n')}</textarea>
                    </div>
                    <div class="form-group-inline">
                        <label>Expected Output Files (comma-separated filenames to verify)</label>
                        <input type="text" class="form-input" data-field="outputFiles" data-index="${index}"
                                value="${(testCase.outputFiles || []).join(', ')}" placeholder="output.txt, result.tar.gz">
                        <small style="color: var(--text-muted); font-size: 0.85rem;">Files created by script that will be hash-verified</small>
                    </div>
                    <div class="form-group-inline">
                        <label>Expected Output (auto-filled when testing)</label>
                        <textarea class="form-input" data-field="expectedOutput" data-index="${index}"
                                   rows="3" placeholder="Run tests to populate..." readonly style="background: #2a2a2a;">${testCase.expectedOutput || ''}</textarea>
                    </div>
                    <div class="form-group-inline">
                        <label>Expected STDERR (auto-filled when testing)</label>
                        <textarea class="form-input" data-field="expectedStderr" data-index="${index}"
                                   rows="2" placeholder="Run tests to populate..." readonly style="background: #2a2a2a;">${testCase.expectedStderr || ''}</textarea>
                    </div>
                    <div class="form-group-inline">
                        <label>Expected File Hashes (auto-filled when testing)</label>
                        <textarea class="form-input" data-field="expectedOutputFiles" data-index="${index}"
                                   rows="2" placeholder="Run tests to populate..." readonly style="background: #2a2a2a;">${this.formatOutputFiles(testCase.expectedOutputFiles || [])}</textarea>
                    </div>
                    <div class="form-group-inline">
                        <label>Expected Exit Code (auto-filled when testing)</label>
                        <input type="number" class="form-input" data-field="expectedExitCode" data-index="${index}"
                                value="${testCase.expectedExitCode || 0}" readonly style="background: #2a2a2a;">
                    </div>
                    <div class="form-group-inline">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" data-field="useDynamicOutput" data-index="${index}"
                                   ${testCase.useDynamicOutput ? 'checked' : ''} 
                                   style="width: auto; cursor: pointer;">
                            <span>Use Dynamic Output (re-run solution each time)</span>
                        </label>
                        <small style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem; display: block;">
                            Enable this for exercises with time-dependent or random output (e.g., date commands). 
                            The exercise solution will be executed to generate expected output dynamically.
                        </small>
                    </div>
                </div>
            `;
            container.appendChild(testCaseDiv);
        });

        container.querySelectorAll('[data-field]').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;
                let value = e.target.value;

                if (field === 'fixtures') {
                    // Get all selected options for multi-select
                    const select = e.target;
                    value = Array.from(select.selectedOptions).map(opt => opt.value);
                } else if (field === 'arguments') {
                    value = value.split(',').map(s => s.trim()).filter(s => s);
                } else if (field === 'outputFiles') {
                    value = value.split(',').map(s => s.trim()).filter(s => s);
                } else if (field === 'input') {
                    value = value.split('\n').filter(s => s !== '');
                } else if (field === 'expectedExitCode') {
                    value = parseInt(value) || 0;
                } else if (field === 'useDynamicOutput') {
                    value = e.target.checked;
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
        const chaptersData = new Map();

        this.exercises.forEach(ex => {
            if (ex.chapter) {
                const key = `${ex.language_id || 'unknown'}_${ex.chapter}`;
                if (!chaptersData.has(key)) {
                    chaptersData.set(key, {
                        name: ex.chapter,
                        order: ex.chapter_order || 0,
                        language_id: ex.language_id || 'unknown',
                        language_name: ex.language || 'Unknown'
                    });
                }
            }
        });

        const currentValue = select.value;
        select.innerHTML = '';

        const byLanguage = new Map();
        chaptersData.forEach((data, key) => {
            if (!byLanguage.has(data.language_id)) {
                byLanguage.set(data.language_id, []);
            }
            byLanguage.get(data.language_id).push(data);
        });

        const sortedLanguages = Array.from(byLanguage.entries())
            .sort((a, b) => {
                const langA = this.languages.find(l => l.id === a[0]);
                const langB = this.languages.find(l => l.id === b[0]);
                const orderA = langA ? langA.order_num || 0 : 999;
                const orderB = langB ? langB.order_num || 0 : 999;
                return orderA - orderB;
            });

        sortedLanguages.forEach(([languageId, chapters]) => {
            const sortedChapters = chapters.sort((a, b) => a.order - b.order);

            if (this.languages.length > 1) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = sortedChapters[0].language_name;

                sortedChapters.forEach(chapter => {
                    const option = document.createElement('option');
                    option.value = chapter.name;
                    option.textContent = chapter.name;
                    option.dataset.languageId = chapter.language_id;
                    optgroup.appendChild(option);
                });

                select.appendChild(optgroup);
            } else {
                sortedChapters.forEach(chapter => {
                    const option = document.createElement('option');
                    option.value = chapter.name;
                    option.textContent = chapter.name;
                    option.dataset.languageId = chapter.language_id;
                    select.appendChild(option);
                });
            }
        });

        const newOption = document.createElement('option');
        newOption.value = '__new__';
        newOption.textContent = '+ Create New Chapter';
        select.appendChild(newOption);

        if (currentValue && currentValue !== '__new__') {
            select.value = currentValue;
        }
    }

    // Drag and Drop Reordering
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
        item.draggable = true;

        item.addEventListener('dragstart', (e) => {
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', item.innerHTML);
        });

        item.addEventListener('dragend', (e) => {
            item.classList.remove('dragging');
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dragging = document.querySelector('.dragging');
            const afterElement = this.getDragAfterElement(item.parentElement, e.clientY);

            if (afterElement == null) {
                item.parentElement.appendChild(dragging);
            } else {
                item.parentElement.insertBefore(dragging, afterElement);
            }
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.exercise-item:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    async saveReorder() {
        const newOrder = [];
        const groups = document.querySelectorAll('.exercise-group');

        groups.forEach(group => {
            const items = group.querySelectorAll('.exercise-item');
            items.forEach((item, index) => {
                newOrder.push({
                    id: item.dataset.id,
                    order: index + 1
                });
            });
        });

        try {
            await this.apiService.updateExerciseOrder(newOrder);
            alert('Exercise order saved!');
            await this.loadExercises();
            this.toggleReorderMode();
        } catch (error) {
            alert('Failed to save order: ' + error.message);
        }
    }

    cancelReorder() {
        this.exercises = this.originalOrder;
        this.toggleReorderMode();
    }

    // Bulk Test Verification
    openBulkVerification() {
        const modal = document.getElementById('bulk-verify-modal');
        modal.style.display = 'flex';
        this.runBulkVerification();
    }

    closeBulkVerification() {
        const modal = document.getElementById('bulk-verify-modal');
        modal.style.display = 'none';
    }

    async runBulkVerification() {
        const statusDiv = document.getElementById('verification-status');
        const resultsDiv = document.getElementById('verification-results');
        const progressBar = document.getElementById('verification-progress');

        statusDiv.innerHTML = '<p>Running tests across all exercises...</p><div class="progress-bar"><div id="verification-progress" class="progress-fill" style="width: 0%;"></div></div>';
        resultsDiv.innerHTML = '';

        const verificationResults = [];
        let totalTests = 0;
        let changedTests = 0;
        let errorTests = 0;

        // Filter exercises with solutions
        const exercisesWithSolutions = this.exercises.filter(ex => ex.solution && ex.solution.trim());

        for (let i = 0; i < exercisesWithSolutions.length; i++) {
            const exercise = exercisesWithSolutions[i];
            const progress = ((i + 1) / exercisesWithSolutions.length) * 100;
            progressBar.style.width = `${progress}%`;

            statusDiv.innerHTML = `<p>Testing ${exercise.title} (${i + 1}/${exercisesWithSolutions.length})...</p><div class="progress-bar"><div class="progress-fill" style="width: ${progress}%;"></div></div>`;

            try {
                // Get full exercise data with test cases (admin endpoint)
                const fullExercise = await this.apiService.getExerciseWithTests(exercise.id);

                if (!fullExercise.testCases || fullExercise.testCases.length === 0) {
                    continue;
                }

                const testCaseResults = [];

                // Run each test case
                for (const testCase of fullExercise.testCases) {
                    totalTests++;
                    const fixtures = testCase.fixtures || [];

                    try {
                        const result = await this.apiService.runTestCase(fullExercise.solution, {
                            arguments: testCase.arguments || [],
                            input: testCase.input || [],
                            fixtures: fixtures
                        });

                        // Check if results differ from database
                        const outputChanged = (result.output || '') !== (testCase.expectedOutput || '');
                        const stderrChanged = (result.stderr || '') !== (testCase.expectedStderr || '');
                        const exitCodeChanged = result.exitCode !== testCase.expectedExitCode;

                        const hasChanges = outputChanged || stderrChanged || exitCodeChanged;

                        if (hasChanges) {
                            changedTests++;
                        }

                        testCaseResults.push({
                            testCase,
                            newResult: result,
                            hasChanges,
                            outputChanged,
                            stderrChanged,
                            exitCodeChanged
                        });
                    } catch (error) {
                        errorTests++;
                        testCaseResults.push({
                            testCase,
                            error: error.message,
                            hasChanges: true
                        });
                    }
                }

                // Only add to results if there are changes or errors
                const hasAnyChanges = testCaseResults.some(r => r.hasChanges);
                if (hasAnyChanges) {
                    verificationResults.push({
                        exercise: fullExercise,
                        testCaseResults
                    });
                }
            } catch (error) {
                console.error(`Error verifying ${exercise.title}:`, error);
                errorTests++;
            }
        }

        // Display results
        this.displayVerificationResults(verificationResults, totalTests, changedTests, errorTests);
    }

    displayVerificationResults(results, totalTests, changedTests, errorTests) {
        const statusDiv = document.getElementById('verification-status');
        const resultsDiv = document.getElementById('verification-results');

        // Summary
        const unchangedTests = totalTests - changedTests - errorTests;
        statusDiv.innerHTML = `
            <div class="verification-summary">
                <h3>Verification Complete</h3>
                <div class="summary-stats">
                    <div class="stat-item">
                        <div class="stat-value">${totalTests}</div>
                        <div class="stat-label">Total Tests</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" style="color: var(--accent-yellow);">${changedTests}</div>
                        <div class="stat-label">Changed</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" style="color: var(--accent-green);">${unchangedTests}</div>
                        <div class="stat-label">Unchanged</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" style="color: var(--accent-red);">${errorTests}</div>
                        <div class="stat-label">Errors</div>
                    </div>
                </div>
            </div>
        `;

        if (results.length === 0) {
            resultsDiv.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">All tests match their expected values! ✓</p>';
            return;
        }

        // Display each exercise with changes
        results.forEach(({ exercise, testCaseResults }) => {
            const changedCases = testCaseResults.filter(r => r.hasChanges);

            const itemDiv = document.createElement('div');
            itemDiv.className = 'verification-item has-changes';
            itemDiv.innerHTML = `
                <div class="verification-header">
                    <div class="verification-title">${escapeHtml(exercise.title)}</div>
                    <div class="verification-status changed">${changedCases.length} test(s) changed</div>
                </div>
            `;

            testCaseResults.forEach((testResult, idx) => {
                if (!testResult.hasChanges) return;

                const testDiv = document.createElement('div');
                testDiv.className = 'test-case-comparison';

                if (testResult.error) {
                    testDiv.innerHTML = `
                        <div class="test-case-comparison-header">
                            <span>Test Case ${idx + 1}</span>
                            <span class="verification-status error">Error</span>
                        </div>
                        <p style="color: var(--accent-red); font-size: 0.85rem;">Error: ${escapeHtml(testResult.error)}</p>
                    `;
                } else {
                    const { testCase, newResult, outputChanged, stderrChanged, exitCodeChanged } = testResult;

                    let changesHtml = '';

                    if (outputChanged) {
                        changesHtml += `
                            <div class="comparison-diff">
                                <div class="diff-column diff-old">
                                    <h5>Old Output</h5>
                                    <pre>${escapeHtml(testCase.expectedOutput || '')}</pre>
                                </div>
                                <div class="diff-column diff-new">
                                    <h5>New Output</h5>
                                    <pre>${escapeHtml(newResult.output || '')}</pre>
                                </div>
                            </div>
                        `;
                    }

                    if (stderrChanged) {
                        changesHtml += `
                            <div class="comparison-diff">
                                <div class="diff-column diff-old">
                                    <h5>Old STDERR</h5>
                                    <pre>${escapeHtml(testCase.expectedStderr || '')}</pre>
                                </div>
                                <div class="diff-column diff-new">
                                    <h5>New STDERR</h5>
                                    <pre>${escapeHtml(newResult.stderr || '')}</pre>
                                </div>
                            </div>
                        `;
                    }

                    if (exitCodeChanged) {
                        changesHtml += `
                            <div class="comparison-diff">
                                <div class="diff-column diff-old">
                                    <h5>Old Exit Code</h5>
                                    <pre>${testCase.expectedExitCode}</pre>
                                </div>
                                <div class="diff-column diff-new">
                                    <h5>New Exit Code</h5>
                                    <pre>${newResult.exitCode}</pre>
                                </div>
                            </div>
                        `;
                    }

                    testDiv.innerHTML = `
                        <div class="test-case-comparison-header">
                            <span>Test Case ${idx + 1}</span>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">
                                ${outputChanged ? 'Output ' : ''}
                                ${stderrChanged ? 'STDERR ' : ''}
                                ${exitCodeChanged ? 'Exit Code' : ''}
                                changed
                            </span>
                        </div>
                        ${changesHtml}
                        <div class="verification-actions">
                            <button class="approve-btn" data-exercise-id="${exercise.id}" data-test-index="${idx}">
                                ✓ Approve Changes
                            </button>
                            <button class="reject-btn">✗ Keep Old Values</button>
                        </div>
                    `;
                }

                itemDiv.appendChild(testDiv);
            });

            resultsDiv.appendChild(itemDiv);
        });

        // Add event listeners for approve buttons
        resultsDiv.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const exerciseId = e.target.dataset.exerciseId;
                const testIndex = parseInt(e.target.dataset.testIndex);
                await this.approveTestChange(exerciseId, testIndex, results);
                e.target.disabled = true;
                e.target.textContent = '✓ Approved';
            });
        });
    }

    async approveTestChange(exerciseId, testIndex, verificationResults) {
        try {
            // Find the exercise and test result
            const exerciseResult = verificationResults.find(r => r.exercise.id === exerciseId);
            if (!exerciseResult) return;

            const testResult = exerciseResult.testCaseResults[testIndex];
            if (!testResult || !testResult.newResult) return;

            const exercise = exerciseResult.exercise;

            // Update the test case with new values
            exercise.testCases[testIndex].expectedOutput = testResult.newResult.output || '';
            exercise.testCases[testIndex].expectedStderr = testResult.newResult.stderr || '';
            exercise.testCases[testIndex].expectedExitCode = testResult.newResult.exitCode;

            // Save the updated exercise
            await this.apiService.updateExercise(exerciseId, {
                title: exercise.title,
                description: exercise.description,
                solution: exercise.solution,
                chapter_id: exercise.chapter_id,
                testCases: exercise.testCases
            });

            console.log(`Approved test change for ${exercise.title}, test ${testIndex + 1}`);
        } catch (error) {
            alert(`Failed to approve changes: ${error.message}`);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ExercisesPage();
});



