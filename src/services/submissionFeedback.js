function classifyFailure(result) {
	if (result.passed) return null;
	if (result.configurationError) return 'configuration_error';
	if (result.timedOut) return 'timeout';
	if (result.outputLimited) return 'output_limit';
	if (result.error) return 'error';
	if (!result.isDatabaseExercise && String(result.exitCode) !== String(result.expectedExitCode)) {
		return 'wrong_exit_code';
	}
	if (result.outputFiles?.some(file => !file.matches)) return 'wrong_output';
	const actual = result.usedValidation ? result.actualValidationOutput : result.actualOutput;
	const expected = result.usedValidation && result.expectedValidationOutput
		? result.expectedValidationOutput : result.expectedOutput;
	if (String(actual ?? '').trim() !== String(expected ?? '').trim()) return 'wrong_output';
	if (!result.isDatabaseExercise && String(result.actualStderr ?? '').trim() !== String(result.expectedStderr ?? '').trim()) {
		return 'wrong_stderr';
	}
	return 'unknown';
}

module.exports = { classifyFailure };
