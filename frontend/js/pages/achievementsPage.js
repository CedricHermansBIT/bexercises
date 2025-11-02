// frontend/js/pages/achievementsPage.js
import ApiService from '../services/apiService.js';
import AuthComponent from '../components/authComponent.js';
import NotificationBanner from '../components/notificationBanner.js';
import { navigateTo } from '../utils/navigationUtils.js';
import themeManager from '../utils/themeUtils.js';
import { setFavicon } from '../utils/faviconUtils.js';

class AchievementsPage {
    constructor() {
        this.apiService = new ApiService();
        this.authComponent = new AuthComponent(this.apiService);
        this.notificationBanner = new NotificationBanner();
        this.achievements = [];
        this.currentFilter = 'all';

        this.init();
    }

    async init() {
        // Check authentication
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

        // Update time display
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);

        // Setup event listeners
        this.setupEventListeners();
        this.setupLogout();
        this.setupThemeToggle();

        // Load achievements
        await this.loadAchievements();
    }

    updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const timeElements = document.querySelectorAll('.system-time');
        timeElements.forEach(el => el.textContent = timeString);
    }

    setupEventListeners() {
        document.getElementById('back-btn').addEventListener('click', () => {
            navigateTo('languages.html');
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                this.filterAchievements(filter);
            });
        });

        // Leaderboard button
        const leaderboardBtn = document.getElementById('leaderboard-btn-achievements');
        if (leaderboardBtn) {
            leaderboardBtn.addEventListener('click', () => {
                navigateTo('leaderboard.html');
            });
        }

        // Admin button
        const adminBtn = document.getElementById('admin-btn-achievements');
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
                this.authComponent.logout();
            });
        }

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

    async loadAchievements() {
        try {
            const data = await this.apiService.getUserAchievements();
            this.achievements = data.achievements || [];

            const totalPoints = data.totalPoints || 0;
            const earnedCount = this.achievements.filter(a => a.earned).length;
            const totalCount = this.achievements.length;
            const progressPercent = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

            // Update stats
            document.getElementById('points-display').textContent = `${totalPoints} points`;
            document.getElementById('earned-count').textContent = earnedCount;
            document.getElementById('total-count').textContent = totalCount;
            document.getElementById('progress-percent').textContent = `${progressPercent}%`;

            // Display achievements
            this.displayAchievements();
        } catch (error) {
            console.error('Failed to load achievements:', error);
        }
    }

    displayAchievements() {
        const grid = document.getElementById('achievements-grid');
        grid.innerHTML = '';

        // Group by category
        const categories = {};
        this.achievements.forEach(achievement => {
            const category = achievement.category || 'other';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(achievement);
        });

        // Display by category
        Object.keys(categories).sort().forEach(category => {
            const categorySection = document.createElement('div');
            categorySection.className = 'achievement-category';

            const categoryTitle = document.createElement('h2');
            categoryTitle.className = 'category-title';
            categoryTitle.textContent = this.formatCategoryName(category);
            categorySection.appendChild(categoryTitle);

            const achievementsList = document.createElement('div');
            achievementsList.className = 'achievements-list';

            categories[category].forEach(achievement => {
                const card = this.createAchievementCard(achievement);
                achievementsList.appendChild(card);
            });

            categorySection.appendChild(achievementsList);
            grid.appendChild(categorySection);
        });
    }

    createAchievementCard(achievement) {
        const card = document.createElement('div');
        card.className = 'achievement-card';

        if (achievement.earned) {
            card.classList.add('earned');
        } else {
            card.classList.add('locked');
        }

        const icon = document.createElement('div');
        icon.className = 'achievement-icon';
        icon.textContent = achievement.earned ? achievement.icon : '🔒';
        card.appendChild(icon);

        const content = document.createElement('div');
        content.className = 'achievement-content';

        const name = document.createElement('div');
        name.className = 'achievement-name';
        name.textContent = achievement.earned ? achievement.name : '???';
        content.appendChild(name);

        const description = document.createElement('div');
        description.className = 'achievement-description';
        description.textContent = achievement.earned ? achievement.description : 'Locked';
        content.appendChild(description);

        const footer = document.createElement('div');
        footer.className = 'achievement-footer';

        const points = document.createElement('span');
        points.className = 'achievement-points';
        points.textContent = `${achievement.points} pts`;
        footer.appendChild(points);

        if (achievement.earned && achievement.earned_at) {
            const earnedDate = new Date(achievement.earned_at);
            const dateSpan = document.createElement('span');
            dateSpan.className = 'achievement-date';
            // Format date as MM/DD/YYYY -> DD/MM/YYYY
            dateSpan.textContent = earnedDate.toLocaleDateString('en-GB');
            const newLine = document.createTextNode(' | ');
            footer.appendChild(newLine);
            footer.appendChild(dateSpan);
        }

        content.appendChild(footer);
        card.appendChild(content);

        return card;
    }

    formatCategoryName(category) {
        return category.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    filterAchievements(filter) {
        this.currentFilter = filter;

        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        // Show/hide achievements
        document.querySelectorAll('.achievement-card').forEach(card => {
            if (filter === 'all') {
                card.style.display = 'flex';
            } else if (filter === 'earned') {
                card.style.display = card.classList.contains('earned') ? 'flex' : 'none';
            } else if (filter === 'locked') {
                card.style.display = card.classList.contains('locked') ? 'flex' : 'none';
            }
        });
    }
}

// Initialize the page when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new AchievementsPage());
} else {
    new AchievementsPage();
}

