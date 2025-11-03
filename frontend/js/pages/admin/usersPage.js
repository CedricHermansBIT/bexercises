// frontend/js/pages/admin/usersPage.js
import ApiService from '../../services/apiService.js';
import AuthComponent from '../../components/authComponent.js';
import NotificationBanner from '../../components/notificationBanner.js';
import { navigateTo } from '../../utils/navigationUtils.js';
import { setupAdminCommon, formatDateTime, formatTimeOnly, escapeHtml } from './adminUtils.js';
import { setFavicon } from '../../utils/faviconUtils.js';

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
            navigateTo('login.html');
            return;
        }

        // Check admin privileges
        if (!this.authComponent.isAdmin()) {
            alert('Access denied. Admin privileges required.');
            navigateTo('languages.html');
            return;
        }

        setFavicon();

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
                // Store the current user ID if viewing details
                const currentUserId = this.currentUser?.user?.id;

                // Reload the users list (this will re-sort by latest activity)
                await this.loadUsers();

                // If a user detail view was open, refresh it
                if (currentUserId) {
                    await this.viewUserDetails(currentUserId);
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

        // Sort users by most recent activity (descending)
        const sortedUsers = [...this.users].sort((a, b) => {
            const aActivity = a.last_activity || a.created_at || '';
            const bActivity = b.last_activity || b.created_at || '';
            return bActivity.localeCompare(aActivity); // Most recent first
        });

        sortedUsers.forEach(user => {
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

        // Render achievements first
        let achievementsHTML = this.renderAchievements(data.achievements);

        if (!data.progress || data.progress.length === 0) {
            container.innerHTML = achievementsHTML + '<p class="no-progress">No exercise progress yet</p>';
            return;
        }

        let progressHTML = '<div class="progress-list" style="margin-top: 2rem;">';

        data.progress.forEach(p => {
            const statusIcon = p.completed ? '✅' : '❌';
            const statusClass = p.completed ? 'completed' : 'incomplete';

            // Format last submission time - use last_submission_at if available, otherwise started_at
            const lastSubmissionTime = p.last_submission_at || p.started_at;
            const lastSubmissionFormatted = formatDateTime(lastSubmissionTime, true);

            progressHTML += `
                <div class="progress-item ${statusClass}">
                    <div class="progress-header">
                        <span class="status-icon">${statusIcon}</span>
                        <span class="exercise-title">${escapeHtml(p.exercise_title)}</span>
                        <span class="attempts-badge" title="Total test runs for this exercise">${p.attempts} test run(s)</span>
                        <span class="attempts-badge" title="Successful vs failed attempts">✓${p.successful_attempts || 0} / ✗${p.failed_attempts || 0}</span>
                    </div>
                    <div class="progress-details">
                        <span class="chapter-tag">${escapeHtml(p.language_name || 'Unknown')} / ${escapeHtml(p.chapter_name || 'Unknown')}</span>
                        <span class="date-info" title="First attempt">Started: ${formatDateTime(p.started_at)}</span>
                        ${p.completed_at ? `<span class="date-info" title="Successfully completed">Completed: ${formatDateTime(p.completed_at)}</span>` : ''}
                        <span class="date-info" title="Most recent submission with time">Last submission: ${lastSubmissionFormatted}</span>
                    </div>
                    ${p.last_submission ? `
                    <div class="submission-preview">
                        <details>
                            <summary class="submission-summary">
                                <span class="summary-icon">📄</span>
                                <span class="summary-text">View latest submission</span>
                                <span class="summary-hint">(${p.last_submission.split('\n').length} lines)</span>
                            </summary>
                            <div class="code-preview-container">
                                <div class="code-preview-header">
                                    <span class="code-language">bash</span>
                                    <span class="code-lines">${p.last_submission.split('\n').length} lines</span>
                                </div>
                                <textarea class="code-editor-preview" data-mode="shell">${escapeHtml(p.last_submission)}</textarea>
                            </div>
                        </details>
                    </div>
                    ` : `
                    <div class="submission-preview">
                        <p class="no-submission">No submission code recorded</p>
                    </div>
                    `}
                </div>
            `;
        });

        progressHTML += '</div>';
        container.innerHTML = achievementsHTML + progressHTML;

        // Initialize CodeMirror for all code previews
        this.initializeCodePreviews();
    }

    renderAchievements(achievements) {
        if (!achievements || achievements.length === 0) {
            return '<div class="achievements-section"><h3>Achievements</h3><p class="no-achievements">No achievements unlocked yet</p></div>';
        }

        let html = '<div class="achievements-section"><h3>🏆 Achievements Unlocked</h3><div class="achievements-grid">';

        achievements.forEach(achievement => {
            const earnedDate = formatDateTime(achievement.earned_at);
            html += `
                <div class="achievement-card">
                    <div class="achievement-icon">${achievement.achievement_icon || '🏆'}</div>
                    <div class="achievement-info">
                        <div class="achievement-name">${escapeHtml(achievement.achievement_name)}</div>
                        <div class="achievement-description">${escapeHtml(achievement.achievement_description)}</div>
                        <div class="achievement-meta">
                            <span class="achievement-points">${achievement.points} points</span>
                            <span class="achievement-date">Unlocked: ${earnedDate}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div></div>';
        return html;
    }

    initializeCodePreviews() {
        // Wait for CodeMirror to be loaded
        const tryInitialize = () => {
            if (typeof CodeMirror === 'undefined' || !window.CodeMirror) {
                console.warn('CodeMirror not loaded yet, retrying...');
                setTimeout(tryInitialize, 100);
                return;
            }

            const textareas = document.querySelectorAll('.code-editor-preview');

            textareas.forEach(textarea => {
                if (textarea.nextSibling && textarea.nextSibling.classList?.contains('CodeMirror')) {
                    // Already initialized
                    return;
                }

                const mode = textarea.dataset.mode || 'shell';

                // Determine theme based on current mode
                const currentTheme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
                const editorTheme = currentTheme === 'dark' ? 'dracula' : 'default';

                try {
                    const editor = CodeMirror.fromTextArea(textarea, {
                        mode: mode,
                        theme: editorTheme,
                        lineNumbers: true,
                        readOnly: true,
                        lineWrapping: true,
                        viewportMargin: Infinity
                    });

                    // Make it compact
                    editor.setSize(null, 'auto');

                    // Listen for theme changes
                    window.addEventListener('themechange', (e) => {
                        const newTheme = e.detail.theme === 'dark' ? 'dracula' : 'default';
                        editor.setOption('theme', newTheme);
                    });
                } catch (error) {
                    console.error('Failed to initialize CodeMirror for textarea:', error);
                }
            });
        };

        // Start trying to initialize after a short delay
        setTimeout(tryInitialize, 200);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new UsersPage();
});

