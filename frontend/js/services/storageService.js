// frontend/js/services/storageService.js
/**
 * Service for managing local storage
 */
class StorageService {
	constructor(key = 'bash-exercises-progress') {
		this.key = key;
	}

	/**
	 * Load progress from localStorage
	 * @returns {Object} Progress object
	 */
	loadProgress() {
		const saved = localStorage.getItem(this.key);
		return saved ? JSON.parse(saved) : {};
	}

	/**
	 * Save progress to localStorage
	 * @param {Object} progress - Progress object
	 */
	saveProgress(progress) {
		localStorage.setItem(this.key, JSON.stringify(progress));
	}

	/**
	 * Update progress for a specific exercise
	 * @param {string} exerciseId - Exercise ID
	 * @param {string} code - User's code
	 * @param {boolean} completed - Whether the exercise is completed
	 * @returns {Object} Updated progress object
	 */
	updateExerciseProgress(exerciseId, code, completed) {
		const progress = this.loadProgress();

		if (!progress[exerciseId]) {
			progress[exerciseId] = {};
		}

		progress[exerciseId].code = code;
		progress[exerciseId].completed = completed;
		progress[exerciseId].lastModified = new Date().toISOString();

		this.saveProgress(progress);
		return progress;
	}

	/**
	 * Get progress for a specific exercise
	 * @param {string} exerciseId - Exercise ID
	 * @returns {Object|null} Exercise progress or null
	 */
	getExerciseProgress(exerciseId) {
		const progress = this.loadProgress();
		return progress[exerciseId] || null;
	}
}

export default StorageService;

