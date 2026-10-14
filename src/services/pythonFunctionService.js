const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { runScriptInContainer } = require('./dockerService');

function validateFunctionTest(value, languageId = 'python', testCase = {}) {
	if (value == null) return null;
	if (languageId !== 'python') throw new Error('Function tests are only supported for Python');
	if (typeof value !== 'object' || Array.isArray(value)
		|| typeof value.name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(value.name)) {
		throw new Error('Function test needs a valid Python function name');
	}
	const args = value.args ?? [];
	const kwargs = value.kwargs ?? {};
	if (!Array.isArray(args) || args.length > 100 || !kwargs || typeof kwargs !== 'object'
		|| Array.isArray(kwargs) || Object.keys(kwargs).length > 100
		|| Object.keys(kwargs).some(key => !/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(key))) {
		throw new Error('Function arguments must be a JSON array and keyword arguments a JSON object');
	}
	function checkJSON(item, depth = 0) {
		if (depth > 30) throw new Error('Function input nesting exceeds 30 levels');
		if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
		if (typeof item === 'number' && Number.isFinite(item)) return;
		if (typeof item !== 'object') throw new Error('Function inputs must contain only JSON values');
		for (const child of Object.values(item)) checkJSON(child, depth + 1);
	}
	checkJSON(args);
	checkJSON(kwargs);
	const call = { name: value.name, args, kwargs };
	if (Buffer.byteLength(JSON.stringify(call)) > 65536) throw new Error('Function inputs exceed 64 KiB');
	if (testCase.useDynamicOutput || testCase.validationQuery
		|| testCase.arguments?.length || testCase.input?.length) {
		throw new Error('Function tests use JSON arguments instead of stdin, script arguments or dynamic output');
	}
	return call;
}

function canonicalJSON(value) {
	if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
	if (value && typeof value === 'object') {
		return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`).join(',')}}`;
	}
	return JSON.stringify(value);
}

async function runPythonFunction(tmpdir, scriptFilename, languageConfig, functionTest, timeoutMs, options = {}) {
	const call = validateFunctionTest(functionTest);
	const originalScript = await fs.readFile(path.join(tmpdir, scriptFilename));
	const filename = `.bitlab-function-${crypto.randomUUID()}.py`;
	await fs.copyFile(path.join(__dirname, '../runners/pythonFunctionRunner.py'), path.join(tmpdir, filename));
	try {
		const result = await runScriptInContainer(tmpdir, filename, languageConfig,
			[scriptFilename, JSON.stringify(call)], [], timeoutMs, { ...options, isolateScript: true });
		if (result.exitCode !== 0 || result.timedOut || result.outputLimited || result.error) return result;
		try {
			const report = JSON.parse(result.stdout);
			if (!Object.hasOwn(report, 'value') || typeof report.printedOutput !== 'string') throw new Error('Invalid report');
			return { ...result, stdout: canonicalJSON(report.value), functionStdout: report.printedOutput };
		} catch {
			return { ...result, error: 'Function runner did not return a valid JSON result' };
		}
	} finally {
		await fs.rm(path.join(tmpdir, filename), { force: true });
		// Every case starts with the submitted source, even if a function changed it.
		await fs.rm(path.join(tmpdir, scriptFilename), { force: true, recursive: true });
		await fs.writeFile(path.join(tmpdir, scriptFilename), originalScript, { mode: 0o644 });
	}
}

module.exports = { validateFunctionTest, canonicalJSON, runPythonFunction };
