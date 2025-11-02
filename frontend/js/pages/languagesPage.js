// frontend/js/pages/languagesPage.js
import ApiService from '../services/apiService.js';
import StorageService from '../services/storageService.js';
import AuthComponent from '../components/authComponent.js';
import NotificationBanner from '../components/notificationBanner.js';
import { navigateTo } from '../utils/navigationUtils.js';
import themeManager from '../utils/themeUtils.js';
import { setFavicon } from '../utils/faviconUtils.js';

class LanguagesPage {
    constructor() {
        this.apiService = new ApiService();
        this.storageService = new StorageService();
        this.authComponent = new AuthComponent(this.apiService);
        this.notificationBanner = new NotificationBanner();

        // Make auth component globally accessible
        window.authComponent = this.authComponent;

        this.exercises = [];

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

        // Setup theme toggle
        this.setupThemeToggle();

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
            const userMenu = document.getElementById('user-menu-language');
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
                    <!-- snake icon -->
<svg height="200px" width="200px" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 17.056 17.056" xml:space="preserve" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <g> <path style="fill:#b4befe;" d="M11.298,8.02c1.295-0.587,1.488-5.055,0.724-6.371c-0.998-1.718-5.742-1.373-7.24-0.145 C4.61,2.114,4.628,3.221,4.636,4.101h4.702v0.412H4.637c0,0.006-2.093,0.013-2.093,0.013c-3.609,0-3.534,7.838,1.228,7.838 c0,0,0.175-1.736,0.481-2.606C5.198,7.073,9.168,8.986,11.298,8.02z M6.375,3.465c-0.542,0-0.981-0.439-0.981-0.982 c0-0.542,0.439-0.982,0.981-0.982c0.543,0,0.982,0.44,0.982,0.982C7.358,3.025,6.918,3.465,6.375,3.465z"></path> <path style="fill:#b4befe;" d="M13.12,4.691c0,0-0.125,1.737-0.431,2.606c-0.945,2.684-4.914,0.772-7.045,1.738 C4.35,9.622,4.155,14.09,4.92,15.406c0.997,1.719,5.741,1.374,7.24,0.145c0.172-0.609,0.154-1.716,0.146-2.596H7.603v-0.412h4.701 c0-0.006,2.317-0.013,2.317-0.013C17.947,12.53,18.245,4.691,13.12,4.691z M10.398,13.42c0.542,0,0.982,0.439,0.982,0.982 c0,0.542-0.44,0.981-0.982,0.981s-0.981-0.439-0.981-0.981C9.417,13.859,9.856,13.42,10.398,13.42z"></path> </g> </g> </g></svg>                </div>
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

            <div class="language-card coming-soon" data-language="sql">
                <div class="language-icon">
<svg fill="#b4befe" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="#b4befe"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>mariadb</title> <path d="M29.942 6.518c-0.597 0.293-1.3 0.465-2.042 0.465-0.017 0-0.034-0-0.051-0l0.003 0c-0.543 0-1.064 0.096-1.546 0.271l0.032-0.010c-1.052 0.391-1.916 1.082-2.513 1.969l-0.012 0.018c-0.495 0.693-1.011 1.505-1.487 2.343l-0.074 0.142c-0.382 0.63-0.759 1.169-1.168 1.681l0.024-0.031c-0.701 0.866-1.6 1.545-2.63 1.971l-0.044 0.016c-1.369 0.617-3.070 1.245-4.818 1.767l-0.308 0.079c-1.341 0.441-2.665 0.922-2.958 1.080-1.109 0.603-2.030 1.418-2.737 2.398l-0.016 0.024c-1.253 1.65-1.215 1.641-3.801 1.183q-0.421-0.051-0.844-0.079c-0.12-0.026-0.258-0.041-0.399-0.041-0.483 0-0.925 0.173-1.268 0.461l0.003-0.003-0.284 0.269 0.221 0.11c0.268 0.167 0.496 0.331 0.714 0.508l-0.013-0.010c0.202 0.167 0.426 0.328 0.661 0.473l0.026 0.015c0.089 0.041 0.164 0.084 0.236 0.131l-0.007-0.004c-0.078 0.169-0.173 0.314-0.287 0.443l0.002-0.002c-0.544 0.726-0.741 1.088-0.717 1.31 0.024 0.205 0.040 0.212 0.537 0.212 0.027 0.001 0.059 0.001 0.091 0.001 0.533 0 1.043-0.096 1.515-0.271l-0.030 0.010c1.352-0.551 2.496-1.138 3.582-1.809l-0.103 0.059c0.704-0.485 1.508-0.922 2.358-1.271l0.086-0.031c0.102-0.025 0.442-0.087 0.742-0.142 0.42-0.055 0.906-0.087 1.4-0.087 0.647 0 1.282 0.054 1.899 0.159l-0.067-0.009c0.135 0.016 0.466 0.056 0.75 0.080 0.208 0.014 0.402 0.048 0.587 0.1l-0.020-0.005c0.033 0.015 0.592 0.046 1.247 0.070 1.167 0.032 1.38 0.009 1.625-0.236 0.256-0.353 0.467-0.761 0.613-1.199l0.009-0.032c0.261-0.804 0.521-1.151 0.457-0.615-0.1 1.117-0.418 2.14-0.912 3.055l0.021-0.042c-0.351 0.662-0.738 1.234-1.179 1.758l0.012-0.015c-0.402 0.434-0.394 0.45 0.11 0.394 0.991-0.155 1.876-0.516 2.641-1.039l-0.022 0.014c1.225-0.975 2.167-2.255 2.717-3.727l0.019-0.059c0.134-0.337 0.275-0.275 0.229 0.104-0.016 0.117-0.047 0.394-0.071 0.622l-0.039 0.41 0.441-0.252c1.245-0.867 2.178-2.107 2.644-3.555l0.014-0.049c0.473-1.33 0.936-2.995 1.294-4.699l0.047-0.269c0.106-0.524 0.223-0.961 0.363-1.387l-0.024 0.085c0.092-0.425 0.305-0.791 0.599-1.071l0.001-0.001c0.37-0.353 0.768-0.684 1.189-0.987l0.033-0.023c0.63-0.358 1.134-0.87 1.473-1.486l0.010-0.020c0.16-0.307 0.254-0.671 0.254-1.057 0-0.227-0.033-0.447-0.093-0.655l0.004 0.016c-0.165-0.252-0.355-0.245-0.954 0.008z"></path> </g></svg>
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
            
            <!-- PHP -->
            <div class="language-card coming-soon" data-language="php">
                <div class="language-icon">
<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--twemoji" preserveAspectRatio="xMidYMid meet" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path fill="#b4befe" d="M34.453 15.573c-.864-7.3-5.729-10.447-13.93-10.447c-.391 0-.763.017-1.139.031c-.013-.01-.022-.021-.035-.031C14.655 1.605 4.091 2.779 1.745 6.3c-3.255 4.883-1.174 22.3 0 24.646c1.173 2.35 4.694 3.521 5.868 2.35c1.174-1.176 0-1.176-1.173-3.521c-.85-1.701-.466-5.859.255-8.471c.028.168.068.322.1.486c.39 2.871 1.993 7.412 1.993 9.744c0 3.564 2.102 4.107 4.694 4.107c2.593 0 4.695-.543 4.695-4.107c0-.24-.008-.463-.012-.695c.757.064 1.535.107 2.359.107c.497 0 .977-.016 1.448-.039c-.004.209-.013.41-.013.627c0 3.564 2.103 4.107 4.694 4.107c2.593 0 4.695-.543 4.695-4.107c0-1.801 1.192-4.625 2.039-6.982c.159-.354.291-.732.42-1.117c.118 1.307.193 2.706.193 4.206a1 1 0 1 0 2 0c0-5.153-.771-9.248-1.547-12.068z"></path><path fill="#66757F" d="M19.35 5.126S23 10.641 20 15.641c-3 5-7.838 5-11 5c-2 0-1 2 0 2c1.414 0 8.395 1.211 12-6c3-6-1.65-11.515-1.65-11.515z"></path><circle fill="#292F33" cx="6.5" cy="14.141" r="1.5"></circle></g></svg>
                </div>
                <div class="language-info">
                    <h2 class="language-name">PHP</h2>
                    <p class="language-description">Server-side scripting</p>
                    <div class="language-meta">
                        <span class="language-level">Coming Soon</span>
                    </div>
                </div>
                <div class="language-status">
                    <span class="status-badge coming-soon">Coming Soon</span>
                </div>
            </div>
            <!--
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
            -->
        `;
        // Achievements link
        const achievementsLink = document.getElementById('achievements-btn-language');
        if (achievementsLink) {
            achievementsLink.addEventListener('click', () => {
                navigateTo('achievements.html');
            });
        }

        // Leaderboard link
        const leaderboardLink = document.getElementById('leaderboard-btn-language');
        if (leaderboardLink) {
            leaderboardLink.addEventListener('click', () => {
                navigateTo('leaderboard.html');
            });
        }

        // Admin button
        const adminBtn = document.getElementById('admin-btn-language');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                navigateTo('admin.html');
            });
        }

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
        navigateTo('exercises.html');
    }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LanguagesPage();
});

