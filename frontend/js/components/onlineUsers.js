    // frontend/js/components/onlineUsers.js
import ApiService from '../services/apiService.js';

class OnlineUsers {
    constructor() {
        this.apiService = new ApiService();
        this.container = null;
        this.updateInterval = null;
        this.isNavbarMode = false;
    }

    /**
     * Initialize the online users display
     * @param {string} containerId - ID of container element
     * @param {boolean} navbarMode - Whether to render in navbar dropdown mode
     */
    async init(containerId = 'online-users-widget', navbarMode = false) {
        this.container = document.getElementById(containerId);
        this.isNavbarMode = navbarMode;

        if (!this.container) {
            console.warn('Online users container not found');
            return;
        }

        // Load initially
        await this.update();

        // Update every 30 seconds
        this.updateInterval = setInterval(() => this.update(), 30000);
    }

    /**
     * Update the online users display
     */
    async update() {
        try {
            const data = await this.apiService.getOnlineUsers();
            this.render(data);
        } catch (error) {
            console.error('Failed to load online users:', error);
        }
    }

    /**
     * Render the online users widget
     * @param {Object} data - Online users data with count and users array
     */
    render(data) {
        if (!this.container) return;

        const { count, users } = data;

        if (this.isNavbarMode) {
            this.renderNavbar(count, users);
        } else {
            this.renderWidget(count, users);
        }
    }

    /**
     * Render navbar dropdown format
     */
    renderNavbar(count, users) {
        // Update the navbar button indicator
        const btn = document.getElementById('online-users-btn');
        const indicator = document.querySelector('.online-indicator-navbar');
        const countSpan = document.querySelector('.online-count-navbar');
        const countNoAdmin = users.filter(u => !u.isAdmin).length;
        if (countSpan) {
            countSpan.textContent = countNoAdmin;
        }

        if (indicator) {
            indicator.className = 'online-indicator-navbar';
            if (count > 0) {
                // Check if anyone is active (<15 min)
                const now = new Date();
                const hasActiveUsers = users.some(u => {
                    // CORRECTED: Ensure UTC parsing by adding 'Z'
                    const lastActivity = new Date(u.lastActivity + 'Z');
                    const minutesAgo = Math.floor((now - lastActivity) / 60000);
                    return minutesAgo < 15;
                });

                if (hasActiveUsers) {
                    indicator.classList.add('online-active');
                } else {
                    indicator.classList.add('online-idle');
                }
            } else {
                indicator.classList.add('offline');
            }
        }

        // Render dropdown content
        if (countNoAdmin === 0) {
            this.container.innerHTML = `
            <div class="dropdown-empty">
                <span class="online-indicator offline"></span>
                <span>No one online</span>
            </div>
        `;
            return;
        }

        const now = new Date();
        const usersList = users.map(user => {
            // CORRECTED: Ensure UTC parsing by adding 'Z'
            const lastActivity = new Date(user.lastActivity + 'Z');
            const minutesAgo = Math.floor((now - lastActivity) / 60000);
            // Don't show actual time ago, but < 15 minutes and < 1 hour
            const minutesShown = minutesAgo < 60 ? minutesAgo < 15 ? '<15' : '<60' : '>60';

            let indicatorClass = minutesAgo < 15 ? 'online-active' : 'online-idle';
            if (user.isAdmin) {
                return ``;
            }
            return `
            <div class="dropdown-user" title="Active ${minutesAgo} min ago">
                <span class="online-indicator ${indicatorClass} ${user.isAdmin ? 'admin' : ''}"></span>
                <span class="user-name">${this.escapeHtml(user.displayName)}${user.isAdmin ? ' 👑' : ''}</span>
                <span class="time-ago">${minutesShown}m</span>
            </div>
        `;
        }).join('');

        this.container.innerHTML = usersList;
    }

    /**
     * Render widget format (for full widget display)
     */
    renderWidget(count, users) {
        if (count === 0) {
            this.container.innerHTML = `
                <div class="online-users-empty">
                    <span class="online-indicator offline"></span>
                    <span>No one online</span>
                </div>
            `;
            return;
        }

        const now = new Date();
        const usersList = users.slice(0, 10).map(user => {
            const lastActivity = new Date(user.lastActivity + 'Z');

            // The subtraction now correctly yields the difference in milliseconds
            const diffMilliseconds = now - lastActivity;

            // Convert milliseconds to minutes
            const minutesAgo = Math.floor(diffMilliseconds / 60000);

            let indicatorClass = minutesAgo < 15 ? 'online-active' : 'online-idle';

            return `
                <div class="online-user" title="Active ${minutesAgo} min ago">
                    <span class="online-indicator ${indicatorClass} ${user.isAdmin ? 'admin' : ''}"></span>
                    <span class="user-name">${this.escapeHtml(user.displayName)}${user.isAdmin ? ' 👑' : ''}</span>
                    <span class="time-ago">${minutesAgo}m</span>
                </div>
            `;
        }).join('');

        const moreText = count > 10 ? `<div class="online-more">+ ${count - 10} more</div>` : '';

        // Determine header indicator state
        const hasActiveUsers = users.some(u => {
            const minutesAgo = Math.floor((now - new Date(u.lastActivity)) / 60000);
            return minutesAgo < 15;
        });

        this.container.innerHTML = `
            <div class="online-users-header">
                <span class="online-indicator ${hasActiveUsers ? 'online-active' : 'online-idle'}"></span>
                <span class="online-count">${count} online</span>
            </div>
            <div class="online-users-list">
                ${usersList}
                ${moreText}
            </div>
        `;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Destroy the component and cleanup
     */
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

export default OnlineUsers;

