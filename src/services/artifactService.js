const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const config = require('../config');
const images = require('../config/runtimeImages');
const { createTempScript, runScriptInContainer, removeRecursive, hashOutputFiles } = require('./dockerService');
const { compareOutputState } = require('./gradingComparison');
const { canonicalJSON } = require('./pythonFunctionService');

function validateArtifactChecks(checks = [], outputFiles) {
	if (!Array.isArray(checks) || checks.length > 8) throw new Error('Use at most eight artifact checks per test');
	const names = new Set();
	for (const check of checks) {
		if (!check || typeof check.filename !== 'string' || !check.filename || check.filename.length > 200
			|| path.isAbsolute(check.filename) || check.filename.includes('\\') || check.filename.includes('\0')
			|| check.filename.includes('$(') || check.filename.split('/').some(part => part === '..' || !part)
			|| !['xlsx', 'sqlite', 'image', 'docx', 'pdf', 'plot'].includes(check.kind) || names.has(check.filename)) {
			throw new Error('Artifact checks need unique, relative filenames and a supported kind');
		}
		names.add(check.filename);
		if (outputFiles && !outputFiles.includes(check.filename)) throw new Error(`Add ${check.filename} to expected output paths first`);
		if (check.sheets !== undefined && (!Array.isArray(check.sheets) || check.sheets.length > 20
			|| check.sheets.some(name => typeof name !== 'string' || !name || name.length > 100)
			|| new Set(check.sheets).size !== check.sheets.length)) throw new Error('Checked sheets must be unique sheet names');
		for (const key of ['headings', 'layout']) {
            if (check[key] !== undefined && typeof check[key] !== 'boolean') throw new Error(`${key} must be a boolean`);
        }
        for (const [key, minimum, maximum] of [['positionTolerance', 0, 10], ['channelTolerance', 0, 20],
            ['maxDifferentPixelRatio', 0, 0.05], ['maxMeanAbsoluteError', 0, 10]]) {
            if (check[key] !== undefined && (typeof check[key] !== 'number' || !Number.isFinite(check[key])
                || check[key] < minimum || check[key] > maximum)) throw new Error(`${key} must be between ${minimum} and ${maximum}`);
        }
		if (check.kind === 'sqlite') {
			if (!Array.isArray(check.queries) || !check.queries.length || check.queries.length > 8) {
				throw new Error('SQLite checks need one to eight named SELECT queries');
			}
			const queries = new Set();
			for (const query of check.queries) {
				if (!query || typeof query.name !== 'string' || !query.name || query.name.length > 100
					|| queries.has(query.name) || typeof query.sql !== 'string' || query.sql.length > 8192
					|| !/^\s*(SELECT|WITH)\b/i.test(query.sql)
					|| (query.ordered !== undefined && typeof query.ordered !== 'boolean')
					|| (query.parameters !== undefined && (!Array.isArray(query.parameters) || query.parameters.length > 100))) {
					throw new Error('SQLite checks need distinct names and read-only SELECT/WITH queries');
				}
				for (const value of query.parameters || []) {
					if (value !== null && typeof value !== 'string' && typeof value !== 'boolean'
						&& !(typeof value === 'number' && Number.isFinite(value))) throw new Error('SQLite parameters must be JSON scalar values');
				}
				queries.add(query.name);
			}
		}
	}
	if (Buffer.byteLength(JSON.stringify(checks)) > 65536) throw new Error('Artifact check configuration exceeds 64 KiB');
	return checks;
}

async function copyRegularFile(root, relative, destination) {
	const filename = path.resolve(root, relative);
	const canonical = await fs.realpath(filename);
	const stat = await fs.lstat(filename);
	if (!canonical.startsWith(`${root}${path.sep}`) || !stat.isFile() || stat.size > 16 * 1024 * 1024) {
		throw new Error('Artifact must be a regular file inside the workspace, at most 16 MiB');
	}
	await fs.copyFile(filename, destination);
	await fs.chmod(destination, 0o644);
}

async function inspectArtifact(tmpdir, check) {
	let temp;
	try {
		const root = await fs.realpath(tmpdir);
		const source = await fs.readFile(path.join(__dirname, '../runners/artifactInspector.py'), 'utf8');
		temp = await createTempScript(source, 'python');
		await copyRegularFile(root, check.filename, path.join(temp.tmpdir, 'artifact.bin'));
		if (check.kind === 'sqlite') {
			// Preserve committed WAL rows; SQLite can recreate its shared-memory index.
			try { await copyRegularFile(root, `${check.filename}-wal`, path.join(temp.tmpdir, 'artifact.bin-wal')); }
			catch (error) { if (error.code !== 'ENOENT') throw error; }
		}
		const result = await runScriptInContainer(temp.tmpdir, temp.scriptFilename,
			{ ...temp.languageConfig, dockerImage: images.python, interpreter: 'python3 -I' },
			[JSON.stringify(check)], [], config.docker.timeout, { isolateScript: true });
		if (result.error || result.timedOut || result.outputLimited || result.exitCode !== 0) {
			throw new Error(`Artifact inspection failed: ${result.error || result.stderr || 'execution limit'}`);
		}
		const report = path.join(temp.tmpdir, 'artifact-report.json');
		const stat = await fs.lstat(report);
		if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('Artifact snapshot exceeds 1 MiB');
		return { ...JSON.parse(await fs.readFile(report, 'utf8')), checkSignature: canonicalJSON(check) };
	} catch (error) {
		return { kind: check.kind, error: error.code === 'ENOENT' ? 'Artifact file not found' : error.message };
	} finally {
		if (temp) await removeRecursive(temp.tmpdir);
	}
}

async function inspectOutputFiles(tmpdir, filenames, checks = []) {
	validateArtifactChecks(checks, filenames);
	const files = await hashOutputFiles(tmpdir, filenames);
	for (const file of files) {
		const check = checks.find(check => check.filename === file.filename);
		if (check) file.artifact = await inspectArtifact(tmpdir, check);
	}
	return files;
}

function compareArtifactState(actual, expected, check) {
	if (!check) return compareOutputState(actual, expected);
	const a = actual?.artifact, e = expected?.artifact;
	const differences = [];
	let totalDifferences = 0;
	const diff = (location, wanted, got) => {
		totalDifferences++;
		if (differences.length < 25) differences.push({ location, expected: wanted, actual: got });
	};
	const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
	if (!actual?.exists || actual.type !== 'file' || !a || a.error) {
		diff('File', 'Readable ' + check.kind + ' file', a?.error || actual?.error || actual?.type || 'missing');
	} else if (!e?.data || e.error || e.kind !== check.kind || e.checkSignature !== canonicalJSON(check)) {
		diff('Reference', 'Retest the reference solution', 'Expected artifact data is missing or incompatible');
	} else if (a.kind !== e.kind || !a.data) {
		diff('File', e.kind, a.kind || 'invalid snapshot');
	} else if (check.kind === 'xlsx') {
		const left = new Map(e.data.sheets.map(sheet => [sheet.name, sheet.cells]));
		const right = new Map(a.data.sheets.map(sheet => [sheet.name, sheet.cells]));
		for (const name of new Set([...left.keys(), ...right.keys()])) {
			if (!left.has(name) || !right.has(name)) { diff(`Sheet ${name}`, left.has(name) ? 'present' : 'absent', right.has(name) ? 'present' : 'absent'); continue; }
			for (const cell of new Set([...Object.keys(left.get(name)), ...Object.keys(right.get(name))])) {
				const wanted = left.get(name)[cell], got = right.get(name)[cell];
				if (!same(wanted, got)) diff(`${name}!${cell}`, wanted ?? null, got ?? null);
			}
		}
	} else if (check.kind === 'sqlite') {
		for (const query of check.queries) {
			const wanted = e.data.queries.find(item => item.name === query.name);
			const got = a.data.queries.find(item => item.name === query.name);
			if (!wanted || !got) { diff(`Query ${query.name}`, 'present', 'missing'); continue; }
			if (!same(wanted.columns, got.columns)) diff(`${query.name}: columns`, wanted.columns, got.columns);
			const rows = query.ordered === false
				? [wanted.rows.map(canonicalJSON).sort(), got.rows.map(canonicalJSON).sort()]
				: [wanted.rows, got.rows];
			if (rows[0].length !== rows[1].length) diff(`${query.name}: row count`, rows[0].length, rows[1].length);
			for (let index = 0; index < Math.max(rows[0].length, rows[1].length); index++) {
				if (!same(rows[0][index], rows[1][index])) {
					const decode = item => query.ordered === false && item !== undefined ? JSON.parse(item) : item;
					diff(`${query.name}: row ${index + 1}`, decode(rows[0][index]) ?? null, decode(rows[1][index]) ?? null);
				}
			}
		}
	} else if (check.kind === 'docx') {
        const wanted = e.data.blocks, got = a.data.blocks;
        if (wanted.length !== got.length) diff('Content block count', wanted.length, got.length);
        for (let index = 0; index < Math.max(wanted.length, got.length); index++) {
            const left = wanted[index], right = got[index];
            if (!left || !right || left.kind !== right.kind) { diff(`Block ${index + 1}`, left ?? null, right ?? null); continue; }
            if (left.kind === 'paragraph') {
                if (left.text !== right.text) diff(`Paragraph in block ${index + 1}`, left.text, right.text);
                if (check.headings !== false && left.heading !== right.heading) diff(`Heading in block ${index + 1}`, left.heading, right.heading);
            } else {
                if (left.rows.length !== right.rows.length) diff(`Table in block ${index + 1}: rows`, left.rows.length, right.rows.length);
                for (let row = 0; row < Math.max(left.rows.length, right.rows.length); row++) {
                    const l = left.rows[row] || [], r = right.rows[row] || [];
                    if (l.length !== r.length) diff(`Table ${index + 1}, row ${row + 1}: columns`, l.length, r.length);
                    for (let cell = 0; cell < Math.max(l.length, r.length); cell++) {
                        if (l[cell] !== r[cell]) diff(`Table ${index + 1}, cell (${row + 1}, ${cell + 1})`, l[cell] ?? null, r[cell] ?? null);
                    }
                }
            }
        }
    } else if (check.kind === 'pdf') {
        const wanted = e.data.pages, got = a.data.pages;
        if (wanted.length !== got.length) diff('Page count', wanted.length, got.length);
        for (let index = 0; index < Math.min(wanted.length, got.length); index++) {
            const left = wanted[index], right = got[index];
            if (left.text !== right.text) diff(`Page ${index + 1}: text`, left.text, right.text);
            if (check.layout) {
                const tolerance = check.positionTolerance ?? 2;
                if (left.size.some((value, i) => Math.abs(value - right.size[i]) > tolerance)) diff(`Page ${index + 1}: size`, left.size, right.size);
                if (left.characters.length !== right.characters.length) diff(`Page ${index + 1}: character count`, left.characters.length, right.characters.length);
                for (let char = 0; char < Math.min(left.characters.length, right.characters.length); char++) {
                    const l = left.characters[char], r = right.characters[char];
                    if (l.text !== r.text || l.box.some((value, i) => Math.abs(value - r.box[i]) > tolerance)) {
                        diff(`Page ${index + 1}: character ${char + 1} position`, l, r);
                    }
                }
            }
        }
    } else if (check.kind === 'image' || check.kind === 'plot') {
		if (a.data.width !== e.data.width || a.data.height !== e.data.height) {
			diff('Dimensions', `${e.data.width} × ${e.data.height}`, `${a.data.width} × ${a.data.height}`);
		} else {
			try {
				const length = e.data.width * e.data.height * 4;
				if (!Number.isSafeInteger(length) || length < 4 || length > 4000000) throw new Error('Invalid image dimensions');
				const wanted = zlib.inflateSync(Buffer.from(e.data.rgba, 'base64'), { maxOutputLength: length });
				const got = zlib.inflateSync(Buffer.from(a.data.rgba, 'base64'), { maxOutputLength: length });
				if (wanted.length !== length || got.length !== length) throw new Error('Invalid pixel data');
				let differentPixels = 0, absoluteError = 0;
                const pixelDiffs = [];
                for (let offset = 0; offset < length; offset += 4) {
					if (check.kind === 'plot') {
                        const errors = [...wanted.subarray(offset, offset + 4)].map((value, channel) => Math.abs(value - got[offset + channel]));
                        absoluteError += errors.reduce((sum, value) => sum + value, 0);
                        if (Math.max(...errors) > (check.channelTolerance ?? 3)) {
                            differentPixels++;
                            if (pixelDiffs.length < 25) pixelDiffs.push(offset);
                        }
                    } else if (!wanted.subarray(offset, offset + 4).equals(got.subarray(offset, offset + 4))) {
						diff(`Pixel (${(offset / 4) % e.data.width}, ${Math.floor(offset / 4 / e.data.width)})`,
							[...wanted.subarray(offset, offset + 4)], [...got.subarray(offset, offset + 4)]);
					}
				}
				if (check.kind === 'plot') {
                    const ratio = differentPixels / (length / 4), mean = absoluteError / length;
                    actual.plotMetrics = {differentPixelRatio: ratio, meanAbsoluteError: mean};
                    if (ratio > (check.maxDifferentPixelRatio ?? 0.005)) diff('Changed pixel ratio', `≤ ${check.maxDifferentPixelRatio ?? 0.005}`, ratio);
                    if (mean > (check.maxMeanAbsoluteError ?? 0.5)) diff('Mean channel error', `≤ ${check.maxMeanAbsoluteError ?? 0.5}`, mean);
                    if (totalDifferences) for (const offset of pixelDiffs) diff(`Pixel (${(offset / 4) % e.data.width}, ${Math.floor(offset / 4 / e.data.width)})`, [...wanted.subarray(offset, offset + 4)], [...got.subarray(offset, offset + 4)]);
                }
			} catch (error) { diff('Pixels', 'Readable pixel data', error.message); }
		}
	}
	return { matches: totalDifferences === 0, expectedType: 'file', entries: [], artifact: {
		kind: check.kind, differences, totalDifferences, metrics: actual?.plotMetrics || null, expectedPreview: e?.preview || null,
		actualPreview: a?.preview || null, scope: check.sheets?.length ? `Sheets: ${check.sheets.join(', ')}` : null
	} };
}

function publicArtifactResults(results) {
	return results.map(result => ({ ...result, outputFiles: (result.outputFiles || []).map(file => {
		const feedback = { ...file };
        delete feedback.artifactSnapshot;
		return feedback;
	}) }));
}

module.exports = { validateArtifactChecks, inspectArtifact, inspectOutputFiles, compareArtifactState, publicArtifactResults };
