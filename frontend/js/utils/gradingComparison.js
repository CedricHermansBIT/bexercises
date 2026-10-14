// Match the normalization used by the server's gradingComparison service.
export function normalizeGradingOutput(value) {
	return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

export function compareTestOutputs(actual, expected) {
	const outputChanged = normalizeGradingOutput(actual?.output) !== normalizeGradingOutput(expected?.expectedOutput);
	const stderrChanged = normalizeGradingOutput(actual?.stderr) !== normalizeGradingOutput(expected?.expectedStderr);
	const exitCodeChanged = String(actual?.exitCode) !== String(expected?.expectedExitCode);
	const filesChanged = Array.isArray(actual?.fileComparisons) && actual.fileComparisons.some(file => !file.matches);
	return { outputChanged, stderrChanged, exitCodeChanged, filesChanged,
		hasChanges: outputChanged || stderrChanged || exitCodeChanged || filesChanged };
}
