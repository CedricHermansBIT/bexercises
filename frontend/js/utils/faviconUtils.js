// frontend/js/utils/faviconUtils.js

/**
 * Set the favicon path dynamically based on the base path
 * This ensures the favicon works correctly whether deployed at root or in a subdirectory
 */
function setFavicon() {
    // Detect base path from current URL
    const path = window.location.pathname;
    let basePath = '';

    // Extract base path (e.g., '/bitlab' from '/bitlab/pages/login.html')
    const match = path.match(/^(\/[^\/]+)?\/(pages|index\.html)/);
    if (match && match[1]) {
        basePath = match[1];
    }

    // If at root level (e.g., /index.html), check parent directory
    if (!basePath && path.includes('/pages/')) {
        const pathParts = path.split('/pages/')[0];
        if (pathParts && pathParts !== '') {
            basePath = pathParts;
        }
    }

    // Create or update favicon link
    let faviconLink = document.querySelector('link[rel="icon"]');
    if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        document.head.appendChild(faviconLink);
    }

    // Set the correct path
    const faviconPath = basePath ? `${basePath}/favicon.ico` : '/favicon.ico';
    faviconLink.href = faviconPath;

    // Also set shortcut icon for better browser support
    let shortcutIcon = document.querySelector('link[rel="shortcut icon"]');
    if (!shortcutIcon) {
        shortcutIcon = document.createElement('link');
        shortcutIcon.rel = 'shortcut icon';
        document.head.appendChild(shortcutIcon);
    }
    shortcutIcon.href = faviconPath;
}

// Run on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setFavicon);
} else {
    setFavicon();
}

// Export for ES6 modules
export { setFavicon };

