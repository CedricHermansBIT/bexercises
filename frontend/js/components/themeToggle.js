// frontend/js/components/themeToggle.js

/**
 * Initialize theme toggle button functionality
 * Call this function after the DOM is loaded
 */
function initThemeToggle() {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');

    if (!themeToggleBtn) {
        console.warn('Theme toggle button not found');
        return;
    }

    // Update button text based on current theme
    function updateThemeButton() {
        const currentTheme = themeManager.getTheme();
        const themeIcon = themeToggleBtn.querySelector('.theme-icon');
        const themeText = themeToggleBtn.querySelector('.theme-text');

        if (currentTheme === 'dark') {
            themeIcon.textContent = '☀️';
            themeText.textContent = 'Light Mode';
        } else {
            themeIcon.textContent = '🌙';
            themeText.textContent = 'Dark Mode';
        }
    }

    // Initialize button state
    updateThemeButton();

    // Handle toggle click
    themeToggleBtn.addEventListener('click', () => {
        themeManager.toggle();
        updateThemeButton();
    });

    // Listen for theme changes (from other tabs/windows)
    window.addEventListener('storage', (e) => {
        if (e.key === 'bitlab-theme') {
            updateThemeButton();
        }
    });

    // Listen for theme changes from themeManager
    window.addEventListener('themechange', () => {
        updateThemeButton();
    });
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initThemeToggle };
}

