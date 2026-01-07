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
 * @param {string} dockerImage - Docker image to use (default: mariadb:latest)
 * @returns {Promise<Object>} Container info {containerId, host, port, cleanup}
 */
async function startMariaDBContainer(tmpdir, fixtures = [], dockerImage = 'mariadb:latest') {
    const containerName = `bex-mariadb-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const password = 'testpass';
    const database = 'testdb';
    const containerCmd = getContainerCommand();

    console.log(`[MariaDB] Starting container: ${containerName} using ${containerCmd} with image ${dockerImage}`);

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
        dockerImage
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

            // Wait for initialization to complete by checking logs
            // The container runs init scripts first with a temporary server, then starts the real server
            console.log(`[MariaDB] Waiting for initialization to complete...`);
            let initComplete = false;

            for (let i = 0; i < 30 && !initComplete; i++) {
                await new Promise(res => setTimeout(res, 1000));

                // Check if container is still running (it may have stopped due to SQL error in init scripts)
                const stateCheck = await new Promise((stateResolve) => {
                    const inspectDocker = spawn(containerCmd, ['inspect', '--format', '{{.State.Running}}', containerName]);
                    let stateOutput = '';
                    inspectDocker.stdout.on('data', (data) => stateOutput += data.toString());
                    inspectDocker.on('close', (code) => stateResolve({ running: stateOutput.trim() === 'true', code }));
                });

                if (!stateCheck.running) {
                    // Container stopped - likely due to init script error
                    const logsResult = await new Promise((logsResolve) => {
                        const logsDocker = spawn(containerCmd, ['logs', containerName]);
                        let logs = '';
                        logsDocker.stdout.on('data', (data) => logs += data.toString());
                        logsDocker.stderr.on('data', (data) => logs += data.toString());
                        logsDocker.on('close', () => logsResolve(logs));
                    });

                    // Extract SQL error from logs
                    const errorMatch = logsResult.match(/ERROR \d+ \(\w+\)[^\n]*/);
                    const errorMsg = errorMatch ? errorMatch[0] : 'Container stopped during initialization';

                    console.error(`[MariaDB] Container stopped during initialization`);
                    console.error(`[MariaDB] Error: ${errorMsg}`);

                    // Clean up
                    await new Promise((res) => {
                        const stop = spawn(containerCmd, ['rm', '-f', containerName]);
                        stop.on('close', () => res());
                    });

                    reject(new Error(`MariaDB initialization failed: ${errorMsg}`));
                    return;
                }

                // Check container logs for completion message
                const logs = await new Promise((logsResolve) => {
                    const logsDocker = spawn(containerCmd, ['logs', containerName]);
                    let logsOutput = '';
                    logsDocker.stdout.on('data', (data) => logsOutput += data.toString());
                    logsDocker.stderr.on('data', (data) => logsOutput += data.toString());
                    logsDocker.on('close', () => logsResolve(logsOutput));
                });

                // Look for the message indicating the real server is ready
                // After init scripts run, it says "Stopping temporary server" then starts the real one
                if (logs.includes('ready for connections') &&
                    logs.includes('Stopping temporary server')) {
                    // Make sure we see "ready for connections" AFTER "Stopping temporary server"
                    const tempServerStop = logs.indexOf('Stopping temporary server');
                    const lastReady = logs.lastIndexOf('ready for connections');
                    if (lastReady > tempServerStop) {
                        initComplete = true;
                        console.log(`[MariaDB] Initialization complete, server is ready`);
                        break;
                    }
                }

                if (i % 5 === 0 && i > 0) {
                    console.log(`[MariaDB] Still initializing... (${i}s)`);
                }
            }

            if (!initComplete) {
                console.warn(`[MariaDB] Initialization check timed out, attempting to connect anyway...`);
            }

            // Now try to connect with ping
            for (let attempt = 0; attempt < 10 && !ready; attempt++) {
                await new Promise(res => setTimeout(res, 1000));

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
                    console.log(`[MariaDB] Successfully connected to database!`);
                    break;
                } else {
                    lastError = pingResult.stderr || pingResult.stdout;
                    console.log(`[MariaDB] Connection attempt ${attempt + 1}/10 failed`);
                }
            }

            if (!ready) {
                console.error(`[MariaDB] Failed to become ready after multiple attempts`);
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
 * @param {string} dockerImage - Docker image to use (default: mongo:latest)
 * @returns {Promise<Object>} Container info {containerId, host, port, cleanup}
 */
async function startMongoDBContainer(tmpdir, fixtures = [], dockerImage = 'mongo:latest') {
    const containerName = `bex-mongo-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const database = 'testdb';
    const containerCmd = getContainerCommand();

    console.log(`[MongoDB] Starting container: ${containerName} using ${containerCmd} with image ${dockerImage}`);

    // Copy fixture files to tmpdir if provided
    if (fixtures.length > 0) {
        const initJsPath = path.join(tmpdir, 'init.js');
        // MongoDB init scripts run in the context of MONGO_INITDB_DATABASE
        // We need to explicitly switch to our test database
        let initJs = `db = db.getSiblingDB('${database}');\n\n`;

        for (const fixtureName of fixtures) {
            const fixturePath = path.join(config.paths.fixtures, fixtureName);
            if (!fsSync.existsSync(fixturePath)) {
                console.warn(`[MongoDB] Fixture file not found: ${fixtureName}`);
                continue;
            }

            const ext = path.extname(fixtureName).toLowerCase();

            if (ext === '.js') {
                // JavaScript file - include directly
                const content = await fs.readFile(fixturePath, 'utf8');
                initJs += `// Fixture: ${fixtureName}\n${content}\n\n`;
            } else if (ext === '.json') {
                // JSON file - parse and generate insert commands
                const content = await fs.readFile(fixturePath, 'utf8');
                try {
                    const jsonData = JSON.parse(content);

                    // Check if it's an object with collection names as keys
                    if (typeof jsonData === 'object' && !Array.isArray(jsonData)) {
                        // Format: { "collectionName": [ {...}, {...} ], "anotherCollection": [ {...} ] }
                        for (const [collectionName, documents] of Object.entries(jsonData)) {
                            if (Array.isArray(documents) && documents.length > 0) {
                                initJs += `// Fixture: ${fixtureName} - Collection: ${collectionName}\n`;
                                initJs += `db.${collectionName}.insertMany(${JSON.stringify(documents, null, 2)});\n\n`;
                            }
                        }
                    } else if (Array.isArray(jsonData)) {
                        // Array of documents - need collection name from filename
                        const collectionName = path.basename(fixtureName, '.json');
                        initJs += `// Fixture: ${fixtureName}\n`;
                        initJs += `db.${collectionName}.insertMany(${JSON.stringify(jsonData, null, 2)});\n\n`;
                    } else {
                        console.warn(`[MongoDB] Unsupported JSON format in ${fixtureName}`);
                    }
                } catch (err) {
                    console.error(`[MongoDB] Failed to parse JSON fixture ${fixtureName}: ${err.message}`);
                }
            } else if (ext === '.bson') {
                // BSON file - copy to tmpdir and use mongorestore
                const bsonDestPath = path.join(tmpdir, fixtureName);
                await fs.copyFile(fixturePath, bsonDestPath);

                // Extract collection name from filename (e.g., "users.bson" -> "users")
                const collectionName = path.basename(fixtureName, '.bson');

                initJs += `// Fixture: ${fixtureName}\n`;
                initJs += `// Note: BSON files are restored using mongorestore in a separate init script\n`;
                initJs += `// This is a placeholder to maintain fixture ordering\n\n`;

                // Create a separate shell script to run mongorestore
                // MongoDB init scripts in /docker-entrypoint-initdb.d can be .sh or .js
                const restoreShPath = path.join(tmpdir, `restore-${collectionName}.sh`);
                const restoreScript = `#!/bin/bash
# Restore BSON fixture: ${fixtureName}
mongorestore --db=${database} --collection=${collectionName} /docker-entrypoint-initdb.d/${fixtureName}
`;
                await fs.writeFile(restoreShPath, restoreScript);
                // Make it executable
                await fs.chmod(restoreShPath, 0o755);

                console.log(`[MongoDB] Created mongorestore script for BSON fixture: ${fixtureName}`);
            } else {
                console.warn(`[MongoDB] Unsupported fixture file type: ${fixtureName} (only .js, .json, and .bson are supported)`);
            }
        }

        await fs.writeFile(initJsPath, initJs);
        console.log(`[MongoDB] Created init.js with ${fixtures.length} fixtures`);
    }

    // Start MongoDB container
    // Note: MONGO_INITDB_DATABASE sets the initial database context for init scripts
    const dockerArgs = [
        'run', '-d',
        '--name', containerName,
        '--network', 'none',
        '-e', `MONGO_INITDB_DATABASE=${database}`,
        '-v', `${tmpdir}:/docker-entrypoint-initdb.d:ro`,
        dockerImage
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

            // Verify that fixtures were loaded by checking if collections exist
            if (fixtures.length > 0) {
                console.log(`[MongoDB] Verifying fixture loading...`);
                const verifyResult = await new Promise((verifyResolve) => {
                    const verifyArgs = [
                        'exec', containerName,
                        'mongosh',
                        database,
                        '--quiet',
                        '--eval', 'db.getCollectionNames()'
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

                if (verifyResult.exitCode === 0) {
                    console.log(`[MongoDB] Collections in database: ${verifyResult.stdout.trim()}`);
                    if (verifyResult.stdout.trim() === '[]' || verifyResult.stdout.trim() === '') {
                        console.warn(`[MongoDB] WARNING: No collections found after fixture loading!`);
                        console.warn(`[MongoDB] This may indicate init scripts didn't run properly.`);

                        // Check container logs for init script execution
                        const logsResult = await new Promise((logsResolve) => {
                            const logsDocker = spawn(containerCmd, ['logs', containerName]);
                            let logs = '';
                            logsDocker.stdout.on('data', (data) => logs += data.toString());
                            logsDocker.stderr.on('data', (data) => logs += data.toString());
                            logsDocker.on('close', () => logsResolve(logs));
                        });
                        console.log(`[MongoDB] Container logs:\n${logsResult}`);
                    }
                } else {
                    console.error(`[MongoDB] Verification failed: ${verifyResult.stderr}`);
                }
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
                exitCode: code,
                timedOut: false,
                error: null
            });
        });

        docker.on('error', (err) => {
            console.error(`[MariaDB] Query error: ${err.message}`);
            resolve({
                stdout,
                stderr: err.message,
                exitCode: -1,
                timedOut: false,
                error: err.message
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
                exitCode: code,
                timedOut: false,
                error: null
            });
        });

        docker.on('error', (err) => {
            resolve({
                stdout,
                stderr: err.message,
                exitCode: -1,
                timedOut: false,
                error: err.message
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
