// frontend/js/utils/themeUtils.js

/**
 * Theme utility for managing light/dark mode
 */
class ThemeManager {
    constructor() {
        this.STORAGE_KEY = 'bitlab-theme';
        this.LIGHT_MODE_CLASS = 'light-mode';
    }

    /**
     * Initialize theme from localStorage or system preference
     */
    init() {
        const savedTheme = localStorage.getItem(this.STORAGE_KEY);

        if (savedTheme) {
            // Use saved preference
            this.setTheme(savedTheme);
        } else {
            // Check system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.setTheme(prefersDark ? 'dark' : 'light');
        }

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(this.STORAGE_KEY)) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    /**
     * Get current theme
     * @returns {string} 'light' or 'dark'
     */
    getTheme() {
        return document.body.classList.contains(this.LIGHT_MODE_CLASS) ? 'light' : 'dark';
    }

    /**
     * Set theme
     * @param {string} theme - 'light' or 'dark'
     */
    setTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add(this.LIGHT_MODE_CLASS);
        } else {
            document.body.classList.remove(this.LIGHT_MODE_CLASS);
        }

        // Save preference
        localStorage.setItem(this.STORAGE_KEY, theme);

        // Dispatch event for components that need to react to theme changes
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    }

    /**
     * Toggle between light and dark mode
     */
    toggle() {
        const currentTheme = this.getTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
        return newTheme;
    }
}

// Create singleton instance
const themeManager = new ThemeManager();

// Auto-initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => themeManager.init());
} else {
    themeManager.init();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = themeManager;
}

