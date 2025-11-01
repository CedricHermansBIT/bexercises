// frontend/js/pages/leaderboardPage.js
import ApiService from '../services/apiService.js';
import AuthComponent from '../components/authComponent.js';
import { navigateTo } from '../utils/navigationUtils.js';

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
        this.searchQuery = '';
        this.autoRefresh = false;
        this.autoRefreshInterval = null;
        this.autoRefreshProgressInterval = null;
        this.lastUpdated = null;
        this.autoRefreshProgress = 100;

        this.init();
    }

    async init() {
        // Check authentication - REQUIRED
        const isAuthenticated = await this.authComponent.checkAuth();
        if (!isAuthenticated) {
            navigateTo('login.html');
            return;
        }

        // Setup admin access
        this.setupAdminAccess();

        // Update time display
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);

        // Update "last updated" display every 10 seconds
        setInterval(() => this.updateLastUpdatedDisplay(), 10000);

        // Setup event listeners
        this.setupEventListeners();

        // Setup logout
        this.setupLogout();

        // Load initial data - languages first, then rankings
        await this.loadLanguages();
        await this.loadRankings();
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
            // Clean up auto-refresh before leaving
            if (this.autoRefreshInterval) {
                clearInterval(this.autoRefreshInterval);
            }
            if (this.autoRefreshProgressInterval) {
                clearInterval(this.autoRefreshProgressInterval);
            }

            // Go back to previous page or languages page
            const referrer = document.referrer;
            if (referrer.includes('exercises.html')) {
                navigateTo('exercises.html');
            } else if (referrer.includes('workspace.html')) {
                navigateTo('workspace.html');
            } else {
                navigateTo('languages.html');
            }
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshCurrentTab());
        }

        // Search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.renderRankings(this.currentTab);
            });
        }

        // Auto-refresh toggle
        const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', (e) => {
                this.toggleAutoRefresh(e.target.checked);
            });
        }

        // Achievements button
        const achievementsBtn = document.getElementById('achievements-btn-leaderboard');
        if (achievementsBtn) {
            achievementsBtn.addEventListener('click', () => {
                navigateTo('achievements.html');
            });
        }

        // Admin button
        const adminBtn = document.getElementById('admin-btn-leaderboard');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                navigateTo('admin.html');
            });
        }
    }

    setupLogout() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                // Clean up auto-refresh before logout
                if (this.autoRefreshInterval) {
                    clearInterval(this.autoRefreshInterval);
                }
                if (this.autoRefreshProgressInterval) {
                    clearInterval(this.autoRefreshProgressInterval);
                }
                this.authComponent.logout();
            });
        }

        // Setup theme toggle
        this.setupThemeToggle();

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

        // Update page title
        this.updatePageTitle(tabName);

        // Load data if not already loaded
        if (!this.rankings[tabName] || this.rankings[tabName].length === 0) {
            await this.loadRankings(tabName === 'global' ? null : tabName);
        } else {
            this.renderRankings(tabName);
        }

        // Update last updated display
        this.updateLastUpdatedDisplay();
    }

    updatePageTitle(tabName) {
        const titleElement = document.querySelector('.page-title');
        if (titleElement) {
            if (tabName === 'global') {
                titleElement.textContent = '$ cat /rankings/global.txt';
            } else {
                const lang = this.languages.find(l => l.id === tabName);
                titleElement.textContent = `$ cat /rankings/${lang ? lang.name.toLowerCase() : tabName}.txt`;
            }
        }
    }

    async refreshCurrentTab() {
        const refreshBtn = document.getElementById('refresh-btn');
        const currentTable = document.querySelector('.leaderboard-panel.active .leaderboard-table');

        if (refreshBtn) {
            refreshBtn.classList.add('spinning');
        }

        if (currentTable) {
            currentTable.classList.add('refreshing');
        }

        await this.loadRankings(this.currentTab === 'global' ? null : this.currentTab);

        if (refreshBtn) {
            setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
        }

        if (currentTable) {
            setTimeout(() => currentTable.classList.remove('refreshing'), 500);
        }
    }

    toggleAutoRefresh(enabled) {
        this.autoRefresh = enabled;
        console.log('Auto-refresh toggled:', enabled);

        if (enabled) {
            console.log('Starting auto-refresh (every 30 seconds)...');

            // Do an immediate refresh
            this.refreshCurrentTab();

            // Reset progress
            this.autoRefreshProgress = 100;
            this.updateProgressBar();

            // Then refresh every 30 seconds
            this.autoRefreshInterval = setInterval(() => {
                console.log('Auto-refresh triggered');
                this.autoRefreshProgress = 100;
                this.refreshCurrentTab();
            }, 30000);

            // Update progress bar every 100ms (smooth animation)
            this.autoRefreshProgressInterval = setInterval(() => {
                this.autoRefreshProgress -= (100 / 30000) * 100; // Decrease over 30 seconds
                if (this.autoRefreshProgress < 0) this.autoRefreshProgress = 0;
                this.updateProgressBar();
            }, 100);

            // Update footer to show auto-refresh is active
            this.updateFooterWithAutoRefresh();

            // Show visual indicator
            this.showAutoRefreshStatus('Auto-refresh enabled - refreshing now...');
        } else {
            console.log('Stopping auto-refresh');
            if (this.autoRefreshInterval) {
                clearInterval(this.autoRefreshInterval);
                this.autoRefreshInterval = null;
            }
            if (this.autoRefreshProgressInterval) {
                clearInterval(this.autoRefreshProgressInterval);
                this.autoRefreshProgressInterval = null;
            }

            // Hide progress bar
            this.hideProgressBar();

            // Update footer
            this.updateFooterWithAutoRefresh();

            this.showAutoRefreshStatus('Auto-refresh disabled');
        }
    }

    updateProgressBar() {
        let progressBar = document.getElementById('auto-refresh-progress');

        if (!progressBar) {
            // Create progress bar if it doesn't exist
            const footer = document.querySelector('.leaderboard-footer');
            if (footer) {
                progressBar = document.createElement('div');
                progressBar.id = 'auto-refresh-progress';
                progressBar.className = 'auto-refresh-progress-bar';
                progressBar.innerHTML = '<div class="progress-fill"></div>';
                footer.insertBefore(progressBar, footer.firstChild);
            }
        }

        if (progressBar) {
            const fill = progressBar.querySelector('.progress-fill');
            if (fill) {
                fill.style.width = this.autoRefreshProgress + '%';

                // Change color based on time remaining
                if (this.autoRefreshProgress > 66) {
                    fill.style.background = 'var(--accent-green)';
                } else if (this.autoRefreshProgress > 33) {
                    fill.style.background = 'var(--accent-yellow)';
                } else {
                    fill.style.background = 'var(--accent-blue)';
                }
            }
        }
    }

    hideProgressBar() {
        const progressBar = document.getElementById('auto-refresh-progress');
        if (progressBar) {
            progressBar.remove();
        }
    }

    updateFooterWithAutoRefresh() {
        const lastUpdatedElement = document.getElementById('last-updated');
        if (!lastUpdatedElement) return;

        if (this.autoRefresh) {
            // Add auto-refresh indicator
            if (!lastUpdatedElement.querySelector('.auto-refresh-indicator')) {
                const indicator = document.createElement('span');
                indicator.className = 'auto-refresh-indicator';
                indicator.textContent = ' • Auto-refresh ON';
                indicator.style.color = 'var(--accent-green)';
                indicator.style.fontWeight = '600';
                lastUpdatedElement.appendChild(indicator);
            }
        } else {
            // Remove auto-refresh indicator
            const indicator = lastUpdatedElement.querySelector('.auto-refresh-indicator');
            if (indicator) {
                indicator.remove();
            }
        }
    }

    showAutoRefreshStatus(message) {
        // Show a temporary status message
        const lastUpdatedElement = document.getElementById('last-updated');
        if (lastUpdatedElement) {
            lastUpdatedElement.textContent = message;
            lastUpdatedElement.style.color = 'var(--accent-blue)';

            setTimeout(() => {
                lastUpdatedElement.style.color = '';
                this.updateLastUpdatedDisplay();
            }, 3000);
        }
    }

    updateLastUpdatedDisplay() {
        const lastUpdatedElement = document.getElementById('last-updated');
        if (lastUpdatedElement && this.lastUpdated) {
            const now = new Date();
            const diff = Math.floor((now - this.lastUpdated) / 1000);

            let timeAgo;
            if (diff < 60) {
                timeAgo = 'just now';
            } else if (diff < 3600) {
                const minutes = Math.floor(diff / 60);
                timeAgo = `${minutes}m ago`;
            } else {
                const hours = Math.floor(diff / 3600);
                timeAgo = `${hours}h ago`;
            }

            // Check if auto-refresh indicator exists
            const indicator = lastUpdatedElement.querySelector('.auto-refresh-indicator');
            const indicatorHTML = indicator ? indicator.outerHTML : '';

            lastUpdatedElement.innerHTML = `Updated ${timeAgo}${indicatorHTML}`;
        }
    }

    async loadLanguages() {
        try {
            this.languages = await this.apiService.getLanguages();
            console.log('Loaded languages:', this.languages);
            this.renderLanguageTabs();
        } catch (error) {
            console.error('Failed to load languages:', error);
            // Show a user-friendly message
            const tabsContainer = document.querySelector('.leaderboard-tabs');
            if (tabsContainer && this.languages.length === 0) {
                const infoSpan = document.createElement('span');
                infoSpan.className = 'tabs-info';
                infoSpan.textContent = '(Language tabs will appear when languages are available)';
                infoSpan.style.color = 'var(--text-muted)';
                infoSpan.style.fontSize = '12px';
                infoSpan.style.marginLeft = '1rem';
                tabsContainer.appendChild(infoSpan);
            }
        }
    }

    renderLanguageTabs() {
        const tabsContainer = document.querySelector('.leaderboard-tabs');
        if (!tabsContainer) {
            console.warn('Leaderboard tabs container not found');
            return;
        }

        if (!this.languages || this.languages.length === 0) {
            console.log('No languages to render tabs for');
            return;
        }

        console.log(`Rendering ${this.languages.length} language tabs`);

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
            panel.innerHTML = `
                <div class="leaderboard-table">
                    <div class="table-header">
                        <div class="rank-col">Rank</div>
                        <div class="user-col">User</div>
                        <div class="score-col">Completed</div>
                        <div class="attempts-col">Attempts</div>
                        <div class="rate-col">Success Rate</div>
                    </div>
                    <div id="${lang.id}-rankings" class="table-body"></div>
                </div>
            `;
            document.querySelector('.leaderboard-panels').appendChild(panel);

            this.rankings[lang.id] = [];
        });
    }

    async loadRankings(languageId = null) {
        const tabName = languageId || 'global';
        const container = document.getElementById(`${tabName}-rankings`);

        try {
            // Show loading state
            if (container) {
                container.innerHTML = '<div class="loading-spinner">Loading rankings...</div>';
            }

            let rankings;
            if (tabName === 'achievements') {
                rankings = await this.apiService.getAchievementLeaderboard();
            } else {
                rankings = await this.apiService.getLeaderboard(languageId);
            }

            this.rankings[tabName] = rankings;
            this.lastUpdated = new Date();
            this.renderRankings(tabName);
            this.updateLastUpdatedDisplay();
        } catch (error) {
            console.error('Failed to load rankings:', error);
            if (container) {
                container.innerHTML = `
                    <div class="error-state">
                        <span class="error-icon">⚠</span>
                        <p>Failed to load leaderboard data</p>
                        <button class="retry-btn" onclick="window.location.reload()">Retry</button>
                    </div>
                `;
            }
        }
    }

    renderRankings(tabName) {
        const container = document.getElementById(`${tabName}-rankings`);
        if (!container) return;

        let rankings = this.rankings[tabName] || [];

        if (rankings.length === 0) {
            container.innerHTML = `
                <div class="no-rankings">
                    <span class="empty-icon">📊</span>
                    <p>No rankings available yet</p>
                    <p class="empty-subtitle">Be the first to complete exercises!</p>
                </div>
            `;
            return;
        }

        // Apply search filter
        if (this.searchQuery) {
            rankings = rankings.filter(user =>
                (user.display_name || 'Anonymous').toLowerCase().includes(this.searchQuery)
            );
        }

        if (rankings.length === 0 && this.searchQuery) {
            container.innerHTML = `
                <div class="no-rankings">
                    <span class="empty-icon">🔍</span>
                    <p>No users found matching "${this.escapeHtml(this.searchQuery)}"</p>
                </div>
            `;
            return;
        }

        let html = '';
        const currentUserId = this.authComponent.getCurrentUser()?.id;
        let currentUserRank = null;

        // Check if this is the achievements tab
        const isAchievementsTab = tabName === 'achievements';

        rankings.forEach((user, index) => {
            const rank = index + 1;
            const isCurrentUser = currentUserId === user.id;

            if (isCurrentUser) {
                currentUserRank = rank;
            }

            const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
            const userClass = isCurrentUser ? 'current-user' : '';

            // Trophy icons for top 3
            let rankDisplay = `#${rank}`;
            if (rank === 1) rankDisplay = '🥇';
            else if (rank === 2) rankDisplay = '🥈';
            else if (rank === 3) rankDisplay = '🥉';

            if (isAchievementsTab) {
                // Achievements leaderboard format
                const completionPercent = user.total_achievements > 0
                    ? Math.round((user.achievements_earned / user.total_achievements) * 100)
                    : 0;

                html += `
                    <div class="ranking-row ${userClass}" data-user-id="${user.id}">
                        <div class="rank-col">
                            <span class="rank-number ${rankClass}">${rankDisplay}</span>
                        </div>
                        <div class="user-col">
                            <span class="user-name">${this.escapeHtml(user.display_name || 'Anonymous')}</span>
                            ${isCurrentUser ? '<span class="you-badge">YOU</span>' : ''}
                        </div>
                        <div class="score-col">
                            <span class="score">${user.total_points}</span>
                            <span class="score-label">points</span>
                        </div>
                        <div class="achievements-col">
                            <span class="attempts">${user.achievements_earned}/${user.total_achievements}</span>
                            <span class="attempts-label">achievements</span>
                        </div>
                        <div class="completion-col">
                            <span class="rate ${completionPercent >= 80 ? 'high' : completionPercent >= 50 ? 'medium' : 'low'}">${completionPercent}%</span>
                            <span class="rate-label">completion</span>
                        </div>
                    </div>
                `;
            } else {
                // Exercise leaderboard format
                const successRate = user.total_attempts > 0
                    ? Math.round((user.completed_count / user.total_attempts) * 100)
                    : 0;

                html += `
                    <div class="ranking-row ${userClass}" data-user-id="${user.id}">
                        <div class="rank-col">
                            <span class="rank-number ${rankClass}">${rankDisplay}</span>
                        </div>
                        <div class="user-col">
                            <span class="user-name">${this.escapeHtml(user.display_name || 'Anonymous')}</span>
                            ${isCurrentUser ? '<span class="you-badge">YOU</span>' : ''}
                        </div>
                        <div class="score-col">
                            <span class="score">${user.completed_count}</span>
                            <span class="score-label">completed</span>
                        </div>
                        <div class="attempts-col">
                            <span class="attempts">${user.total_attempts || 0}</span>
                            <span class="attempts-label">attempts</span>
                        </div>
                        <div class="rate-col">
                            <span class="rate ${successRate >= 80 ? 'high' : successRate >= 50 ? 'medium' : 'low'}">${successRate}%</span>
                            <span class="rate-label">success</span>
                        </div>
                    </div>
                `;
            }
        });

        container.innerHTML = html;

        // Update summary stats
        this.updateSummaryStats(rankings, currentUserRank);

        // Scroll to current user if they exist and are not in top 10
        if (currentUserRank && currentUserRank > 10) {
            const currentUserRow = container.querySelector('.current-user');
            if (currentUserRow) {
                setTimeout(() => {
                    currentUserRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        }
    }

    updateSummaryStats(rankings, currentUserRank) {
        const summaryContainer = document.getElementById('summary-stats');
        if (!summaryContainer || rankings.length === 0) return;

        const totalUsers = rankings.length;

        // Check if this is achievements leaderboard (has total_points) or exercises leaderboard (has completed_count)
        const isAchievementsTab = rankings[0] && 'total_points' in rankings[0];

        let avgValue, topScore, avgLabel, topLabel;

        if (isAchievementsTab) {
            // Achievements leaderboard stats
            avgValue = Math.round(
                rankings.reduce((sum, user) => sum + (user.total_points || 0), 0) / totalUsers
            );
            topScore = rankings[0]?.total_points || 0;
            avgLabel = 'Avg Points';
            topLabel = 'Top Points';
        } else {
            // Exercise leaderboard stats
            avgValue = Math.round(
                rankings.reduce((sum, user) => sum + (user.completed_count || 0), 0) / totalUsers
            );
            topScore = rankings[0]?.completed_count || 0;
            avgLabel = 'Average';
            topLabel = 'Top Score';
        }

        let rankText = currentUserRank ? `#${currentUserRank}` : 'Unranked';
        if (currentUserRank === 1) rankText = '🥇 #1';
        else if (currentUserRank === 2) rankText = '🥈 #2';
        else if (currentUserRank === 3) rankText = '🥉 #3';

        summaryContainer.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Total Players</span>
                <span class="stat-value">${totalUsers}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">${topLabel}</span>
                <span class="stat-value">${topScore}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">${avgLabel}</span>
                <span class="stat-value">${avgValue}</span>
            </div>
            <div class="stat-item ${currentUserRank ? 'highlight' : ''}">
                <span class="stat-label">Your Rank</span>
                <span class="stat-value">${rankText}</span>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

