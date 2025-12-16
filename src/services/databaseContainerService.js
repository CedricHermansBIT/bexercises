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

		docker.on('close', (code) => {
			if (code !== 0) {
				reject(new Error(`Failed to start MariaDB container: ${stderr}`));
				return;
			}

			const containerId = stdout.trim();
			console.log(`[MariaDB] Container started: ${containerId}`);

			// Wait for database to be ready
			setTimeout(() => {
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
			}, 3000); // Wait 3 seconds for MariaDB to initialize
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

		docker.on('close', (code) => {
			if (code !== 0) {
				reject(new Error(`Failed to start MongoDB container: ${stderr}`));
				return;
			}

			const containerId = stdout.trim();
			console.log(`[MongoDB] Container started: ${containerId}`);

			// Wait for database to be ready
			setTimeout(() => {
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
			}, 3000); // Wait 3 seconds for MongoDB to initialize
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
	
	return new Promise((resolve) => {
		const dockerArgs = [
			'exec', containerInfo.containerName,
			'mariadb',
			'-u', 'root',
			`-p${containerInfo.password}`,
			containerInfo.database,
			'-e', query
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
