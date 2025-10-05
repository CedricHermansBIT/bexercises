// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const morgan = require('morgan');

const app = express();
app.use(morgan('combined'));
app.use(bodyParser.json({ limit: '200kb' }));

// CORS middleware
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	if (req.method === 'OPTIONS') {
		return res.sendStatus(200);
	}
	next();
});

// Load exercises (server side). Keep testCases & solutions here.
// Example structure used below; replace with your real data file
const EXERCISES_INTERNAL_PATH = path.join(__dirname, 'exercises-internal.json');

// Config: tweak these to taste / infra
const RUNNER_IMAGE = 'bexercises-runner:latest';
const PER_TEST_TIMEOUT_MS = 30000; // 30s per test (Docker startup can be slow)
const MAX_PARALLEL_TESTS = 4; // for potential future job queue
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

// ---------- Utility helpers ----------
async function loadExercisesInternal() {
	const txt = await fs.readFile(EXERCISES_INTERNAL_PATH, 'utf8');
	return JSON.parse(txt);
}

function normalizeOutput(s) {
	if (s === null || s === undefined) return '';
	// Normalize CRLF to LF
	return s.replace(/\r\n/g, '\n');
}

// ---------- Compatibility helpers ----------
const { promisify } = require('util');
const fsPromises = require('fs').promises;

// cross-version recursive remove helper
async function removeRecursive(targetPath) {
  // prefer fs.rm if available (Node >= 14.14+)
  if (fsPromises.rm) {
    return fsPromises.rm(targetPath, { recursive: true, force: true });
  }
  // fallback to rmdir recursive (older Node) or manual removal
  if (fsPromises.rmdir) {
    try {
      return fsPromises.rmdir(targetPath, { recursive: true });
    } catch (e) {
      // some Node versions throw for rmdir recursive, fall through to manual
    }
  }

  // Manual recursive delete (safe fallback)
  async function _rmDirRecursive(p) {
    const entries = await fsPromises.readdir(p);
    await Promise.all(entries.map(async (entry) => {
      const full = path.join(p, entry);
      const stat = await fsPromises.lstat(full);
      if (stat.isDirectory()) {
        await _rmDirRecursive(full);
      } else {
        await fsPromises.unlink(full);
      }
    }));
    await fsPromises.rmdir(p);
  }

  try {
    await _rmDirRecursive(targetPath);
  } catch (err) {
    // last resort: ignore errors if path no longer exists
    if (err.code !== 'ENOENT') throw err;
  }
}

// createTempScript - robust: if scriptPath exists and is a directory -> remove it
async function createTempScript(scriptContents) {
  // Normalize line endings to LF
  const normalized = String(scriptContents).replace(/\r\n/g, '\n');

  // Create unique temp directory
  const tmpdir = await fsPromises.mkdtemp('/srv/bexercises/tmp/bex-');
  
  // Set tmpdir permissions to allow Docker container access (different UID)
  await fsPromises.chmod(tmpdir, 0o755);
  
  const scriptPath = path.join(tmpdir, 'script.sh');

  // Defensive: if something exists at scriptPath remove it (handle case where it's a dir)
  try {
    if (fsSync.existsSync(scriptPath)) {
      const st = fsSync.lstatSync(scriptPath);
      if (st.isDirectory()) {
        // remove directory (use your removeRecursive helper)
        await removeRecursive(scriptPath);
      } else {
        // remove existing file
        await fsPromises.unlink(scriptPath);
      }
    }
  } catch (err) {
    // Log but continue; cleanup will happen later
    //console.error('Warning while prepping script path:', err && err.message ? err.message : err);
  }

  // Ensure parent directory exists (should exist because mkdtemp created tmpdir)
  await fsPromises.mkdir(path.dirname(scriptPath), { recursive: true });

  // Create the file atomically and write contents
  // Use flag 'w' to create/overwrite safely
  await fsPromises.writeFile(scriptPath, normalized, { encoding: 'utf8', flag: 'w' });

  // Explicitly set executable permissions (writeFile mode is affected by umask)
  // Mode 0o777 ensures all users can read/write/execute (needed for Docker container with different UID)
  await fsPromises.chmod(scriptPath, 0o777);

  // Extra safety: verify it's a file
  const finalStat = fsSync.lstatSync(scriptPath);
  if (!finalStat.isFile()) {
    throw new Error(`Failed to create script file at ${scriptPath} (not a regular file)`);
  }

  //console.error(`Created script file: tmpdir=${tmpdir}, scriptPath=${scriptPath}`);
  return { tmpdir, scriptPath };
}

// Copy fixture files to temp directory
// fixturePermissions is optional: { "filename": 0o755, ... }
async function copyFixtures(tmpdir, fixtures = [], fixturePermissions = {}) {
  const copiedFiles = [];
  //console.error(`copyFixtures called with fixturePermissions:`, JSON.stringify(fixturePermissions));
  for (const fixtureName of fixtures) {
    const sourcePath = path.join(FIXTURES_DIR, fixtureName);
    const destPath = path.join(tmpdir, fixtureName);
    
    try {
      // Check if fixture exists
      if (!fsSync.existsSync(sourcePath)) {
        //console.error(`Warning: fixture ${fixtureName} not found at ${sourcePath}`);
        continue;
      }
      
      // Copy the file
      await fsPromises.copyFile(sourcePath, destPath);
      
      // Set permissions: use explicit permission if provided, otherwise preserve original
      let mode;
      if (fixturePermissions && fixturePermissions[fixtureName] !== undefined) {
        mode = fixturePermissions[fixtureName];
        //console.error(`Using explicit permissions for ${fixtureName}: ${mode} (0o${mode.toString(8)})`);
      } else {
        const stat = await fsPromises.stat(sourcePath);
        mode = stat.mode;
      }
      await fsPromises.chmod(destPath, mode);
      
      copiedFiles.push(fixtureName);
      //console.error(`Copied fixture: ${fixtureName} to ${destPath} with mode ${(mode & 0o777).toString(8)}`);
    } catch (err) {
      //console.error(`Error copying fixture ${fixtureName}:`, err.message);
    }
  }
  return copiedFiles;
}

// Run the script inside a docker container for one test-case.
// Returns { stdout, stderr, exitCode, timedOut, error }
async function runScriptInContainer(tmpdir, args = [], inputs=[], timeoutMs = PER_TEST_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const containerWorkdir = '/home/runner';
    const containerScript = 'script.sh';
    
    // Build the command to execute
    // If we have inputs, pipe them via printf, otherwise just run the script
    let shellCommand;
    if (inputs && Array.isArray(inputs) && inputs.length > 0) {
      // Escape single quotes in the input by replacing ' with '\''
      const escapedInputs = inputs.map(line => line.replace(/'/g, "'\\''"));
      const inputString = escapedInputs.join('\\n') + '\\n';
      // Use printf to handle special characters properly, pipe to the script
      // Use ./ prefix to execute from current directory
      shellCommand = `printf '%b' '${inputString}' | bash ./${containerScript} "$@"`;
    } else {
      // No input - just run the script with empty stdin
      // Use ./ prefix to execute from current directory
      shellCommand = `bash ./${containerScript} "$@" < /dev/null`;
    }
    
    const dockerArgs = [
      'run', '--rm',
      '--network', 'none',
      '--memory', '256m',
      '--pids-limit', '128',
      '-v', `${tmpdir}:${containerWorkdir}:rw`,  // Mount entire tmpdir with write access for output files
      '-w', containerWorkdir,
      '--entrypoint', '/bin/bash',
      RUNNER_IMAGE,
      '-c',
      shellCommand,
      '--',
      ...args
    ];

    // Log the docker command for debugging
    //console.error('Docker command:', dockerArgs.join(' '));
    //console.error('Shell command:', shellCommand);
    //console.error('Args:', args);

    const docker = spawn('docker', dockerArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    
    // Add spawn error logging
    docker.on('spawn', () => {
      //console.error('Docker process spawned successfully');
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    docker.stdout.on('data', (d) => { 
      stdout += d.toString(); 
    });
    
    docker.stderr.on('data', (d) => { 
      stderr += d.toString(); 
    });

    const killTimer = setTimeout(() => {
      timedOut = true;
      try { 
        docker.kill('SIGKILL'); 
      } catch (e) { 
        /* ignore */ 
      }
    }, timeoutMs);

    docker.on('error', (err) => {
      clearTimeout(killTimer);
      resolve({ 
        stdout: normalizeOutput(stdout), 
        stderr: normalizeOutput(stderr), 
        exitCode: null, 
        timedOut, 
        error: err.message 
      });
    });

    docker.on('close', (code, signal) => {
      clearTimeout(killTimer);
      //console.error(`Docker process closed. Code: ${code}, Signal: ${signal}, TimedOut: ${timedOut}`);
      const exitCode = timedOut ? -1 : code;
      resolve({ 
        stdout: normalizeOutput(stdout), 
        stderr: normalizeOutput(stderr), 
        exitCode, 
        timedOut, 
        error: null 
      });
    });
  });
}

// ---------- API ----------
app.get('/api/exercises', async (req, res) => {
	const all = await loadExercisesInternal();
	// Remove sensitive fields before exposing to clients
	const stripped = all.map(ex => ({
		id: ex.id,
		title: ex.title,
		description: ex.description,
		solution: ex.solution,
		chapter: ex.chapter,
		order: ex.order
	}));
	res.json(stripped);
});

app.get('/api/exercises/:id', async (req, res) => {
	const id = req.params.id;
	const all = await loadExercisesInternal();
	const ex = all.find(e => e.id === id);
	if (!ex) return res.status(404).json({ error: 'not found' });
	// Do NOT return solution or testCases
	res.json({
		id: ex.id,
		title: ex.title,
		description: ex.description,
		solution: ex.solution
	});
});

// Run tests for an exercise
// Body: { script: "..." }
app.post('/api/exercises/:id/run', async (req, res) => {
	try {
		const id = req.params.id;
		const body = req.body;
		if (!body || typeof body.script !== 'string') {
			return res.status(400).json({ error: 'Missing script in request body' });
		}

		const all = await loadExercisesInternal();
		const ex = all.find(e => e.id === id);
		if (!ex) return res.status(404).json({ error: 'exercise not found' });

		// Create temp script
		const { tmpdir, scriptPath } = await createTempScript(body.script);
		//console.log(scriptPath)
		// For each test case, run script in container with arguments
		const results = [];
		for (let i = 0; i < ex.testCases.length; i++) {
			const tc = ex.testCases[i];
			
			// Copy any fixtures needed for this test case
			if (tc.fixtures && Array.isArray(tc.fixtures)) {
				await copyFixtures(tmpdir, tc.fixtures, tc.fixturePermissions);
			}
			
			// run with args
			//console.log("DEBUG: ",tc.input)
			// IMPORTANT: arguments are provided as list of strings
			const r = await runScriptInContainer(tmpdir, tc.arguments || [], tc.input || [], PER_TEST_TIMEOUT_MS);

			// Compare output. Use exact match by default (including trailing newline)
			// You can add more sophisticated matching (trim, regex, ignoring whitespace).
const expected = normalizeOutput(tc.expectedOutput || '').trim();
const actual = r.stdout.trim();

// nullish-coalescing replacement for older Node: fallback to 0 when expectedExitCode is null/undefined
const expectedExitCode = (tc.expectedExitCode != null) ? tc.expectedExitCode : 0;

const passed = (!r.timedOut)
  && (r.exitCode !== null)
  && (String(r.exitCode) === String(expectedExitCode))
  && (actual === expected);

results.push({
  testNumber: i + 1,
  arguments: tc.arguments || [],
  expectedOutput: expected,
  expectedExitCode: expectedExitCode,
  actualOutput: actual,
  stderr: r.stderr,
  exitCode: r.exitCode,
  timedOut: r.timedOut,
  error: r.error,
  passed
});
//console.log(results)
		}

		// cleanup
		try {
			// remove temp dir recursively
			try {
			  await removeRecursive(tmpdir);
			} catch (e) {
			  //console.error('Cleanup failed:', e);
			}
		} catch (e) {
			// ignore cleanup errors but log
			//console.error('Cleanup failed:', e);
		}

		res.json({ results });

	} catch (err) {
		//console.error(err);
		res.status(500).json({ error: 'internal error', detail: err.message });
	}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	//console.log(`Bash execution server listening on port ${PORT}`);
});

