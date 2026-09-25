function normalized(value) {
	return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function compareRunnerResults(actual, expected) {
	const outputMatch = normalized(actual?.stdout) === normalized(expected?.stdout);
	const stderrMatch = normalized(actual?.stderr) === normalized(expected?.stderr);
	const exitCodeMatch = String(actual?.exitCode) === String(expected?.exitCode);
	const valid = result => result && result.exitCode !== null && result.exitCode !== undefined
		&& !result.timedOut && !result.outputLimited && !result.error;
	return { outputMatch, stderrMatch, exitCodeMatch,
		passed: Boolean(valid(actual) && valid(expected) && outputMatch && stderrMatch && exitCodeMatch) };
}

function compareOutputState(actual, expected) {
	const expectedType = expected ? (expected.type || 'file') : null;
	const expectedEntries = expected?.entries || [];
	const actualEntries = actual?.entries || [];
	const paths = new Set([...expectedEntries.map(entry => entry.path), ...actualEntries.map(entry => entry.path)]);
	const entries = [...paths].sort().map(entryPath => {
		const expectedEntry = expectedEntries.find(entry => entry.path === entryPath);
		const actualEntry = actualEntries.find(entry => entry.path === entryPath);
		return { path: entryPath, expectedType: expectedEntry?.type || null,
			actualType: actualEntry?.type || null,
			matches: Boolean(expectedEntry && actualEntry)
				&& expectedEntry.type === actualEntry.type
				&& (expectedEntry.type !== 'file' || expectedEntry.sha256 === actualEntry.sha256)
				&& (expectedEntry.type !== 'link' || expectedEntry.linkTarget === actualEntry.linkTarget) };
	});
	const stateMatches = ['file', 'directory'].includes(expectedType)
		? (!expected?.sha256 || actual?.sha256 === expected.sha256)
		: expectedType === 'link'
			? (!expected?.linkTarget || actual?.linkTarget === expected.linkTarget)
			: true;
	const matches = Boolean(expected && expected.exists !== false && actual?.exists
		&& actual.type === expectedType && stateMatches
		&& (expectedEntries.length === 0 || entries.every(entry => entry.matches)));
	return { matches, expectedType, entries };
}

module.exports = { compareRunnerResults, compareOutputState };
