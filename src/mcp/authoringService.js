const database = require('../services/databaseService');
const exercises = require('../services/exerciseService');
const runner = require('../services/testRunner');
const limiter = require('../services/executionLimiter');

async function prepareExercise(draft, deps = { database, runner }) {
	const language = await deps.database.getLanguage(draft.language_id);
	if (!language) throw new Error(`Unknown language: ${draft.language_id}`);
	if (Buffer.byteLength(draft.solution, 'utf8') > 65536) throw new Error('Solution exceeds 64 KiB');
	const testCases = [];
	for (const tc of draft.testCases) {
		const fixturePermissions = {};
		for (const filename of tc.fixtures || []) {
			const fixture = await deps.database.getFixtureFile(filename);
			if (!fixture) throw new Error(`Unknown fixture: ${filename}`);
			fixturePermissions[filename] = fixture.permissions;
		}
		testCases.push({ ...tc, fixturePermissions,
			expectedOutputFiles: (tc.outputFiles || []).map(filename => ({ filename })) });
	}
	const exercise = { ...draft, exercise_type: language.exercise_type, testCases };
	const generated = await deps.runner.runTests(exercise, exercise.solution);
	if (generated.length !== testCases.length) throw new Error('Runner returned an incomplete test report');
	exercise.testCases = testCases.map((tc, index) => {
		const result = generated[index];
		if (result.error || result.configurationError || result.timedOut || result.outputLimited || result.exitCode == null) {
			throw new Error(`Reference test ${index + 1} failed: ${result.configurationError || result.error || 'timeout or output limit'}`);
		}
		if ((result.outputFiles || []).some(file => !file.exists)) {
			throw new Error(`Reference test ${index + 1} did not create all output paths`);
		}
		return { ...tc, expectedOutput: result.actualOutput, expectedStderr: result.actualStderr,
			expectedExitCode: result.exitCode, expectedValidationOutput: result.actualValidationOutput,
			expectedOutputFiles: (result.outputFiles || []).map(file => ({
				filename: file.filename, type: file.actualType, sha256: file.actualHash,
				linkTarget: file.actualLinkTarget
			})) };
	});
	const verification = await deps.runner.runTests(exercise, exercise.solution);
	if (verification.length !== testCases.length || verification.some(result => !result.passed)) {
		throw new Error('Reference solution did not pass the generated tests; inspect dynamic output and validation queries');
	}
	return { exercise, verification };
}

function queued(work) {
	return limiter.enqueue(work, 'bitlab-mcp');
}

async function saveExercise(mode, draft) {
	const existing = await exercises.getExerciseWithTests(draft.id);
	if (mode === 'create' && existing) throw new Error('Exercise already exists; use update mode');
	if (mode === 'update' && !existing) throw new Error('Exercise does not exist; use create mode');
	return queued(async () => {
		const { exercise, verification } = await prepareExercise(draft);
		if (mode === 'create') await exercises.createExercise(exercise);
		else await exercises.updateExercise(draft.id, exercise);
		return { exercise: await exercises.getExerciseWithTests(draft.id), verification };
	});
}

module.exports = { prepareExercise, queued, saveExercise };
