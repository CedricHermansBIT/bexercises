import ApiService from '../services/apiService.js';
import AuthComponent from '../components/authComponent.js';
import { navigateTo } from '../utils/navigationUtils.js';
import themeManager from '../utils/themeUtils.js';
import { setFavicon } from '../utils/faviconUtils.js';

class LoginPage {
    constructor() {
        this.apiService = new ApiService();
        this.authComponent = new AuthComponent(this.apiService);

        window.authComponent = this.authComponent;

        this.init();
    }

    async init() {
        // Set favicon
        setFavicon();

        const isAuthenticated = await this.authComponent.checkAuth();

        if (isAuthenticated) {
            navigateTo('languages.html');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new LoginPage();
});

