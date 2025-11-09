// src/services/exerciseService.js
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const databaseService = require('./databaseService');

/**
 * Load exercises from database (for backward compatibility, keep JSON as fallback)
 * @returns {Promise<Array>} All exercises with full data
 */
async function loadExercisesInternal() {
	try {
		// Get all languages including disabled ones (this is used by admin endpoints)
		const languages = await databaseService.getLanguages(true);
		const allExercises = [];

		for (const lang of languages) {
			const exercises = await databaseService.getExercisesByLanguage(lang.id);

			// Get test cases for each exercise
			for (const exercise of exercises) {
				const fullExercise = await databaseService.getExerciseWithTests(exercise.id);
				allExercises.push({
					...fullExercise,
					language_id: lang.id,
					language: lang.name,
					chapter: fullExercise.chapter_name || exercise.chapter_name,
					chapter_order: exercise.chapter_order || 0,
					order: fullExercise.order_num || exercise.order_num || 0
				});
			}
		}

		return allExercises;
	} catch (error) {
		console.error('Error loading from database, falling back to JSON:', error);
		// Fallback to JSON if database fails
		const filePath = path.join(__dirname, '../../exercises-internal.json');
		const data = await fs.readFile(filePath, 'utf-8');
		return JSON.parse(data);
	}
}

/**
 * Get all exercises (without test cases for public API)
 * @returns {Promise<Array>} Exercises without test cases
 */
async function getAllExercises() {
	try {
		// Get all languages including disabled ones, so exercises are available
		// Frontend handles showing/hiding disabled languages appropriately
		const languages = await databaseService.getLanguages(true);
		const allExercises = [];

		for (const lang of languages) {
			const exercises = await databaseService.getExercisesByLanguage(lang.id);

			// Remove test cases for public API, but add language info
			allExercises.push(...exercises.map(ex => ({
				id: ex.id,
				title: ex.title,
				description: ex.description,
				chapter: ex.chapter_name,
				order: ex.order_num,
				language_id: lang.id,
				language: lang.name
			})));
		}

		return allExercises;
	} catch (error) {
		console.error('Error loading from database:', error);
		const exercises = await loadExercisesInternal();
		return exercises.map(ex => ({
			id: ex.id,
			title: ex.title,
			description: ex.description,
			chapter: ex.chapter,
			order: ex.order,
			language_id: ex.language_id,
			language: ex.language
		}));
	}
}

/**
 * Get exercises for a specific language (without test cases)
 * @param {string} languageId - Language ID
 * @returns {Promise<Array>} Exercises without test cases for the language
 */
async function getExercisesByLanguage(languageId) {
	try {
		const exercises = await databaseService.getExercisesByLanguage(languageId);

		// Get language info
		const language = await databaseService.getLanguage(languageId);

		// Remove test cases for public API, but add language info
		return exercises.map(ex => ({
			id: ex.id,
			title: ex.title,
			description: ex.description,
			chapter: ex.chapter_name,
			order: ex.order_num,
			language_id: languageId,
			language: language?.name || languageId
		}));
	} catch (error) {
		console.error('Error loading exercises from database:', error);
		// Fallback: filter from all exercises
		const allExercises = await loadExercisesInternal();
		return allExercises
			.filter(ex => ex.language_id === languageId || ex.language === languageId)
			.map(ex => ({
				id: ex.id,
				title: ex.title,
				description: ex.description,
				chapter: ex.chapter,
				order: ex.order,
				language_id: ex.language_id,
				language: ex.language
			}));
	}
}

/**
 * Get a single exercise by ID (without test cases)
 * @param {string} id - Exercise ID
 * @returns {Promise<Object|null>} Exercise or null
 */
async function getExerciseById(id) {
	try {
		const exercise = await databaseService.getExercise(id);
		if (!exercise) return null;

		return {
			id: exercise.id,
			title: exercise.title,
			description: exercise.description
		};
	} catch (error) {
		console.error('Error getting exercise from database:', error);
		const exercises = await loadExercisesInternal();
		const exercise = exercises.find(e => e.id === id);
		if (!exercise) return null;

		return {
			id: exercise.id,
			title: exercise.title,
			description: exercise.description
		};
	}
}

/**
 * Get exercise with test cases (admin/testing only)
 * @param {string} id - Exercise ID
 * @returns {Promise<Object|null>} Exercise with test cases or null
 */
async function getExerciseWithTests(id) {
	try {
		const exercise = await databaseService.getExerciseWithTests(id);
		if (!exercise) return null;

		// Get chapter info
		const chapter = await databaseService.getChapter(exercise.chapter_id);

		return {
			...exercise,
			chapter: chapter ? chapter.name : 'Unknown'
		};
	} catch (error) {
		console.error('Error getting exercise with tests from database:', error);
		const exercises = await loadExercisesInternal();
		return exercises.find(e => e.id === id) || null;
	}
}

/**
 * Create a new exercise (admin only)
 * @param {Object} exerciseData - Exercise data
 * @returns {Promise<Object>} Created exercise
 */
async function createExercise(exerciseData) {
	try {
		// Find or create chapter
		let chapterId = exerciseData.chapter_id;

		if (!chapterId && exerciseData.chapter) {
			// Get the language_id from exerciseData or default to 'bash'
			const languageId = exerciseData.language_id || 'bash';

			// Try to find existing chapter by name for this language
			const chapters = await databaseService.getChaptersByLanguage(languageId);
			let chapter = chapters.find(c => c.name === exerciseData.chapter);

			if (!chapter) {
				// Create new chapter for the correct language
				chapterId = `${languageId}-${exerciseData.chapter.toLowerCase().replace(/\s+/g, '-')}`;
				chapter = await databaseService.createChapter({
					id: chapterId,
					language_id: languageId,
					name: exerciseData.chapter,
					order_num: chapters.length + 1
				});
			} else {
				chapterId = chapter.id;
			}
		}

		// Map 'order' from frontend to 'order_num' for database
		const dbData = {
			...exerciseData,
			chapter_id: chapterId,
			order_num: exerciseData.order
		};

		return await databaseService.createExercise(dbData);
	} catch (error) {
		console.error('Error creating exercise:', error);
		throw error;
	}
}

/**
 * Update an existing exercise (admin only)
 * @param {string} id - Exercise ID
 * @param {Object} exerciseData - Updated exercise data
 * @returns {Promise<Object>} Updated exercise
 */
async function updateExercise(id, exerciseData) {
	try {
		// Get the current exercise to preserve fields that shouldn't change
		const currentExercise = await databaseService.getExerciseWithTests(id);

		if (!currentExercise) {
			throw new Error('Exercise not found');
		}

		// Find or create chapter if chapter name is provided
		let chapterId = exerciseData.chapter_id || currentExercise.chapter_id;

		if (exerciseData.chapter && exerciseData.chapter !== currentExercise.chapter) {
			// Chapter is changing - find or create the new chapter
			// Get language_id from exerciseData, or get it from current exercise's chapter
			let languageId = exerciseData.language_id;
			if (!languageId && currentExercise.chapter_id) {
				const currentChapter = await databaseService.getChapter(currentExercise.chapter_id);
				languageId = currentChapter?.language_id || 'bash';
			}
			languageId = languageId || 'bash';

			const chapters = await databaseService.getChaptersByLanguage(languageId);
			let chapter = chapters.find(c => c.name === exerciseData.chapter);

			if (!chapter) {
				// Create new chapter for the correct language
				chapterId = `${languageId}-${exerciseData.chapter.toLowerCase().replace(/\s+/g, '-')}`;
				chapter = await databaseService.createChapter({
					id: chapterId,
					language_id: languageId,
					name: exerciseData.chapter,
					order_num: chapters.length + 1
				});
			} else {
				chapterId = chapter.id;
			}
		}

		// Use the provided order, or preserve the current order if not provided
		const orderNum = exerciseData.order !== undefined ? exerciseData.order : currentExercise.order_num;

		return await databaseService.updateExercise(id, {
			...exerciseData,
			chapter_id: chapterId,
			order_num: orderNum
		});
	} catch (error) {
		console.error('Error updating exercise:', error);
		throw error;
	}
}

/**
 * Delete an exercise (admin only)
 * @param {string} id - Exercise ID
 * @returns {Promise<void>}
 */
async function deleteExercise(id) {
	try {
		await databaseService.deleteExercise(id);
	} catch (error) {
		console.error('Error deleting exercise:', error);
		throw error;
	}
}

/**
 * Reorder exercises (admin only)
 * @param {Array} exercises - Array of exercises with updated order
 * @returns {Promise<void>}
 */
async function reorderExercises(exercises) {
	try {
		// Map chapter names to IDs
		const exercisesWithChapterIds = [];

		for (const ex of exercises) {
			let chapterId = ex.chapter_id;

			if (!chapterId && ex.chapter) {
				const chapters = await databaseService.getChaptersByLanguage('bash');
				const chapter = chapters.find(c => c.name === ex.chapter);
				chapterId = chapter ? chapter.id : ex.chapter.toLowerCase().replace(/\s+/g, '-');
			}

			exercisesWithChapterIds.push({
				...ex,
				chapter_id: chapterId
			});
		}

		await databaseService.reorderExercises(exercisesWithChapterIds);
	} catch (error) {
		console.error('Error reordering exercises:', error);
		throw error;
	}
}

module.exports = {
	loadExercisesInternal,
	getAllExercises,
	getExerciseById,
	getExerciseWithTests,
	createExercise,
	updateExercise,
	deleteExercise,
	reorderExercises,
	getExercisesByLanguage
};
