const { spawn } = require('node:child_process');
const path = require('node:path');
const { getContainerCommand } = require('../services/dockerService');
const images = require('../config/runtimeImages');

const child = spawn(getContainerCommand(), ['build', '-t', images.python,
	path.join(__dirname, '../runtimes/python-course')], { stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('close', code => { process.exitCode = code ?? 1; });
