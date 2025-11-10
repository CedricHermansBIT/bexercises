// frontend/js/services/apiService.js
/**
 * API Service for interacting with the backend
 */
class ApiService {
	constructor(baseUrl = '') {
		// Auto-detect base path from current URL if not provided
		if (!baseUrl) {
			const path = window.location.pathname;
			// Extract base path (e.g., '/bitlab' from '/bitlab/pages/login.html')
			const match = path.match(/^(\/[^\/]+)?\/(pages|index\.html)/);
			if (match && match[1]) {
				baseUrl = match[1];
			}
		}
		this.baseUrl = baseUrl;
	}

	/**
	 * Fetch all exercises
	 * @param {string} [language] - Optional language ID to filter exercises
	 * @returns {Promise<Array>} Array of exercises
	 */
	async getExercises(language = null) {
		const url = language
			? `${this.baseUrl}/api/exercises?language=${encodeURIComponent(language)}`
			: `${this.baseUrl}/api/exercises`;

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch exercises: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Fetch all languages
	 * @returns {Promise<Array>} Array of languages
	 */
	async getLanguages() {
		const response = await fetch(`${this.baseUrl}/api/languages`);
		if (!response.ok) {
			throw new Error(`Failed to fetch languages: ${response.status}`);
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
		// Get user's timezone
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

		const response = await fetch(`${this.baseUrl}/api/exercises/${encodeURIComponent(exerciseId)}/run`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ script, timezone })
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
	 * Get global statistics for all exercises
	 * @returns {Promise<Object>} Object with exercise IDs as keys and stats as values
	 */
	async getGlobalExerciseStats() {
		const response = await fetch(`${this.baseUrl}/api/exercises/stats/global`);
		if (!response.ok) {
			throw new Error(`Failed to fetch global exercise statistics: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Get current user's progress for all exercises
	 * @returns {Promise<Object>} Object with exercise IDs as keys and progress data as values
	 */
	async getUserProgress() {
		const response = await fetch(`${this.baseUrl}/api/progress`);
		if (!response.ok) {
			if (response.status === 401) {
				return {}; // Not authenticated, return empty progress
			}
			throw new Error(`Failed to fetch user progress: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Get current user's progress for a specific language
	 * @param {string} languageId - Language ID
	 * @returns {Promise<Array>} Array of progress records for the language
	 */
	async getUserProgressByLanguage(languageId) {
		const response = await fetch(`${this.baseUrl}/api/progress/language/${encodeURIComponent(languageId)}`);
		if (!response.ok) {
			if (response.status === 401) {
				return []; // Not authenticated, return empty progress
			}
			throw new Error(`Failed to fetch user progress: ${response.status}`);
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
	 * Get all exercises with full data (admin only)
	 * @returns {Promise<Array>} Array of exercises with test cases
	 */
	async getAdminExercises() {
		const response = await fetch(`${this.baseUrl}/api/admin/exercises`);
		if (!response.ok) {
			throw new Error(`Failed to fetch exercises: ${response.status}`);
		}
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
	 * Run a specific test case (admin only)
	 * @param {string} solution - Solution script
	 * @param {Object} testCase - Test case with arguments, input, fixtures, outputFiles
	 * @returns {Promise<Object>} Test output and exit code
	 */
	async runTestCase(solution, testCase) {
		const response = await fetch(`${this.baseUrl}/api/admin/run-test-case`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				solution,
				languageId: testCase.languageId || 'bash',
				arguments: testCase.arguments || [],
				input: testCase.input || [],
				fixtures: testCase.fixtures || [],
				outputFiles: testCase.outputFiles || []
			})
		});

		if (!response.ok) {
			throw new Error(`Failed to run test case: ${response.status}`);
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

	/**
	 * Get all fixture files (admin only)
	 * @returns {Promise<Array>} List of fixture files
	 */
	async getFixtureFiles() {
		const response = await fetch(`${this.baseUrl}/api/admin/fixtures`);
		if (!response.ok) {
			throw new Error(`Failed to get fixture files: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Upload a fixture file (admin only)
	 * @param {string} filename - File name
	 * @param {string} content - File content
	 * @returns {Promise<Object>} Upload result
	 */
	async uploadFixtureFile(filename, content) {
		const response = await fetch(`${this.baseUrl}/api/admin/fixtures`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ filename, content, type: 'file' })
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || `Failed to upload file: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Create a fixture folder (admin only)
	 * @param {string} foldername - Folder name
	 * @returns {Promise<Object>} Creation result
	 */
	async createFixtureFolder(foldername) {
		const response = await fetch(`${this.baseUrl}/api/admin/fixtures`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ filename: foldername, type: 'folder' })
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || `Failed to create folder: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Get fixture file content (admin only)
	 * @param {string} filename - File name
	 * @returns {Promise<string>} File content
	 */
	async getFixtureFileContent(filename) {
		const response = await fetch(`${this.baseUrl}/api/admin/fixtures/${encodeURIComponent(filename)}`);
		if (!response.ok) {
			throw new Error(`Failed to get file content: ${response.status}`);
		}
		const data = await response.json();
		return data.content;
	}

	/**
	 * Delete a fixture file (admin only)
	 * @param {string} filename - File name
	 * @returns {Promise<void>}
	 */
	async deleteFixtureFile(filename) {
		const response = await fetch(`${this.baseUrl}/api/admin/fixtures/${encodeURIComponent(filename)}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || `Failed to delete file: ${response.status}`);
		}
	}

	/**
	 * Set file permissions (admin only)
	 * @param {string} filename - File name
	 * @param {string} permissions - Permission string (e.g., 'rwxr-xr-x' or octal like '755')
	 * @returns {Promise<void>}
	 */
	async setFilePermissions(filename, permissions) {
		const response = await fetch(`${this.baseUrl}/api/admin/fixtures/${encodeURIComponent(filename)}/permissions`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ permissions })
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || `Failed to set permissions: ${response.status}`);
		}
	}

	/**
	 * Sync fixture files database with filesystem (admin only)
	 * Removes orphaned database entries that don't exist on filesystem
	 * @returns {Promise<Object>} Sync result with removed count and files
	 */
	async syncFixtures() {
		const response = await fetch(`${this.baseUrl}/api/admin/fixtures/sync`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || `Failed to sync fixtures: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Get folder contents (admin only)
	 * @param {string} foldername - Folder name
	 * @returns {Promise<Array>} Array of file objects with name and size
	 */
	async getFolderContents(foldername) {
		const response = await fetch(`${this.baseUrl}/api/admin/fixtures/${encodeURIComponent(foldername)}/contents`);
		if (!response.ok) {
			throw new Error(`Failed to get folder contents: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Upload a file to a folder (admin only)
	 * @param {string} foldername - Folder name
	 * @param {string} filename - File name
	 * @param {string} content - File content
	 * @returns {Promise<Object>} Upload result
	 */
	async uploadFileToFolder(foldername, filename, content) {
		const response = await fetch(`${this.baseUrl}/api/admin/fixtures/${encodeURIComponent(foldername)}/files`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ filename, content })
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || `Failed to upload file: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Delete a file from a folder (admin only)
	 * @param {string} foldername - Folder name
	 * @param {string} filename - File name
	 * @returns {Promise<void>}
	 */
	async deleteFileFromFolder(foldername, filename) {
		const response = await fetch(`${this.baseUrl}/api/admin/fixtures/${encodeURIComponent(foldername)}/files/${encodeURIComponent(filename)}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || `Failed to delete file: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Get all users (admin only)
	 * @returns {Promise<Array>} List of users with statistics
	 */
	async getUsers() {
		const response = await fetch(`${this.baseUrl}/api/admin/users`);
		if (!response.ok) {
			throw new Error(`Failed to fetch users: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Get detailed user information (admin only)
	 * @param {number} userId - User ID
	 * @returns {Promise<Object>} User details with progress
	 */
	async getUserDetails(userId) {
		const response = await fetch(`${this.baseUrl}/api/admin/users/${userId}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch user details: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Update user (admin only)
	 * @param {number} userId - User ID
	 * @param {Object} data - Update data (e.g., is_admin)
	 * @returns {Promise<Object>} Updated user
	 */
	async updateUser(userId, data) {
		const response = await fetch(`${this.baseUrl}/api/admin/users/${userId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			throw new Error(`Failed to update user: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Delete a user (admin only)
	 * @param {number} userId - User ID
	 * @returns {Promise<void>}
	 */
	async deleteUser(userId) {
		const response = await fetch(`${this.baseUrl}/api/admin/users/${userId}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			throw new Error(`Failed to delete user: ${response.status}`);
		}
	}

	/**
	 * Get active notifications
	 * @returns {Promise<Array>} Active notifications
	 */
	async getNotifications() {
		const response = await fetch(`${this.baseUrl}/api/notifications`);
		if (!response.ok) {
			throw new Error(`Failed to fetch notifications: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Get all notifications (admin only)
	 * @returns {Promise<Array>} All notifications
	 */
	async getAllNotifications() {
		const response = await fetch(`${this.baseUrl}/api/admin/notifications`);
		if (!response.ok) {
			throw new Error(`Failed to fetch all notifications: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Create a notification (admin only)
	 * @param {Object} notification - Notification data
	 * @returns {Promise<Object>} Created notification
	 */
	async createNotification(notification) {
		const response = await fetch(`${this.baseUrl}/api/admin/notifications`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(notification)
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || `Failed to create notification: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Update a notification (admin only)
	 * @param {number} id - Notification ID
	 * @param {Object} updates - Notification updates
	 * @returns {Promise<Object>} Updated notification
	 */
	async updateNotification(id, updates) {
		const response = await fetch(`${this.baseUrl}/api/admin/notifications/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updates)
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || `Failed to update notification: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Delete a notification (admin only)
	 * @param {number} id - Notification ID
	 * @returns {Promise<void>}
	 */
	async deleteNotification(id) {
		const response = await fetch(`${this.baseUrl}/api/admin/notifications/${id}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			throw new Error(`Failed to delete notification: ${response.status}`);
		}
	}

	/**
	 * Deactivate a notification (admin only)
	 * @param {number} id - Notification ID
	 * @returns {Promise<void>}
	 */
	async deactivateNotification(id) {
		const response = await fetch(`${this.baseUrl}/api/admin/notifications/${id}/deactivate`, {
			method: 'POST'
		});

		if (!response.ok) {
			throw new Error(`Failed to deactivate notification: ${response.status}`);
		}
	}

	/**
	 * Get leaderboard data, optionally filtered by language
	 * @param {string|null} languageId - Optional language ID to filter by
	 * @returns {Promise<Array>} Leaderboard rankings
	 */
	async getLeaderboard(languageId = null) {
		const endpoint = languageId
			? `${this.baseUrl}/api/leaderboard/${encodeURIComponent(languageId)}`
			: `${this.baseUrl}/api/leaderboard`;

		const response = await fetch(endpoint);
		if (!response.ok) {
			throw new Error(`Failed to fetch leaderboard: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Get achievement points leaderboard
	 * @returns {Promise<Array>} Achievement leaderboard rankings
	 */
	async getAchievementLeaderboard() {
		const response = await fetch(`${this.baseUrl}/api/leaderboard-achievements`);
		if (!response.ok) {
			throw new Error(`Failed to fetch achievement leaderboard: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Get all available achievements
	 * @returns {Promise<Array>} Array of achievements
	 */
	async getAllAchievements() {
		const response = await fetch(`${this.baseUrl}/api/achievements`);
		if (!response.ok) {
			throw new Error(`Failed to fetch achievements: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Get current user's achievements and progress
	 * @returns {Promise<Object>} User achievements and total points
	 */
	async getUserAchievements() {
		const response = await fetch(`${this.baseUrl}/api/achievements/user`);
		if (!response.ok) {
			throw new Error(`Failed to fetch user achievements: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Grade exam submissions (admin only)
	 * @param {string} zipData - Base64 encoded ZIP file
	 * @param {Object} gradingConfig - Grading configuration with tasks, tests, and code rules
	 * @returns {Promise<Object>} Grading results
	 */
	async gradeExamSubmissions(zipData, gradingConfig) {
		const response = await fetch(`${this.baseUrl}/api/admin/exam-grader/grade`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ zipData, gradingConfig })
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || error.detail || `Failed to grade submissions: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Test a single script against a solution (admin only)
	 * @param {Object} testData - Test data with studentScript, solutionScript, arguments, inputs, codeRules
	 * @returns {Promise<Object>} Comparison results and code check results
	 */
	async testSingleScript(testData) {
		const response = await fetch(`${this.baseUrl}/api/admin/exam-grader/test-single`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(testData)
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || error.detail || `Failed to test script: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Get all languages (admin only, includes disabled)
	 * @returns {Promise<Array>} Array of languages
	 */
	async getAdminLanguages() {
		const response = await fetch(`${this.baseUrl}/api/admin/languages`);
		if (!response.ok) {
			throw new Error(`Failed to fetch languages: ${response.status}`);
		}
		return response.json();
	}

	/**
	 * Create a new language (admin only)
	 * @param {Object} languageData - Language data
	 * @returns {Promise<Object>} Created language
	 */
	async createLanguage(languageData) {
		const response = await fetch(`${this.baseUrl}/api/admin/languages`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(languageData)
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || error.detail || `Failed to create language: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Update a language (admin only)
	 * @param {string} languageId - Language ID
	 * @param {Object} languageData - Language data
	 * @returns {Promise<Object>} Updated language
	 */
	async updateLanguage(languageId, languageData) {
		const response = await fetch(`${this.baseUrl}/api/admin/languages/${encodeURIComponent(languageId)}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(languageData)
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || error.detail || `Failed to update language: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Delete a language (admin only)
	 * @param {string} languageId - Language ID
	 * @returns {Promise<void>}
	 */
	async deleteLanguage(languageId) {
		const response = await fetch(`${this.baseUrl}/api/admin/languages/${encodeURIComponent(languageId)}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || error.detail || `Failed to delete language: ${response.status}`);
		}
	}
}

export default ApiService;
