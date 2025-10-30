// frontend/js/utils/basePathUtils.js
/**
 * Base Path Utilities
 * Dynamically detect and set the base path for the application
 */

/**
 * Detect base path from current URL
 * @returns {string} Base path (e.g., '/bitlab' or '')
 */
export function detectBasePath() {
	const path = window.location.pathname;

	// Extract base path from URL patterns like:
	// /bitlab/pages/login.html -> /bitlab
	// /bitlab/ -> /bitlab
	// /pages/login.html -> ''
	// / -> ''

	const match = path.match(/^(\/[^\/]+)(?:\/|$)/);
	if (match && match[1] && !match[1].match(/\.(html|css|js)$/)) {
		// Only return if it's not a file extension and not 'pages'
		if (match[1] !== '/pages' && match[1] !== '/js' && match[1] !== '/styles.css') {
			return match[1];
		}
	}

	return '';
}

/**
 * Set the base tag dynamically based on detected path
 */
export function setBasePath() {
	const basePath = detectBasePath();

	// Remove any existing base tag
	const existingBase = document.querySelector('base');
	if (existingBase) {
		existingBase.remove();
	}

	// Add new base tag if basePath exists
	if (basePath) {
		const base = document.createElement('base');
		base.href = basePath + '/';
		document.head.insertBefore(base, document.head.firstChild);
	}

	return basePath;
}

/**
 * Get the current base path
 * @returns {string} Base path
 */
export function getBasePath() {
	const base = document.querySelector('base');
	if (base) {
		const href = base.getAttribute('href');
		// Remove trailing slash
		return href.replace(/\/$/, '');
	}
	return detectBasePath();
}

