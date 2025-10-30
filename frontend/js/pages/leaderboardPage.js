// frontend/js/pages/leaderboardPage.js
import ApiService from '../services/apiService.js';
import AuthComponent from '../components/authComponent.js';

class LeaderboardPage {
    constructor() {
        this.apiService = new ApiService();
        this.authComponent = new AuthComponent(this.apiService);

        // Make auth component globally accessible
        window.authComponent = this.authComponent;

        this.currentTab = 'global';
        this.rankings = {
            global: [],
        };
        this.languages = [];

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

        // Setup event listeners
        this.setupEventListeners();

        // Setup logout
        this.setupLogout();

        // Load initial data
        await this.loadRankings();
        await this.loadLanguages();
    }

    updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const timeElements = document.querySelectorAll('.system-time');
        timeElements.forEach(el => el.textContent = timeString);
    }

    setupEventListeners() {
        // Back button
        document.getElementById('back-btn').addEventListener('click', () => {
            // Go back to previous page or languages page
            const referrer = document.referrer;
            if (referrer.includes('exercises.html')) {
                window.location.href = './exercises.html';
            } else if (referrer.includes('workspace.html')) {
                window.location.href = './workspace.html';
            } else {
                window.location.href = './languages.html';
            }
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    setupLogout() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.authComponent.logout();
            });
        }

        const userMenu = document.getElementById('user-menu');
        if (userMenu) {
            userMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenu.classList.toggle('active');
            });
        }

        document.addEventListener('click', () => {
            const userMenu = document.getElementById('user-menu');
            if (userMenu) {
                userMenu.classList.remove('active');
            }
        });
    }

    async switchTab(tabName) {
        this.currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update panels
        document.querySelectorAll('.leaderboard-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `${tabName}-tab`);
        });

        // Load data if not already loaded
        if (this.rankings[tabName].length === 0) {
            await this.loadRankings(tabName === 'global' ? null : tabName);
        }
    }

    async loadLanguages() {
        try {
            this.languages = await this.apiService.getLanguages();
            this.renderLanguageTabs();
        } catch (error) {
            console.error('Failed to load languages:', error);
        }
    }

    renderLanguageTabs() {
        const tabsContainer = document.querySelector('.leaderboard-tabs');
        if (!tabsContainer) return;

        this.languages.forEach(lang => {
            const tabBtn = document.createElement('button');
            tabBtn.className = 'tab-btn';
            tabBtn.dataset.tab = lang.id;
            tabBtn.textContent = lang.name;
            tabBtn.addEventListener('click', () => this.switchTab(lang.id));
            tabsContainer.appendChild(tabBtn);

            const panel = document.createElement('div');
            panel.id = `${lang.id}-tab`;
            panel.className = 'leaderboard-panel';
            panel.innerHTML = `<div id="${lang.id}-rankings" class="rankings-container"></div>`;
            document.querySelector('.leaderboard-content').appendChild(panel);

            this.rankings[lang.id] = [];
        });
    }

    async loadRankings(languageId = null) {
        try {
            const rankings = await this.apiService.getLeaderboard(languageId);
            this.rankings[languageId || 'global'] = rankings;
            this.renderRankings(languageId || 'global');
        } catch (error) {
            console.error('Failed to load rankings:', error);
            this.showError('Failed to load leaderboard data');
        }
    }

    renderRankings(tabName) {
        const container = document.getElementById(`${tabName}-rankings`);
        if (!container) return;

        const rankings = this.rankings[tabName];

        if (rankings.length === 0) {
            container.innerHTML = '<div class="no-rankings">No rankings available yet</div>';
            return;
        }

        let html = '';

        rankings.forEach((user, index) => {
            const rank = index + 1;
            const isCurrentUser = this.authComponent.getCurrentUser()?.id === user.id;
            const successRate = user.total_attempts > 0
                ? Math.round((user.completed_count / user.total_attempts) * 100)
                : 0;

            const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
            const userClass = isCurrentUser ? 'current-user' : '';

            html += `
                <div class="ranking-row ${userClass}">
                    <div class="rank-col">
                        <span class="rank-number ${rankClass}">#${rank}</span>
                    </div>
                    <div class="user-col">
                        <span class="user-name">${user.display_name || 'Anonymous'}</span>
                        ${isCurrentUser ? '<span class="you-badge">YOU</span>' : ''}
                    </div>
                    <div class="score-col">
                        <span class="score">${user.completed_count}</span>
                        <span class="score-label">completed</span>
                    </div>
                    <div class="rate-col">
                        <span class="rate">${successRate}%</span>
                        <span class="rate-label">success</span>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    showError(message) {
        // Simple error display
        const container = document.querySelector('.leaderboard-content');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        container.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new LeaderboardPage();
});
