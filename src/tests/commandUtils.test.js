const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { expandCommandSubstitution, isCommandAllowed } = require('../utils/commandUtils');

test('legacy and explicit date templates expand without a shell', () => {
	const now = new Date(2026, 8, 25, 14, 6, 9);
	assert.equal(expandCommandSubstitution('backup_$(date +%Y%m%d).tar.gz', { now }),
		'backup_20260925.tar.gz');
	assert.equal(expandCommandSubstitution('backup_{date:%Y-%m-%d_%H%M%S}.tar.gz', { now }),
		'backup_2026-09-25_140609.tar.gz');
});

test('shell syntax in a date substitution never runs', () => {
	const marker = path.join(os.tmpdir(), `bitlab-command-test-${process.pid}`);
	try {
		assert.equal(isCommandAllowed('date +%Y%m%d; touch /tmp/marker'), false);
		assert.equal(expandCommandSubstitution(`$(date +%Y%m%d; touch ${marker})`),
			'[BLOCKED_COMMAND]');
		assert.equal(expandCommandSubstitution(`$(date ; touch ${marker})`),
			'[BLOCKED_COMMAND]');
		assert.equal(fs.existsSync(marker), false);
	} finally {
		if (fs.existsSync(marker)) fs.unlinkSync(marker);
	}
});
