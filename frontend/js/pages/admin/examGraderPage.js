// frontend/js/pages/admin/examGraderPage.js
import ApiService from '../../services/apiService.js';
import AuthComponent from '../../components/authComponent.js';
import NotificationBanner from '../../components/notificationBanner.js';
import { navigateTo } from '../../utils/navigationUtils.js';
import { setupAdminCommon } from './adminUtils.js';
import { setFavicon } from '../../utils/faviconUtils.js';

class ExamGraderPage {
    constructor() {
        this.apiService = new ApiService();
        this.authComponent = new AuthComponent(this.apiService);
        this.notificationBanner = new NotificationBanner();

        window.authComponent = this.authComponent;

        this.selectedFile = null;
        this.gradingConfig = {
            tasks: []
        };
        this.gradingResults = null;
        this.availableFixtures = [];

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

        // Load available fixtures
        await this.loadAvailableFixtures();

        // Setup event listeners
        this.setupEventListeners();

        // Add sample task
        this.addSampleTask();
    }

    setupEventListeners() {
        // Back button and logout are handled by setupAdminCommon

        // File upload
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');

        uploadArea.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
            }
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                this.handleFileSelect(e.dataTransfer.files[0]);
            }
        });

        // Add task button
        document.getElementById('add-task-btn').addEventListener('click', () => this.addTask());

        // Grade button
        document.getElementById('grade-btn').addEventListener('click', () => this.gradeSubmissions());

        // Export CSV button
        document.getElementById('export-csv-btn').addEventListener('click', () => this.exportToCSV());

        // Import/Export config buttons
        document.getElementById('import-config-btn').addEventListener('click', () => {
            document.getElementById('config-file-input').click();
        });

        document.getElementById('config-file-input').addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                await this.importConfiguration(e.target.files[0]);
            }
        });

        document.getElementById('export-config-btn').addEventListener('click', () => this.exportConfiguration());
    }

    async loadAvailableFixtures() {
        try {
            const fixtures = await this.apiService.getFixtureFiles();
            this.availableFixtures = fixtures.filter(f => f.type === 'file').map(f => f.filename);
            console.log('Available fixtures:', this.availableFixtures);
        } catch (error) {
            console.error('Error loading fixtures:', error);
            this.availableFixtures = [];
        }
    }

    handleFileSelect(file) {
        if (!file.name.endsWith('.zip')) {
            alert('Please select a ZIP file');
            return;
        }

        this.selectedFile = file;
        document.getElementById('file-info').innerHTML = `
            <strong>Selected file:</strong> ${file.name} (${(file.size / 1024).toFixed(2)} KB)
        `;

        this.updateGradeButton();
    }

    updateGradeButton() {
        const btn = document.getElementById('grade-btn');
        btn.disabled = !this.selectedFile || this.gradingConfig.tasks.length === 0;
    }

    addSampleTask() {
        const task = {
            name: 'Backup Script',
            scriptName: 'backup_script.sh',
            solutionScriptContent: '',
            tests: [],
            codeRules: []
        };

        this.gradingConfig.tasks.push(task);
        this.renderTasks();
        this.updateGradeButton();
    }

    addTask() {
        const task = {
            name: `Task ${this.gradingConfig.tasks.length + 1}`,
            scriptName: 'script.sh',
            solutionScriptContent: '',
            tests: [],
            codeRules: []
        };

        this.gradingConfig.tasks.push(task);
        this.renderTasks();
        this.updateGradeButton();
    }

    removeTask(index) {
        if (confirm('Are you sure you want to remove this task?')) {
            this.gradingConfig.tasks.splice(index, 1);
            this.renderTasks();
            this.updateGradeButton();
        }
    }

    addTest(taskIndex) {
        const test = {
            description: 'Test case',
            arguments: [],
            inputs: [],
            fixtures: [],
            expectedOutputFiles: [],
            points: 1
        };

        this.gradingConfig.tasks[taskIndex].tests.push(test);
        this.renderTasks();
    }

    removeTest(taskIndex, testIndex) {
        this.gradingConfig.tasks[taskIndex].tests.splice(testIndex, 1);
        this.renderTasks();
    }

    addCodeRule(taskIndex) {
        const rule = {
            description: 'Code check',
            pattern: '',
            flags: '',
            points: 0.5
        };

        this.gradingConfig.tasks[taskIndex].codeRules.push(rule);
        this.renderTasks();
    }

    removeCodeRule(taskIndex, ruleIndex) {
        this.gradingConfig.tasks[taskIndex].codeRules.splice(ruleIndex, 1);
        this.renderTasks();
    }

    renderTasks() {
        const container = document.getElementById('tasks-container');
        container.innerHTML = '';

        this.gradingConfig.tasks.forEach((task, taskIndex) => {
            const taskDiv = document.createElement('div');
            taskDiv.className = 'task-config';

            taskDiv.innerHTML = `
                <div class="task-header">
                    <h3>Task ${taskIndex + 1}</h3>
                    <button class="btn btn-danger btn-small" data-action="remove-task" data-index="${taskIndex}">Remove Task</button>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Task Name</label>
                        <input type="text" class="form-input" value="${task.name}" 
                            data-action="update-task-field" data-task="${taskIndex}" data-field="name">
                    </div>
                    <div class="form-group">
                        <label>Script Filename</label>
                        <input type="text" class="form-input" value="${task.scriptName}" 
                            data-action="update-task-field" data-task="${taskIndex}" data-field="scriptName">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Solution Script Content</label>
                    <textarea class="form-textarea" placeholder="Paste the solution script here..." 
                        data-action="update-task-field" data-task="${taskIndex}" data-field="solutionScriptContent">${task.solutionScriptContent}</textarea>
                </div>
                
                <h4>Output Comparison Tests</h4>
                <div id="tests-${taskIndex}">
                    ${task.tests.map((test, testIndex) => this.renderTest(taskIndex, testIndex, test)).join('')}
                </div>
                <button class="btn btn-secondary btn-small" data-action="add-test" data-task="${taskIndex}">+ Add Test</button>
                
                <h4>Code Pattern Checks</h4>
                <div id="rules-${taskIndex}">
                    ${task.codeRules.map((rule, ruleIndex) => this.renderCodeRule(taskIndex, ruleIndex, rule)).join('')}
                </div>
                <button class="btn btn-secondary btn-small" data-action="add-code-rule" data-task="${taskIndex}">+ Add Code Rule</button>
            `;

            container.appendChild(taskDiv);
        });

        // Attach event listeners after rendering
        this.attachTaskEventListeners();
    }

    attachTaskEventListeners() {
        // Remove task buttons
        document.querySelectorAll('[data-action="remove-task"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeTask(parseInt(btn.dataset.index));
            });
        });

        // Update task field inputs
        document.querySelectorAll('[data-action="update-task-field"]').forEach(input => {
            input.addEventListener('change', () => {
                const taskIndex = parseInt(input.dataset.task);
                const field = input.dataset.field;
                this.gradingConfig.tasks[taskIndex][field] = input.value;
            });
        });

        // Add test buttons
        document.querySelectorAll('[data-action="add-test"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.addTest(parseInt(btn.dataset.task));
            });
        });

        // Add code rule buttons
        document.querySelectorAll('[data-action="add-code-rule"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.addCodeRule(parseInt(btn.dataset.task));
            });
        });

        // Test-specific listeners
        document.querySelectorAll('[data-action="remove-test"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeTest(parseInt(btn.dataset.task), parseInt(btn.dataset.test));
            });
        });

        document.querySelectorAll('[data-action="update-test-field"]').forEach(input => {
            input.addEventListener('change', () => {
                const taskIndex = parseInt(input.dataset.task);
                const testIndex = parseInt(input.dataset.test);
                const field = input.dataset.field;
                let value = input.value;

                // Handle special fields
                if (field === 'arguments') {
                    value = value.split(',').map(s => s.trim()).filter(s => s);
                } else if (field === 'inputs' || field === 'expectedOutputFiles') {
                    value = value.split('\n').filter(s => s.trim());
                } else if (field === 'fixtures') {
                    value = Array.from(input.selectedOptions).map(o => o.value);
                } else if (field === 'points') {
                    value = parseFloat(value);
                }

                this.gradingConfig.tasks[taskIndex].tests[testIndex][field] = value;
            });
        });

        // Code rule listeners
        document.querySelectorAll('[data-action="remove-code-rule"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeCodeRule(parseInt(btn.dataset.task), parseInt(btn.dataset.rule));
            });
        });

        document.querySelectorAll('[data-action="update-code-rule-field"]').forEach(input => {
            input.addEventListener('change', () => {
                const taskIndex = parseInt(input.dataset.task);
                const ruleIndex = parseInt(input.dataset.rule);
                const field = input.dataset.field;
                let value = input.value;

                if (field === 'points') {
                    value = parseFloat(value);
                }

                this.gradingConfig.tasks[taskIndex].codeRules[ruleIndex][field] = value;
            });
        });
    }

    renderTest(taskIndex, testIndex, test) {
        const fixturesOptions = this.availableFixtures.map(f =>
            `<option value="${f}" ${(test.fixtures || []).includes(f) ? 'selected' : ''}>${f}</option>`
        ).join('');

        return `
            <div class="test-case-config">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>Test ${testIndex + 1}</strong>
                    <button class="btn btn-danger btn-small" data-action="remove-test" data-task="${taskIndex}" data-test="${testIndex}">Remove</button>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <input type="text" class="form-input" value="${test.description}" 
                        data-action="update-test-field" data-task="${taskIndex}" data-test="${testIndex}" data-field="description">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Arguments (comma-separated)</label>
                        <input type="text" class="form-input" value="${(test.arguments || []).join(', ')}" 
                            data-action="update-test-field" data-task="${taskIndex}" data-test="${testIndex}" data-field="arguments">
                    </div>
                    <div class="form-group">
                        <label>Points</label>
                        <input type="number" step="0.5" class="form-input" value="${test.points}" 
                            data-action="update-test-field" data-task="${taskIndex}" data-test="${testIndex}" data-field="points">
                    </div>
                </div>
                <div class="form-group">
                    <label>Stdin Inputs (one per line)</label>
                    <textarea class="form-textarea" 
                        data-action="update-test-field" data-task="${taskIndex}" data-test="${testIndex}" data-field="inputs">${(test.inputs || []).join('\n')}</textarea>
                </div>
                <div class="form-group">
                    <label>Fixture Files (multi-select: hold Ctrl/Cmd to select multiple)</label>
                    <select multiple class="form-input" style="height: 100px;" 
                        data-action="update-test-field" data-task="${taskIndex}" data-test="${testIndex}" data-field="fixtures">
                        ${fixturesOptions}
                    </select>
                    <small style="color: var(--text-secondary);">Selected: ${(test.fixtures || []).join(', ') || 'None'}</small>
                </div>
                <div class="form-group">
                    <label>Expected Output Files (one filename per line, for file content verification)</label>
                    <textarea class="form-textarea" placeholder="e.g., output.txt" 
                        data-action="update-test-field" data-task="${taskIndex}" data-test="${testIndex}" data-field="expectedOutputFiles">${(test.expectedOutputFiles || []).join('\n')}</textarea>
                    <small style="color: var(--text-secondary);">Files created by the script will be compared with solution output files</small>
                </div>
            </div>
        `;
    }

    renderCodeRule(taskIndex, ruleIndex, rule) {
        return `
            <div class="code-rule-config">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>Rule ${ruleIndex + 1}</strong>
                    <button class="btn btn-danger btn-small" data-action="remove-code-rule" data-task="${taskIndex}" data-rule="${ruleIndex}">Remove</button>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <input type="text" class="form-input" value="${rule.description}" 
                        data-action="update-code-rule-field" data-task="${taskIndex}" data-rule="${ruleIndex}" data-field="description">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Regex Pattern</label>
                        <input type="text" class="form-input" value="${rule.pattern}" placeholder="e.g., ^#!/bin/bash" 
                            data-action="update-code-rule-field" data-task="${taskIndex}" data-rule="${ruleIndex}" data-field="pattern">
                    </div>
                    <div class="form-group">
                        <label>Flags</label>
                        <input type="text" class="form-input" value="${rule.flags || ''}" placeholder="e.g., m, i" 
                            data-action="update-code-rule-field" data-task="${taskIndex}" data-rule="${ruleIndex}" data-field="flags">
                    </div>
                    <div class="form-group">
                        <label>Points</label>
                        <input type="number" step="0.5" class="form-input" value="${rule.points}" 
                            data-action="update-code-rule-field" data-task="${taskIndex}" data-rule="${ruleIndex}" data-field="points">
                    </div>
                </div>
            </div>
        `;
    }

    async gradeSubmissions() {
        if (!this.selectedFile) {
            alert('Please select a ZIP file');
            return;
        }

        if (this.gradingConfig.tasks.length === 0) {
            alert('Please add at least one task');
            return;
        }

        // Validate that all tasks have solution scripts
        for (const task of this.gradingConfig.tasks) {
            if (!task.solutionScriptContent.trim()) {
                alert(`Task "${task.name}" is missing a solution script`);
                return;
            }
        }

        // Show loading
        document.getElementById('loading-section').style.display = 'block';
        document.getElementById('results-section').style.display = 'none';

        try {
            // Read file as base64
            const fileData = await this.readFileAsBase64(this.selectedFile);

            // Prepare grading config with solution script paths
            const configForAPI = {
                tasks: this.gradingConfig.tasks.map((task, index) => {
                    // Create a temp solution script path (will be handled server-side)
                    return {
                        name: task.name,
                        scriptName: task.scriptName,
                        solutionScriptPath: `/tmp/solution_${index}.sh`,
                        solutionScriptContent: task.solutionScriptContent,
                        tests: task.tests.map(test => ({
                            description: test.description,
                            arguments: test.arguments || [],
                            inputs: test.inputs || [],
                            fixtures: test.fixtures || [],
                            expectedOutputFiles: test.expectedOutputFiles || [],
                            points: test.points,
                            solutionScriptPath: `/tmp/solution_${index}.sh`
                        })),
                        codeRules: task.codeRules
                    };
                })
            };

            // Send to API
            const results = await this.apiService.gradeExamSubmissions(fileData, configForAPI);

            this.gradingResults = results;
            this.displayResults(results);
        } catch (error) {
            console.error('Error grading submissions:', error);
            alert(`Failed to grade submissions: ${error.message}`);
        } finally {
            document.getElementById('loading-section').style.display = 'none';
        }
    }

    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    displayResults(results) {
        const resultsSection = document.getElementById('results-section');
        resultsSection.style.display = 'block';

        // Display summary stats
        const summaryStats = document.getElementById('summary-stats');
        summaryStats.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${results.submissions.length}</div>
                <div class="stat-label">Total Submissions</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${results.summary.averageScore.toFixed(1)}%</div>
                <div class="stat-label">Average Score</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${results.summary.maxPossiblePoints}</div>
                <div class="stat-label">Max Points</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${results.submissions.filter(s => (s.totalPoints / s.maxPoints) >= 0.5).length}</div>
                <div class="stat-label">Passing (≥50%)</div>
            </div>
        `;

        // Display individual results
        const resultsContainer = document.getElementById('results-container');
        resultsContainer.innerHTML = '';

        results.submissions.forEach((submission, index) => {
            const percentage = submission.maxPoints > 0 ? (submission.totalPoints / submission.maxPoints) * 100 : 0;
            const isPassing = percentage >= 50;

            const submissionDiv = document.createElement('div');
            submissionDiv.className = 'submission-result';

            // Show script filename prominently for student identification
            const displayName = submission.scriptFilename || submission.studentId;

            submissionDiv.innerHTML = `
                <div class="submission-header" onclick="window.toggleSubmission(${index})">
                    <div>
                        <strong style="font-size: 1.1em;">${displayName}</strong>
                        ${submission.scriptFilename && submission.studentId !== displayName ? 
                            `<span style="color: var(--text-secondary); margin-left: 10px; font-size: 0.9em;">(${submission.studentId})</span>` : ''}
                        ${submission.error ? `<span style="color: #e74c3c;"> - Error: ${submission.error}</span>` : ''}
                    </div>
                    <div class="score ${isPassing ? 'passing' : 'failing'}">
                        ${submission.totalPoints.toFixed(2)} / ${submission.maxPoints.toFixed(2)} (${percentage.toFixed(1)}%)
                    </div>
                </div>
                <div class="collapsible-content" id="submission-${index}">
                    ${submission.tasks.map((task, taskIndex) => this.renderTaskResult(task, taskIndex)).join('')}
                </div>
            `;

            resultsContainer.appendChild(submissionDiv);
        });

        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    renderTaskResult(task, taskIndex) {
        const taskPassed = task.points === task.maxPoints;

        return `
            <div class="task-result ${taskPassed ? 'passed' : 'failed'}">
                <strong>${task.name || `Task ${taskIndex + 1}`}</strong> - 
                ${task.points.toFixed(2)} / ${task.maxPoints.toFixed(2)} points
                ${task.error ? `<div style="color: #e74c3c; margin-top: 5px;">Error: ${task.error}</div>` : ''}
                
                ${task.tests && task.tests.length > 0 ? `
                    <div style="margin-top: 10px;">
                        <strong>Output Tests:</strong>
                        ${task.tests.map(test => `
                            <div class="test-detail" style="color: ${test.passed ? '#2ecc71' : '#e74c3c'};">
                                ${test.passed ? '✓' : '✗'} ${test.description} - ${test.points} / ${test.maxPoints} pts
                                ${test.error ? `<div>Error: ${test.error}</div>` : ''}
                                ${!test.passed && !test.error ? `
                                    <div class="output-comparison">
                                        <div>
                                            <strong>Student Output:</strong>
                                            <div class="output-box">${this.escapeHtml(test.studentOutput || '')}</div>
                                            Exit: ${test.studentExitCode}
                                        </div>
                                        <div>
                                            <strong>Expected Output:</strong>
                                            <div class="output-box">${this.escapeHtml(test.solutionOutput || '')}</div>
                                            Exit: ${test.solutionExitCode}
                                        </div>
                                    </div>
                                    ${test.outputFiles && test.outputFiles.length > 0 ? `
                                        <div style="margin-top: 10px;">
                                            <strong>Output Files:</strong>
                                            ${test.outputFiles.map(file => `
                                                <div style="margin: 5px 0; font-size: 0.9em;">
                                                    ${file.hashMatches ? '✓' : '✗'} ${file.filename}
                                                    ${!file.studentExists ? ' (not created by student)' : ''}
                                                    ${!file.solutionExists ? ' (not created by solution)' : ''}
                                                    ${file.studentExists && file.solutionExists && !file.hashMatches ? ' (content differs)' : ''}
                                                </div>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${task.codeChecks && task.codeChecks.length > 0 ? `
                    <div style="margin-top: 10px;">
                        <strong>Code Checks:</strong>
                        ${task.codeChecks.map(check => `
                            <div class="test-detail" style="color: ${check.passed ? '#2ecc71' : '#e74c3c'};">
                                ${check.passed ? '✓' : '✗'} ${check.description} - ${check.points} / ${check.maxPoints} pts
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    exportToCSV() {
        if (!this.gradingResults) {
            alert('No results to export');
            return;
        }

        let csv = 'Student ID,Total Points,Max Points,Percentage';

        // Add task columns
        if (this.gradingResults.submissions.length > 0 && this.gradingResults.submissions[0].tasks.length > 0) {
            this.gradingResults.submissions[0].tasks.forEach(task => {
                csv += `,${task.name} Points,${task.name} Max`;
            });
        }

        csv += '\n';

        // Add data rows
        this.gradingResults.submissions.forEach(submission => {
            const percentage = submission.maxPoints > 0 ? (submission.totalPoints / submission.maxPoints) * 100 : 0;
            csv += `${submission.studentId},${submission.totalPoints.toFixed(2)},${submission.maxPoints.toFixed(2)},${percentage.toFixed(1)}%`;

            submission.tasks.forEach(task => {
                csv += `,${task.points.toFixed(2)},${task.maxPoints.toFixed(2)}`;
            });

            csv += '\n';
        });

        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `exam_results_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async importConfiguration(file) {
        try {
            const text = await file.text();
            const config = JSON.parse(text);

            if (!config.tasks || !Array.isArray(config.tasks)) {
                alert('Invalid configuration file: missing tasks array');
                return;
            }

            // Load the configuration
            this.gradingConfig = {
                tasks: config.tasks.map(task => ({
                    name: task.name || 'Unnamed Task',
                    scriptName: task.scriptName || 'script.sh',
                    solutionScriptContent: task.solutionScriptContent || '',
                    tests: (task.tests || []).map(test => ({
                        description: test.description || '',
                        arguments: test.arguments || [],
                        inputs: test.inputs || [],
                        fixtures: test.fixtures || [],
                        expectedOutputFiles: test.expectedOutputFiles || [],
                        points: test.points || 0
                    })),
                    codeRules: (task.codeRules || []).map(rule => ({
                        description: rule.description || '',
                        pattern: rule.pattern || '',
                        flags: rule.flags || '',
                        points: rule.points || 0
                    }))
                }))
            };

            this.renderTasks();
            this.updateGradeButton();
            alert(`Configuration loaded: ${config.examName || 'Unnamed exam'}\n${config.tasks.length} task(s) imported`);
        } catch (error) {
            console.error('Error importing configuration:', error);
            alert(`Failed to import configuration: ${error.message}`);
        }
    }

    exportConfiguration() {
        const config = {
            examName: 'Exam Configuration',
            description: 'Exported from BITLab Exam Grader',
            exportedAt: new Date().toISOString(),
            tasks: this.gradingConfig.tasks,
            totalPoints: this.gradingConfig.tasks.reduce((sum, task) => {
                const taskPoints = (task.tests || []).reduce((s, t) => s + (t.points || 0), 0) +
                                  (task.codeRules || []).reduce((s, r) => s + (r.points || 0), 0);
                return sum + taskPoints;
            }, 0)
        };

        const json = JSON.stringify(config, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `exam-grading-config-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Global function for toggling submission details (called from inline onclick)
window.toggleSubmission = (index) => {
    const content = document.getElementById(`submission-${index}`);
    content.classList.toggle('expanded');
};

document.addEventListener('DOMContentLoaded', () => {
    new ExamGraderPage();
});

