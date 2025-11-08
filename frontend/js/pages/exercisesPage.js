// frontend/js/pages/exercisesPage.js
import ApiService from '../services/apiService.js';
import AuthComponent from '../components/authComponent.js';
import NotificationBanner from '../components/notificationBanner.js';
import { navigateTo } from '../utils/navigationUtils.js';
import themeManager from '../utils/themeUtils.js';
import { setFavicon } from '../utils/faviconUtils.js';

class ExercisesPage {
    constructor() {
        this.apiService = new ApiService();
        this.authComponent = new AuthComponent(this.apiService);
        this.notificationBanner = new NotificationBanner();

        // Make auth component globally accessible
        window.authComponent = this.authComponent;

        this.currentLanguage = 'bash';
        this.exercises = [];
        this.globalStats = {};
        this.userProgress = {}; // Store user progress from database
        this.currentFilter = 'all';
        this.currentChapterFilter = 'all'; // Track selected chapter

        this.init();
    }

    async init() {
        // Check authentication - REQUIRED
        const isAuthenticated = await this.authComponent.checkAuth();
        if (!isAuthenticated) {
            navigateTo('login.html');
            return;
        }

        // Set favicon
        setFavicon();

        // Initialize notification banner
        await this.notificationBanner.init();

        // Setup admin access
        this.setupAdminAccess();

        // Get selected language from session storage
        this.currentLanguage = sessionStorage.getItem('selectedLanguage') || 'bash';

        // Update time display
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);

        // Update language title
        const languageTitle = document.getElementById('language-title');
        if (languageTitle) {
            languageTitle.textContent = this.currentLanguage;
        }

        // Setup event listeners
        this.setupEventListeners();

        // Load exercises and user progress
        await this.loadExercises();
        await this.loadUserProgress();

        // Update progress display
        this.updateProgressDisplay();

        // Populate exercise cards
        this.populateExerciseSections();

        // Populate chapter filter dropdown
        this.populateChapterFilter();

        // Setup logout
        this.setupLogout();
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
        const userMenu = document.getElementById('user-menu');
        if (userMenu) {
            userMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenu.classList.toggle('active');
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            const userMenu = document.getElementById('user-menu');
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
            const userMenu = document.getElementById('user-menu');
            if (userMenu) {
                userMenu.classList.remove('active');
            }
        });

        window.addEventListener('themechange', updateThemeButton);
    }

    setupAdminAccess() {
        if (this.authComponent.isAdmin()) {
            const adminBtns = document.querySelectorAll('.admin-only');
            adminBtns.forEach(btn => {
                btn.style.display = 'flex';
            });
        }
    }

    updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const timeElements = document.querySelectorAll('.system-time');
        timeElements.forEach(el => el.textContent = timeString);
    }

    setupEventListeners() {
        // Back to languages button
        const backToLanguagesBtn = document.getElementById('back-to-languages');
        if (backToLanguagesBtn) {
            backToLanguagesBtn.addEventListener('click', () => {
                navigateTo('languages.html');
            });
        }

        // Achievements button
        const achievementsBtn = document.getElementById('achievements-btn-exercises');
        if (achievementsBtn) {
            achievementsBtn.addEventListener('click', () => {
                navigateTo('achievements.html');
            });
        }

        // Leaderboard button
        const leaderboardBtn = document.getElementById('leaderboard-btn-exercises');
        if (leaderboardBtn) {
            leaderboardBtn.addEventListener('click', () => {
                navigateTo('leaderboard.html');
            });
        }

        // Admin button
        const adminBtn = document.getElementById('admin-btn-exercises');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                navigateTo('admin.html');
            });
        }

        // Filter buttons
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                filterBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.filterExercises();
            });
        });

        // Chapter filter dropdown
        const chapterFilter = document.getElementById('chapter-filter');
        if (chapterFilter) {
            chapterFilter.addEventListener('change', (e) => {
                this.currentChapterFilter = e.target.value;
                this.filterExercises();
            });
        }
    }

    async loadExercises() {
        try {
            // Load exercises filtered by current language from the backend
            this.exercises = await this.apiService.getExercises(this.currentLanguage);
            // Load global statistics for all exercises
            this.globalStats = await this.apiService.getGlobalExerciseStats();
        } catch (error) {
            console.error('Failed to load exercises:', error);
        }
    }

    async loadUserProgress() {
        try {
            // Load user progress from database
            this.userProgress = await this.apiService.getUserProgress();
        } catch (error) {
            console.error('Failed to load user progress:', error);
            // Fall back to empty progress if error
            this.userProgress = {};
        }
    }

    populateExerciseSections() {
        const container = document.getElementById('exercises-container');
        if (!container) return;

        // Group exercises by chapter
        const chapters = this.groupExercisesByChapter();

        container.innerHTML = '';

        // Create sections for each chapter
        Object.keys(chapters).forEach(chapterName => {
            const section = this.createChapterSection(chapterName, chapters[chapterName]);
            container.appendChild(section);
        });
    }

    groupExercisesByChapter() {
        const chapters = {};

        // Exercises are already filtered by language from the backend
        this.exercises.forEach(exercise => {
            const chapter = exercise.chapter || 'Uncategorized';
            if (!chapters[chapter]) {
                chapters[chapter] = [];
            }
            chapters[chapter].push(exercise);
        });

        // Sort exercises within each chapter by order
        Object.keys(chapters).forEach(chapter => {
            chapters[chapter].sort((a, b) => (a.order || 0) - (b.order || 0));
        });

        return chapters;
    }

    populateChapterFilter() {
        const chapterFilter = document.getElementById('chapter-filter');
        if (!chapterFilter) return;

        // Get unique chapters from exercises
        const chapters = [...new Set(this.exercises.map(ex => ex.chapter || 'Uncategorized'))];
        chapters.sort();

        // Clear existing options except "All Chapters"
        chapterFilter.innerHTML = '<option value="all">All Chapters</option>';

        // Add option for each chapter
        chapters.forEach(chapter => {
            const option = document.createElement('option');
            option.value = chapter;
            option.textContent = chapter;
            chapterFilter.appendChild(option);
        });
    }

    createChapterSection(chapterName, exercises) {
        const section = document.createElement('div');
        section.className = 'chapter-section';

        const header = document.createElement('div');
        header.className = 'chapter-header';
        header.innerHTML = `
            <h2 class="chapter-title">${chapterName}</h2>
            <span class="chapter-count">${exercises.length} exercises</span>
        `;
        section.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'exercises-grid';

        exercises.forEach((exercise, index) => {
            // Use database progress instead of localStorage
            const isCompleted = this.userProgress[exercise.id]?.completed || false;
            const card = this.createExerciseCard(exercise, isCompleted, index + 1);
            grid.appendChild(card);
        });

        section.appendChild(grid);

        return section;
    }

    createExerciseCard(exercise, isCompleted, number) {
        const card = document.createElement('div');
        card.className = `exercise-card ${isCompleted ? 'completed' : ''}`;
        card.dataset.exerciseId = exercise.id;
        card.dataset.completed = isCompleted;

        // Extract first paragraph from description
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = exercise.description;
        const firstP = tempDiv.querySelector('p')?.textContent || exercise.description.substring(0, 150);

        // Get global stats for this exercise
        const stats = this.globalStats[exercise.id] || { usersCompleted: 0, avgTries: 0 };

        // Calculate difficulty rating based on average tries
        // Only show difficulty if at least 3 users have completed it (to ensure meaningful statistics)
        let difficulty;
        let difficultyClass;
        if (stats.usersCompleted < 3 || stats.avgTries === 0) {
            difficulty = '';
            difficultyClass = '';
        } else if (stats.avgTries <= 3) {
            difficulty = 'Easy';
            difficultyClass = 'difficulty-easy';
        } else if (stats.avgTries <= 5) {
            difficulty = 'Medium';
            difficultyClass = 'difficulty-medium';
        } else if (stats.avgTries <= 10) {
            difficulty = 'Hard';
            difficultyClass = 'difficulty-hard';
        } else {
            difficulty = 'Very Hard';
            difficultyClass = 'difficulty-very-hard';
        }

        const statsHtml = stats.usersCompleted > 0 ? `
            <div class="card-meta ${difficultyClass}">
                <span class="stat-dot"></span>
                <span class="stat-text">${stats.usersCompleted} completed</span>
                <span class="stat-separator">•</span>
                <span class="stat-text">${stats.avgTries} tries</span>
                ${difficulty ? `<span class="difficulty-badge">${difficulty}</span>` : ''}
            </div>
        ` : '<div class="card-meta"><span class="difficulty-badge new-badge">New</span></div>';

        card.innerHTML = `
            <div class="card-header">
                <div class="card-number">${number}.</div>
                <div class="card-title-container">
                    <div class="card-title">${exercise.title}</div>
                </div>
                <span class="card-badge ${isCompleted ? 'completed' : 'not-started'}">
                    ${isCompleted ? '✓' : '○'}
                </span>
            </div>
            <div class="card-description">${firstP.substring(0, 120)}${firstP.length > 120 ? '...' : ''}</div>
            <div class="card-footer">
                <span class="card-arrow">→</span>
                ${statsHtml}
            </div>
        `;

        card.addEventListener('click', () => {
            this.selectExercise(exercise.id);
        });

        return card;
    }

    selectExercise(exerciseId) {
        // Store selected exercise
        sessionStorage.setItem('selectedExercise', exerciseId);
        // Navigate to workspace page
        navigateTo(`workspace.html?exercise=${exerciseId}`);
    }

    filterExercises() {
        const sections = document.querySelectorAll('.chapter-section');

        // Filter by chapter first
        sections.forEach(section => {
            const chapterTitle = section.querySelector('.chapter-title')?.textContent;
            const matchesChapter = this.currentChapterFilter === 'all' || chapterTitle === this.currentChapterFilter;

            if (!matchesChapter) {
                section.style.display = 'none';
                return;
            }

            // Filter cards within visible chapters
            const sectionCards = section.querySelectorAll('.exercise-card');
            let visibleCount = 0;

            sectionCards.forEach(card => {
                const isCompleted = card.dataset.completed === 'true';
                let shouldShow = false;

                if (this.currentFilter === 'all') {
                    shouldShow = true;
                } else if (this.currentFilter === 'completed' && isCompleted) {
                    shouldShow = true;
                } else if (this.currentFilter === 'pending' && !isCompleted) {
                    shouldShow = true;
                }

                card.style.display = shouldShow ? 'block' : 'none';
                if (shouldShow) visibleCount++;
            });

            // Hide section if no visible cards
            section.style.display = visibleCount > 0 ? 'block' : 'none';
        });
    }

    updateProgressDisplay() {
        const totalExercises = this.exercises.length;
        // Count completed exercises only for the current language (exercises are already filtered)
        const completedExercises = this.exercises.filter(ex => this.userProgress[ex.id]?.completed).length;
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
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ExercisesPage();
});

