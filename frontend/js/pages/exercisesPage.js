// frontend/js/pages/exercisesPage.js
import ApiService from '../services/apiService.js';
import StorageService from '../services/storageService.js';
import AuthComponent from '../components/authComponent.js';

class ExercisesPage {
    constructor() {
        this.apiService = new ApiService();
        this.storageService = new StorageService();
        this.authComponent = new AuthComponent(this.apiService);

        // Make auth component globally accessible
        window.authComponent = this.authComponent;

        this.currentLanguage = 'bash';
        this.exercises = [];
        this.currentFilter = 'all';

        this.init();
    }

    async init() {
        // Check authentication - REQUIRED
        const isAuthenticated = await this.authComponent.checkAuth();
        if (!isAuthenticated) {
            window.location.href = './login.html';
            return;
        }

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

        // Load exercises
        await this.loadExercises();

        // Update progress display
        this.updateProgressDisplay();

        // Populate exercise cards
        this.populateExerciseSections();

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
                window.location.href = './languages.html';
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
    }

    async loadExercises() {
        try {
            this.exercises = await this.apiService.getExercises();
        } catch (error) {
            console.error('Failed to load exercises:', error);
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

        const progress = this.storageService.loadProgress();

        exercises.forEach((exercise, index) => {
            const isCompleted = progress[exercise.id]?.completed || false;
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
        window.location.href = `./workspace.html?exercise=${exerciseId}`;
    }

    filterExercises() {
        const cards = document.querySelectorAll('.exercise-card');
        const sections = document.querySelectorAll('.chapter-section');

        cards.forEach(card => {
            const isCompleted = card.dataset.completed === 'true';

            if (this.currentFilter === 'all') {
                card.style.display = 'block';
            } else if (this.currentFilter === 'completed' && isCompleted) {
                card.style.display = 'block';
            } else if (this.currentFilter === 'pending' && !isCompleted) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });

        // Hide sections with no visible cards
        sections.forEach(section => {
            const visibleCards = section.querySelectorAll('.exercise-card[style="display: block;"], .exercise-card:not([style*="display: none"])');
            if (visibleCards.length === 0 && this.currentFilter !== 'all') {
                section.style.display = 'none';
            } else {
                section.style.display = 'block';
            }
        });
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
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ExercisesPage();
});

