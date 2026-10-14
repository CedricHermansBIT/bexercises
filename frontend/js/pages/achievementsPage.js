// frontend/js/pages/achievementsPage.js
import ApiService from '../services/apiService.js';
import AuthComponent from '../components/authComponent.js';
import NotificationBanner from '../components/notificationBanner.js';
import OnlineUsers from '../components/onlineUsers.js';
import Navbar from '../components/navbar.js';
import { navigateTo } from '../utils/navigationUtils.js';
import themeManager from '../utils/themeUtils.js';
import { setFavicon } from '../utils/faviconUtils.js';
import { paintAvatar, previewAvatarReward, paintRewardThumbnail } from '../utils/avatarIdentity.js';
import { getAchievementRewards } from '../utils/avatarRewards.js';

class AchievementsPage {
    constructor() {
        this.apiService = new ApiService();
        this.authComponent = new AuthComponent(this.apiService);
        this.notificationBanner = new NotificationBanner();
        this.onlineUsers = new OnlineUsers();
        this.navbar = new Navbar(this.apiService);
        this.achievements = [];
        this.currentFilter = 'all';

        window.themeManager = themeManager;

        this.init();
    }

    async init() {
        // Check authentication
        const isAuthenticated = await this.authComponent.checkAuth();
        if (isAuthenticated === null) return;
        if (!isAuthenticated) {
            navigateTo('login.html');
            return;
        }

        // Set favicon
        setFavicon();

        // Setup admin access
        this.setupAdminAccess();

        // Update time display
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);

        // Setup event listeners
        this.setupEventListeners();
        this.setupLogout();
        this.setupThemeToggle();

        // Initialize components and load data in parallel
        await Promise.all([
            this.notificationBanner.init(),
            this.onlineUsers.init('online-users-dropdown', true),
            this.loadAchievements(),
            this.loadCharacter()
        ]);
    }

    async loadCharacter() {
        try {
            const state = await this.apiService._get('/api/avatar');
            this.avatarState = state;
            if (this.achievements.length) this.displayAchievements();
            await paintAvatar(document.getElementById('achievement-character'), state.selection, '');
        } catch (error) { console.warn('Could not load character preview:', error); }
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
                const filter = e.currentTarget.dataset.filter;
                this.filterAchievements(filter);
            });
        });

        document.getElementById('achievement-category').addEventListener('change', () => this.displayAchievements());

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
            document.getElementById('collection-progress').value = progressPercent;
            document.getElementById('collection-points').textContent = `${totalPoints} points`;
            const categories = [...new Set(this.achievements.map(a => a.category || 'other'))].sort();
            const select = document.getElementById('achievement-category');
            for (const category of categories) {
                const option = document.createElement('option'); option.value = category;
                option.textContent = this.formatCategoryName(category); select.append(option);
            }

            // Display achievements
            this.displayAchievements();
        } catch (error) {
            console.error('Failed to load achievements:', error);
            const status = document.getElementById('collection-results');
            status.textContent = 'Could not load achievements. ';
            const retry = document.createElement('button'); retry.textContent = 'Try again';
            retry.addEventListener('click', () => { status.textContent = 'Loading achievements…'; void this.loadAchievements(); });
            status.append(retry);
            document.getElementById('achievements-grid').setAttribute('aria-busy', 'false');
        }
    }

    displayAchievements() {
        const grid = document.getElementById('achievements-grid');
        grid.replaceChildren(); grid.setAttribute('aria-busy', 'false');
        const categoryFilter = document.getElementById('achievement-category').value;
        const matches = this.achievements.filter(a => {
            return (this.currentFilter === 'all' || (this.currentFilter === 'earned' ? a.earned : !a.earned)) &&
                (categoryFilter === 'all' || (a.category || 'other') === categoryFilter);
        });
        document.getElementById('collection-results').textContent = matches.length
            ? `${matches.length} achievement${matches.length === 1 ? '' : 's'} · Click a character reward to preview it.`
            : 'No achievements match. Try another filter.';
        const order = ['getting-started', 'progress', 'skill', 'mastery', 'persistence', 'attempts', 'speed', 'streak', 'time', 'secret'];
        const rank = category => order.includes(category) ? order.indexOf(category) : order.length - 1;
        // Separate states before grouping categories so every earned achievement comes first.
        for (const earned of [true, false]) {
            const group = matches.filter(a => Boolean(a.earned) === earned);
            if (!group.length) continue;
            const state = document.createElement('section'); state.className = `collection-state ${earned ? 'is-earned' : 'is-locked'}`;
            const title = document.createElement('h2'); title.className = 'collection-state-title';
            title.textContent = `${earned ? '✓ Earned' : '🔒 To earn'} · ${group.length}`; state.append(title);
            const categories = new Map();
            for (const achievement of group) {
                const key = achievement.category || 'other';
                if (!categories.has(key)) categories.set(key, []);
                categories.get(key).push(achievement);
            }
            for (const category of [...categories.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))) {
                const achievements = categories.get(category);
                const section = document.createElement('section'); section.className = 'collection-category';
                const heading = document.createElement('h3'); heading.textContent = this.formatCategoryName(category);
                const list = document.createElement('div'); list.className = 'collection-cards';
                achievements.sort((a, b) => (b.measure?.fraction || 0) - (a.measure?.fraction || 0) || (a.points || 0) - (b.points || 0));
                for (const achievement of achievements) list.append(this.createAchievementCard(achievement));
                section.append(heading, list); state.append(section);
            }
            grid.append(state);
        }
    }

    createAchievementCard(achievement) {
        const card = document.createElement('article');
        card.className = 'collection-card';
        const secret = achievement.hidden && !achievement.earned;

        if (achievement.earned) {
            card.classList.add('earned');
        } else {
            card.classList.add('locked');
        }

        const icon = document.createElement('div');
        icon.className = 'achievement-icon';
        icon.textContent = achievement.earned ? achievement.icon : '🔒';
        icon.setAttribute('aria-hidden', 'true');
        card.appendChild(icon);

        const content = document.createElement('div');
        content.className = 'achievement-content';

        const name = document.createElement('h4');
        name.className = 'achievement-name';
        name.textContent = achievement.earned ? achievement.name : '???';
        content.appendChild(name);

        const description = document.createElement('div');
        description.className = 'achievement-description';
        description.textContent = secret ? 'Keep exploring BITLab to discover this achievement.' : achievement.description;
        content.appendChild(description);

        if (!achievement.hidden && !achievement.earned && achievement.measure?.target != null) {
            const measure = achievement.measure;
            const progress = document.createElement('progress'); progress.max = measure.target || 1;
            progress.value = measure.current; progress.setAttribute('aria-label', `Achievement progress: ${measure.current} of ${measure.target}`);
            const hint = document.createElement('p'); hint.className = 'collection-hint';
            hint.textContent = `${measure.current}/${measure.target} · ${measure.label}`;
            content.append(progress, hint);
        }

        const footer = document.createElement('div');
        footer.className = 'achievement-footer';

        const points = document.createElement('span');
        points.className = 'achievement-points';
        points.textContent = secret ? 'Secret' : `${achievement.points} pts`;
        const status = document.createElement('span'); status.className = 'collection-status'; status.textContent = achievement.earned ? '✓ Earned' : '🔒 Locked';
        name.append(status);
        footer.appendChild(points);

        if (achievement.earned && achievement.earned_at) {
            const earnedDate = new Date(achievement.earned_at);
            const dateSpan = document.createElement('span');
            dateSpan.className = 'achievement-date';
            // Format date as MM/DD/YYYY -> DD/MM/YYYY
            dateSpan.textContent = earnedDate.toLocaleDateString('en-GB');
            dateSpan.textContent = `Earned ${dateSpan.textContent}`;
            footer.appendChild(dateSpan);
        }

        const rewards = getAchievementRewards(achievement, this.avatarState?.catalog, { includeLocked: true });
        if (rewards.length) {
            const section = document.createElement('section'); section.className = 'achievement-rewards';
            card.classList.add('has-rewards');
            const heading = document.createElement('h4'); heading.textContent = achievement.earned ? 'Unlocked' : 'Unlocks'; section.append(heading);
            const list = document.createElement('div'); list.className = 'achievement-reward-list';
            for (const item of rewards) {
                const button = document.createElement('button'); button.type = 'button'; button.className = 'achievement-reward-button';
                button.setAttribute('aria-label', `Preview ${item.name}`); button.title = `Preview ${item.name}`;
                const art = document.createElement('span'); art.className = 'achievement-reward-art'; art.setAttribute('aria-hidden', 'true');
                void paintRewardThumbnail(art, { ...this.avatarState.selection, [item.slot]: item.id }, item);
                const label = document.createElement('span'); label.textContent = item.name;
                button.append(art, label);
                button.addEventListener('click', () => void previewAvatarReward(this.avatarState.selection, item, button));
                list.append(button);
            }
            section.append(list); content.append(section);
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
            btn.setAttribute('aria-pressed', String(btn.dataset.filter === filter));
        });

        this.displayAchievements();
    }
}

// Initialize the page when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new AchievementsPage());
} else {
    new AchievementsPage();
}
