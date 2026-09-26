// src/services/examGraderService.js
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const config = require('../config');
const { createTempDirectory } = require('../utils/tempDirectory');
const { createTempScript, runScriptInContainer, removeRecursive, normalizeOutput, copyFixtures, hashOutputFiles } = require('./dockerService');
const { compareRunnerResults, compareOutputState } = require('./gradingComparison');

function inspectZip(zipBuffer) {
	if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length > config.docker.maxExamArchiveBytes) {
		throw new Error('Exam ZIP exceeds the compressed size limit');
	}
	let end = -1;
	for (let offset = zipBuffer.length - 22; offset >= Math.max(0, zipBuffer.length - 65557); offset--) {
		if (zipBuffer.readUInt32LE(offset) === 0x06054b50) { end = offset; break; }
	}
	if (end < 0) throw new Error('Invalid ZIP archive');
	const count = zipBuffer.readUInt16LE(end + 10);
	const centralSize = zipBuffer.readUInt32LE(end + 12);
	let cursor = zipBuffer.readUInt32LE(end + 16);
	if (count === 0xffff || cursor === 0xffffffff || cursor + centralSize > end) {
		throw new Error('Unsupported ZIP directory');
	}
	if (count > config.docker.maxExamFiles) throw new Error('Exam ZIP contains too many entries');
	const seen = new Set();
	let uncompressed = 0;
	for (let i = 0; i < count; i++) {
		if (cursor + 46 > end || zipBuffer.readUInt32LE(cursor) !== 0x02014b50) {
			throw new Error('Invalid ZIP directory entry');
		}
		const filenameLength = zipBuffer.readUInt16LE(cursor + 28);
		const extraLength = zipBuffer.readUInt16LE(cursor + 30);
		const commentLength = zipBuffer.readUInt16LE(cursor + 32);
		const next = cursor + 46 + filenameLength + extraLength + commentLength;
		if (next > end) throw new Error('Invalid ZIP directory entry length');
		const filename = zipBuffer.subarray(cursor + 46, cursor + 46 + filenameLength).toString('utf8');
		const parts = filename.split('/').filter(Boolean);
		if (!filename || filename.startsWith('/') || filename.includes('\\') || filename.includes('\0')
			|| parts.some(part => part === '.' || part === '..')
			|| (parts.length === 1 && filename.startsWith('solution_'))
			|| parts.length > config.docker.maxExamDepth || seen.has(filename)) {
			throw new Error(`Unsafe ZIP entry: ${filename}`);
		}
		seen.add(filename);
		const unixMode = zipBuffer.readUInt32LE(cursor + 38) >>> 16;
		if ((unixMode & 0xf000) === 0xa000) throw new Error(`ZIP symlink is not allowed: ${filename}`);
		uncompressed += zipBuffer.readUInt32LE(cursor + 24);
		if (uncompressed > config.docker.maxExamUncompressedBytes) {
			throw new Error('Exam ZIP exceeds the uncompressed size limit');
		}
		cursor = next;
	}
	if (cursor !== zipBuffer.readUInt32LE(end + 16) + centralSize) {
		throw new Error('Invalid ZIP directory size');
	}
}

async function scanSubmissionFiles(root, excludeSolutions = false) {
	const canonicalRoot = await fs.realpath(root);
	const scripts = [];
	let count = 0;
	let bytes = 0;
	async function visit(directory, depth) {
		if (depth > config.docker.maxExamDepth) throw new Error('Exam ZIP nesting is too deep');
		for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
			const fullPath = path.join(directory, entry.name);
			const stat = await fs.lstat(fullPath);
			if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) {
				throw new Error(`Unsafe extracted file: ${fullPath}`);
			}
			const real = await fs.realpath(fullPath);
			if (!real.startsWith(`${canonicalRoot}${path.sep}`)) {
				throw new Error(`Extracted file escapes archive directory: ${fullPath}`);
			}
			count++;
			if (count > config.docker.maxExamFiles) throw new Error('Exam ZIP contains too many files');
			if (stat.isDirectory()) await visit(fullPath, depth + 1);
			else {
				bytes += stat.size;
				if (bytes > config.docker.maxExamUncompressedBytes) {
					throw new Error('Exam ZIP exceeds the uncompressed size limit');
				}
				const relative = path.relative(root, fullPath);
				if (relative.endsWith('.sh') && !(excludeSolutions && path.basename(relative).startsWith('solution_'))) {
					scripts.push({ filename: relative, path: fullPath });
				}
			}
		}
	}
	await visit(root, 0);
	return scripts.sort((a, b) => a.filename.localeCompare(b.filename));
}

/**
 * Extract a zip file to a directory using the existing Docker infrastructure
 * @param {Buffer} zipBuffer - The zip file buffer
 * @param {string} targetDir - Directory to extract to
 * @returns {Promise<string[]>} List of extracted file names
 */
async function extractZip(zipBuffer, targetDir) {
	inspectZip(zipBuffer);
	const unzipScript = `#!/bin/bash
set -e
mkdir extracted
unzip -oq upload.zip -d extracted
`;
	const { tmpdir, scriptFilename, languageConfig } = await createTempScript(unzipScript);
	try {
		await fs.writeFile(path.join(tmpdir, 'upload.zip'), zipBuffer);
		const result = await runScriptInContainer(tmpdir, scriptFilename,
			{ ...languageConfig, dockerImage: config.docker.image, interpreter: 'bash' },
			[], [], config.docker.timeout);
		if (result.exitCode !== 0 || result.timedOut || result.outputLimited || result.error) {
			throw new Error(`Unzip failed: ${result.error || result.stderr || result.exitCode}`);
		}
		const extractedRoot = path.join(tmpdir, 'extracted');
		const scripts = await scanSubmissionFiles(extractedRoot);
		await copyDirectory(extractedRoot, targetDir, extractedRoot);
		return scripts.map(script => script.filename);
	} finally {
		await removeRecursive(tmpdir);
	}
}

async function copyDirectory(src, dest, root = src) {
	await fs.mkdir(dest, { recursive: true });
	const realRoot = await fs.realpath(root);
	for (const entry of await fs.readdir(src, { withFileTypes: true })) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		const stat = await fs.lstat(srcPath);
		if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())
			|| !(await fs.realpath(srcPath)).startsWith(`${realRoot}${path.sep}`)) {
			throw new Error(`Unsafe extracted file: ${srcPath}`);
		}
		const existing = await fs.lstat(destPath).catch(error => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (existing) throw new Error(`Exam ZIP would overwrite an existing file: ${entry.name}`);
		if (stat.isDirectory()) await copyDirectory(srcPath, destPath, root);
		else await fs.copyFile(srcPath, destPath);
	}
}

/**
 * Run a script and compare output with solution
 * @param {string} studentScript - Path to student's script
 * @param {string} solutionScript - Path to solution script
 * @param {Array} args - Command line arguments
 * @param {Array} inputs - Stdin inputs
 * @param {Array} fixtures - Fixture files to copy (optional)
 * @param {Object} fixturePermissions - Fixture permissions (optional)
 * @param {Array} expectedOutputFiles - Expected output files to verify (optional)
 * @returns {Promise<Object>} Comparison result
 */
async function compareScriptOutputs(studentScript, solutionScript, args = [], inputs = [], fixtures = [], fixturePermissions = {}, expectedOutputFiles = []) {
	const studentContent = await fs.readFile(studentScript, 'utf8');
	const solutionContent = await fs.readFile(solutionScript, 'utf8');

	// Create temp directories for both scripts
	const studentTemp = await createTempScript(studentContent);
	const solutionTemp = await createTempScript(solutionContent);
	const studentTmpdir = studentTemp.tmpdir;
	const solutionTmpdir = solutionTemp.tmpdir;

	try {
		// Copy fixtures to both directories if provided
		if (fixtures && fixtures.length > 0) {
			await Promise.all([
				copyFixtures(studentTmpdir, fixtures, fixturePermissions),
				copyFixtures(solutionTmpdir, fixtures, fixturePermissions)
			]);
		}

		// Run both scripts with same arguments and inputs
		const [studentResult, solutionResult] = await Promise.all([
			runScriptInContainer(studentTmpdir, studentTemp.scriptFilename,
				{ ...studentTemp.languageConfig, dockerImage: config.docker.image, interpreter: 'bash' },
				args, inputs, config.docker.timeout),
			runScriptInContainer(solutionTmpdir, solutionTemp.scriptFilename,
				{ ...solutionTemp.languageConfig, dockerImage: config.docker.image, interpreter: 'bash' },
				args, inputs, config.docker.timeout)
		]);

		const studentOut = normalizeOutput(studentResult.stdout).trim();
		const solutionOut = normalizeOutput(solutionResult.stdout).trim();
		const studentErr = normalizeOutput(studentResult.stderr).trim();
		const solutionErr = normalizeOutput(solutionResult.stderr).trim();

		const runnerComparison = compareRunnerResults(studentResult, solutionResult);

		// Check output files if specified
		let outputFilesResult = [];
		let outputFilesMatch = true;

		if (expectedOutputFiles && expectedOutputFiles.length > 0) {
			const filenames = expectedOutputFiles.map(f => typeof f === 'string' ? f : f.filename);

			const [studentFileHashes, solutionFileHashes] = await Promise.all([
				hashOutputFiles(studentTmpdir, filenames),
				hashOutputFiles(solutionTmpdir, filenames)
			]);

			// Compare file hashes
			outputFilesResult = studentFileHashes.map((studentFile) => {
				const solutionFile = solutionFileHashes.find(f => f.filename === studentFile.filename);
				const { matches: hashMatches, entries } = compareOutputState(studentFile, solutionFile);

				if (!hashMatches) {
					outputFilesMatch = false;
				}

				return {
					filename: studentFile.filename,
					studentExists: studentFile.exists,
					solutionExists: solutionFile ? solutionFile.exists : false,
					studentHash: studentFile.sha256,
					solutionHash: solutionFile ? solutionFile.sha256 : null,
					studentType: studentFile.type,
					solutionType: solutionFile ? solutionFile.type : null,
					studentLinkTarget: studentFile.linkTarget,
					solutionLinkTarget: solutionFile ? solutionFile.linkTarget : null,
					entries,
					hashMatches,
					studentSize: studentFile.size,
					solutionSize: solutionFile ? solutionFile.size : null,
					error: studentFile.error || (solutionFile ? solutionFile.error : null)
				};
			});
		}

		return {
			passed: runnerComparison.passed && outputFilesMatch,
			studentOutput: studentOut,
			solutionOutput: solutionOut,
			studentStderr: studentErr,
			solutionStderr: solutionErr,
			studentExitCode: studentResult.exitCode,
			solutionExitCode: solutionResult.exitCode,
			outputMatch: runnerComparison.outputMatch,
			stderrMatch: runnerComparison.stderrMatch,
			exitCodeMatch: runnerComparison.exitCodeMatch,
			outputFiles: outputFilesResult,
			outputFilesMatch
		};
	} finally {
		// Clean up
		await Promise.all([
			removeRecursive(studentTmpdir),
			removeRecursive(solutionTmpdir)
		]);
	}
}

/**
 * Check if script contains specific code patterns
 * @param {string} scriptPath - Path to script file
 * @param {Array} rules - Array of regex rules to check
 * @returns {Promise<Object>} Check results
 */
async function checkCodeRules(scriptPath, rules) {
	const content = await fs.readFile(scriptPath, 'utf8');
	const { Worker } = require('node:worker_threads');
	return new Promise((resolve, reject) => {
		const worker = new Worker(path.join(__dirname, '../workers/codeRuleWorker.js'), {
			workerData: { content, rules }, resourceLimits: { maxOldGenerationSizeMb: 128 }
		});
		let settled = false;
		const finish = (error, results) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			worker.terminate();
			if (error) reject(error);
			else resolve(results);
		};
		const timer = setTimeout(() => finish(new Error('Code rule evaluation timed out')), 2000);
		worker.on('message', message => finish(message.error ? new Error(message.error) : null, message.results));
		worker.on('error', error => finish(error));
		worker.on('exit', code => {
			if (code !== 0) finish(new Error(`Code rule worker exited with status ${code}`));
		});
	});
}

/**
 * Grade a single student submission
 * @param {string} submissionDir - Directory containing student's scripts
 * @param {Object} gradingConfig - Grading configuration
 * @returns {Promise<Object>} Grading result
 */
async function gradeSubmission(submissionDir, gradingConfig) {
	const results = {
		studentId: path.basename(submissionDir),
		tasks: [],
		totalPoints: 0,
		maxPoints: 0
	};

	for (const task of gradingConfig.tasks) {
		const taskResult = {
			name: task.name,
			scriptName: task.scriptName,
			actualScriptName: null, // Will store the actual filename found
			tests: [],
			codeChecks: [],
			points: 0,
			maxPoints: 0
		};

		let studentScriptPath = path.join(submissionDir, task.scriptName);

		// Check if script exists with exact name
		if (!fsSync.existsSync(studentScriptPath)) {
			// Try to find any .sh file in the directory
			try {
				const files = await fs.readdir(submissionDir);
				const shFiles = files.filter(f => f.endsWith('.sh'));

				if (shFiles.length === 0) {
					taskResult.error = `Script file not found. No .sh files in directory. Available files: ${files.join(', ') || 'none'}`;
					results.tasks.push(taskResult);
					continue;
				} else if (shFiles.length === 1) {
					// Only one .sh file, use it
					studentScriptPath = path.join(submissionDir, shFiles[0]);
					taskResult.actualScriptName = shFiles[0];
				} else {
					// Multiple .sh files, try to find best match
					const exactMatch = shFiles.find(f => f === task.scriptName);
					const partialMatch = shFiles.find(f => f.toLowerCase().includes(task.scriptName.replace('.sh', '').toLowerCase()));

					if (exactMatch) {
						studentScriptPath = path.join(submissionDir, exactMatch);
						taskResult.actualScriptName = exactMatch;
					} else if (partialMatch) {
						studentScriptPath = path.join(submissionDir, partialMatch);
						taskResult.actualScriptName = partialMatch;
					} else {
						// Use the first .sh file found
						studentScriptPath = path.join(submissionDir, shFiles[0]);
						taskResult.actualScriptName = shFiles[0];
					}
				}
			} catch (error) {
				taskResult.error = `Failed to read directory: ${error.message}`;
				results.tasks.push(taskResult);
				continue;
			}
		} else {
			taskResult.actualScriptName = task.scriptName;
		}

		// Run output comparison tests
		if (task.tests && task.tests.length > 0) {
			for (const test of task.tests) {
				try {
					const comparison = await compareScriptOutputs(
						studentScriptPath,
						test.solutionScriptPath,
						test.arguments || [],
						test.inputs || [],
						test.fixtures || [],
						test.fixturePermissions || {},
						test.expectedOutputFiles || []
					);

					const testPassed = comparison.passed;
					const testPoints = testPassed ? test.points : 0;

					taskResult.tests.push({
						description: test.description,
						passed: testPassed,
						points: testPoints,
						maxPoints: test.points,
						studentOutput: comparison.studentOutput,
						solutionOutput: comparison.solutionOutput,
						studentExitCode: comparison.studentExitCode,
						solutionExitCode: comparison.solutionExitCode,
						outputMatch: comparison.outputMatch,
						exitCodeMatch: comparison.exitCodeMatch,
						outputFiles: comparison.outputFiles || [],
						outputFilesMatch: comparison.outputFilesMatch
					});

					taskResult.points += testPoints;
					taskResult.maxPoints += test.points;
				} catch (error) {
					taskResult.tests.push({
						description: test.description,
						passed: false,
						points: 0,
						maxPoints: test.points,
						error: error.message
					});
					taskResult.maxPoints += test.points;
				}
			}
		}

		// Run code pattern checks
		if (task.codeRules && task.codeRules.length > 0) {
			try {
				const codeCheckResults = await checkCodeRules(studentScriptPath, task.codeRules);
				taskResult.codeChecks = codeCheckResults;

				for (const check of codeCheckResults) {
					taskResult.points += check.points;
					taskResult.maxPoints += check.maxPoints;
				}
			} catch (error) {
				taskResult.error = `Code check failed: ${error.message}`;
			}
		}

		results.tasks.push(taskResult);
		results.totalPoints += taskResult.points;
		results.maxPoints += taskResult.maxPoints;
	}

	return results;
}

/**
 * Grade a single script file against all tasks
 * @param {string} scriptPath - Path to the student's script file
 * @param {string} studentId - Student identifier (from filename)
 * @param {string} scriptFilename - Original script filename
 * @param {Object} gradingConfig - Grading configuration
 * @returns {Promise<Object>} Grading result
 */
async function gradeScriptFile(scriptPath, studentId, scriptFilename, gradingConfig) {
	const results = {
		studentId: studentId,
		scriptFilename: scriptFilename,
		tasks: [],
		totalPoints: 0,
		maxPoints: 0
	};

	// Check if script exists
	if (!fsSync.existsSync(scriptPath)) {
		throw new Error('Script file not found');
	}

	// Grade the script against each task
	for (const task of gradingConfig.tasks) {
		const taskResult = {
			name: task.name,
			scriptName: scriptFilename, // Show actual filename
			tests: [],
			codeChecks: [],
			points: 0,
			maxPoints: 0
		};

		// Run output comparison tests
		if (task.tests && task.tests.length > 0) {
			for (const test of task.tests) {
				try {
					const comparison = await compareScriptOutputs(
						scriptPath,
						test.solutionScriptPath,
						test.arguments || [],
						test.inputs || [],
						test.fixtures || [],
						test.fixturePermissions || {},
						test.expectedOutputFiles || []
					);

					const testPassed = comparison.passed;
					const testPoints = testPassed ? test.points : 0;

					taskResult.tests.push({
						description: test.description,
						passed: testPassed,
						points: testPoints,
						maxPoints: test.points,
						studentOutput: comparison.studentOutput,
						solutionOutput: comparison.solutionOutput,
						studentExitCode: comparison.studentExitCode,
						solutionExitCode: comparison.solutionExitCode,
						outputMatch: comparison.outputMatch,
						exitCodeMatch: comparison.exitCodeMatch,
						outputFiles: comparison.outputFiles || [],
						outputFilesMatch: comparison.outputFilesMatch
					});

					taskResult.points += testPoints;
					taskResult.maxPoints += test.points;
				} catch (error) {
					taskResult.tests.push({
						description: test.description,
						passed: false,
						points: 0,
						maxPoints: test.points,
						error: error.message
					});
					taskResult.maxPoints += test.points;
				}
			}
		}

		// Run code pattern checks
		if (task.codeRules && task.codeRules.length > 0) {
			try {
				const codeCheckResults = await checkCodeRules(scriptPath, task.codeRules);
				taskResult.codeChecks = codeCheckResults;

				// Add points from code checks
				codeCheckResults.forEach(check => {
					taskResult.points += check.points;
					taskResult.maxPoints += check.maxPoints;
				});
			} catch (error) {
				taskResult.error = `Code check failed: ${error.message}`;
			}
		}

		results.tasks.push(taskResult);
		results.totalPoints += taskResult.points;
		results.maxPoints += taskResult.maxPoints;
	}

	return results;
}

/**
 * Grade all submissions in a zip file
 * @param {Buffer} zipBuffer - Zip file containing submissions
 * @param {Object} gradingConfig - Grading configuration
 * @returns {Promise<Object>} Grading results for all submissions
 */
async function gradeExamSubmissions(zipBuffer, gradingConfig) {
	const tempDir = await createTempDirectory('exam-grading-');
	const solutionScripts = {};

	try {
		// First, save all solution scripts to temp files
		for (let i = 0; i < gradingConfig.tasks.length; i++) {
			const task = gradingConfig.tasks[i];
			if (task.solutionScriptContent) {
				const solutionPath = path.join(tempDir, `solution_${i}.sh`);
				await fs.writeFile(solutionPath, task.solutionScriptContent, 'utf8');
				solutionScripts[i] = solutionPath;

				// Update the task's solution path and its tests
				task.solutionScriptPath = solutionPath;
				if (task.tests) {
					task.tests.forEach(test => {
						test.solutionScriptPath = solutionPath;
					});
				}
			}
		}

		// Extract zip file
		console.log('[ExamGrader] Extracting ZIP file to:', tempDir);
		await extractZip(zipBuffer, tempDir);

		// Scan every directory, including mixed root and nested submissions.
		const scriptFiles = await scanSubmissionFiles(tempDir, true);

		if (scriptFiles.length === 0) {
			throw new Error('No .sh script files found in the ZIP file');
		}

		// Grade each script file
		const results = [];
		for (const scriptFile of scriptFiles) {
			try {
				// Extract student ID from filename (remove .sh extension)
				const studentId = scriptFile.filename.replace(/\.sh$/, '');

				const result = await gradeScriptFile(scriptFile.path, studentId, scriptFile.filename, gradingConfig);
				results.push(result);
			} catch (error) {
				results.push({
					studentId: scriptFile.filename.replace(/\.sh$/, ''),
					scriptFilename: scriptFile.filename,
					error: error.message,
					totalPoints: 0,
					maxPoints: 0,
					tasks: []
				});
			}
		}

		return {
			submissions: results,
			summary: {
				totalSubmissions: results.length,
				averageScore: results.reduce((sum, r) => sum + (r.maxPoints > 0 ? (r.totalPoints / r.maxPoints) * 100 : 0), 0) / results.length,
				maxPossiblePoints: gradingConfig.tasks.reduce((sum, t) => {
					const taskMax = (t.tests || []).reduce((s, test) => s + test.points, 0) +
									(t.codeRules || []).reduce((s, rule) => s + rule.points, 0);
					return sum + taskMax;
				}, 0)
			}
		};
	} finally {
		// Clean up temp directory
		await removeRecursive(tempDir);
	}
}

module.exports = {
	extractZip,
	inspectZip,
	scanSubmissionFiles,
	compareScriptOutputs,
	checkCodeRules,
	gradeSubmission,
	gradeExamSubmissions
};
