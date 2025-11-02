// frontend/js/pages/admin/usersPage.js
import ApiService from '../../services/apiService.js';
import AuthComponent from '../../components/authComponent.js';
import NotificationBanner from '../../components/notificationBanner.js';
import { navigateTo } from '../../utils/navigationUtils.js';
import { setupAdminCommon, formatDateTime, formatTimeOnly, escapeHtml } from './adminUtils.js';

class UsersPage {
    constructor() {
        this.apiService = new ApiService();
        this.authComponent = new AuthComponent(this.apiService);
        this.notificationBanner = new NotificationBanner();

        window.authComponent = this.authComponent;

        this.users = [];
        this.currentUser = null;

        this.init();
    }

    async init() {
        // Check authentication
        const isAuthenticated = await this.authComponent.checkAuth();
        if (!isAuthenticated) {
            navigateTo('../../login.html');
            return;
        }

        // Check admin privileges
        if (!this.authComponent.isAdmin()) {
            alert('Access denied. Admin privileges required.');
            navigateTo('../../languages.html');
            return;
        }

        // Initialize notification banner
        await this.notificationBanner.init();

        // Setup common admin functionality
        setupAdminCommon(this.authComponent);

        // Load users
        await this.loadUsers();

        // Setup event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        const refreshBtn = document.getElementById('refresh-users-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.loadUsers();
                // If a user detail view is currently open, refresh it
                if (this.currentUser && this.currentUser.user && this.currentUser.user.id) {
                    await this.viewUserDetails(this.currentUser.user.id);
                }
            });
        }
    }

    async loadUsers() {
        try {
            this.users = await this.apiService.getUsers();
            this.renderUsersList();
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    }

    renderUsersList() {
        const list = document.getElementById('users-list');
        if (!list) return;

        list.innerHTML = '';

        if (this.users.length === 0) {
            list.innerHTML = '<p class="no-users">No users found</p>';
            return;
        }

        this.users.forEach(user => {
            const item = document.createElement('div');
            item.className = 'user-item';
            item.dataset.userId = user.id;
            item.style.cursor = 'pointer';

            const adminBadge = user.is_admin ? '<span class="admin-badge">👑 Admin</span>' : '';
            const lastLogin = formatDateTime(user.last_login) || 'Never';
            const lastActivity = formatDateTime(user.last_activity) || 'No activity';

            item.innerHTML = `
                <div class="user-info">
                    <div class="user-name">
                        ${user.display_name || 'Unknown'} ${adminBadge}
                    </div>
                    <div class="user-email">${user.email || ''}</div>
                    <div class="user-stats">
                        <span class="stat-badge" title="Exercises where user submitted at least one attempt">📚 ${user.exercises_attempted || 0} exercises tried</span>
                        <span class="stat-badge" title="Exercises successfully completed">✅ ${user.exercises_completed || 0} completed</span>
                        <span class="stat-badge" title="Total test runs across all exercises">🔄 ${user.total_test_runs || 0} test runs</span>
                        <span class="stat-badge" title="Achievements unlocked">🏆 ${user.achievements_unlocked || 0} achievements</span>
                        <span class="stat-badge">Last activity: ${lastActivity}</span>
                    </div>
                </div>
            `;

            // Make entire item clickable
            item.addEventListener('click', () => {
                this.viewUserDetails(user.id);
            });

            list.appendChild(item);
        });
    }

    async viewUserDetails(userId) {
        try {
            const data = await this.apiService.getUserDetails(userId);
            this.currentUser = data;

            // Show user details panel
            document.getElementById('admin-welcome').style.display = 'none';
            document.getElementById('user-details').style.display = 'block';

            // Update title
            const isAdmin = data.user.is_admin === 1;
            document.getElementById('user-details-title').textContent =
                `${data.user.display_name}'s Progress`;

            // Render user info
            this.renderUserInfo(data);

            // Render statistics
            this.renderUserStats(data);

            // Render progress
            this.renderUserProgress(data);

        } catch (error) {
            console.error('Error loading user details:', error);
            alert('Failed to load user details');
        }
    }

    renderUserInfo(data) {
        const container = document.getElementById('user-info-content');
        if (!container) return;

        container.innerHTML = `
            <div class="info-grid">
                <div class="info-item">
                    <label>Name</label>
                    <span>${escapeHtml(data.user.display_name)}</span>
                </div>
                <div class="info-item">
                    <label>Email</label>
                    <span>${escapeHtml(data.user.email)}</span>
                </div>
                <div class="info-item">
                    <label>Role</label>
                    <span>${data.user.is_admin ? '👑 Admin' : 'User'}</span>
                </div>
                <div class="info-item">
                    <label>Member Since</label>
                    <span>${formatDateTime(data.user.created_at)}</span>
                </div>
                <div class="info-item">
                    <label>Last Login</label>
                    <span>${formatDateTime(data.user.last_login, true)}</span>
                </div>
            </div>
        `;
    }

    renderUserStats(data) {
        const container = document.getElementById('user-stats-content');
        if (!container) return;

        const totalAttempts = data.statistics.total_test_runs || 0;
        const successfulAttempts = data.statistics.total_successful_runs || 0;
        const successRate = totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 0;
        const completionRate = data.statistics.exercises_attempted > 0
            ? Math.round((data.statistics.exercises_completed / data.statistics.exercises_attempted) * 100)
            : 0;

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${data.statistics.exercises_attempted || 0}</div>
                    <div class="stat-label">Exercises Tried</div>
                    <div class="stat-sublabel">Submitted at least once</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.statistics.exercises_completed || 0}</div>
                    <div class="stat-label">Exercises Completed</div>
                    <div class="stat-sublabel">${completionRate}% completion rate</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.statistics.total_test_runs || 0}</div>
                    <div class="stat-label">Total Test Runs</div>
                    <div class="stat-sublabel">${successfulAttempts} passed, ${data.statistics.total_failed_runs || 0} failed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Math.round(data.statistics.avg_attempts_per_exercise || 0)}</div>
                    <div class="stat-label">Avg Tests per Exercise</div>
                    <div class="stat-sublabel">${successRate}% test success rate</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.statistics.total_achievements || 0}</div>
                    <div class="stat-label">Achievements Unlocked</div>
                    <div class="stat-sublabel">${data.statistics.total_points || 0} points</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.statistics.last_activity ? formatDateTime(data.statistics.last_activity) : 'N/A'}</div>
                    <div class="stat-value-sub">${data.statistics.last_activity ? formatTimeOnly(data.statistics.last_activity) : ''}</div>
                    <div class="stat-label">Last Activity</div>
                    <div class="stat-sublabel">Most recent submission</div>
                </div>
            </div>
        `;
    }

    renderUserProgress(data) {
        const container = document.getElementById('user-progress-content');
        if (!container) return;

        if (!data.progress || data.progress.length === 0) {
            container.innerHTML = '<p class="no-progress">No exercise progress yet</p>';
            return;
        }

        container.innerHTML = `
            <div class="progress-list">
                ${data.progress.map(p => {
                    const statusIcon = p.completed ? '✅' : '🔄';
                    const statusClass = p.completed ? 'completed' : 'incomplete';
                    
                    return `
                        <div class="progress-item ${statusClass}">
                            <div class="progress-header">
                                <span class="status-icon">${statusIcon}</span>
                                <span class="exercise-title">${escapeHtml(p.exercise_title)}</span>
                                <span class="attempts-badge">${p.attempts} attempt${p.attempts !== 1 ? 's' : ''}</span>
                            </div>
                            <div class="progress-details">
                                <span class="chapter-tag">📁 ${escapeHtml(p.chapter || 'Unknown')}</span>
                                <span class="date-info" title="First attempt">Started: ${formatDateTime(p.started_at)}</span>
                                ${p.completed_at ? `<span class="date-info" title="Successfully completed">Completed: ${formatDateTime(p.completed_at)}</span>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new UsersPage();
});

