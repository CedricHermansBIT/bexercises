// frontend/js/pages/workspacePage.js
import ApiService from '../services/apiService.js';
import StorageService from '../services/storageService.js';
import AuthComponent from '../components/authComponent.js';
import NotificationBanner from '../components/notificationBanner.js';
import OnlineUsers from '../components/onlineUsers.js';
import TestResults from '../components/testResults.js';
import Statistics from '../components/statistics.js';
import { initializeResizableSidebars, makeVerticallyResizable } from '../utils/resizeUtils.js';
import { navigateTo } from '../utils/navigationUtils.js';
import themeManager from '../utils/themeUtils.js';
import { setFavicon } from '../utils/faviconUtils.js';
import { showAchievementNotifications } from '../components/achievementNotification.js';
import soundEffects from '../utils/soundEffects.js';

class WorkspacePage {
    constructor() {
        this.apiService = new ApiService();
        this.storageService = new StorageService();
        this.authComponent = new AuthComponent(this.apiService);
        this.notificationBanner = new NotificationBanner();
        this.onlineUsers = new OnlineUsers();
        this.testResults = new TestResults();
        this.statistics = new Statistics();

        // Make auth component globally accessible
        window.authComponent = this.authComponent;
        window.themeManager = themeManager;

        this.currentExercise = null;
        this.codeEditor = null;
        this.chapterExercises = []; // All exercises in current chapter
        this.currentExerciseIndex = -1; // Index in chapterExercises array
        this.isRunning = false;
        this.saveStatusTimer = null;
        this.nextExerciseCtaTimer = null;

        this.init();
    }

    async init() {
        // Set favicon
        setFavicon();

        // Check authentication - REQUIRED
        const isAuthenticated = await this.authComponent.checkAuth();
        if (!isAuthenticated) {
            navigateTo('login.html');
            return;
        }

        // Initialize components in parallel (don't block the main flow)
        const componentInit = Promise.all([
            this.notificationBanner.init(),
            this.onlineUsers.init('online-users-dropdown', true)
        ]);

        // Setup admin access
        this.setupAdminAccess();

        // Update time display
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);

        // Setup code editor
        this.setupCodeEditor();

        // Setup event listeners
        this.setupEventListeners();

        // Setup logout
        this.setupLogout();

        // Initialize resizable sidebar
        initializeResizableSidebars();

        // Initialize vertical resize between editor and results
        makeVerticallyResizable(
            '.resize-handle-vertical',
            '.editor-container',
            '.results-container',
            200,  // min editor height
            150,  // min results height
            'workspace-editor-height',
            () => {
                // Refresh CodeMirror when resizing
                if (this.codeEditor) {
                    this.codeEditor.refresh();
                }
            }
        );

        // Show edit button for admins
        if (this.authComponent.isAdmin()) {
            const editBtn = document.getElementById('edit-exercise');
            if (editBtn) {
                editBtn.style.display = 'inline-block';
            }
        }

        // Wait for component initialization to complete
        await componentInit;

        // Get exercise ID from URL or session storage
        const urlParams = new URLSearchParams(window.location.search);
        const exerciseId = urlParams.get('exercise') || sessionStorage.getItem('selectedExercise');

        if (exerciseId) {
            await this.loadExercise(exerciseId);
        } else {
            // Redirect back to exercises page if no exercise selected
            navigateTo('exercises.html');
        }

        // Initialize rickroll easter egg
        this.initRickrollEasterEgg();

        // Initialize hackerman achievement (detect DevTools)
        this.initHackermanAchievement();
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

        // Determine initial theme based on current mode
        const currentTheme = themeManager.getTheme();
        const editorTheme = currentTheme === 'light' ? 'default' : 'dracula';

        this.codeEditor = CodeMirror.fromTextArea(textarea, {
            mode: 'shell',
            theme: editorTheme,
            lineNumbers: true,
            indentUnit: 4,
            lineWrapping: true,
            autoCloseBrackets: true,
            matchBrackets: true
        });

        // Auto-save code changes
        this.codeEditor.on('change', () => {
            if (this.currentExercise) {
                this.updateSaveStatus('Saving…', 'saving');
                this.saveProgress();
                this.hideNextExerciseCta();
            }
        });

        // Listen for theme changes and update CodeMirror theme
        window.addEventListener('themechange', (e) => {
            const newTheme = e.detail.theme === 'light' ? 'default' : 'dracula';
            this.codeEditor.setOption('theme', newTheme);
        });
    }

    setupEventListeners() {
        // Back to selection button
        const backBtn = document.getElementById('back-to-selection');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                navigateTo('exercises.html');
            });
        }

        // Achievements button
        const achievementsBtn = document.getElementById('achievements-btn-workspace');
        if (achievementsBtn) {
            achievementsBtn.addEventListener('click', () => {
                navigateTo('achievements.html');
            });
        }

        // Leaderboard button
        const leaderboardBtn = document.getElementById('leaderboard-btn-workspace');
        if (leaderboardBtn) {
            leaderboardBtn.addEventListener('click', () => {
                navigateTo('leaderboard.html');
            });
        }

        // Admin button
        const adminBtn = document.getElementById('admin-btn-workspace');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                navigateTo('admin.html');
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

        // Edit exercise button (admin only)
        const editExerciseBtn = document.getElementById('edit-exercise');
        if (editExerciseBtn) {
            editExerciseBtn.addEventListener('click', () => this.editExercise());
        }

        // Navigation buttons
        const prevExerciseBtn = document.getElementById('prev-exercise-btn');
        if (prevExerciseBtn) {
            prevExerciseBtn.addEventListener('click', () => this.navigateToPreviousExercise());
        }

        const nextExerciseBtn = document.getElementById('next-exercise-btn');
        if (nextExerciseBtn) {
            nextExerciseBtn.addEventListener('click', () => this.navigateToNextExercise());
        }

        const nextExerciseCta = document.getElementById('next-exercise-cta');
        if (nextExerciseCta) {
            nextExerciseCta.addEventListener('click', () => this.navigateToRecommendedExercise());
        }

        document.addEventListener('keydown', (event) => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey) return;

            if (event.key.toLowerCase() === 's') {
                event.preventDefault();
                this.saveProgress(true);
            } else if (event.key === 'Enter' && !this.isRunning) {
                event.preventDefault();
                this.runTests();
            }
        });
    }

    setupLogout() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.authComponent.logout();
            });
        }

        // Setup theme toggle
        this.setupThemeToggle();

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

    setupThemeToggle() {
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (!themeToggleBtn) return;

        const updateThemeButton = () => {
            const currentTheme = themeManager.getTheme();
            const themeIcon = themeToggleBtn.querySelector('.theme-icon');
            const themeText = themeToggleBtn.querySelector('.theme-text');

            if (currentTheme === 'dark') {
                themeIcon.textContent = '☀️';
                themeText.textContent = 'Light Mode';
            } else {
                themeIcon.textContent = '🌙';
                themeText.textContent = 'Dark Mode';
            }
        };

        updateThemeButton();

        themeToggleBtn.addEventListener('click', () => {
            themeManager.toggle();
            updateThemeButton();

            // Close the dropdown after toggling
            const userMenu = document.getElementById('user-menu-workspace');
            if (userMenu) {
                userMenu.classList.remove('active');
            }
        });

        window.addEventListener('themechange', updateThemeButton);

        // Setup sound toggle
        this.setupSoundToggle();
    }

    setupSoundToggle() {
        const soundToggleBtn = document.getElementById('sound-toggle-btn');
        if (!soundToggleBtn) return;

        const updateSoundButton = () => {
            const soundEnabled = soundEffects.isEnabled();
            const soundIcon = soundToggleBtn.querySelector('.sound-icon');

            if (soundEnabled) {
                soundIcon.textContent = '🔊';
                soundToggleBtn.title = 'Sound On (click to mute)';
            } else {
                soundIcon.textContent = '🔇';
                soundToggleBtn.title = 'Sound Off (click to enable)';
            }
        };

        updateSoundButton();

        soundToggleBtn.addEventListener('click', () => {
            const newState = soundEffects.toggle();
            updateSoundButton();

            // Play a test sound if enabled
            if (newState) {
                soundEffects.playClick();
            }
        });
    }

    setupAdminAccess() {
        if (this.authComponent.isAdmin()) {
            const adminBtns = document.querySelectorAll('.admin-only');
            adminBtns.forEach(btn => {
                btn.style.display = 'flex';
            });
        }
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

            await this.loadFixtures(exercise.id);

            // Set CodeMirror mode based on exercise language
            if (this.codeEditor) {
                const languageMode = this.getCodeMirrorMode(exercise.language_id || 'bash');
                this.codeEditor.setOption('mode', languageMode);
            }

            // Get code template - now included in exercise object
            const defaultTemplate = exercise.code_template || '#!/bin/bash\n\n# Write your solution here\n';

            // Load saved code or default template
            const savedCode = this.storageService.getExerciseProgress(exerciseId)?.code;
            const startingCode = savedCode || defaultTemplate;
            this.codeEditor.setValue(startingCode);

            // Refresh CodeMirror
            setTimeout(() => {
                this.codeEditor.refresh();
            }, 100);

            // Update completion status
            this.updateCompletionStatus(exerciseId);
            this.testResults.displayNoResults();
            this.hideNextExerciseCta();

            // Load chapter exercises and update navigation
            await this.loadChapterExercises(exercise);
            this.updateNavigationButtons();

            // Load statistics
            await this.loadStatistics(exerciseId);
        } catch (error) {
            console.error('Failed to load exercise:', error);
            this.testResults.displayError('Failed to load exercise');
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

    async loadFixtures(exerciseId) {
        const tree = document.getElementById('fixture-tree');
        if (!tree) return;

        tree.replaceChildren();
        try {
            const fixtures = await this.apiService.getExerciseFixtures(exerciseId);
            if (fixtures.length === 0) {
                tree.innerHTML = '<span class="fixture-tree-empty">No fixture files for this exercise.</span>';
                return;
            }

            fixtures.forEach((fixture) => {
                const entry = document.createElement('div');
                entry.className = 'fixture-tree-entry';
                entry.style.paddingLeft = `${Math.max(0, fixture.filename.split('/').length - 1) * 0.8}rem`;

                const icon = document.createElement('span');
                icon.className = 'fixture-tree-icon';
                icon.textContent = fixture.type === 'directory' ? '▸' : '·';

                const name = document.createElement('span');
                name.className = 'fixture-tree-name';
                name.textContent = fixture.filename;

                entry.append(icon, name);
                if (fixture.permissions) {
                    const permissions = document.createElement('span');
                    permissions.className = 'fixture-tree-permissions';
                    permissions.textContent = fixture.permissions;
                    entry.appendChild(permissions);
                }
                tree.appendChild(entry);
            });
        } catch (error) {
            console.error('Failed to load exercise fixtures:', error);
            tree.innerHTML = '<span class="fixture-tree-empty">Fixture list unavailable.</span>';
        }
    }

    async runTests() {
        if (!this.currentExercise) return;

        const code = this.codeEditor.getValue();
        const runButton = document.getElementById('run-tests');

        // Show loading state
        runButton.innerHTML = '<span>⟳</span> running...';
        runButton.disabled = true;
        this.isRunning = true;

        try {
            const data = await this.apiService.runTests(this.currentExercise.id, code);

            // Display results
            this.testResults.display(data.results);

            // Display statistics
            if (data.statistics) {
                this.statistics.display(data.statistics);
            }

            // Check test results and play appropriate sound
            if (data.results && data.results.length > 0) {
                const allPassed = data.results.every(r => r.passed);
                const somePassed = data.results.some(r => r.passed);

                if (allPassed) {
                    soundEffects.playSuccess();
                } else if (somePassed) {
                    soundEffects.playPartialSuccess();
                } else {
                    soundEffects.playFailure();
                }
            }

            // Show achievement notifications if any were earned
            if (data.newAchievements && data.newAchievements.length > 0) {
                showAchievementNotifications(data.newAchievements);
            }

            // Refresh CodeMirror after results are shown to recalculate dimensions
            setTimeout(() => {
                if (this.codeEditor) {
                    this.codeEditor.refresh();
                }
            }, 100);

            // Update progress
            const allPassed = data.results.length > 0 && data.results.every(r => r.passed);
            this.updateProgress(this.currentExercise.id, code, allPassed);
            this.updateNextExerciseCta(allPassed);
        } catch (error) {
            this.testResults.displayError('Error running tests: ' + error.message);
            if (error.message.includes('403')) {
                this.showVPNNotification();
            }
        } finally {
            runButton.innerHTML = '<span aria-hidden="true">▶</span> run tests';
            runButton.disabled = false;
            this.isRunning = false;
        }
    }

    updateProgress(exerciseId, code, completed) {
        this.storageService.updateExerciseProgress(exerciseId, code, completed);
        this.updateCompletionStatus(exerciseId);
    }

    saveProgress(manual = false) {
        if (!this.currentExercise) return;
        const code = this.codeEditor.getValue();
        const progress = this.storageService.getExerciseProgress(this.currentExercise.id);
        const completed = progress?.completed || false;
        this.storageService.updateExerciseProgress(this.currentExercise.id, code, completed);
        this.updateSaveStatus(manual ? 'Saved manually' : 'Saved just now', 'saved');
    }

    updateSaveStatus(message, state = '') {
        const status = document.getElementById('save-status');
        if (!status) return;

        status.textContent = message;
        status.className = `save-status ${state}`;
        clearTimeout(this.saveStatusTimer);
        if (state === 'saved' && message !== 'Saved') {
            this.saveStatusTimer = setTimeout(() => {
                status.textContent = 'Saved';
                status.className = 'save-status saved';
            }, 2500);
        }
    }

    getRecommendedNextExercise() {
        return this.chapterExercises
            .slice(this.currentExerciseIndex + 1)
            .find(exercise => !this.storageService.getExerciseProgress(exercise.id)?.completed);
    }

    updateNextExerciseCta(allPassed) {
        const cta = document.getElementById('next-exercise-cta');
        if (!cta) return;

        const nextExercise = allPassed ? this.getRecommendedNextExercise() : null;
        if (!nextExercise) {
            this.hideNextExerciseCta();
            return;
        }

        cta.textContent = `✓ Exercise completed — continue to ${nextExercise.title} →`;
        cta.hidden = false;
        clearTimeout(this.nextExerciseCtaTimer);
        this.nextExerciseCtaTimer = setTimeout(() => this.hideNextExerciseCta(), 8000);
    }

    hideNextExerciseCta() {
        const cta = document.getElementById('next-exercise-cta');
        if (cta) cta.hidden = true;
        clearTimeout(this.nextExerciseCtaTimer);
    }

    navigateToRecommendedExercise() {
        const nextExercise = this.getRecommendedNextExercise();
        if (nextExercise) {
            this.hideNextExerciseCta();
            this.navigateToExercise(nextExercise);
        }
    }

    async resetCode() {
        if (!this.currentExercise) return;

        if (confirm('Reset your code? This will remove all your changes.')) {
            // Use code template from exercise (already includes language template)
            const defaultCode = this.currentExercise.code_template || '#!/bin/bash\n\n# Write your solution here\n';

            this.codeEditor.setValue(defaultCode);
            this.updateProgress(this.currentExercise.id, defaultCode, false);
        }
    }

    editExercise() {
        if (!this.currentExercise) return;

        // Save current exercise ID to sessionStorage so we can return here
        sessionStorage.setItem('returnToExercise', this.currentExercise.id);

        // Navigate to admin exercises page with the exercise ID
        navigateTo(`admin/exercises.html?edit=${this.currentExercise.id}`);
    }

    async loadChapterExercises(currentExercise) {
        try {
            // Get all exercises
            this.chapterExercises = await this.apiService.getExercises(null, currentExercise.chapter_id);

            //console.log('Current exercise:', currentExercise);
            //console.log('Current exercise chapter:', currentExercise.chapter);
            //console.log('All exercises:', allExercises);

            // Filter exercises by chapter (matching chapter name)
            //this.chapterExercises = allExercises
            //    .filter(ex => ex.chapter === currentExercise.chapter)
            //    .sort((a, b) => (a.order || 0) - (b.order || 0));

            //console.log('Chapter exercises:', this.chapterExercises);

            // Find current exercise index
            this.currentExerciseIndex = this.chapterExercises.findIndex(ex => ex.id === currentExercise.id);

            //console.log('Current exercise index:', this.currentExerciseIndex);
        } catch (error) {
            console.error('Failed to load chapter exercises:', error);
            this.chapterExercises = [];
            this.currentExerciseIndex = -1;
        }
    }

    updateNavigationButtons() {
        const navigationDiv = document.getElementById('exercise-navigation');
        const prevBtn = document.getElementById('prev-exercise-btn');
        const nextBtn = document.getElementById('next-exercise-btn');

        //console.log('Updating navigation buttons...');
        //console.log('Navigation div:', navigationDiv);
        //console.log('Prev btn:', prevBtn);
        //console.log('Next btn:', nextBtn);
        //console.log('Chapter exercises length:', this.chapterExercises.length);
        //console.log('Current index:', this.currentExerciseIndex);

        if (!navigationDiv || !prevBtn || !nextBtn) return;

        // Show navigation container if we have chapter exercises
        if (this.chapterExercises.length > 1) {
            navigationDiv.style.display = 'flex';

            // Show/hide previous button
            if (this.currentExerciseIndex > 0) {
                prevBtn.style.display = 'flex';
                const prevExercise = this.chapterExercises[this.currentExerciseIndex - 1];
                prevBtn.title = prevExercise.title;
                //console.log('Showing previous button for:', prevExercise.title);
            } else {
                prevBtn.style.display = 'none';
                //console.log('Hiding previous button (first exercise)');
            }

            // Show/hide next button
            if (this.currentExerciseIndex < this.chapterExercises.length - 1) {
                nextBtn.style.display = 'flex';
                const nextExercise = this.chapterExercises[this.currentExerciseIndex + 1];
                nextBtn.title = nextExercise.title;
                //console.log('Showing next button for:', nextExercise.title);
            } else {
                nextBtn.style.display = 'none';
                //console.log('Hiding next button (last exercise)');
            }
        } else {
            // Hide navigation if only one exercise in chapter
            navigationDiv.style.display = 'none';
            console.log('Hiding navigation (only one or zero exercises in chapter)');
        }
    }

    navigateToPreviousExercise() {
        if (this.currentExerciseIndex > 0) {
            const prevExercise = this.chapterExercises[this.currentExerciseIndex - 1];
            this.navigateToExercise(prevExercise);
        }
    }

    navigateToNextExercise() {
        if (this.currentExerciseIndex < this.chapterExercises.length - 1) {
            const nextExercise = this.chapterExercises[this.currentExerciseIndex + 1];
            this.navigateToExercise(nextExercise);
        }
    }

    navigateToExercise(exercise) {
        this.loadExercise(exercise.id);
        window.history.pushState({}, '', `./workspace.html?exercise=${exercise.id}`);
    }

    showVPNNotification() {
        alert('VPN Connection Required\n\nAccess to the exercises requires a VPN connection to the organization network.\nPlease connect to your VPN and refresh the page.');
    }

    /**
     * Initialize the rickroll easter egg
     */
    initRickrollEasterEgg() {
        // Create hidden button
        const button = document.createElement('button');
        button.className = 'secret-rickroll-trigger';
        button.setAttribute('aria-label', 'Secret');
        button.title = '';
        document.body.appendChild(button);

        // Click handler
        button.addEventListener('click', async () => {
            // Play notification sound
            soundEffects.playNotification();

            // Show rickroll modal
            this.showRickroll();

            // Unlock achievement
            try {
                await this.unlockRickrollAchievement();
            } catch (error) {
                console.error('Failed to unlock rickroll achievement:', error);
            }
        });
    }

    /**
     * Show the rickroll modal
     */
    showRickroll() {
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'rickroll-modal';
        modal.innerHTML = `
            <div class="rickroll-content">
                <h1>🎵 You've Been Rickrolled! 🎵</h1>
                <iframe 
                    width="800" 
                    height="450" 
                    src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" 
                    style="border: none;"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
                <br>
                <button class="rickroll-close">Close (and Never Gonna Give You Up)</button>
            </div>
        `;

        document.body.appendChild(modal);

        // Close button handler
        modal.querySelector('.rickroll-close').addEventListener('click', () => {
            modal.remove();
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * Unlock the rickroll achievement
     */
    async unlockRickrollAchievement() {
        try {
            const response = await fetch(`${this.apiService.baseUrl}/api/achievements/unlock/rickrolled`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                // If already unlocked, that's fine
                if (error.message && error.message.includes('already unlocked')) {
                    console.log('Achievement already unlocked');
                    return;
                }
                throw new Error(error.error || 'Failed to unlock achievement');
            }

            const data = await response.json();
            console.log('Rickroll achievement unlocked!', data);

            // Show achievement notification
            if (data.achievement) {
                showAchievementNotifications([data.achievement]);
            }
        } catch (error) {
            console.error('Error unlocking rickroll achievement:', error);
        }
    }

    /**
     * Initialize the Hackerman achievement (detect DevTools)
     */
    initHackermanAchievement() {
        let devtoolsOpen = false;
        let consecutiveDetections = 0;
        const REQUIRED_DETECTIONS = 3; // Need 3 consecutive detections to avoid false positives

        // More reliable detection: Check console.table behavior
        const detectDevTools = () => {
            const widthThreshold = window.outerWidth - window.innerWidth > 160;
            const heightThreshold = window.outerHeight - window.innerHeight > 160;

            // Only trigger if threshold is exceeded multiple times consecutively
            if (widthThreshold || heightThreshold) {
                consecutiveDetections++;
                if (consecutiveDetections >= REQUIRED_DETECTIONS && !devtoolsOpen) {
                    devtoolsOpen = true;
                    this.unlockHackermanAchievement();
                }
            } else {
                // Reset count if DevTools appears to be closed
                consecutiveDetections = 0;
            }
        };

        // Check every 2 seconds (less aggressive than before)
        // Also wait 5 seconds before starting to avoid initial page load issues
        setTimeout(() => {
            setInterval(detectDevTools, 1000);
        }, 2000);
    }

    /**
     * Unlock the Hackerman achievement
     */
    async unlockHackermanAchievement() {
        try {
            const response = await fetch(`${this.apiService.baseUrl}/api/achievements/unlock/hackerman`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                // If already unlocked, that's fine
                if (error.message && error.message.includes('already unlocked')) {
                    console.log('%cHackerman achievement already unlocked!', 'color: #00ff00;');
                    return;
                }
                throw new Error(error.error || 'Failed to unlock achievement');
            }

            const data = await response.json();
            console.log('%cHackerman achievement unlocked! 🎉', 'font-size: 16px; color: #00ff00; font-weight: bold;');

            // Show achievement notification
            if (data.achievement) {
                showAchievementNotifications([data.achievement]);
                soundEffects.playSuccess();
            }
        } catch (error) {
            console.error('Error unlocking Hackerman achievement:', error);
        }
    }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WorkspacePage();
});

