// frontend/js/utils/themeUtils.js

/**
 * Theme utility for managing the available colour themes.
 */
class ThemeManager {
    constructor() {
        this.STORAGE_KEY = 'bitlab-theme';
        this.LIGHT_MODE_CLASS = 'light-mode';
        this.HIGH_CONTRAST_MODE_CLASS = 'high-contrast-mode';
        this.THEMES = ['dark', 'light', 'high-contrast', 'pink', 'dracula', 'paper', 'nord', 'solarized'];
        this.THEME_DETAILS = {
            dark: { label: 'Dark', icon: '🌙' },
            light: { label: 'Light', icon: '☀️' },
            'high-contrast': { label: 'High contrast', icon: '◐' },
            pink: { label: 'Pink', icon: '🌸' },
            dracula: { label: 'Dracula', icon: '🧛' },
            paper: { label: 'Paper', icon: '📜' },
            nord: { label: 'Nord', icon: '❄️' },
            solarized: { label: 'Solarized', icon: '🌤️' }
        };
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
     * @returns {string} Current theme identifier
     */
    getTheme() {
        const selectedTheme = document.body.dataset.theme;
        if (this.THEMES.includes(selectedTheme)) return selectedTheme;
        if (document.body.classList.contains(this.HIGH_CONTRAST_MODE_CLASS)) return 'high-contrast';
        return document.body.classList.contains(this.LIGHT_MODE_CLASS) ? 'light' : 'dark';
    }

    /**
     * Set theme
     * @param {string} theme - A supported theme identifier
     */
    setTheme(theme) {
        const selectedTheme = this.THEMES.includes(theme) ? theme : 'dark';
        document.body.classList.toggle(this.LIGHT_MODE_CLASS, selectedTheme === 'light');
        document.body.classList.toggle(this.HIGH_CONTRAST_MODE_CLASS, selectedTheme === 'high-contrast');
        document.body.dataset.theme = selectedTheme;

        // Save preference
        localStorage.setItem(this.STORAGE_KEY, selectedTheme);

        // Dispatch event for components that need to react to theme changes
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: selectedTheme } }));
        queueMicrotask(() => this.refreshThemeControls());
    }

    getNextTheme() {
        const currentIndex = this.THEMES.indexOf(this.getTheme());
        return this.THEMES[(currentIndex + 1) % this.THEMES.length];
    }

    isLightTheme(theme = this.getTheme()) {
        return ['light', 'paper', 'pink', 'nord'].includes(theme);
    }

    refreshThemeControls() {
        const currentTheme = this.getTheme();
        const details = this.THEME_DETAILS[currentTheme];
        document.querySelectorAll('#theme-toggle-btn').forEach((button) => {
            const icon = button.querySelector('.theme-icon');
            const text = button.querySelector('.theme-text');
            if (icon) icon.textContent = details.icon;
            if (text) text.textContent = `Theme: ${details.label}`;
            button.title = `Current theme: ${details.label}. Click to change it.`;

            let selector = button.parentElement.querySelector('.theme-select');
            if (!selector) {
                selector = document.createElement('select');
                selector.className = 'theme-select';
                selector.setAttribute('aria-label', 'Choose colour theme');
                this.THEMES.forEach((theme) => {
                    const option = document.createElement('option');
                    option.value = theme;
                    option.textContent = `${this.THEME_DETAILS[theme].icon} ${this.THEME_DETAILS[theme].label}`;
                    selector.appendChild(option);
                });
                selector.addEventListener('click', (event) => event.stopPropagation());
                selector.addEventListener('change', (event) => this.setTheme(event.target.value));
                button.insertAdjacentElement('afterend', selector);
            }
            selector.value = currentTheme;
        });
    }

    /**
     * Cycle through available themes
     */
    toggle() {
        const newTheme = this.getNextTheme();
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

// Export as ES6 module
export default themeManager;

