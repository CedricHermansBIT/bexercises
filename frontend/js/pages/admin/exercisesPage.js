// frontend/js/pages/admin/exercisesPage.js
import { installExerciseHelp } from '../../utils/exerciseHelp.js';
import ApiService from '../../services/apiService.js';
import AuthComponent from '../../components/authComponent.js';
import NotificationBanner from '../../components/notificationBanner.js';
import Navbar from '../../components/navbar.js';
import { navigateTo } from '../../utils/navigationUtils.js';
import { escapeHtml } from './adminUtils.js';
import { renderArtifactFeedback } from '../../utils/artifactResults.js';
import { compareTestOutputs } from '../../utils/gradingComparison.js';
import { initializeResizableSidebars } from '../../utils/resizeUtils.js';
import { setFavicon } from '../../utils/faviconUtils.js';

class ExercisesPage {
    constructor() {
        this.apiService = new ApiService();
        this.authComponent = new AuthComponent(this.apiService);
        this.notificationBanner = new NotificationBanner();
        this.navbar = new Navbar();

        window.authComponent = this.authComponent;

        this.exercises = [];
        this.languages = [];
        this.functionTestsAvailable = false;
        this.semanticArtifactsAvailable = false;
        this.documentArtifactsAvailable = false;
        this.networkHostsAvailable = [];
        this.currentExercise = null;
        this.solutionEditor = null;
        this.starterEditor = null;
        this.testCases = [];
        this.reorderMode = false;
        this.originalOrder = null;
        // Load last selected language from localStorage
        this.selectedLanguage = localStorage.getItem('admin-selected-language') || null;
        this.pendingChapterLanguage = null;
        this.pendingChapterName = null;
        this.availableFiles = [];

        this.init();
    }

    async init() {
        // Check authentication
        const isAuthenticated = await this.authComponent.checkAuth();
        if (isAuthenticated === null) return;
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

        // Render navbar
        const navbarContainer = document.getElementById('navbar-container');
        if (navbarContainer) {
            navbarContainer.innerHTML = this.navbar.render({
                showBack: true,
                backText: 'back',
                backUrl: this.getBackUrl(),
                workspaceIndicator: '[admin]',
                appTitle: 'Exercises',
                isAdminPage: true
            });
        }

        // Setup code editor (synchronous, doesn't need to wait)
        this.setupCodeEditor();

        // Initialize navbar, notification banner and load data in parallel
        await Promise.all([
            this.navbar.init(this.authComponent),
            this.notificationBanner.init(),
            this.loadLanguages(),
            this.loadFiles()
        ]);

        // Initialize resizable sidebars
        initializeResizableSidebars();

        // Load exercises (depends on languages being loaded for filtering)
        await this.loadExercises();

        // Setup event listeners
        this.setupEventListeners();
        installExerciseHelp(document);

        // Check if we should auto-edit an exercise (from workspace)
        const urlParams = new URLSearchParams(window.location.search);
        const editExerciseId = urlParams.get('edit');
        if (editExerciseId) {
            // Wait a bit for everything to load, then edit the exercise
            setTimeout(() => {
                this.editExercise(editExerciseId);
            }, 100);
        }
    }

    /**
     * Get CodeMirror mode for a language
     * @param {string} languageId - Language identifier
     * @returns {string} CodeMirror mode name
     */
    getCodeMirrorMode(languageId) {
        const modeMap = {
            'bash': 'shell',
            'python': 'python',
            'javascript': 'javascript',
            'js': 'javascript',
            'sql': 'sql',
            'r': 'r',
            'php': 'php',
            'ruby': 'ruby',
            'perl': 'perl',
            'c': 'clike',
            'cpp': 'clike',
            'c++': 'clike',
            'java': 'clike',
            'go': 'go',
            'rust': 'rust',
            'mongodb': 'javascript' // MongoDB queries are JavaScript-like
        };

        return modeMap[languageId] || 'shell';
    }

    /**
     * Format SQL/database output as HTML table if it looks like tabular data
     * @param {string} output - Raw text output
     * @param {string} languageId - Language ID (sql, mariadb, etc.)
     * @returns {string} HTML formatted output
     */
    formatDatabaseOutput(output, languageId) {
        // Only format for SQL-like languages
        const isSQLLanguage = ['sql', 'mariadb'].includes(languageId);

        if (!isSQLLanguage || !output || !output.trim()) {
            return `<pre class="test-output-preview">${escapeHtml(output || '')}</pre>`;
        }

        // Check if output looks like a table (has lines with separators like +--+--+ or |  |  |)
        const lines = output.trim().split('\n');
        const hasTableBorders = lines.some(line => /^[+|-]+$/.test(line.trim()) || /^\|.*\|$/.test(line));

        if (!hasTableBorders) {
            // Not a table, return as pre
            return `<pre class="test-output-preview">${escapeHtml(output)}</pre>`;
        }

        // Parse table format (MariaDB outputs tables with +--+--+ borders and | col | col | format)
        const dataLines = lines.filter(line => {
            const trimmed = line.trim();
            return trimmed.startsWith('|') && !trimmed.match(/^[+-]+$/);
        });

        if (dataLines.length < 1) {
            return `<pre class="test-output-preview">${escapeHtml(output)}</pre>`;
        }

        // Parse header and data
        const parseRow = (line) => {
            return line.split('|')
                .slice(1, -1) // Remove first and last empty elements
                .map(cell => cell.trim());
        };

        const headerRow = parseRow(dataLines[0]);
        const dataRows = dataLines.slice(1).map(parseRow);

        // Build HTML table
        let tableHtml = '<div class="sql-result-table"><table class="table">';
        tableHtml += '<thead><tr>';
        headerRow.forEach(header => {
            tableHtml += `<th>${escapeHtml(header)}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        dataRows.forEach(row => {
            tableHtml += '<tr>';
            row.forEach(cell => {
                tableHtml += `<td>${escapeHtml(cell)}</td>`;
            });
            tableHtml += '</tr>';
        });

        tableHtml += '</tbody></table></div>';
        return tableHtml;
    }

    setupCodeEditor() {
        const textarea = document.getElementById('exercise-solution');
        if (textarea && window.CodeMirror) {
            // Determine initial theme based on current mode
            const currentTheme = document.body.dataset.theme || (document.body.classList.contains('light-mode') ? 'light' : 'dark');
            const editorTheme = ['light', 'paper', 'pink', 'nord'].includes(currentTheme) ? 'default' : 'dracula';

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

            const starter = document.getElementById('exercise-starter-code');
            if (starter) {
                this.starterEditor = CodeMirror.fromTextArea(starter, {
                    mode: 'shell', theme: editorTheme, lineNumbers: true,
                    autoCloseBrackets: true, matchBrackets: true,
                    indentUnit: 4, tabSize: 4, lineWrapping: true, readOnly: true
                });
                this.starterEditor.getInputField().setAttribute('aria-label', 'Exercise starter code');
            }

            // Listen for theme changes and update CodeMirror theme
            window.addEventListener('themechange', (e) => {
                const newTheme = ['light', 'paper', 'pink', 'nord'].includes(e.detail.theme) ? 'default' : 'dracula';
                this.solutionEditor.setOption('theme', newTheme);
                this.starterEditor?.setOption('theme', newTheme);
            });
        }
    }

    setStarterCode(code) {
        const checkbox = document.getElementById('exercise-use-starter');
        const field = document.getElementById('exercise-starter-code');
        if (!checkbox || !field) return;
        checkbox.checked = code !== null && code !== undefined;
        field.value = code ?? '';
        this.starterEditor?.setValue(code ?? '');
        this.updateStarterEditorVisibility();
    }

    updateStarterEditorVisibility() {
        const enabled = !!document.getElementById('exercise-use-starter')?.checked;
        const field = document.getElementById('exercise-starter-code');
        const wrapper = document.getElementById('exercise-starter-editor');
        if (wrapper) wrapper.hidden = !enabled;
        if (field) {
            field.disabled = !enabled;
            field.hidden = !!this.starterEditor || !enabled;
        }
        this.starterEditor?.setOption('readOnly', !enabled);
        if (enabled) setTimeout(() => this.starterEditor?.refresh(), 0);
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

        // Save the current exercise before opening its workspace
        document.getElementById('back-to-workspace-btn')?.addEventListener('click', () => {
            this.returnToWorkspace();
        });

        document.getElementById('exercise-editor')?.addEventListener('input', () => {
            this.setSaveStatus('Unsaved changes');
        });
        this.solutionEditor?.on('change', () => this.setSaveStatus('Unsaved changes'));
        this.starterEditor?.on('change', () => this.setSaveStatus('Unsaved changes'));
        document.getElementById('exercise-use-starter')?.addEventListener('change', () => {
            this.updateStarterEditorVisibility();
            this.setSaveStatus('Unsaved changes');
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
            // Save to localStorage to remember selection
            localStorage.setItem('admin-selected-language', this.selectedLanguage);

            // Update exercise type based on the new language
            const language = this.languages.find(l => l.id === this.selectedLanguage);
            this.currentExerciseType = language?.exercise_type || 'programming';

            console.log('[Language Change]', {
                selectedLanguage: this.selectedLanguage,
                exerciseType: this.currentExerciseType
            });

            // Update CodeMirror syntax highlighting
            if (this.solutionEditor) {
                const mode = this.getCodeMirrorMode(this.selectedLanguage);
                this.solutionEditor.setOption('mode', mode);
            this.starterEditor?.setOption('mode', mode);
            }

            // Update chapter options to show chapters for the new language
            this.updateChapterOptions();

            this.updateNewExerciseButton();
            this.populateExerciseList();
        });
    }

    async loadLanguages() {
        try {
            this.languages = await this.apiService.getLanguages();
            const capabilities = await this.apiService.getCapabilities();
            const starterOptions = document.getElementById('exercise-starter-options');
            if (starterOptions) starterOptions.hidden = !capabilities.exerciseStarters;
            this.functionTestsAvailable = !!capabilities.pythonFunctionTests;
            this.semanticArtifactsAvailable = !!capabilities.semanticArtifacts;
            this.documentArtifactsAvailable = !!capabilities.documentArtifacts;
            this.networkHostsAvailable = capabilities.restrictedNetwork ? capabilities.networkHosts || [] : [];
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

        select.innerHTML = languageOptions;

        // Validate saved language still exists in the list
        const savedLanguageExists = this.selectedLanguage &&
            this.languages.some(l => l.id === this.selectedLanguage);

        // Set default to first language if not already set or saved language doesn't exist
        if (!savedLanguageExists && this.languages.length > 0) {
            this.selectedLanguage = this.languages[0].id;
            // Save the default selection
            localStorage.setItem('admin-selected-language', this.selectedLanguage);
        }

        // Always ensure selectedLanguage is set to something if languages exist
        if (!this.selectedLanguage && this.languages.length > 0) {
            this.selectedLanguage = this.languages[0].id;
            localStorage.setItem('admin-selected-language', this.selectedLanguage);
        }

        select.value = this.selectedLanguage || '';

        console.log('Language selector initialized:', {
            selectedLanguage: this.selectedLanguage,
            selectValue: select.value,
            languagesCount: this.languages.length
        });

        // Update new exercise button text
        this.updateNewExerciseButton();
    }

    updateNewExerciseButton() {
        const btn = document.getElementById('new-exercise-btn');
        if (!btn || !this.selectedLanguage) return;

        const language = this.languages.find(l => l.id === this.selectedLanguage);
        const langName = language ? language.name : 'Exercise';

        btn.innerHTML = `<span>+</span> New ${langName} Exercise`;
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

        // Filter exercises by selected language (no 'all' option anymore)
        const filteredExercises = this.selectedLanguage
            ? this.exercises.filter(ex => {
                return ex.language_id === this.selectedLanguage ||
                    (ex.chapter_id && ex.chapter_id.startsWith(this.selectedLanguage));
            })
            : [];

        if (filteredExercises.length === 0) {
            const languageName = this.languages.find(l => l.id === this.selectedLanguage)?.name || 'this language';
            list.innerHTML = `<p class="no-files">No exercises found for ${languageName}. Click "+ New Exercise" to create one!</p>`;
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

            // No need for language tag since we're only showing one language at a time
            chapterDiv.innerHTML = `<div class="group-title">${chapter}</div>`;

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
        if (!this.selectedLanguage) {
            alert('Please select a language first.');
            return;
        }

        this.currentExercise = null;
        this.testCases = [];

        // Set current language info for database detection
        this.currentLanguageId = this.selectedLanguage;
        const language = this.languages.find(l => l.id === this.selectedLanguage);
        this.currentExerciseType = language?.exercise_type || 'programming';

        const languageName = language?.name || 'Exercise';
        document.getElementById('editor-title').textContent = `New ${languageName} Exercise`;
        document.getElementById('exercise-id').value = '';
        document.getElementById('exercise-id').disabled = false;
        document.getElementById('exercise-title').value = '';

        // Get first available chapter for this language or default
        this.updateChapterOptions();
        const chapterSelect = document.getElementById('exercise-chapter');
        if (chapterSelect.options.length > 0) {
            chapterSelect.selectedIndex = 0;
        }

        document.getElementById('exercise-description').value = '';
        this.setStarterCode(null);

        // Set CodeMirror mode for the selected language
        if (this.solutionEditor) {
            const mode = this.getCodeMirrorMode(this.selectedLanguage);
            this.solutionEditor.setOption('mode', mode);
            this.starterEditor?.setOption('mode', mode);
        }

        // Get code template from selected language
        const starterCode = language?.code_template || '#!/bin/bash\n\n# Write your solution here\n';
        this.solutionEditor.setValue(starterCode);

        this.renderTestCases();

        document.getElementById('admin-welcome').style.display = 'none';
        document.getElementById('exercise-editor').style.display = 'block';
        document.getElementById('test-preview').style.display = 'none';

        // Reset save button text
        document.getElementById('save-exercise-btn').textContent = 'Save exercise';
        this.setSaveStatus('');

        setTimeout(() => {
            this.solutionEditor.refresh();
                this.starterEditor?.refresh();
        }, 100);
    }

    createNewChapter() {
        // Use the currently selected language
        let languageId = this.selectedLanguage;

        if (!languageId) {
            alert('Please select a language first.');
            return;
        }

        const languageName = this.languages.find(l => l.id === languageId)?.name || 'this language';
        const chapterName = prompt(`Enter the name for the new chapter in ${languageName}:`);

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
            alert(`Chapter "${trimmedName}" already exists for ${languageName}!`);
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
        select.insertBefore(option, select.querySelector('[value="__new_chapter__"]') || null);
        select.value = trimmedName;
    }

    async editExercise(id) {
        try {
            const exercise = await this.apiService.getExerciseWithTests(id);
            this.currentExercise = exercise;
            this.testCases = exercise.testCases || [];

            // Store current language info for database detection
            this.selectedLanguage = exercise.language_id;
            localStorage.setItem('admin-selected-language', this.selectedLanguage);
            document.getElementById('admin-language-select').value = this.selectedLanguage;
            this.currentLanguageId = exercise.language_id;
            this.updateNewExerciseButton();
            this.populateExerciseList();
            const language = this.languages.find(l => l.id === exercise.language_id);
            this.currentExerciseType = language?.exercise_type || 'programming';

            document.getElementById('editor-title').textContent = `Edit: ${exercise.title}`;
            document.getElementById('exercise-id').value = exercise.id;
            document.getElementById('exercise-id').disabled = true;
            document.getElementById('exercise-title').value = exercise.title;
            this.updateChapterOptions(exercise.chapter);
            document.getElementById('exercise-description').value = exercise.description;
            this.setStarterCode(exercise.starter_code ?? null);

            // Set CodeMirror mode based on exercise language
            if (this.solutionEditor && exercise.language_id) {
                const mode = this.getCodeMirrorMode(exercise.language_id);
                this.solutionEditor.setOption('mode', mode);
            this.starterEditor?.setOption('mode', mode);
            }

            this.solutionEditor.setValue(exercise.solution);

            this.renderTestCases();

            document.getElementById('admin-welcome').style.display = 'none';
            document.getElementById('exercise-editor').style.display = 'block';
            document.getElementById('test-preview').style.display = 'none';

            document.getElementById('save-exercise-btn').textContent = 'Save changes';
            this.setSaveStatus('');

            setTimeout(() => {
                this.solutionEditor.refresh();
                this.starterEditor?.refresh();
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

    getBackUrl() {
        const params = new URLSearchParams(window.location.search);
        const exerciseId = params.get('edit');
        const fromWorkspace = params.get('from') === 'workspace'
            || (!params.has('from') && sessionStorage.getItem('returnToExercise') === exerciseId);
        return fromWorkspace && exerciseId
            ? `workspace.html?exercise=${encodeURIComponent(exerciseId)}`
            : 'admin/index.html';
    }

    returnToWorkspace() {
        return this.saveExercise(true);
    }

    setSaveStatus(message) {
        const status = document.getElementById('exercise-save-status');
        if (status) status.textContent = message;
    }

    renderArtifactControls(testCase, index) {
        return (testCase.outputFiles || []).map(filename => {
            const check = (testCase.artifactChecks || []).find(item => item.filename === filename);
            return `<div class="form-group-inline"><label>${escapeHtml(filename)} — file check</label>
                <select class="form-input" data-artifact-input data-artifact-mode data-index="${index}" data-path="${escapeHtml(filename)}">
                ${[['hash','Exact file hash'],['xlsx','Excel cells and types'],['sqlite','SQLite query results'],['image','Image pixels'], ...(this.documentArtifactsAvailable ? [['docx','Word text, headings and tables'],['pdf','PDF pages and text'],['plot','Plot appearance (with tolerance)']] : [])].map(([value,label]) => `<option value="${value}" ${(check?.kind || 'hash') === value ? 'selected' : ''}>${label}</option>`).join('')}</select>
                ${check?.kind === 'sqlite' ? `<label>Read-only queries (JSON array)</label><textarea class="form-input" rows="4" data-artifact-input data-artifact-queries data-index="${index}" data-path="${escapeHtml(filename)}">${escapeHtml(JSON.stringify(check.queries, null, 2))}</textarea><small>Each query needs name and sql. Add ORDER BY for ordered rows, or set ordered to false. Optional parameters is an array.</small>` : ''}
                ${check?.kind === 'xlsx' ? `<label>Sheets to check (comma-separated; empty checks all)</label><input class="form-input" data-artifact-input data-artifact-sheets data-index="${index}" data-path="${escapeHtml(filename)}" value="${escapeHtml((check.sheets || []).join(', '))}"><small>Checks values, types and formula text; ignores formatting.</small>` : ''}
                ${check?.kind === 'docx' ? `<label><input type="checkbox" data-artifact-input data-artifact-option data-key="headings" data-index="${index}" data-path="${escapeHtml(filename)}" ${check.headings !== false ? 'checked' : ''}> Check heading levels as well as text and tables</label><small>Ignores fonts, page layout, headers, footers and embedded images.</small>` : ''}
                ${check?.kind === 'pdf' ? `<label><input type="checkbox" data-artifact-input data-artifact-option data-key="layout" data-index="${index}" data-path="${escapeHtml(filename)}" ${check.layout ? 'checked' : ''}> Also check page sizes and text positions</label><label>Position tolerance (points)</label><input type="number" min="0" max="10" step="0.1" class="form-input" data-artifact-input data-artifact-option data-key="positionTolerance" data-index="${index}" data-path="${escapeHtml(filename)}" value="${check.positionTolerance ?? 2}"><small>Always checks page count and text. Scanned text and graphics require other checks.</small>` : ''}
                ${check?.kind === 'plot' ? `<small>Checks dimensions and decoded appearance on a white background. Grade the underlying data separately.</small>${[['channelTolerance','Channel tolerance',3,0,20,1],['maxDifferentPixelRatio','Maximum changed-pixel fraction',0.005,0,0.05,0.001],['maxMeanAbsoluteError','Maximum mean channel error',0.5,0,10,0.1]].map(([key,label,value,min,max,step]) => `<label>${label}</label><input type="number" class="form-input" data-artifact-input data-artifact-option data-key="${key}" data-index="${index}" data-path="${escapeHtml(filename)}" min="${min}" max="${max}" step="${step}" value="${check[key] ?? value}">`).join('')}` : ''}
                ${check?.kind === 'image' ? '<small>Checks dimensions and every decoded RGBA pixel; ignores file format and metadata.</small>' : ''}
                </div>`;
        }).join('');
    }

    validateFunctionInputs() {
        for (const field of document.querySelectorAll?.('[data-function-input], [data-artifact-input]') || []) {
            if (!field.reportValidity()) return false;
        }
        return true;
    }

    async testSolution() {
        if (!this.validateFunctionInputs()) return;
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

                // Get exercise_type from the selected language
                const selectedLangObj = this.languages.find(l => l.id === this.selectedLanguage);
                const exerciseType = selectedLangObj?.exercise_type || 'programming';
                const isDatabaseExercise = exerciseType === 'database';

                const result = await this.apiService.runTestCase(solution, {
                    languageId: this.selectedLanguage,
                    exerciseType: exerciseType,
                    arguments: testCase.arguments || [],
                    input: testCase.input || [],
                    fixtures: fixtures,
                    outputFiles: testCase.outputFiles || [],
                    artifactChecks: testCase.artifactChecks || [],
                    networkHosts: testCase.networkHosts || [],
                    expectedOutputFiles: testCase.expectedOutputFiles || [],
                    functionTest: testCase.functionTest || null,
                    useDynamicOutput: !!testCase.useDynamicOutput,
                    validationQuery: (isDatabaseExercise && testCase.validationQuery) ? testCase.validationQuery : null
                });

                if (testCase.functionTest && (result.exitCode !== 0 || result.error || result.timedOut || result.outputLimited)) {
                    throw new Error(`Function reference test ${i + 1} failed: ${result.error || result.stderr || 'execution limit'}`);
                }
                if ((result.fileHashes || []).some(file => !file.exists || file.artifact?.error)) {
                    throw new Error(`Reference output file failed: ${(result.fileHashes || []).find(file => !file.exists || file.artifact?.error)?.artifact?.error || 'file missing'}`);
                }
                this.testCases[i].expectedOutput = result.output;
                this.testCases[i].expectedStderr = result.stderr || '';
                this.testCases[i].expectedExitCode = result.exitCode;

                // Store validation results if present (database exercises only)
                if (isDatabaseExercise && result.validationOutput !== undefined) {
                    this.testCases[i].expectedValidationOutput = result.validationOutput;
                    console.log(`[Test Case ${i + 1}] Stored validation output:`, result.validationOutput?.substring(0, 100));
                }

                // Store file hashes if any output files were specified
                this.testCases[i].expectedOutputFiles = [];
                if (result.fileHashes && result.fileHashes.length > 0) {
                    this.testCases[i].expectedOutputFiles = result.fileHashes.map(fh => ({
                        filename: fh.filename,
                        sha256: fh.sha256,
                        type: fh.type,
                        linkTarget: fh.linkTarget,
                        entries: fh.entries,
                        artifact: fh.artifact || null
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
                                    <small style="color: var(--text-muted);">Type: ${fh.type}</small><br>
                                    ${fh.artifact ? renderArtifactFeedback({kind: fh.artifact.kind, totalDifferences: 0, differences: [], actualPreview: fh.artifact.preview}) : ''}
                                    ${fh.sha256 && !fh.artifact ? `<small style="color: var(--text-muted);">${fh.type === 'directory' ? 'Tree SHA-256' : 'SHA-256'}: ${fh.sha256}</small><br>` : ''}
                                    ${fh.type === 'link' ? `<small style="color: var(--text-muted);">Target: ${escapeHtml(fh.linkTarget)}</small><br>` : ''}
                                    <small style="color: var(--text-muted);">Size: ${fh.size} bytes</small>
                                ` : `<small style="color: var(--accent-red);">${fh.error || 'File not found'}</small>`}
                            </div>
                        `;
                    });
                }

                const outputHtml = this.formatDatabaseOutput(result.output, this.selectedLanguage);
                const validationHtml = (isDatabaseExercise && result.validationOutput !== undefined)
                    ? this.formatDatabaseOutput(result.validationOutput, this.selectedLanguage)
                    : null;

                console.log(`[Test Case ${i + 1}] Display validation:`, {
                    isDatabaseExercise,
                    hasValidationOutput: !!result.validationOutput,
                    willShowValidation: !!validationHtml
                });

                resultsHtml += `
                    <div class="test-result-details">
                        <p><strong>Arguments:</strong> ${(testCase.arguments || []).join(', ') || '(none)'}</p>
                        <p><strong>Input:</strong> ${(testCase.input || []).length} lines</p>
                        <p><strong>Fixtures Used:</strong> ${fixtures.join(', ') || '(none)'}</p>
                        ${fileHashesHtml}
                        <p><strong>${isDatabaseExercise ? 'Solution Query' : 'Solution'} Output:</strong></p>
                        ${outputHtml}
                        ${!isDatabaseExercise && result.stderr ? `
                            <p><strong>STDERR:</strong></p>
                            <pre class="test-output-preview">${escapeHtml(result.stderr)}</pre>
                        ` : ''}
                        <p><strong>Exit Code:</strong> ${result.exitCode}</p>
                        ${isDatabaseExercise && validationHtml ? `
                            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color); background: rgba(137, 180, 250, 0.1); padding: 1rem; border-radius: 8px;">
                                <p><strong>🔍 Validation Query Output (Database State Check):</strong></p>
                                ${validationHtml}
                                ${result.validationStderr ? `
                                    <p><strong>Validation STDERR:</strong></p>
                                    <pre class="test-output-preview">${escapeHtml(result.validationStderr)}</pre>
                                ` : ''}
                                <p><strong>Validation Exit Code:</strong> ${result.validationExitCode}</p>
                            </div>
                        ` : ''}
                    </div>
                `;

                resultsHtml += '</div>';
            }

            console.log('[Before renderTestCases] Test cases state:', this.testCases.map((tc, i) => ({
                index: i,
                hasExpectedOutput: !!tc.expectedOutput,
                hasExpectedValidationOutput: !!tc.expectedValidationOutput,
                expectedValidationOutputLength: tc.expectedValidationOutput?.length || 0
            })));

            this.renderTestCases();

            // Manually update readonly textarea values after render (fixes display issue with readonly fields)
            this.testCases.forEach((tc, index) => {
                if (tc.expectedValidationOutput) {
                    const field = document.querySelector(`[data-field="expectedValidationOutput"][data-index="${index}"]`);
                    if (field) {
                        field.value = tc.expectedValidationOutput;
                        console.log(`[Manual Update] Set validation output for test case ${index + 1}, length: ${tc.expectedValidationOutput.length}`);
                    }
                }
                // Also update expectedOutput field
                if (tc.expectedOutput) {
                    const outputField = document.querySelector(`[data-field="expectedOutput"][data-index="${index}"]`);
                    if (outputField) {
                        outputField.value = tc.expectedOutput;
                    }
                }
            });

            document.getElementById('test-results-container').innerHTML = resultsHtml;
            document.getElementById('test-preview').style.display = 'block';
            document.getElementById('save-exercise-btn').textContent =
                this.currentExercise ? 'Save changes' : 'Save exercise';
            this.setSaveStatus('Unsaved changes');
        } catch (error) {
            alert('Failed to test solution: ' + error.message);
        } finally {
            testBtn.innerHTML = '<span>Test Solution</span>';
            testBtn.disabled = false;
        }
    }

    async saveExercise(openWorkspace = false) {
        if (!this.validateFunctionInputs()) return;
        if (this.testCases.some(test => (test.artifactChecks || []).some(check => {
            const reference = (test.expectedOutputFiles || []).find(file => file.filename === check.filename)?.artifact;
            return !reference?.data || reference.error || reference.kind !== check.kind;
        }))) {
            alert('Test the reference solution before saving the generated-file checks');
            return;
        }
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

        // Ensure a language is selected
        if (!this.selectedLanguage) {
            alert('Please select a language from the dropdown at the top of the page.');
            return;
        }

        const exerciseData = {
            id,
            title,
            chapter,
            order,
            description,
            solution,
            starter_code: document.getElementById('exercise-use-starter')
                ? (document.getElementById('exercise-use-starter').checked
                    ? (this.starterEditor?.getValue() ?? document.getElementById('exercise-starter-code').value) : null)
                : this.currentExercise?.starter_code,
            testCases: this.testCases,
            language_id: this.selectedLanguage // Include the currently selected language
        };

        // Debug: Log exercise data being saved
        console.log('[Frontend] Saving exercise:', {
            id,
            chapter,
            language_id: this.selectedLanguage,
            currentExerciseType: this.currentExerciseType
        });

        // Debug: Log test cases to verify expectedValidationOutput is present
        console.log('[Frontend] Saving exercise with test cases:', this.testCases.map((tc, i) => ({
            index: i,
            hasValidationQuery: !!tc.validationQuery,
            hasExpectedValidationOutput: !!tc.expectedValidationOutput,
            validationQuery: tc.validationQuery?.substring(0, 50),
            expectedValidationOutput: tc.expectedValidationOutput?.substring(0, 50)
        })));

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
        if (saveBtn.disabled) return;
        const workspaceBtn = document.getElementById('back-to-workspace-btn');
        saveBtn.disabled = true;
        workspaceBtn.disabled = true;
        this.setSaveStatus('Saving…');

        try {
            if (this.currentExercise) {
                await this.apiService.updateExercise(id, exerciseData);
            } else {
                await this.apiService.createExercise(exerciseData);
            }

            this.currentExercise = exerciseData;
            document.getElementById('exercise-id').disabled = true;
            document.getElementById('editor-title').textContent = `Edit: ${title}`;
            saveBtn.textContent = 'Save changes';
            this.setSaveStatus('Saved. You can keep editing or select another exercise.');
            await this.loadExercises();
            if (openWorkspace) {
                sessionStorage.removeItem('returnToExercise');
                navigateTo(`workspace.html?exercise=${encodeURIComponent(id)}`);
            }
        } catch (error) {
            this.setSaveStatus('Save failed. Your edits are still here.');
            alert('Failed to save exercise: ' + error.message);
        } finally {
            saveBtn.disabled = false;
            workspaceBtn.disabled = false;
        }
    }

    discardChanges() {
        if (confirm('Close the editor? Any unsaved changes will be lost.')) {
            this.cancelEdit();
        }
    }

    formatOutputFiles(files) {
        if (!files || files.length === 0) return '';
        return files.map(f => {
            const type = f.artifact ? `${f.artifact.kind} content` : f.type || 'file';
            const hash = f.sha256 && !f.artifact ? `: ${f.sha256.substring(0, 16)}...` : '';
            return `${f.filename} (${type})${hash}`;
        }).join('\n');
    }

    modifyProceed() {
        document.getElementById('test-preview').style.display = 'none';
        setTimeout(() => {
            this.solutionEditor.refresh();
                this.starterEditor?.refresh();
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
        this.setSaveStatus('Unsaved changes');
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
        this.setSaveStatus('Unsaved changes');
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

        // Check if this is a database exercise
        const isDatabaseExercise = this.currentExerciseType === 'database';

        console.log('[renderTestCases] Rendering test cases:', this.testCases.map((tc, i) => ({
            index: i,
            hasValidationQuery: !!tc.validationQuery,
            hasExpectedValidationOutput: !!tc.expectedValidationOutput,
            expectedValidationOutputPreview: tc.expectedValidationOutput?.substring(0, 50)
        })));

        this.testCases.forEach((testCase, index) => {
            const isFunctionTest = !!testCase.functionTest;
            const testCaseDiv = document.createElement('div');
            testCaseDiv.className = 'test-case-item';

            // Build fixture files options
            const fixtureOptions = this.availableFiles.map(f => {
                const isSelected = (testCase.fixtures || []).includes(f.filename);
                return `<option value="${f.filename}" ${isSelected ? 'selected' : ''}>${f.filename}</option>`;
            }).join('');

            // Database-specific help text
            const fixtureHelpText = isDatabaseExercise
                ? 'Select .sql files for MariaDB or .js files for MongoDB to initialize the database'
                : 'Hold Ctrl/Cmd to select multiple files';

            testCaseDiv.innerHTML = `
                <div class="test-case-header">
                    <span>Test Case ${index + 1}${isDatabaseExercise ? ' (Database Exercise)' : ''}</span>
                    <button type="button" class="icon-btn delete" data-index="${index}">
                        <span>🗑</span>
                    </button>
                </div>
                <div class="test-case-fields">
                    <div class="form-group-inline">
                        <label>Fixture Files ${isDatabaseExercise ? '(Database Initialization Files)' : '(files needed for this test)'}</label>
                        <select multiple class="form-input fixture-select" data-field="fixtures" data-index="${index}"
                                 style="min-height: 80px;">
                            ${fixtureOptions || '<option disabled>No files available - upload files first</option>'}
                        </select>
                        <small style="color: var(--text-muted); font-size: 0.85rem;">${fixtureHelpText}</small>
                    </div>
                    ${this.selectedLanguage === 'python' && this.functionTestsAvailable ? `
                    <div class="form-group-inline">
                        <label>Test mode</label>
                        <select class="form-input" data-field="testMode" data-index="${index}">
                            <option value="script" ${!isFunctionTest ? 'selected' : ''}>Run script</option>
                            <option value="function" ${isFunctionTest ? 'selected' : ''}>Call a function</option>
                        </select>
                    </div>` : ''}
                    ${isFunctionTest ? `
                    <div class="form-group-inline">
                        <label>Function name</label>
                        <input class="form-input" data-field="functionName" data-function-input data-index="${index}"
                            value="${escapeHtml(testCase.functionTest.name)}" required pattern="[A-Za-z_][A-Za-z0-9_]{0,99}" placeholder="double">
                    </div>
                    <div class="form-group-inline">
                        <label>Positional arguments (JSON array)</label>
                        <textarea class="form-input" data-field="functionArgs" data-function-input data-index="${index}"
                            rows="2">${escapeHtml(JSON.stringify(testCase.functionTest.args || []))}</textarea>
                        <small>For example: [6] or ["sample A", 3]. Values are passed directly to the function.</small>
                    </div>
                    <div class="form-group-inline">
                        <label>Keyword arguments (JSON object)</label>
                        <textarea class="form-input" data-field="functionKwargs" data-function-input data-index="${index}"
                            rows="2">${escapeHtml(JSON.stringify(testCase.functionTest.kwargs || {}))}</textarea>
                        <small>For example: {"times": 3}. The expected return value is filled by testing the reference solution.</small>
                    </div>` : ''}
                    ${!isDatabaseExercise && !isFunctionTest ? `
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
                    ` : ''}
                    ${isDatabaseExercise ? `
                    <div class="form-group-inline" style="background: #2a3a4a; padding: 1rem; border-radius: 8px; border-left: 4px solid var(--accent-blue);">
                        <label style="color: var(--accent-blue); font-weight: 600;">🔍 Validation Query (checks database state after user's query)</label>
                        <textarea class="form-input" data-field="validationQuery" data-index="${index}"
                                   rows="3" placeholder="SELECT * FROM users;\nOR\ndb.users.find();">${testCase.validationQuery || ''}</textarea>
                        <small style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.5rem; display: block;">
                            💡 <strong>Validation Query runs AFTER the user's query</strong> to check the actual database state.<br>
                            • For CREATE TABLE: <code>SHOW CREATE TABLE tablename;</code><br>
                            • For INSERT/UPDATE: <code>SELECT * FROM tablename ORDER BY id;</code><br>
                            • For DELETE: <code>SELECT COUNT(*) FROM tablename;</code><br>
                            • MongoDB: <code>db.collection.find();</code> or <code>db.collection.countDocuments();</code>
                        </small>
                    </div>
                    <div class="form-group-inline">
                        <label>Expected Validation Output (auto-filled when testing)</label>
                        <textarea class="form-input readonly-result" data-field="expectedValidationOutput" data-index="${index}"
                                   rows="3" placeholder="Run tests to populate..." readonly 
                                   data-has-value="${!!testCase.expectedValidationOutput}">${escapeHtml(testCase.expectedValidationOutput || '')}</textarea>
                        <small style="color: var(--text-muted); font-size: 0.85rem;">Expected result from the validation query - used for pass/fail comparison</small>
                    </div>
                    ` : ''}
                    ${!isDatabaseExercise ? `
                    <div class="form-group-inline">
                        <label>Expected Output Paths (comma-separated names to verify)</label>
                        <input type="text" class="form-input" data-field="outputFiles" data-index="${index}"
                                value="${escapeHtml((testCase.outputFiles || []).join(', '))}" placeholder="output.txt, result.tar.gz">
                        <small style="color: var(--text-muted); font-size: 0.85rem;">Choose a content check below, or use exact file hashes; directories and symbolic links are verified by type</small>
                    </div>
                    ` : ''}
                    <div class="form-group-inline">
                        <label>${isFunctionTest ? 'Expected return value' : 'Expected Output'} ${isDatabaseExercise ? '(Database Query Result)' : '(auto-filled when testing)'}</label>
                        <textarea class="form-input readonly-result" data-field="expectedOutput" data-index="${index}"
                                   rows="3" placeholder="Run tests to populate..." readonly>${testCase.expectedOutput || ''}</textarea>
                        ${isDatabaseExercise ? '<small style="color: var(--text-muted); font-size: 0.85rem;">Expected output from the validation query</small>' : ''}
                    </div>
                    ${this.selectedLanguage === 'python' && this.networkHostsAvailable.length ? `<div class="form-group-inline"><label>Allowed HTTPS websites for this test</label><select multiple class="form-input" data-field="networkHosts" data-index="${index}" style="min-height:100px">${this.networkHostsAvailable.map(host => `<option value="${escapeHtml(host)}" ${(testCase.networkHosts || []).includes(host) ? 'selected' : ''}>${escapeHtml(host)}</option>`).join('')}</select><small>Hold Ctrl/Cmd to select sites. Empty means offline. Redirect destinations must also be selected. Live data can change; use stable inputs for grading.</small></div>` : ''}
                    ${!isDatabaseExercise && this.semanticArtifactsAvailable ? this.renderArtifactControls(testCase, index) : ''}
                    ${!isDatabaseExercise ? `
                    <div class="form-group-inline">
                        <label>Expected STDERR (auto-filled when testing)</label>
                        <textarea class="form-input readonly-result" data-field="expectedStderr" data-index="${index}"
                                   rows="2" placeholder="Run tests to populate..." readonly>${testCase.expectedStderr || ''}</textarea>
                    </div>
                    <div class="form-group-inline">
                        <label>Expected Output Path State (auto-filled when testing)</label>
                        <textarea class="form-input readonly-result" data-field="expectedOutputFiles" data-index="${index}"
                                   rows="2" placeholder="Run tests to populate..." readonly>${this.formatOutputFiles(testCase.expectedOutputFiles || [])}</textarea>
                    </div>
                    <div class="form-group-inline">
                        <label>Expected Exit Code (auto-filled when testing)</label>
                        <input type="number" class="form-input readonly-result" data-field="expectedExitCode" data-index="${index}"
                                value="${testCase.expectedExitCode || 0}" readonly>
                    </div>
                    ` : ''}
                    ${!isFunctionTest ? `<div class="form-group-inline">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" data-field="useDynamicOutput" data-index="${index}"
                                   ${testCase.useDynamicOutput ? 'checked' : ''} 
                                   style="width: auto; cursor: pointer;">
                            <span>Use Dynamic Output (re-run solution each time)</span>
                        </label>
                        <small style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem; display: block;">
                            Enable this for changing output (e.g., date commands or directory listings).
                            The solution regenerates expected text and output path contents for each run. The runner script is kept outside the working directory.
                        </small>
                    </div>` : ''}
                </div>
            `;
            container.appendChild(testCaseDiv);
        });

        installExerciseHelp(container);

        container.querySelectorAll('[data-field]').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;
                let value = e.target.value;

                if (field === 'testMode') {
                    this.testCases[index].functionTest = value === 'function' ? { name: '', args: [], kwargs: {} } : null;
                    this.testCases[index].arguments = [];
                    this.testCases[index].input = [];
                    this.testCases[index].useDynamicOutput = false;
                    delete this.testCases[index].expectedOutput;
                    this.renderTestCases();
                    return;
                }
                if (field === 'functionName') {
                    this.testCases[index].functionTest.name = value.trim();
                    delete this.testCases[index].expectedOutput;
                    return;
                }
                if (field === 'functionArgs' || field === 'functionKwargs') {
                    try {
                        const parsed = JSON.parse(value);
                        const valid = field === 'functionArgs' ? Array.isArray(parsed)
                            : parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
                        if (!valid) throw new Error('Wrong JSON type');
                        e.target.setCustomValidity('');
                        this.testCases[index].functionTest[field === 'functionArgs' ? 'args' : 'kwargs'] = parsed;
                        delete this.testCases[index].expectedOutput;
                    } catch {
                        e.target.setCustomValidity(field === 'functionArgs' ? 'Enter a valid JSON array' : 'Enter a valid JSON object');
                        e.target.reportValidity();
                    }
                    return;
                }
                if (field === 'fixtures' || field === 'networkHosts') {
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
                } else if (field === 'validationQuery') {
                    // Keep as string, trim whitespace
                    value = value.trim();
                }

                this.testCases[index][field] = value;
                if (field === 'outputFiles') {
                    this.testCases[index].artifactChecks = (this.testCases[index].artifactChecks || []).filter(check => value.includes(check.filename));
                    this.renderTestCases();
                }
            });
        });

        container.querySelectorAll('[data-artifact-input]').forEach(field => field.addEventListener('change', () => {
            const test = this.testCases[Number(field.dataset.index)];
            const filename = field.dataset.path;
            test.artifactChecks ||= [];
            if (field.hasAttribute('data-artifact-mode')) {
                test.artifactChecks = test.artifactChecks.filter(check => check.filename !== filename);
                if (field.value !== 'hash') test.artifactChecks.push({filename, kind: field.value, ...(field.value === 'sqlite' ? {queries: [{name: 'result', sql: 'SELECT * FROM results ORDER BY 1', ordered: true}]} : {})});
                delete test.expectedOutputFiles;
                this.renderTestCases();
                return;
            }
            const check = test.artifactChecks.find(item => item.filename === filename);
            if (field.hasAttribute('data-artifact-option')) {
                if (!field.reportValidity()) return;
                check[field.dataset.key] = field.type === 'checkbox' ? field.checked : Number(field.value);
            }
            if (field.hasAttribute('data-artifact-sheets')) check.sheets = field.value.split(',').map(item => item.trim()).filter(Boolean);
            if (field.hasAttribute('data-artifact-queries')) {
                try {
                    const queries = JSON.parse(field.value);
                    if (!Array.isArray(queries) || !queries.length || queries.length > 8 || queries.some(query => !query.name || typeof query.sql !== 'string' || !/^\s*(SELECT|WITH)\b/i.test(query.sql))) throw new Error('Invalid queries');
                    check.queries = queries;
                    field.setCustomValidity('');
                } catch { field.setCustomValidity('Enter a JSON array of 1–8 named SELECT queries'); field.reportValidity(); return; }
            }
            delete test.expectedOutputFiles;
        }));

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

    updateChapterOptions(savedChapter = null) {
        const select = document.getElementById('exercise-chapter');
        const currentValue = savedChapter ?? select.value;

        // Only show chapters for the currently selected language
        const languageExercises = this.selectedLanguage
            ? this.exercises.filter(ex => ex.language_id === this.selectedLanguage)
            : this.exercises;

        const chaptersSet = new Set();
        const chaptersData = [];

        languageExercises.forEach(ex => {
            if (ex.chapter && !chaptersSet.has(ex.chapter)) {
                chaptersSet.add(ex.chapter);
                chaptersData.push({
                    name: ex.chapter,
                    order: ex.chapter_order || 0
                });
            }
        });

        if (savedChapter && !chaptersSet.has(savedChapter)) {
            chaptersData.push({ name: savedChapter, order: 0 });
        }

        // Sort chapters by order
        chaptersData.sort((a, b) => a.order - b.order);

        select.innerHTML = '';

        // Add chapters as options
        chaptersData.forEach(chapter => {
            const option = document.createElement('option');
            option.value = chapter.name;
            option.textContent = chapter.name;
            select.appendChild(option);
        });

        // Add "Create New Chapter" option
        const newChapterOption = document.createElement('option');
        newChapterOption.value = '__new_chapter__';
        newChapterOption.textContent = '+ Create New Chapter...';
        select.appendChild(newChapterOption);

        // Restore selection if it still exists
        if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
            select.value = currentValue;
        } else if (chaptersData.length > 0) {
            select.value = chaptersData[0].name;
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
            await this.apiService.reorderExercises(newOrder);
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
        if (this.bulkVerificationRunning) return;
        this.bulkVerificationRunning = true;
        const button = document.getElementById('bulk-verify-btn');
        if (button) button.disabled = true;
        const statusDiv = document.getElementById('verification-status');
        const resultsDiv = document.getElementById('verification-results');

        const languageName = this.languages.find(l => l.id === this.selectedLanguage)?.name || 'selected language';
        statusDiv.innerHTML = `<p>Running tests for ${languageName} exercises...</p><div class="progress-bar"><div id="verification-progress" class="progress-fill" style="width: 0%;"></div></div>`;
        resultsDiv.innerHTML = '';

        const verificationResults = [];
        let completedExercises = 0;
        const activeExercises = new Map();
        let totalTests = 0;
        let changedTests = 0;
        let errorTests = 0;

        // Filter exercises for selected language only, with solutions
        const exercisesWithSolutions = this.exercises.filter(ex => {
            const matchesLanguage = ex.language_id === this.selectedLanguage ||
                (ex.chapter_id && ex.chapter_id.startsWith(this.selectedLanguage));
            return matchesLanguage && ex.solution && ex.solution.trim();
        });

        const updateProgress = () => {
            const progress = exercisesWithSolutions.length
                ? (completedExercises / exercisesWithSolutions.length) * 100 : 100;
            statusDiv.innerHTML = '<p></p><div class="progress-bar"><div class="progress-fill"></div></div>';
            const activeTitles = [...activeExercises.values()].join(' · ');
            statusDiv.querySelector('p').textContent =
                `${completedExercises}/${exercisesWithSolutions.length} exercises verified${activeTitles ? ` — testing ${activeTitles}` : ''}`;
            statusDiv.querySelector('.progress-fill').style.width = `${progress}%`;
        };
        const verifyExercise = async (exercise, index) => {
            activeExercises.set(index, exercise.title);
            updateProgress();
            try {
                // Get full exercise data with test cases (admin endpoint)
                const fullExercise = await this.apiService.getExerciseWithTests(exercise.id);

                if (!fullExercise.testCases || fullExercise.testCases.length === 0) {
                    return;
                }

                const testCaseResults = [];

                // Run each test case
                for (const testCase of fullExercise.testCases) {
                    totalTests++;
                    const fixtures = testCase.fixtures || [];

                    try {
                        const result = await this.apiService.runTestCase(fullExercise.solution, {
                            languageId: fullExercise.language_id || fullExercise.language || 'bash',
                            arguments: testCase.arguments || [],
                            input: testCase.input || [],
                            fixtures: fixtures,
                            functionTest: testCase.functionTest || null,
                            exerciseType: fullExercise.exercise_type || 'programming',
                            outputFiles: testCase.outputFiles || [],
                    artifactChecks: testCase.artifactChecks || [],
                    networkHosts: testCase.networkHosts || [],
                    expectedOutputFiles: testCase.expectedOutputFiles || [],
                            useDynamicOutput: !!testCase.useDynamicOutput,
                            validationQuery: testCase.validationQuery || null
                        });

                        // Compare with the same whitespace rules as student grading.
                        const { outputChanged, stderrChanged, exitCodeChanged, filesChanged, hasChanges } =
                            compareTestOutputs(result, testCase);

                        if (hasChanges) {
                            changedTests++;
                        }

                        testCaseResults.push({
                            testCase,
                            newResult: result,
                            hasChanges,
                            outputChanged,
                            stderrChanged,
                            exitCodeChanged, filesChanged
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
                    verificationResults[index] = {
                        exercise: fullExercise,
                        testCaseResults
                    };
                }
            } catch (error) {
                console.error(`Error verifying ${exercise.title}:`, error);
                errorTests++;
            } finally {
                activeExercises.delete(index);
                completedExercises++;
                updateProgress();
            }
        };

        // Two exercise workers use the existing server execution queue. Each
        // exercise keeps its test cases sequential and its own isolated runs.
        let nextExercise = 0;
        const worker = async () => {
            while (nextExercise < exercisesWithSolutions.length) {
                const index = nextExercise++;
                await verifyExercise(exercisesWithSolutions[index], index);
            }
        };
        try {
            const workers = Array.from({ length: Math.min(2, exercisesWithSolutions.length) }, worker);
            const settled = await Promise.allSettled(workers);
            const failure = settled.find(result => result.status === 'rejected');
            if (failure) throw failure.reason;
            this.displayVerificationResults(verificationResults.filter(Boolean), totalTests, changedTests, errorTests);
        } finally {
            this.bulkVerificationRunning = false;
            if (button) button.disabled = false;
        }
    }

    displayVerificationResults(results, totalTests, changedTests, errorTests) {
        const statusDiv = document.getElementById('verification-status');
        const resultsDiv = document.getElementById('verification-results');

        const languageName = this.languages.find(l => l.id === this.selectedLanguage)?.name || 'selected language';

        // Summary
        const unchangedTests = totalTests - changedTests - errorTests;
        statusDiv.innerHTML = `
            <div class="verification-summary">
                <h3>Verification Complete - ${languageName}</h3>
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
                    const { testCase, newResult, outputChanged, stderrChanged, exitCodeChanged, filesChanged } = testResult;

                    let changesHtml = filesChanged ? '<p>Generated files changed</p>' + (newResult.fileComparisons || []).map(file => `<div><strong>${escapeHtml(file.filename)}</strong>${file.artifact ? renderArtifactFeedback(file.artifact) : `<p>${file.matches ? 'Match' : 'Mismatch'}</p>`}</div>`).join('') : '';

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
            if (testResult.newResult.error || testResult.newResult.timedOut || testResult.newResult.outputLimited
                || (testResult.newResult.fileHashes || []).some(file => !file.exists || file.artifact?.error)) {
                throw new Error('Reference run failed; fix the solution or file checks before approving');
            }

            // Update the test case with new values
            exercise.testCases[testIndex].expectedOutput = testResult.newResult.output || '';
            exercise.testCases[testIndex].expectedStderr = testResult.newResult.stderr || '';
            exercise.testCases[testIndex].expectedExitCode = testResult.newResult.exitCode;

            exercise.testCases[testIndex].expectedOutputFiles = (testResult.newResult.fileHashes || []).map(file => ({ filename: file.filename, type: file.type, sha256: file.sha256, linkTarget: file.linkTarget, entries: file.entries, artifact: file.artifact || null }));

            // Save the updated exercise
            await this.apiService.updateExercise(exerciseId, {
                title: exercise.title,
                description: exercise.description,
                solution: exercise.solution,
                starter_code: exercise.starter_code,
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



