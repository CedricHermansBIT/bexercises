const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { checkCodeRules } = require('../services/examGraderService');

test('exam code rules score normal patterns and time out pathological regexes', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bitlab-code-rules-'));
	const scriptPath = path.join(root, 'student.sh');
	try {
		await fs.writeFile(scriptPath, 'echo hello');
		const checks = await checkCodeRules(scriptPath, [{ pattern: 'echo', points: 2 }]);
		assert.equal(checks[0].points, 2);
		await fs.writeFile(scriptPath, 'a'.repeat(10000) + 'X');
		await assert.rejects(checkCodeRules(scriptPath, [{ pattern: '^(a+)+$', points: 2 }]), /timed out/);
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});
