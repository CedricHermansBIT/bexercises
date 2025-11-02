// frontend/js/components/notificationBanner.js
import ApiService from '../services/apiService.js';

class NotificationBanner {
    constructor() {
        this.apiService = new ApiService();
        this.notifications = [];
        this.container = null;
        this.dismissedNotifications = this.loadDismissedNotifications();
    }

    async init() {
        this.createContainer();
        await this.loadNotifications();

        // Refresh notifications every 5 minutes
        setInterval(() => this.loadNotifications(), 5 * 60 * 1000);
    }

    createContainer() {
        // Check if container already exists
        if (document.getElementById('notification-banner-container')) {
            this.container = document.getElementById('notification-banner-container');
            return;
        }

        this.container = document.createElement('div');
        this.container.id = 'notification-banner-container';
        this.container.className = 'notification-banner-container';

        // Insert at the beginning of body
        document.body.insertBefore(this.container, document.body.firstChild);
    }

    loadDismissedNotifications() {
        try {
            const dismissed = localStorage.getItem('dismissedNotifications');
            return dismissed ? JSON.parse(dismissed) : {};
        } catch (error) {
            console.error('Failed to load dismissed notifications:', error);
            return {};
        }
    }

    saveDismissedNotifications() {
        try {
            localStorage.setItem('dismissedNotifications', JSON.stringify(this.dismissedNotifications));
        } catch (error) {
            console.error('Failed to save dismissed notifications:', error);
        }
    }

    dismissNotification(notificationId) {
        this.dismissedNotifications[notificationId] = Date.now();
        this.saveDismissedNotifications();
        this.render();
    }

    async loadNotifications() {
        try {
            this.notifications = await this.apiService.getNotifications();
            this.render();
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    }

    render() {
        if (!this.container) return;

        // Filter out dismissed notifications
        const visibleNotifications = this.notifications.filter(notification => {
            return !this.dismissedNotifications[notification.id];
        });

        if (visibleNotifications.length === 0) {
            this.container.innerHTML = '';
            this.container.style.display = 'none';
            return;
        }

        this.container.style.display = 'block';
        this.container.innerHTML = visibleNotifications.map(notification => `
            <div class="notification-banner notification-${notification.type}" data-notification-id="${notification.id}">
                <div class="notification-content">
                    <div class="notification-icon">
                        ${this.getIcon(notification.type)}
                    </div>
                    <div class="notification-text">
                        <strong class="notification-title">${this.escapeHtml(notification.title)}</strong>
                        <p class="notification-message">${this.escapeHtml(notification.message)}</p>
                        ${notification.expires_at ? `<small class="notification-expires">Expires: ${this.formatDate(notification.expires_at)}</small>` : ''}
                    </div>
                    <button class="notification-close" data-notification-id="${notification.id}" title="Dismiss">×</button>
                </div>
            </div>
        `).join('');

        // Add event listeners to close buttons
        this.container.querySelectorAll('.notification-close').forEach(button => {
            button.addEventListener('click', (e) => {
                const notificationId = parseInt(e.target.getAttribute('data-notification-id'));
                this.dismissNotification(notificationId);
            });
        });
    }

    getIcon(type) {
        const icons = {
            'info': 'ℹ️',
            'warning': '⚠️',
            'success': '✅',
            'error': '❌'
        };
        return icons[type] || icons['info'];
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default NotificationBanner;

