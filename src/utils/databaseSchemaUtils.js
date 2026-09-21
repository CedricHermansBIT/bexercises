// Extract a small, safe schema summary from database exercise fixtures. The
// workspace needs names and fields, not fixture records or SQL source.

function splitTopLevel(value) {
	const parts = [];
	let start = 0;
	let depth = 0;
	let quote = null;

	for (let index = 0; index < value.length; index++) {
		const char = value[index];
		if (quote) {
			if (char === '\\' && index + 1 < value.length) {
				index++;
			} else if (char === quote) {
				quote = null;
			}
			continue;
		}

		if (char === "'" || char === '"' || char === '`') quote = char;
		else if (char === '(' || char === '[' || char === '{') depth++;
		else if (char === ')' || char === ']' || char === '}') depth--;
		else if (char === ',' && depth === 0) {
			parts.push(value.slice(start, index));
			start = index + 1;
		}
	}

	parts.push(value.slice(start));
	return parts;
}

function findClosingParenthesis(value, openingIndex) {
	let depth = 0;
	let quote = null;
	for (let index = openingIndex; index < value.length; index++) {
		const char = value[index];
		if (quote) {
			if (char === '\\') index++;
			else if (char === quote) quote = null;
			continue;
		}
		if (char === "'" || char === '"' || char === '`') quote = char;
		else if (char === '(') depth++;
		else if (char === ')' && --depth === 0) return index;
	}
	return -1;
}

function addSchema(map, name, columns, kind) {
	if (!name) return;
	const schema = map.get(name) || { name, kind, columns: [] };
	columns.forEach(column => {
		if (column.name && !schema.columns.some(existing => existing.name === column.name)) {
			schema.columns.push(column);
		}
	});
	map.set(name, schema);
}

function extractSqlSchema(content, schemas) {
	const createTable = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`?[\w-]+`?\.)?`?([\w-]+)`?\s*\(/gi;
	let match;
	while ((match = createTable.exec(content))) {
		const openingIndex = createTable.lastIndex - 1;
		const closingIndex = findClosingParenthesis(content, openingIndex);
		if (closingIndex < 0) continue;

		const columns = splitTopLevel(content.slice(openingIndex + 1, closingIndex))
			.map(definition => definition.trim())
			.filter(definition => definition && !/^(PRIMARY|FOREIGN|UNIQUE|CONSTRAINT|KEY|INDEX|CHECK)\b/i.test(definition))
			.map(definition => {
				const column = definition.match(/^`?([\w-]+)`?\s+(.+)/);
				if (!column) return null;
				const type = column[2].match(/^([\w]+(?:\s*\([^)]*\))?)/);
				return { name: column[1], type: type ? type[1].toUpperCase() : '' };
			})
			.filter(Boolean);
		addSchema(schemas, match[1], columns, 'table');
		createTable.lastIndex = closingIndex + 1;
	}
}

function extractObjectFields(value) {
	const openingIndex = value.indexOf('{');
	if (openingIndex < 0) return [];
	const closingIndex = findClosingParenthesis(value.replace(/\{/g, '(').replace(/\}/g, ')'), openingIndex);
	if (closingIndex < 0) return [];
	return splitTopLevel(value.slice(openingIndex + 1, closingIndex))
		.map(field => field.trim().match(/^(?:["']([^"']+)["']|([\w$]+))\s*:/))
		.filter(Boolean)
		.map(match => ({ name: match[1] || match[2], type: '' }));
}

function extractMongoSchema(fixture, schemas) {
	const content = fixture.content || '';
	if (/\.json$/i.test(fixture.filename)) {
		try {
			const data = JSON.parse(content);
			if (Array.isArray(data)) {
				addSchema(schemas, fixture.filename.replace(/\.json$/i, ''), extractObjectFields(JSON.stringify(data[0] || {})), 'collection');
			} else if (data && typeof data === 'object') {
				Object.entries(data).forEach(([name, documents]) => {
					if (Array.isArray(documents)) addSchema(schemas, name, extractObjectFields(JSON.stringify(documents[0] || {})), 'collection');
				});
			}
		} catch (_) { /* Invalid JSON fixtures are ignored, as the runner will report them. */ }
		return;
	}

	const inserts = /db\.([\w$]+)\.insert(?:Many|One)\s*\(/g;
	let match;
	while ((match = inserts.exec(content))) {
		addSchema(schemas, match[1], extractObjectFields(content.slice(inserts.lastIndex)), 'collection');
	}
}

function getDatabaseSchema(fixtures, languageId) {
	const schemas = new Map();
	fixtures.forEach(fixture => {
		if (languageId === 'mongodb') extractMongoSchema(fixture, schemas);
		else if (/\.sql$/i.test(fixture.filename)) extractSqlSchema(fixture.content || '', schemas);
	});
	return [...schemas.values()].sort((first, second) => first.name.localeCompare(second.name));
}

module.exports = { getDatabaseSchema };
