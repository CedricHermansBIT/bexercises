// Run after building the image. Nothing is published; existing exercises stay intact.
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const database = require('../services/databaseService');
const { compareArtifactState } = require('../services/artifactService');
const { runTests } = require('../services/testRunner');
const { compareRunnerResults } = require('../services/gradingComparison');
const { runScriptInContainer, createTempScript, removeRecursive } = require('../services/dockerService');
const images = require('../config/runtimeImages');

function equivalentOutputFiles(before = [], after = [], checks = []) {
    return before.length === after.length && before.every(left => {
        const right = after.find(file => file.filename === left.filename);
        if (!right || left.exists !== right.exists || left.actualType !== right.actualType) return false;
        const check = checks.find(check => check.filename === left.filename);
        if (check) return compareArtifactState({exists:right.exists,type:right.actualType,artifact:right.artifactSnapshot},
            {type:left.actualType,artifact:left.artifactSnapshot},check).matches;
        return left.actualHash === right.actualHash && left.actualLinkTarget === right.actualLinkTarget;
    });
}

async function activate() {
	const verifyOnly = process.argv.includes('--verify-only');
	const filename = path.join(__dirname, '../../data/exercises.db');
	// Rootless Podman images belong to an OS account. Verify/build as the service owner.
	if (!verifyOnly && process.getuid && process.getuid() !== (await fs.stat(filename)).uid) {
		throw new Error('Run activation as the Bitlab service/database owner so the image is available to the live runner');
	}
	const db = await open({ filename, driver: sqlite3.Database, ...(verifyOnly ? {mode:sqlite3.OPEN_READONLY} : {}) });
	database.db = db;
	const originalGetLanguage = database.getLanguage;
	try {
		const language = await database.getLanguage('python');
		if (!language) throw new Error('Python language is not configured');
		const image = images.python;
		const exercises = await database.getExercisesByLanguage('python');
		const temp = await createTempScript('import numpy, pandas, Bio, PIL, bs4, openpyxl, matplotlib, skimage, docx, reportlab, sqlite3, pypdfium2\nprint("OK")', 'python');
		try {
			const probe = await runScriptInContainer(temp.tmpdir, temp.scriptFilename,
				{ ...temp.languageConfig, dockerImage: image }, [], [], 30000);
			if (!compareRunnerResults(probe, { stdout: 'OK', stderr: '', exitCode: 0 }).passed) {
				throw new Error(`Course image probe failed: ${probe.error || probe.stderr || probe.exitCode}`);
			}
		} finally {
			await removeRecursive(temp.tmpdir);
		}
		let count = 0;
		for (const summary of exercises) {
			const exercise = { ...await database.getExerciseWithTests(summary.id), language_id: 'python' };
			// Only this process sees the override; live students retain the old image until activation.
			database.getLanguage = async id => id === 'python' ? language : null;
			const old = await runTests(exercise, exercise.solution);
			database.getLanguage = async id => id === 'python' ? { ...language, docker_image: image } : null;
			const candidate = await runTests(exercise, exercise.solution);
			for (let index = 0; index < old.length; index++) {
				const before = old[index], after = candidate[index];
				if (before.error || before.timedOut || before.outputLimited || !after
					|| after.error || after.timedOut || after.outputLimited
					|| !compareRunnerResults({ stdout: after.actualOutput, stderr: after.actualStderr, exitCode: after.exitCode },
						{ stdout: before.actualOutput, stderr: before.actualStderr, exitCode: before.exitCode }).passed
					|| after.passed !== before.passed
					|| !equivalentOutputFiles(before.outputFiles, after.outputFiles, exercise.testCases[index].artifactChecks || [])) {
					throw new Error(`Compatibility check failed: ${exercise.id}, test ${index + 1}`);
				}
				count++;
			}
		}
		if (verifyOnly) {
            console.log(JSON.stringify({verifiedOnly:true, previousImage:language.docker_image, image, checkedExercises:exercises.length, checkedTests:count}));
            return;
        }
		const backupDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-python-activation-'));
		const backup = path.join(backupDirectory, 'exercises.db');
		await db.run('VACUUM INTO ?', backup);
		await fs.chmod(backup, 0o600);
		await db.exec('BEGIN IMMEDIATE');
		try {
			const current = await db.get('SELECT docker_image FROM languages WHERE id = ?', 'python');
			if (current.docker_image !== language.docker_image) throw new Error('Python configuration changed during verification');
			const columns = await db.all('PRAGMA table_info(test_cases)');
			if (!columns.some(column => column.name === 'function_test')) {
				await db.exec('ALTER TABLE test_cases ADD COLUMN function_test TEXT');
			}
			if (!columns.some(column => column.name === 'artifact_checks')) {
				await db.exec("ALTER TABLE test_cases ADD COLUMN artifact_checks TEXT DEFAULT '[]'");
			}
			if (!columns.some(column => column.name === 'network_hosts')) {
				await db.exec("ALTER TABLE test_cases ADD COLUMN network_hosts TEXT DEFAULT '[]'");
			}
			await db.run('UPDATE languages SET docker_image = ? WHERE id = ?', image, 'python');
			await db.exec('COMMIT');
		} catch (error) {
			await db.exec('ROLLBACK');
			throw error;
		}
		console.log(JSON.stringify({ previousImage: language.docker_image, image,
			checkedExercises: exercises.length, checkedTests: count, backup,
			nextStep: 'Restart bitlab and refresh the admin page to load document/plot checks and restricted web access.' }, null, 2));
	} finally {
		database.getLanguage = originalGetLanguage;
		database.cache.clear();
		database.db = null;
		await db.close();
	}
}

if (require.main === module) activate().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { activate, equivalentOutputFiles };
