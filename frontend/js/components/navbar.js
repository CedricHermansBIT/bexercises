// frontend/js/components/navbar.js
import OnlineUsers from './onlineUsers.js';
import { navigateTo } from '../utils/navigationUtils.js';

class Navbar {
    constructor() {
        this.authComponent = null;
        this.onlineUsers = new OnlineUsers();
    }

    /**
     * Render the navbar HTML
     * @param {Object} options - Configuration options
     * @param {boolean} options.showBack - Show back button
     * @param {string} options.backText - Back button text
     * @param {string} options.backUrl - Back button URL
     * @param {string} options.workspaceIndicator - Workspace indicator text (e.g., '[exercises]')
     * @param {string} options.appTitle - App title
     * @param {string} options.centerContent - Optional center content HTML
     * @returns {string} HTML string
     */
    render(options = {}) {
        const {
            showBack = false,
            backText = 'back',
            backUrl = '',
            workspaceIndicator = '',
            appTitle = 'BITLab',
            centerContent = '<span id="system-time">--:--</span>'
        } = options;

        return `
            <div class="topbar">
                <div class="topbar-left">
                    ${showBack ? `
                        <button class="back-button" id="back-button" data-url="${backUrl}">
                            <span>󰁍</span> ${backText}
                        </button>
                    ` : ''}
                    ${workspaceIndicator ? `<span class="workspace-indicator">${workspaceIndicator}</span>` : ''}
                    <span class="app-title">${appTitle}</span>
                </div>

                <div class="topbar-center">
                    ${centerContent}
                </div>

                <div class="topbar-right">
                    <button class="topbar-btn" id="achievements-btn" title="Achievements">
                        <span>🏅</span>
                    </button>
                    <button class="topbar-btn" id="leaderboard-btn" title="Leaderboard">
                        <span>🏆</span>
                    </button>
                    <div class="online-users-navbar" id="online-users-navbar">
                        <button class="topbar-btn" id="online-users-btn" title="Online Users">
                            <span class="online-indicator-navbar"></span>
                            <span class="online-count-navbar">0</span>
                        </button>
                        <div class="online-users-dropdown" id="online-users-dropdown">
                            <!-- Populated by JavaScript -->
                        </div>
                    </div>
                    <button class="topbar-btn admin-only" id="admin-btn" title="Admin Panel" style="display: none;">
                        <span>⚙️</span>
                    </button>
                    <span class="system-time" id="system-time-alt">00:00</span>
                    <div class="user-menu" id="user-menu">
                        <span class="user-icon">󰀄</span>
                        <div class="user-dropdown">
                            <button class="dropdown-item" id="theme-toggle-btn">
                                <span class="theme-icon">☀️</span> <span class="theme-text">Light Mode</span>
                            </button>
                            <button class="dropdown-item" id="logout-btn">
                                <span>󰗼</span> Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Initialize the navbar after it's been rendered
     * @param {AuthComponent} authComponent - Auth component instance
     */
    async init(authComponent) {
        this.authComponent = authComponent;

        // Initialize online users dropdown
        await this.onlineUsers.init('online-users-dropdown', true);

        // Setup event listeners
        this.setupEventListeners();

        // Show admin button if user is admin
        if (this.authComponent && this.authComponent.isAdmin()) {
            const adminBtn = document.getElementById('admin-btn');
            if (adminBtn) {
                adminBtn.style.display = 'inline-block';
            }
        }

        // Update time display
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);
    }

    setupEventListeners() {
        // Back button
        const backBtn = document.getElementById('back-button');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                const url = backBtn.getAttribute('data-url');
                if (url) {
                    navigateTo(url);
                } else {
                    window.history.back();
                }
            });
        }

        // Achievements button
        const achievementsBtn = document.getElementById('achievements-btn');
        if (achievementsBtn) {
            achievementsBtn.addEventListener('click', () => {
                navigateTo('achievements.html');
            });
        }

        // Leaderboard button
        const leaderboardBtn = document.getElementById('leaderboard-btn');
        if (leaderboardBtn) {
            leaderboardBtn.addEventListener('click', () => {
                navigateTo('leaderboard.html');
            });
        }

        // Admin button
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                navigateTo('admin/index.html');
            });
        }

        // User menu toggle
        const userMenu = document.getElementById('user-menu');
        if (userMenu) {
            userMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenu.classList.toggle('active');
            });

            // Close menu when clicking outside
            document.addEventListener('click', () => {
                userMenu.classList.remove('active');
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (this.authComponent) {
                    this.authComponent.logout();
                }
            });
        }

        // Theme toggle button
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                const themeManager = window.themeManager;
                if (themeManager) {
                    themeManager.toggleTheme();
                }
            });
        }
    }

    updateTime() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });

        // Update both possible time elements
        const timeElements = document.querySelectorAll('#system-time, #system-time-alt');
        timeElements.forEach(el => {
            if (el) el.textContent = timeStr;
        });
    }

    /**
     * Destroy the navbar and cleanup
     */
    destroy() {
        if (this.onlineUsers) {
            this.onlineUsers.destroy();
        }
    }
}

export default Navbar;

