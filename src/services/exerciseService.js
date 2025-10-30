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

module.exports = {
	loadExercisesInternal,
	getAllExercises,
	getExerciseById,
	getExerciseWithTests
};

