// frontend/js/utils/navigationUtils.js
/**
 * Navigation utilities for handling paths with base path support
 */

/**
 * Detect base path from current URL
 * @returns {string} Base path (e.g., '/bitlab' or '')
 */
function detectBasePath() {
	const path = window.location.pathname;

	// Extract base path from URL patterns like:
	// /bitlab/pages/login.html -> /bitlab
	// /pages/login.html -> ''

	const match = path.match(/^(\/[^\/]+)\/pages\//);
	if (match && match[1]) {
		return match[1];
	}

	return '';
}

/**
 * Navigate to a page within the application
 * @param {string} page - Page path (e.g., 'login.html', 'pages/login.html', './login.html')
 */
export function navigateTo(page) {
	const basePath = detectBasePath();

	// Remove leading './' if present
	page = page.replace(/^\.\//, '');

	// If page doesn't start with 'pages/', add it
	if (!page.startsWith('pages/') && !page.startsWith('/')) {
		page = 'pages/' + page;
	}

	// Construct full path
	const fullPath = basePath ? `${basePath}/${page}` : `/${page}`;

	window.location.href = fullPath;
}

/**
 * Get the base path for the application
 * @returns {string} Base path
 */
export function getBasePath() {
	return detectBasePath();
}

/**
 * Build a URL with base path
 * @param {string} path - Path relative to base (e.g., '/api/exercises')
 * @returns {string} Full path with base
 */
export function buildUrl(path) {
	const basePath = detectBasePath();

	// Remove leading slash if present
	if (path.startsWith('/')) {
		path = path.substring(1);
	}

	return basePath ? `${basePath}/${path}` : `/${path}`;
}

