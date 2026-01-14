// src/utils/commandUtils.js
const { execSync } = require('child_process');

/**
 * Whitelist of allowed commands for command substitution
 * Only these commands can be executed for security
 */
const ALLOWED_COMMANDS = [
	'date',
	'whoami',
	'hostname',
	'pwd',
	'echo'
];

/**
 * Validate and sanitize command for substitution
 * @param {string} command - Command to validate
 * @returns {boolean} Whether command is allowed
 */
function isCommandAllowed(command) {
	const trimmed = command.trim();

	// Check if command starts with one of the allowed commands
	for (const allowed of ALLOWED_COMMANDS) {
		if (trimmed === allowed || trimmed.startsWith(`${allowed} `)) {
			return true;
		}
	}

	return false;
}

/**
 * Expand command substitutions in a string
 * Supports $(command) syntax for dynamic values
 * SECURITY: Only whitelisted commands are allowed
 * @param {string} str - String with potential command substitutions
 * @param {Object} options - Optional configuration
 * @param {boolean} options.enforceWhitelist - Whether to enforce whitelist (default: true)
 * @param {number} options.timeout - Command timeout in ms (default: 5000)
 * @returns {string} String with substitutions expanded
 */
function expandCommandSubstitution(str, options = {}) {
	const { enforceWhitelist = true, timeout = 5000 } = options;

	if (!str || typeof str !== 'string') {
		return str;
	}

	// Match $(command) patterns
	const pattern = /\$\(([^)]+)\)/g;

	return str.replace(pattern, (match, command) => {
		try {
			// SECURITY: Check if command is whitelisted
			if (enforceWhitelist && !isCommandAllowed(command)) {
				console.warn(`[SECURITY] Blocked non-whitelisted command substitution: ${command}`);
				console.warn(`[SECURITY] Allowed commands: ${ALLOWED_COMMANDS.join(', ')}`);
				// Return placeholder instead of executing
				return '[BLOCKED_COMMAND]';
			}

			// Execute the command and get output
			// On Windows, use cmd.exe if bash is not available
			const isWindows = process.platform === 'win32';
			const shell = isWindows ? process.env.ComSpec || 'cmd.exe' : '/bin/bash';

			// Log command execution for audit trail
			console.log(`[AUDIT] Executing whitelisted command substitution: ${command}`);

			const result = execSync(command, {
				encoding: 'utf8',
				timeout,
				shell
			});
			return result.trim();
		} catch (error) {
			console.warn(`Failed to expand command substitution: ${command}`, error.message);
			// Return the original match if execution fails
			return match;
		}
	});
}

module.exports = {
	expandCommandSubstitution,
	isCommandAllowed,
	ALLOWED_COMMANDS
};

