// frontend/js/pages/languagesPage.js
import ApiService from '../services/apiService.js';
import StorageService from '../services/storageService.js';
import AuthComponent from '../components/authComponent.js';

class LanguagesPage {
    constructor() {
        this.apiService = new ApiService();
        this.storageService = new StorageService();
        this.authComponent = new AuthComponent(this.apiService);

        // Make auth component globally accessible
        window.authComponent = this.authComponent;

        this.exercises = [];

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

        // Load exercises to get counts
        await this.loadExercises();

        // Populate language cards
        this.populateLanguageCards();

        // Show admin button if user is admin
        this.setupAdminAccess();

        // Setup logout button
        this.setupLogout();
    }

    setupLogout() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.authComponent.logout();
            });
        }

        // Toggle dropdown on user menu click
        const userMenu = document.getElementById('user-menu-language');
        if (userMenu) {
            userMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenu.classList.toggle('active');
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            const userMenu = document.getElementById('user-menu-language');
            if (userMenu) {
                userMenu.classList.remove('active');
            }
        });
    }

    setupAdminAccess() {
        if (this.authComponent.isAdmin()) {
            const topbarRight = document.querySelector('#language-screen .topbar-right');
            const adminBtn = document.createElement('button');
            adminBtn.className = 'action-btn';
            adminBtn.innerHTML = '<span>⚙</span> Admin';
            adminBtn.style.marginRight = '1rem';
            adminBtn.addEventListener('click', () => {
                window.location.href = './admin.html';
            });
            topbarRight.insertBefore(adminBtn, topbarRight.firstChild);
        }
    }

    updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const timeElements = document.querySelectorAll('.system-time');
        timeElements.forEach(el => el.textContent = timeString);
    }

    async loadExercises() {
        try {
            this.exercises = await this.apiService.getExercises();
        } catch (error) {
            console.error('Failed to load exercises:', error);
        }
    }

    getExerciseStats() {
        const progress = this.storageService.loadProgress();
        const total = this.exercises.length;
        const completed = Object.values(progress).filter(p => p.completed).length;
        return { total, completed };
    }

    populateLanguageCards() {
        const grid = document.getElementById('languages-grid');
        if (!grid) return;

        const stats = this.getExerciseStats();

        grid.innerHTML = `
            <div class="language-card" data-language="bash">
                <div class="language-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 17l6-6-6-6M12 19h8"/>
                    </svg>
                </div>
                <div class="language-info">
                    <h2 class="language-name">Bash</h2>
                    <p class="language-description">Shell scripting and automation</p>
                    <div class="language-meta">
                        <span class="language-level">Beginner - Advanced</span>
                        <span class="language-exercises">${stats.total} exercises</span>
                    </div>
                    <div class="language-progress">
                        <span class="progress-label">${stats.completed} / ${stats.total} completed</span>
                        <div class="mini-progress-bar">
                            <div class="mini-progress-fill" style="width: ${stats.total > 0 ? (stats.completed / stats.total * 100) : 0}%"></div>
                        </div>
                    </div>
                </div>
                <div class="language-status">
                    <span class="status-badge available">Available</span>
                </div>
            </div>

            <div class="language-card coming-soon" data-language="python">
                <div class="language-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                        <path d="M8 12h8M12 8v8"/>
                    </svg>
                </div>
                <div class="language-info">
                    <h2 class="language-name">Python</h2>
                    <p class="language-description">General-purpose programming</p>
                    <div class="language-meta">
                        <span class="language-level">Coming Soon</span>
                    </div>
                </div>
                <div class="language-status">
                    <span class="status-badge coming-soon">Coming Soon</span>
                </div>
            </div>

            <div class="language-card coming-soon" data-language="javascript">
                <div class="language-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 3h18v18H3V3z"/>
                        <path d="M7.5 14.5l3-3 3 3"/>
                    </svg>
                </div>
                <div class="language-info">
                    <h2 class="language-name">JavaScript</h2>
                    <p class="language-description">Web development essentials</p>
                    <div class="language-meta">
                        <span class="language-level">Coming Soon</span>
                    </div>
                </div>
                <div class="language-status">
                    <span class="status-badge coming-soon">Coming Soon</span>
                </div>
            </div>

            <div class="language-card coming-soon" data-language="sql">
                <div class="language-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M3 12h18M3 18h18"/>
                    </svg>
                </div>
                <div class="language-info">
                    <h2 class="language-name">SQL</h2>
                    <p class="language-description">Database queries</p>
                    <div class="language-meta">
                        <span class="language-level">Coming Soon</span>
                    </div>
                </div>
                <div class="language-status">
                    <span class="status-badge coming-soon">Coming Soon</span>
                </div>
            </div>

            <div class="language-card coming-soon" data-language="c">
                <div class="language-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/>
                    </svg>
                </div>
                <div class="language-info">
                    <h2 class="language-name">C</h2>
                    <p class="language-description">Systems programming</p>
                    <div class="language-meta">
                        <span class="language-level">Coming Soon</span>
                    </div>
                </div>
                <div class="language-status">
                    <span class="status-badge coming-soon">Coming Soon</span>
                </div>
            </div>

            <div class="language-card coming-soon" data-language="java">
                <div class="language-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2v20M2 12h20"/>
                    </svg>
                </div>
                <div class="language-info">
                    <h2 class="language-name">Java</h2>
                    <p class="language-description">Object-oriented programming</p>
                    <div class="language-meta">
                        <span class="language-level">Coming Soon</span>
                    </div>
                </div>
                <div class="language-status">
                    <span class="status-badge coming-soon">Coming Soon</span>
                </div>
            </div>
        `;

        // Add click handlers
        const languageCards = grid.querySelectorAll('.language-card:not(.coming-soon)');
        languageCards.forEach(card => {
            card.addEventListener('click', () => {
                const language = card.dataset.language;
                this.selectLanguage(language);
            });
        });
    }

    selectLanguage(language) {
        // Store selected language
        sessionStorage.setItem('selectedLanguage', language);
        // Navigate to exercises page
        window.location.href = './exercises.html';
    }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LanguagesPage();
});

