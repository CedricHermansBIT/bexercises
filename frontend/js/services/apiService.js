// frontend/js/services/apiService.js
/**
 * API Service for interacting with the backend
 */
class ApiService {
	constructor(baseUrl = '') {
		this.baseUrl = baseUrl;
	}

	/**
	 * Fetch all exercises
	 * @returns {Promise<Array>} Array of exercises
	 */
	async getExercises() {
		const response = await fetch(`${this.baseUrl}/api/exercises`);
		if (!response.ok) {
			throw new Error(`Failed to fetch exercises: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Fetch a single exercise by ID
	 * @param {string} exerciseId - Exercise ID
	 * @returns {Promise<Object>} Exercise object
	 */
	async getExercise(exerciseId) {
		const response = await fetch(`${this.baseUrl}/api/exercises/${encodeURIComponent(exerciseId)}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch exercise: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Run tests for an exercise
	 * @param {string} exerciseId - Exercise ID
	 * @param {string} script - User's script code
	 * @returns {Promise<Object>} Test results and statistics
	 */
	async runTests(exerciseId, script) {
		const response = await fetch(`${this.baseUrl}/api/exercises/${encodeURIComponent(exerciseId)}/run`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ script })
		});

		if (!response.ok) {
			const err = await response.json().catch(() => ({ error: 'unknown' }));
			throw new Error(`Server error: ${response.status} ${err.error || ''}`);
		}

		return response.json();
	}

	/**
	 * Get statistics for an exercise
	 * @param {string} exerciseId - Exercise ID
	 * @returns {Promise<Object>} Statistics object
	 */
	async getStatistics(exerciseId) {
		const response = await fetch(`${this.baseUrl}/api/statistics/${encodeURIComponent(exerciseId)}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch statistics: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Get current user info
	 * @returns {Promise<Object>} User object
	 */
	async getCurrentUser() {
		const response = await fetch(`${this.baseUrl}/auth/user`);
		return response.json();
	}

	/**
	 * Get exercise with test cases (admin only)
	 * @param {string} exerciseId - Exercise ID
	 * @returns {Promise<Object>} Complete exercise with tests
	 */
	async getExerciseWithTests(exerciseId) {
		const response = await fetch(`${this.baseUrl}/api/admin/exercises/${encodeURIComponent(exerciseId)}/full`);
		if (!response.ok) {
			throw new Error(`Failed to fetch exercise: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Reorder exercises (admin only)
	 * @param {Array} exercises - Array of exercises with updated order
	 * @returns {Promise<void>}
	 */
	async reorderExercises(exercises) {
		const response = await fetch(`${this.baseUrl}/api/admin/exercises/reorder`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ exercises })
		});

		if (!response.ok) {
			throw new Error(`Failed to reorder exercises: ${response.status}`);
		}
	}

	/**
	 * Test exercise solution (admin only)
	 * @param {string} solution - Solution script
	 * @returns {Promise<Object>} Test output and exit code
	 */
	async testExerciseSolution(solution) {
		const response = await fetch(`${this.baseUrl}/api/admin/test-solution`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ solution })
		});

		if (!response.ok) {
			throw new Error(`Failed to test solution: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Create new exercise (admin only)
	 * @param {Object} exerciseData - Exercise data
	 * @returns {Promise<Object>} Created exercise
	 */
	async createExercise(exerciseData) {
		const response = await fetch(`${this.baseUrl}/api/admin/exercises`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(exerciseData)
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || `Failed to create exercise: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Update exercise (admin only)
	 * @param {string} exerciseId - Exercise ID
	 * @param {Object} exerciseData - Exercise data
	 * @returns {Promise<Object>} Updated exercise
	 */
	async updateExercise(exerciseId, exerciseData) {
		const response = await fetch(`${this.baseUrl}/api/admin/exercises/${encodeURIComponent(exerciseId)}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(exerciseData)
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || `Failed to update exercise: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Delete exercise (admin only)
	 * @param {string} exerciseId - Exercise ID
	 * @returns {Promise<void>}
	 */
	async deleteExercise(exerciseId) {
		const response = await fetch(`${this.baseUrl}/api/admin/exercises/${encodeURIComponent(exerciseId)}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			throw new Error(`Failed to delete exercise: ${response.status}`);
		}
	}
}

export default ApiService;

