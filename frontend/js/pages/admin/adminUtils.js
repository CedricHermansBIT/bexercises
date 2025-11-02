// frontend/js/pages/admin/adminUtils.js
// Shared utilities for all admin pages

import themeManager from '../../utils/themeUtils.js';
import { initializeResizableSidebars } from '../../utils/resizeUtils.js';

/**
 * Setup common admin page functionality
 */
export function setupAdminCommon(authComponent) {
    updateTime();
    setInterval(() => updateTime(), 1000);

    setupLogout(authComponent);
    setupThemeToggle();
    setupUserMenu();
    setupBackButton();
    initializeResizableSidebars();
}

/**
 * Update time display
 */
export function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const timeEl = document.getElementById('system-time');
    if (timeEl) {
        timeEl.textContent = timeString;
    }
}

/**
 * Setup logout button
 */
export function setupLogout(authComponent) {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            authComponent.logout();
        });
    }
}

/**
 * Setup theme toggle
 */
export function setupThemeToggle() {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (!themeToggleBtn) return;

    const updateThemeButton = () => {
        const currentTheme = themeManager.getTheme();
        const themeIcon = themeToggleBtn.querySelector('.theme-icon');

        if (currentTheme === 'dark') {
            themeIcon.textContent = '☀️';
        } else {
            themeIcon.textContent = '🌙';
        }
    };

    updateThemeButton();

    themeToggleBtn.addEventListener('click', () => {
        themeManager.toggle();
        updateThemeButton();
    });
}

/**
 * Setup user menu dropdown
 */
export function setupUserMenu() {
    const userMenu = document.getElementById('user-menu-admin');
    if (userMenu) {
        userMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenu.classList.toggle('active');
        });
    }

    document.addEventListener('click', () => {
        const userMenu = document.getElementById('user-menu-admin');
        if (userMenu) {
            userMenu.classList.remove('active');
        }
    });
}

/**
 * Setup back to dashboard button
 */
export function setupBackButton() {
    const backBtn = document.getElementById('back-to-dashboard');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
}

/**
 * Format date/time handling UTC properly
 */
export function formatDateTime(dateString, includeTime = false) {
    if (!dateString) return 'N/A';

    let date;

    if (typeof dateString === 'string') {
        const hasTimezone = dateString.includes('Z') || dateString.includes('+') || dateString.match(/-\d{2}:\d{2}$/);

        if (!hasTimezone) {
            const isoString = dateString.replace(' ', 'T') + 'Z';
            date = new Date(isoString);
        } else {
            date = new Date(dateString);
        }
    } else {
        date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }

    if (includeTime) {
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } else {
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

/**
 * Format time only
 */
export function formatTimeOnly(dateString) {
    if (!dateString) return '';

    let date;

    if (typeof dateString === 'string') {
        const hasTimezone = dateString.includes('Z') || dateString.includes('+') || dateString.match(/-\d{2}:\d{2}$/);

        if (!hasTimezone) {
            const isoString = dateString.replace(' ', 'T') + 'Z';
            date = new Date(isoString);
        } else {
            date = new Date(dateString);
        }
    } else {
        date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format file size
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

