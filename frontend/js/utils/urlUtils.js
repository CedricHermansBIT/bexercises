// frontend/js/utils/urlUtils.js
/**
 * URL utilities for managing exercise navigation
 */

/**
 * Update URL with exercise ID
 * @param {string} exerciseId - Exercise ID
 */
export function updateUrl(exerciseId) {
	const url = new URL(window.location);
	url.searchParams.set('exercise', exerciseId);
	window.history.pushState({}, '', url);
}

/**
 * Get exercise ID from URL
 * @returns {string|null} Exercise ID or null
 */
export function getExerciseIdFromUrl() {
	const urlParams = new URLSearchParams(window.location.search);
	return urlParams.get('exercise');
}

