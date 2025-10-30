// src/services/exerciseService.js
const fs = require('fs').promises;
const config = require('../config');

/**
 * Load exercises from internal JSON file
 * @returns {Promise<Array>} Array of exercise objects
 */
async function loadExercisesInternal() {
	const txt = await fs.readFile(config.paths.exercises, 'utf8');
	return JSON.parse(txt);
}

/**
 * Get all exercises without sensitive data
 * @returns {Promise<Array>} Array of exercise metadata
 */
async function getAllExercises() {
	const all = await loadExercisesInternal();
	return all.map(ex => ({
		id: ex.id,
		title: ex.title,
		description: ex.description,
		solution: ex.solution,
		chapter: ex.chapter,
		order: ex.order
	}));
}

/**
 * Get a single exercise by ID without test cases
 * @param {string} id - Exercise ID
 * @returns {Promise<Object|null>} Exercise object or null if not found
 */
async function getExerciseById(id) {
	const all = await loadExercisesInternal();
	const ex = all.find(e => e.id === id);

	if (!ex) return null;

	return {
		id: ex.id,
		title: ex.title,
		description: ex.description,
		solution: ex.solution
	};
}

/**
 * Get exercise with test cases (internal use only)
 * @param {string} id - Exercise ID
 * @returns {Promise<Object|null>} Complete exercise object or null
 */
async function getExerciseWithTests(id) {
	const all = await loadExercisesInternal();
	return all.find(e => e.id === id) || null;
}

/**
 * Save exercises to internal JSON file
 * @param {Array} exercises - Array of exercise objects
 * @returns {Promise<void>}
 */
async function saveExercisesInternal(exercises) {
	const json = JSON.stringify(exercises, null, 2);
	await fs.writeFile(config.paths.exercises, json, 'utf8');
}

/**
 * Create a new exercise (admin only)
 * @param {Object} exerciseData - Exercise data
 * @returns {Promise<Object>} Created exercise
 */
async function createExercise(exerciseData) {
	const all = await loadExercisesInternal();

	// Check if exercise ID already exists
	if (all.find(e => e.id === exerciseData.id)) {
		throw new Error('Exercise with this ID already exists');
	}

	all.push(exerciseData);
	await saveExercisesInternal(all);

	return exerciseData;
}

/**
 * Update an existing exercise (admin only)
 * @param {string} id - Exercise ID
 * @param {Object} exerciseData - Updated exercise data
 * @returns {Promise<Object>} Updated exercise
 */
async function updateExercise(id, exerciseData) {
	const all = await loadExercisesInternal();
	const index = all.findIndex(e => e.id === id);

	if (index === -1) {
		throw new Error('Exercise not found');
	}

	all[index] = exerciseData;
	await saveExercisesInternal(all);

	return exerciseData;
}

/**
 * Delete an exercise (admin only)
 * @param {string} id - Exercise ID
 * @returns {Promise<void>}
 */
async function deleteExercise(id) {
	const all = await loadExercisesInternal();
	const filtered = all.filter(e => e.id !== id);

	if (filtered.length === all.length) {
		throw new Error('Exercise not found');
	}

	await saveExercisesInternal(filtered);
}

module.exports = {
	loadExercisesInternal,
	getAllExercises,
	getExerciseById,
	getExerciseWithTests,
	createExercise,
	updateExercise,
	deleteExercise
};

