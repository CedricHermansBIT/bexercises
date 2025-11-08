// src/services/examGraderService.js
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const config = require('../config');
const { createTempScript, runScriptInContainer, removeRecursive, normalizeOutput, copyFixtures, hashOutputFiles } = require('./dockerService');

/**
 * Extract a zip file to a directory using the existing Docker infrastructure
 * @param {Buffer} zipBuffer - The zip file buffer
 * @param {string} targetDir - Directory to extract to
 * @returns {Promise<string[]>} List of extracted file names
 */
async function extractZip(zipBuffer, targetDir) {
	const zipPath = path.join(targetDir, 'upload.zip');
	await fs.writeFile(zipPath, zipBuffer);

	// Create a simple script to unzip and list files with details
	const unzipScript = `#!/bin/bash
echo "Unzipping file..."
unzip -o upload.zip 2>&1
echo "Files extracted:"
find . -type f -name "*.sh" 2>&1
ls -la
`;

	const { tmpdir } = await createTempScript(unzipScript);

	try {
		// Copy the zip file to the temp directory
		const zipDestPath = path.join(tmpdir, 'upload.zip');
		await fs.copyFile(zipPath, zipDestPath);

		console.log('[ExamGrader] Running unzip in Docker container...');
		// Run the unzip script using existing Docker infrastructure
		const result = await runScriptInContainer(tmpdir, [], [], config.docker.timeout);

		console.log('[ExamGrader] Unzip output:', result.stdout);
		console.log('[ExamGrader] Unzip stderr:', result.stderr);

		if (result.exitCode !== 0) {
			throw new Error(`Unzip failed with exit code ${result.exitCode}: ${result.stderr}`);
		}

		// Copy all extracted files from tmpdir to targetDir
		console.log('[ExamGrader] Copying files from tmpdir to targetDir...');
		const entries = await fs.readdir(tmpdir);
		console.log('[ExamGrader] Entries in tmpdir:', entries);

		let copiedCount = 0;
		for (const entry of entries) {
			if (entry !== 'script.sh' && entry !== 'upload.zip') {
				const srcPath = path.join(tmpdir, entry);
				const destPath = path.join(targetDir, entry);
				const stat = await fs.stat(srcPath);

				if (stat.isDirectory()) {
					// Recursively copy directory
					console.log('[ExamGrader] Copying directory:', entry);
					await copyDirectory(srcPath, destPath);
				} else {
					console.log('[ExamGrader] Copying file:', entry);
					await fs.copyFile(srcPath, destPath);
					copiedCount++;
				}
			}
		}

		console.log('[ExamGrader] Copied', copiedCount, 'files to', targetDir);

		// Remove the original zip file from target directory
		await fs.unlink(zipPath).catch(() => {});

		// List files in the target directory to verify
		const finalFiles = await fs.readdir(targetDir);
		console.log('[ExamGrader] Files in targetDir after extraction:', finalFiles);

		return finalFiles.filter(f => f.endsWith('.sh') && !f.startsWith('solution_'));
	} finally {
		await removeRecursive(tmpdir);
	}
}

/**
 * Recursively copy a directory
 */
async function copyDirectory(src, dest) {
	await fs.mkdir(dest, { recursive: true });
	const entries = await fs.readdir(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			await copyDirectory(srcPath, destPath);
		} else {
			await fs.copyFile(srcPath, destPath);
		}
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
	const { tmpdir: studentTmpdir } = await createTempScript(studentContent);
	const { tmpdir: solutionTmpdir } = await createTempScript(solutionContent);

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
			runScriptInContainer(studentTmpdir, args, inputs, config.docker.timeout),
			runScriptInContainer(solutionTmpdir, args, inputs, config.docker.timeout)
		]);

		const studentOut = normalizeOutput(studentResult.stdout).trim();
		const solutionOut = normalizeOutput(solutionResult.stdout).trim();
		const studentErr = normalizeOutput(studentResult.stderr).trim();
		const solutionErr = normalizeOutput(solutionResult.stderr).trim();

		const outputMatch = studentOut === solutionOut;
		const exitCodeMatch = studentResult.exitCode === solutionResult.exitCode;

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
				const hashMatches = studentFile.exists && solutionFile.exists &&
								   studentFile.sha256 === solutionFile.sha256;

				if (!hashMatches) {
					outputFilesMatch = false;
				}

				return {
					filename: studentFile.filename,
					studentExists: studentFile.exists,
					solutionExists: solutionFile ? solutionFile.exists : false,
					studentHash: studentFile.sha256,
					solutionHash: solutionFile ? solutionFile.sha256 : null,
					hashMatches,
					studentSize: studentFile.size,
					solutionSize: solutionFile ? solutionFile.size : null,
					error: studentFile.error || (solutionFile ? solutionFile.error : null)
				};
			});
		}

		return {
			passed: outputMatch && exitCodeMatch && outputFilesMatch,
			studentOutput: studentOut,
			solutionOutput: solutionOut,
			studentStderr: studentErr,
			solutionStderr: solutionErr,
			studentExitCode: studentResult.exitCode,
			solutionExitCode: solutionResult.exitCode,
			outputMatch,
			exitCodeMatch,
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
	const results = [];

	for (const rule of rules) {
		const regex = new RegExp(rule.pattern, rule.flags || '');
		const match = regex.test(content);
		results.push({
			description: rule.description,
			pattern: rule.pattern,
			passed: match,
			points: match ? rule.points : 0,
			maxPoints: rule.points
		});
	}

	return results;
}

/**
 * Grade a single student submission
 * @param {string} submissionDir - Directory containing student's scripts
 * @param {Object} config - Grading configuration
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
	const tempDir = await fs.mkdtemp(path.join(config.paths.temp, 'exam-grading-'));
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

		// Find all .sh script files in the extracted directory (each file = one student)
		console.log('[ExamGrader] Looking for .sh files in:', tempDir);
		const entries = await fs.readdir(tempDir);
		console.log('[ExamGrader] Entries found:', entries);
		const scriptFiles = [];

		for (const entry of entries) {
			const fullPath = path.join(tempDir, entry);

			// Skip solution script files
			if (entry.startsWith('solution_')) {
				console.log('[ExamGrader] Skipping solution file:', entry);
				continue;
			}

			const stat = await fs.stat(fullPath);

			// Look for .sh files (each file is a student submission)
			if (stat.isFile() && entry.endsWith('.sh')) {
				console.log('[ExamGrader] Found script file:', entry);
				scriptFiles.push({
					filename: entry,
					path: fullPath
				});
			}
		}

		console.log('[ExamGrader] Found', scriptFiles.length, '.sh files at root level');

		// If no .sh files found directly, check subdirectories
		if (scriptFiles.length === 0) {
			console.log('[ExamGrader] No .sh files at root, checking subdirectories...');
			for (const entry of entries) {
				const fullPath = path.join(tempDir, entry);

				// Skip solution script files
				if (entry.startsWith('solution_')) {
					continue;
				}

				const stat = await fs.stat(fullPath);
				if (stat.isDirectory()) {
					console.log('[ExamGrader] Checking subdirectory:', entry);
					const subEntries = await fs.readdir(fullPath);
					console.log('[ExamGrader] Files in', entry, ':', subEntries);
					for (const subEntry of subEntries) {
						if (subEntry.endsWith('.sh')) {
							console.log('[ExamGrader] Found script in subdirectory:', `${entry}/${subEntry}`);
							scriptFiles.push({
								filename: `${entry}/${subEntry}`,
								path: path.join(fullPath, subEntry)
							});
						}
					}
				}
			}
		}

		console.log('[ExamGrader] Total script files found:', scriptFiles.length);

		if (scriptFiles.length === 0) {
			throw new Error('No .sh script files found in the ZIP file. Extracted files: ' + entries.join(', '));
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
	compareScriptOutputs,
	checkCodeRules,
	gradeSubmission,
	gradeExamSubmissions
};

