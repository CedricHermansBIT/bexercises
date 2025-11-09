// frontend/js/pages/admin/languagesPage.js
import ApiService from '../../services/apiService.js';
import AuthComponent from '../../components/authComponent.js';
import NotificationBanner from '../../components/notificationBanner.js';
import { navigateTo } from '../../utils/navigationUtils.js';
import { setupAdminCommon } from './adminUtils.js';
import { setFavicon } from '../../utils/faviconUtils.js';

class LanguagesPage {
    constructor() {
        this.apiService = new ApiService();
        this.authComponent = new AuthComponent(this.apiService);
        this.notificationBanner = new NotificationBanner();

        window.authComponent = this.authComponent;

        this.languages = [];
        this.currentLanguage = null;
        this.isEditMode = false;

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

        // Load data
        await this.loadLanguages();

        // Setup event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // New language button
        document.getElementById('new-language-btn')?.addEventListener('click', () => {
            this.createNewLanguage();
        });

        // Refresh button
        document.getElementById('refresh-languages-btn')?.addEventListener('click', () => {
            this.loadLanguages();
        });

        // Cancel button
        document.getElementById('cancel-language-btn')?.addEventListener('click', () => {
            this.showWelcome();
        });

        // Delete button
        document.getElementById('delete-language-btn')?.addEventListener('click', () => {
            if (this.currentLanguage) {
                this.deleteLanguage(this.currentLanguage.id);
            }
        });

        // Form submission
        document.getElementById('language-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveLanguage();
        });
    }

    async loadLanguages() {
        try {
            this.languages = await this.apiService.getAdminLanguages();
            this.populateLanguagesSidebar();
        } catch (error) {
            console.error('Failed to load languages:', error);
            alert('Failed to load languages: ' + error.message);
        }
    }

    populateLanguagesSidebar() {
        const container = document.getElementById('languages-sidebar-list');
        if (!container) return;

        if (this.languages.length === 0) {
            container.innerHTML = '<p class="no-files">No languages yet. Create one to get started!</p>';
            return;
        }

        container.innerHTML = '';

        const languagesList = document.createElement('div');
        languagesList.className = 'notification-list';

        this.languages.forEach(language => {
            const item = this.createLanguageSidebarItem(language);
            languagesList.appendChild(item);
        });

        container.appendChild(languagesList);
    }

    createLanguageSidebarItem(language) {
        const item = document.createElement('div');
        item.className = `notification-item ${language.enabled ? '' : 'inactive'}`;
        item.dataset.languageId = language.id;

        const statusText = language.enabled ? 'Enabled' : 'Disabled';
        const hasIcon = language.icon_svg && language.icon_svg.trim() !== '';
        const iconDisplay = hasIcon ? language.icon_svg : '💬';

        item.innerHTML = `
            <div class="notification-item-content">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <div class="item-icon">${iconDisplay}</div>
                    <h4 style="margin: 0;">${language.name}</h4>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0.25rem 0;">
                    <code style="background: var(--bg-tertiary); padding: 0.125rem 0.375rem; border-radius: 3px;">${language.id}</code>
                </p>
                <small>Order: ${language.order_num || 0} | ${statusText}</small>
                ${language.description ? `<br><small>${language.description.substring(0, 80)}${language.description.length > 80 ? '...' : ''}</small>` : ''}
            </div>
        `;

        item.addEventListener('click', () => {
            // Remove active class from all items
            document.querySelectorAll('.notification-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            this.editLanguage(language.id);
        });

        return item;
    }

    createNewLanguage() {
        this.isEditMode = false;
        this.currentLanguage = null;

        // Remove active class from sidebar items
        document.querySelectorAll('.notification-item').forEach(i => i.classList.remove('active'));

        // Reset form
        document.getElementById('language-editor-title').textContent = 'New Language';
        document.getElementById('language-id').value = '';
        document.getElementById('language-id').disabled = false;
        document.getElementById('language-name').value = '';
        document.getElementById('language-description').value = '';
        document.getElementById('language-icon').value = '';
        document.getElementById('language-order').value = '0';
        document.getElementById('language-enabled').checked = true;

        // Reset execution config with defaults
        document.getElementById('language-file-extension').value = '.sh';
        document.getElementById('language-interpreter').value = 'bash';
        document.getElementById('language-docker-image').value = 'alpine:latest';
        document.getElementById('language-code-template').value = '#!/bin/bash\n\n# Write your solution here\n';

        // Show/hide buttons
        document.getElementById('delete-language-btn').style.display = 'none';

        // Show editor
        this.showEditor();
    }

    async editLanguage(languageId) {
        const language = this.languages.find(l => l.id === languageId);
        if (!language) return;

        this.isEditMode = true;
        this.currentLanguage = language;

        // Fill form
        document.getElementById('language-editor-title').textContent = `Edit: ${language.name}`;
        document.getElementById('language-id').value = language.id;
        document.getElementById('language-id').disabled = true; // Can't change ID
        document.getElementById('language-name').value = language.name;
        document.getElementById('language-description').value = language.description || '';
        document.getElementById('language-icon').value = language.icon_svg || '';
        document.getElementById('language-order').value = language.order_num || 0;
        document.getElementById('language-enabled').checked = language.enabled;

        // Fill execution config with defaults if not set
        document.getElementById('language-file-extension').value = language.file_extension || '.sh';
        document.getElementById('language-interpreter').value = language.interpreter || 'bash';
        document.getElementById('language-docker-image').value = language.docker_image || 'alpine:latest';
        document.getElementById('language-code-template').value = language.code_template || '#!/bin/bash\n\n# Write your solution here\n';

        // Show delete button for existing languages
        document.getElementById('delete-language-btn').style.display = 'block';

        // Show editor
        this.showEditor();
    }

    async saveLanguage() {
        const id = document.getElementById('language-id').value.trim();
        const name = document.getElementById('language-name').value.trim();
        const description = document.getElementById('language-description').value.trim();
        const icon_svg = document.getElementById('language-icon').value.trim();
        const order_num = parseInt(document.getElementById('language-order').value) || 0;
        const enabled = document.getElementById('language-enabled').checked;

        // Get execution config
        const file_extension = document.getElementById('language-file-extension').value.trim();
        const interpreter = document.getElementById('language-interpreter').value.trim();
        const docker_image = document.getElementById('language-docker-image').value.trim();
        const code_template = document.getElementById('language-code-template').value; // Don't trim - preserve whitespace

        if (!id || !name) {
            alert('Language ID and Name are required');
            return;
        }

        if (!file_extension || !interpreter || !docker_image) {
            alert('File extension, interpreter, and Docker image are required');
            return;
        }

        // Validate ID format
        if (!/^[a-z0-9-]+$/.test(id)) {
            alert('Language ID must contain only lowercase letters, numbers, and hyphens');
            return;
        }

        // Validate file extension format
        if (!/^\.[a-z0-9]+$/.test(file_extension)) {
            alert('File extension must start with a dot and contain only lowercase letters and numbers (e.g., .py, .js)');
            return;
        }

        const languageData = {
            id,
            name,
            description,
            icon_svg,
            order_num,
            enabled,
            file_extension,
            interpreter,
            docker_image,
            code_template
        };

        try {
            if (this.isEditMode) {
                await this.apiService.updateLanguage(this.currentLanguage.id, languageData);
                alert('Language updated successfully!');
            } else {
                await this.apiService.createLanguage(languageData);
                alert('Language created successfully!');
            }

            await this.loadLanguages();
            this.showWelcome();
        } catch (error) {
            console.error('Failed to save language:', error);
            alert('Failed to save language: ' + error.message);
        }
    }

    async deleteLanguage(languageId) {
        const language = this.languages.find(l => l.id === languageId);
        if (!language) return;

        const confirmed = confirm(
            `Are you sure you want to delete "${language.name}"?\n\n` +
            `⚠️ WARNING: This will also delete all chapters and exercises for this language!\n\n` +
            `This action cannot be undone.`
        );

        if (!confirmed) return;

        const doubleConfirm = prompt(
            `Type "${language.id}" to confirm deletion:`
        );

        if (doubleConfirm !== language.id) {
            alert('Deletion cancelled - confirmation did not match');
            return;
        }

        try {
            await this.apiService.deleteLanguage(languageId);
            alert('Language deleted successfully');
            await this.loadLanguages();
            this.showWelcome();
        } catch (error) {
            console.error('Failed to delete language:', error);
            alert('Failed to delete language: ' + error.message);
        }
    }

    showEditor() {
        document.getElementById('admin-welcome').style.display = 'none';
        document.getElementById('language-editor').style.display = 'block';
    }

    showWelcome() {
        document.getElementById('admin-welcome').style.display = 'flex';
        document.getElementById('language-editor').style.display = 'none';

        // Remove active class from sidebar items
        document.querySelectorAll('.notification-item').forEach(i => i.classList.remove('active'));
    }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LanguagesPage();
});

