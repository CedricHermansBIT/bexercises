// frontend/js/pages/admin/notificationsPage.js
import ApiService from '../../services/apiService.js';
import AuthComponent from '../../components/authComponent.js';
import NotificationBanner from '../../components/notificationBanner.js';
import { navigateTo } from '../../utils/navigationUtils.js';
import { setupAdminCommon, formatDateTime, escapeHtml } from './adminUtils.js';
import { setFavicon } from '../../utils/faviconUtils.js';

class NotificationsPage {
    constructor() {
        this.apiService = new ApiService();
        this.authComponent = new AuthComponent(this.apiService);
        this.notificationBanner = new NotificationBanner();

        window.authComponent = this.authComponent;

        this.notifications = [];
        this.currentNotification = null;

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

        // Load notifications
        await this.loadNotifications();

        // Setup event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        const newBtn = document.getElementById('new-notification-btn');
        if (newBtn) {
            newBtn.addEventListener('click', () => this.createNewNotification());
        }

        const refreshBtn = document.getElementById('refresh-notifications-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadNotifications());
        }

        const saveBtn = document.getElementById('save-notification-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveNotification());
        }

        const cancelBtn = document.getElementById('cancel-notification-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelNotificationEditor());
        }
    }

    async loadNotifications() {
        try {
            this.notifications = await this.apiService.getAllNotifications();
            this.renderNotificationsList();
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    }

    renderNotificationsList() {
        const list = document.getElementById('notifications-list');
        if (!list) return;

        list.innerHTML = '';

        if (this.notifications.length === 0) {
            list.innerHTML = '<p class="no-files">No notifications</p>';
            return;
        }

        const notificationsList = document.createElement('div');
        notificationsList.className = 'notification-list';

        this.notifications.forEach(notification => {
            const item = document.createElement('div');
            item.className = `notification-item ${notification.is_active ? '' : 'inactive'}`;

            const typeClass = `type-${notification.type}`;
            const statusText = notification.is_active ? 'Active' : 'Inactive';
            const expiresText = notification.expires_at
                ? `Expires: ${formatDateTime(notification.expires_at)}`
                : 'No expiration';

            item.innerHTML = `
                <div class="notification-item-content">
                    <span class="notification-item-type ${typeClass}">${notification.type.toUpperCase()}</span>
                    <h4>${escapeHtml(notification.title)}</h4>
                    <p>${escapeHtml(notification.message)}</p>
                    <small>Created by: ${notification.created_by_name || 'Unknown'} | ${formatDateTime(notification.created_at)}</small>
                    <br><small>${expiresText} | ${statusText}</small>
                </div>
                <div class="notification-item-actions">
                    <button class="icon-btn" title="Edit" data-id="${notification.id}">✏️</button>
                    ${notification.is_active 
                        ? `<button class="icon-btn" title="Deactivate" data-id="${notification.id}" data-action="deactivate">⏸️</button>`
                        : `<button class="icon-btn" title="Activate" data-id="${notification.id}" data-action="activate">▶️</button>`
                    }
                    <button class="icon-btn delete" title="Delete" data-id="${notification.id}" data-action="delete">🗑️</button>
                </div>
            `;

            // Add event listeners
            const editBtn = item.querySelector('.icon-btn[title="Edit"]');
            editBtn.addEventListener('click', () => this.editNotification(notification.id));

            const actionBtn = item.querySelector('.icon-btn[data-action="deactivate"], .icon-btn[data-action="activate"]');
            if (actionBtn) {
                actionBtn.addEventListener('click', () => {
                    const action = actionBtn.getAttribute('data-action');
                    if (action === 'deactivate') {
                        this.deactivateNotification(notification.id);
                    } else {
                        this.activateNotification(notification.id);
                    }
                });
            }

            const deleteBtn = item.querySelector('.icon-btn[data-action="delete"]');
            deleteBtn.addEventListener('click', () => this.deleteNotification(notification.id));

            notificationsList.appendChild(item);
        });

        list.appendChild(notificationsList);
    }

    createNewNotification() {
        this.currentNotification = null;
        document.getElementById('notification-editor-title').textContent = 'New Notification';
        document.getElementById('notification-title').value = '';
        document.getElementById('notification-message').value = '';
        document.getElementById('notification-type').value = 'info';
        document.getElementById('notification-expires').value = '';

        document.getElementById('admin-welcome').style.display = 'none';
        document.getElementById('notification-editor').style.display = 'block';
    }

    async editNotification(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (!notification) return;

        this.currentNotification = notification;
        document.getElementById('notification-editor-title').textContent = 'Edit Notification';
        document.getElementById('notification-title').value = notification.title;
        document.getElementById('notification-message').value = notification.message;
        document.getElementById('notification-type').value = notification.type;

        if (notification.expires_at) {
            const date = new Date(notification.expires_at);
            const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16);
            document.getElementById('notification-expires').value = localDateTime;
        } else {
            document.getElementById('notification-expires').value = '';
        }

        document.getElementById('admin-welcome').style.display = 'none';
        document.getElementById('notification-editor').style.display = 'block';
    }

    async saveNotification() {
        const title = document.getElementById('notification-title').value.trim();
        const message = document.getElementById('notification-message').value.trim();
        const type = document.getElementById('notification-type').value;
        const expiresInput = document.getElementById('notification-expires').value;

        if (!title || !message) {
            alert('Title and message are required');
            return;
        }

        const expires_at = expiresInput ? new Date(expiresInput).toISOString() : null;

        try {
            if (this.currentNotification) {
                await this.apiService.updateNotification(this.currentNotification.id, {
                    title,
                    message,
                    type,
                    expires_at
                });
            } else {
                await this.apiService.createNotification({
                    title,
                    message,
                    type,
                    expires_at
                });
            }

            await this.loadNotifications();
            this.cancelNotificationEditor();
        } catch (error) {
            alert('Failed to save notification: ' + error.message);
        }
    }

    async deleteNotification(id) {
        if (!confirm('Are you sure you want to delete this notification?')) {
            return;
        }

        try {
            await this.apiService.deleteNotification(id);
            await this.loadNotifications();
        } catch (error) {
            alert('Failed to delete notification: ' + error.message);
        }
    }

    async deactivateNotification(id) {
        try {
            await this.apiService.deactivateNotification(id);
            await this.loadNotifications();
        } catch (error) {
            alert('Failed to deactivate notification: ' + error.message);
        }
    }

    async activateNotification(id) {
        try {
            await this.apiService.updateNotification(id, { is_active: true });
            await this.loadNotifications();
        } catch (error) {
            alert('Failed to activate notification: ' + error.message);
        }
    }

    cancelNotificationEditor() {
        document.getElementById('notification-editor').style.display = 'none';
        document.getElementById('admin-welcome').style.display = 'flex';
        this.currentNotification = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new NotificationsPage();
});

