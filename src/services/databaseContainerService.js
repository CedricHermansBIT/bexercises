// src/services/databaseContainerService.js
const { spawn } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const config = require('../config');
const { getContainerCommand } = require('./dockerService');

/**
 * Start a MariaDB container with optional fixture loading
 * @param {string} tmpdir - Temporary directory for database files
 * @param {Array<string>} fixtures - SQL fixture files to load
 * @returns {Promise<Object>} Container info {containerId, host, port, cleanup}
 */
async function startMariaDBContainer(tmpdir, fixtures = []) {
	const containerName = `bex-mariadb-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
	const password = 'testpass';
	const database = 'testdb';
	const containerCmd = getContainerCommand();

	console.log(`[MariaDB] Starting container: ${containerName} using ${containerCmd}`);

	// Copy fixture files to tmpdir if provided
	const initSqlPath = path.join(tmpdir, 'init.sql');
	if (fixtures.length > 0) {
		let initSql = `CREATE DATABASE IF NOT EXISTS ${database};\nUSE ${database};\n\n`;
		
		for (const fixtureName of fixtures) {
			const fixturePath = path.join(config.paths.fixtures, fixtureName);
			if (fsSync.existsSync(fixturePath)) {
				const content = await fs.readFile(fixturePath, 'utf8');
				initSql += `-- Fixture: ${fixtureName}\n${content}\n\n`;
			}
		}
		
		await fs.writeFile(initSqlPath, initSql);
		console.log(`[MariaDB] Created init.sql with ${fixtures.length} fixtures`);
	} else {
		// Create empty database
		await fs.writeFile(initSqlPath, `CREATE DATABASE IF NOT EXISTS ${database};\nUSE ${database};\n`);
	}

	// Start MariaDB container
	const dockerArgs = [
		'run', '-d',
		'--name', containerName,
		'--network', 'none',
		'-e', `MYSQL_ROOT_PASSWORD=${password}`,
		'-e', `MYSQL_DATABASE=${database}`,
		'-v', `${tmpdir}:/docker-entrypoint-initdb.d:ro`,
		'mariadb:latest'
	];

	return new Promise((resolve, reject) => {
		const docker = spawn(containerCmd, dockerArgs);
		let stdout = '';
		let stderr = '';

		docker.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		docker.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		// This 'close' event fires when the 'docker run' command completes (immediately with -d flag)
		// The container itself continues running in the background
		docker.on('close', async (code) => {
			if (code !== 0) {
				reject(new Error(`Failed to start MariaDB container: ${stderr}`));
				return;
			}

			const containerId = stdout.trim();
			console.log(`[MariaDB] Container started: ${containerId}`);
			console.log(`[MariaDB] Waiting for database to be ready...`);

			// Manual retry loop - simpler and more reliable than --wait
			const maxRetries = 40;
			const retryDelay = 2000; // 2 seconds between attempts
			let ready = false;
			let lastError = '';

			// Determine which admin command to use
			let adminCmd = 'mariadb-admin';
			await new Promise((resolve) => {
				const check = spawn(containerCmd, ['exec', containerName, 'which', 'mariadb-admin']);
				check.on('close', (code) => {
					if (code !== 0) {
						adminCmd = 'mysqladmin'; // Fallback to mysqladmin
					}
					resolve();
				});
			});

			console.log(`[MariaDB] Using ${adminCmd} for health checks`);

			// First, wait for the container to be minimally ready
			for (let attempt = 0; attempt < maxRetries && !ready; attempt++) {
				// Wait before checking (except first attempt after 2 second initial delay)
				if (attempt === 0) {
					await new Promise(res => setTimeout(res, 2000));
				} else {
					await new Promise(res => setTimeout(res, retryDelay));
				}

				const pingResult = await new Promise((pingResolve) => {
					const pingArgs = [
						'exec', containerName,
						adminCmd,
						'ping',
						'-u', 'root',
						`-p${password}`
					];

					const pingDocker = spawn(containerCmd, pingArgs);
					let pingStdout = '';
					let pingStderr = '';

					pingDocker.stdout.on('data', (data) => {
						pingStdout += data.toString();
					});

					pingDocker.stderr.on('data', (data) => {
						pingStderr += data.toString();
					});

					pingDocker.on('close', (pingCode) => {
						pingResolve({ stdout: pingStdout, stderr: pingStderr, exitCode: pingCode });
					});

					pingDocker.on('error', (err) => {
						pingResolve({ stdout: '', stderr: err.message, exitCode: -1 });
					});
				});

				if (pingResult.exitCode === 0) {
					ready = true;
					const totalTime = 2 + (attempt * (retryDelay / 1000));
					console.log(`[MariaDB] Database is ready after ${totalTime} seconds!`);
					break;
				} else {
					lastError = pingResult.stderr || pingResult.stdout;
					if (attempt % 5 === 0) { // Log every 5th attempt to reduce noise
						console.log(`[MariaDB] Not ready yet (attempt ${attempt + 1}/${maxRetries})...`);
					}
				}
			}

			if (!ready) {
				console.error(`[MariaDB] Failed to become ready after ${maxRetries} attempts`);
				console.error(`[MariaDB] Last error: ${lastError}`);
				console.error(`[MariaDB] Showing container logs for debugging:`);

				// Show container logs to help debug
				const logsResult = await new Promise((logsResolve) => {
					const logsDocker = spawn(containerCmd, ['logs', containerName]);
					let logs = '';
					logsDocker.stdout.on('data', (data) => logs += data.toString());
					logsDocker.stderr.on('data', (data) => logs += data.toString());
					logsDocker.on('close', () => logsResolve(logs));
				});
				console.error(logsResult);

				// Clean up the container
				await new Promise((res) => {
					const stop = spawn(containerCmd, ['rm', '-f', containerName]);
					stop.on('close', () => res());
				});
				reject(new Error(`MariaDB container failed to become ready. Last error: ${lastError}`));
				return;
			}

			// Verify that we can actually query the database (test for permission issues)
			console.log(`[MariaDB] Verifying database permissions...`);
			const verifyResult = await new Promise((verifyResolve) => {
				const verifyArgs = [
					'exec', containerName,
					'mariadb',
					'-u', 'root',
					`-p${password}`,
					database,
					'-e', 'SELECT 1 AS test;'
				];

				const verifyDocker = spawn(containerCmd, verifyArgs);
				let verifyStdout = '';
				let verifyStderr = '';

				verifyDocker.stdout.on('data', (data) => {
					verifyStdout += data.toString();
				});

				verifyDocker.stderr.on('data', (data) => {
					verifyStderr += data.toString();
				});

				verifyDocker.on('close', (verifyCode) => {
					verifyResolve({ stdout: verifyStdout, stderr: verifyStderr, exitCode: verifyCode });
				});

				verifyDocker.on('error', (err) => {
					verifyResolve({ stdout: '', stderr: err.message, exitCode: -1 });
				});
			});

			if (verifyResult.exitCode !== 0) {
				console.error(`[MariaDB] Permission verification failed!`);
				console.error(`[MariaDB] stderr: ${verifyResult.stderr}`);
				console.error(`[MariaDB] stdout: ${verifyResult.stdout}`);
				console.error(`[MariaDB] This indicates a permission or authentication issue.`);

				// Show container logs
				const logsResult = await new Promise((logsResolve) => {
					const logsDocker = spawn(containerCmd, ['logs', containerName]);
					let logs = '';
					logsDocker.stdout.on('data', (data) => logs += data.toString());
					logsDocker.stderr.on('data', (data) => logs += data.toString());
					logsDocker.on('close', () => logsResolve(logs));
				});
				console.error(`[MariaDB] Container logs:\n${logsResult}`);

				// Clean up
				await new Promise((res) => {
					const stop = spawn(containerCmd, ['rm', '-f', containerName]);
					stop.on('close', () => res());
				});
				reject(new Error(`MariaDB permission verification failed: ${verifyResult.stderr}`));
				return;
			}

			console.log(`[MariaDB] Permission verification successful!`);


			resolve({
				containerId,
				containerName,
				database,
				password,
				cleanup: async () => {
					console.log(`[MariaDB] Stopping container: ${containerName}`);
					return new Promise((res) => {
						const stop = spawn(containerCmd, ['rm', '-f', containerName]);
						stop.on('close', () => res());
					});
				}
			});
		});

		docker.on('error', reject);
	});
}

/**
 * Start a MongoDB container with optional fixture loading
 * @param {string} tmpdir - Temporary directory for database files
 * @param {Array<string>} fixtures - JavaScript fixture files to load
 * @returns {Promise<Object>} Container info {containerId, host, port, cleanup}
 */
async function startMongoDBContainer(tmpdir, fixtures = []) {
	const containerName = `bex-mongo-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
	const database = 'testdb';
	const containerCmd = getContainerCommand();

	console.log(`[MongoDB] Starting container: ${containerName} using ${containerCmd}`);

	// Copy fixture files to tmpdir if provided
	if (fixtures.length > 0) {
		const initJsPath = path.join(tmpdir, 'init.js');
		let initJs = `use ${database};\n\n`;
		
		for (const fixtureName of fixtures) {
			const fixturePath = path.join(config.paths.fixtures, fixtureName);
			if (fsSync.existsSync(fixturePath)) {
				const content = await fs.readFile(fixturePath, 'utf8');
				initJs += `// Fixture: ${fixtureName}\n${content}\n\n`;
			}
		}
		
		await fs.writeFile(initJsPath, initJs);
		console.log(`[MongoDB] Created init.js with ${fixtures.length} fixtures`);
	}

	// Start MongoDB container
	const dockerArgs = [
		'run', '-d',
		'--name', containerName,
		'--network', 'none',
		'-v', `${tmpdir}:/docker-entrypoint-initdb.d:ro`,
		'mongo:latest'
	];

	return new Promise((resolve, reject) => {
		const docker = spawn(containerCmd, dockerArgs);
		let stdout = '';
		let stderr = '';

		docker.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		docker.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		docker.on('close', async (code) => {
			if (code !== 0) {
				reject(new Error(`Failed to start MongoDB container: ${stderr}`));
				return;
			}

			const containerId = stdout.trim();
			console.log(`[MongoDB] Container started: ${containerId}`);

			// Use a simple retry loop with mongosh ping - MongoDB doesn't have a built-in wait like MariaDB
			console.log(`[MongoDB] Waiting for database to be ready...`);

			const maxRetries = 30;
			let ready = false;

			for (let i = 0; i < maxRetries && !ready; i++) {
				await new Promise(res => setTimeout(res, 2000)); // Wait 2 seconds between attempts

				const pingResult = await new Promise((pingResolve) => {
					const pingArgs = [
						'exec', containerName,
						'mongosh',
						'--quiet',
						'--eval', 'db.runCommand({ ping: 1 }).ok'
					];

					const pingDocker = spawn(containerCmd, pingArgs);
					let pingStdout = '';
					let pingStderr = '';

					pingDocker.stdout.on('data', (data) => {
						pingStdout += data.toString();
					});

					pingDocker.stderr.on('data', (data) => {
						pingStderr += data.toString();
					});

					pingDocker.on('close', (pingCode) => {
						pingResolve({ stdout: pingStdout, stderr: pingStderr, exitCode: pingCode });
					});

					pingDocker.on('error', () => {
						pingResolve({ stdout: '', stderr: '', exitCode: -1 });
					});
				});

				// MongoDB ping returns "1" when ready
				if (pingResult.exitCode === 0 && pingResult.stdout.trim() === '1') {
					ready = true;
					console.log(`[MongoDB] Database is ready after ${(i + 1) * 2} seconds`);
				}
			}

			if (!ready) {
				console.error(`[MongoDB] Failed to become ready within timeout`);
				// Clean up the container
				await new Promise((res) => {
					const stop = spawn(containerCmd, ['rm', '-f', containerName]);
					stop.on('close', () => res());
				});
				reject(new Error('MongoDB container failed to become ready in time'));
				return;
			}

			resolve({
				containerId,
				containerName,
				database,
				cleanup: async () => {
					console.log(`[MongoDB] Stopping container: ${containerName}`);
					return new Promise((res) => {
						const stop = spawn(containerCmd, ['rm', '-f', containerName]);
						stop.on('close', () => res());
					});
				}
			});
		});

		docker.on('error', reject);
	});
}

/**
 * Execute SQL query in a running MariaDB container
 * @param {Object} containerInfo - Container info from startMariaDBContainer
 * @param {string} query - SQL query to execute
 * @returns {Promise<Object>} Query result {stdout, stderr, exitCode}
 */
async function executeMariaDBQuery(containerInfo, query) {
	const containerCmd = getContainerCommand();
	
	console.log(`[MariaDB] Executing query: ${query.substring(0, 150)}...`);
	console.log(`[MariaDB] Target database: ${containerInfo.database}`);

	return new Promise((resolve) => {
		// Use the database name as argument which is more reliable than USE statement
		const dockerArgs = [
			'exec', containerInfo.containerName,
			'mariadb',
			'-u', 'root',
			`-p${containerInfo.password}`,
			containerInfo.database,
			'-e', query
		];

		console.log(`[MariaDB] Command: mariadb -u root -p*** ${containerInfo.database} -e "${query.substring(0, 50)}..."`);

		const docker = spawn(containerCmd, dockerArgs);
		let stdout = '';
		let stderr = '';

		docker.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		docker.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		docker.on('close', (code) => {
			if (code !== 0) {
				console.error(`[MariaDB] Query failed with exit code ${code}`);
				console.error(`[MariaDB] stderr: ${stderr}`);
				console.error(`[MariaDB] stdout: ${stdout}`);
			} else {
				console.log(`[MariaDB] Query successful, output length: ${stdout.length}`);
			}

			resolve({
				stdout,
				stderr,
				exitCode: code
			});
		});

		docker.on('error', (err) => {
			console.error(`[MariaDB] Query error: ${err.message}`);
			resolve({
				stdout,
				stderr: err.message,
				exitCode: -1
			});
		});
	});
}

/**
 * Execute MongoDB query in a running MongoDB container
 * @param {Object} containerInfo - Container info from startMongoDBContainer
 * @param {string} query - MongoDB query to execute
 * @returns {Promise<Object>} Query result {stdout, stderr, exitCode}
 */
async function executeMongoDBQuery(containerInfo, query) {
	const containerCmd = getContainerCommand();
	
	return new Promise((resolve) => {
		const dockerArgs = [
			'exec', containerInfo.containerName,
			'mongosh',
			containerInfo.database,
			'--quiet',
			'--eval', query
		];

		const docker = spawn(containerCmd, dockerArgs);
		let stdout = '';
		let stderr = '';

		docker.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		docker.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		docker.on('close', (code) => {
			resolve({
				stdout,
				stderr,
				exitCode: code
			});
		});

		docker.on('error', (err) => {
			resolve({
				stdout,
				stderr: err.message,
				exitCode: -1
			});
		});
	});
}

module.exports = {
	startMariaDBContainer,
	startMongoDBContainer,
	executeMariaDBQuery,
	executeMongoDBQuery
};
