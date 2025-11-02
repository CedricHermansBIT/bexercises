// frontend/js/pages/admin/indexPage.js
import ApiService from '../../services/apiService.js';
import AuthComponent from '../../components/authComponent.js';
import NotificationBanner from '../../components/notificationBanner.js';
import { navigateTo } from '../../utils/navigationUtils.js';
import { setupAdminCommon } from './adminUtils.js';

class AdminIndexPage {
    constructor() {
        this.apiService = new ApiService();
        this.authComponent = new AuthComponent(this.apiService);
        this.notificationBanner = new NotificationBanner();

        window.authComponent = this.authComponent;

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

        // Setup additional event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        const backBtn = document.getElementById('back-to-languages');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                navigateTo('languages.html');
            });
        }

        const achievementsBtn = document.getElementById('achievements-btn');
        if (achievementsBtn) {
            achievementsBtn.addEventListener('click', () => {
                navigateTo('achievements.html');
            });
        }

        const leaderboardBtn = document.getElementById('leaderboard-btn');
        if (leaderboardBtn) {
            leaderboardBtn.addEventListener('click', () => {
                navigateTo('leaderboard.html');
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AdminIndexPage();
});

