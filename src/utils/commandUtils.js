// Output filename templates are expanded in the server process. Never pass
// exercise-authored text to a shell or a host command.
const DATE_FORMAT = /^(?:%[YmdHMS%]|[._-])+$/;
const LEGACY_DATE = /^date \+(.+)$/;

function isCommandAllowed(command) {
	const match = typeof command === 'string' && command.trim().match(LEGACY_DATE);
	return Boolean(match && DATE_FORMAT.test(match[1]));
}

function formatDate(format, now) {
	const values = {
		Y: String(now.getFullYear()).padStart(4, '0'),
		m: String(now.getMonth() + 1).padStart(2, '0'),
		d: String(now.getDate()).padStart(2, '0'),
		H: String(now.getHours()).padStart(2, '0'),
		M: String(now.getMinutes()).padStart(2, '0'),
		S: String(now.getSeconds()).padStart(2, '0'),
		'%': '%'
	};
	return format.replace(/%([YmdHMS%])/g, (_match, part) => values[part]);
}

function expandCommandSubstitution(value, options = {}) {
	if (typeof value !== 'string') return value;
	const now = options.now || new Date();
	const expand = (format) => DATE_FORMAT.test(format)
		? formatDate(format, now)
		: '[BLOCKED_COMMAND]';
	// Keep the existing date syntax for saved exercises while supporting an
	// explicit template for newly authored filenames.
	return value
		.replace(/\$\(([^)]*)\)/g, (_match, command) => {
			const match = command.trim().match(LEGACY_DATE);
			return match ? expand(match[1]) : '[BLOCKED_COMMAND]';
		})
		.replace(/\{date:([^}]*)\}/g, (_match, format) => expand(format));
}

module.exports = { expandCommandSubstitution, isCommandAllowed };
