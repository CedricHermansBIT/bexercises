// frontend/js/pages/admin/indexPage.js
import ApiService from '../../services/apiService.js';
import AuthComponent from '../../components/authComponent.js';
import NotificationBanner from '../../components/notificationBanner.js';
import Navbar from '../../components/navbar.js';
import { navigateTo } from '../../utils/navigationUtils.js';
import { setFavicon } from '../../utils/faviconUtils.js';

class AdminIndexPage {
    constructor() {
        this.apiService = new ApiService();
        this.authComponent = new AuthComponent(this.apiService);
        this.notificationBanner = new NotificationBanner();
        this.navbar = new Navbar();

        window.authComponent = this.authComponent;

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

        // Render navbar
        const navbarContainer = document.getElementById('navbar-container');
        if (navbarContainer) {
            navbarContainer.innerHTML = this.navbar.render({
                showBack: true,
                backText: 'back',
                backUrl: 'languages.html',
                workspaceIndicator: '[admin]',
                appTitle: 'Dashboard',
                isAdminPage: true
            });
        }

        // Initialize navbar and notification banner in parallel
        await Promise.all([
            this.navbar.init(this.authComponent),
            this.notificationBanner.init()
        ]);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AdminIndexPage();
});

