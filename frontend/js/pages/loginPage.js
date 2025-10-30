import ApiService from '../services/apiService.js';
import AuthComponent from '../components/authComponent.js';

class LoginPage {
    constructor() {
        this.apiService = new ApiService();
        this.authComponent = new AuthComponent(this.apiService);

        window.authComponent = this.authComponent;

        this.init();
    }

    async init() {
        const isAuthenticated = await this.authComponent.checkAuth();

        if (isAuthenticated) {
            window.location.href = './languages.html';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new LoginPage();
});

