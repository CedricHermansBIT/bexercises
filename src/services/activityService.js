const databaseService = require('./databaseService');
const { isAdmin } = require('../middleware/adminRole');
const { ApiError } = require('../middleware/errorHandler');

const DEFAULT_TIMEZONE = process.env.ACTIVITY_TIMEZONE || 'Europe/Brussels';

function dayFormatter(timezone) {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
	});
}

function dayOf(value, formatter) {
	const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map(p => [p.type, p.value]));
	return `${parts.year}-${parts.month}-${parts.day}`;
}

function utcTimestamp(value) {
	if (!value) return null;
	const normalized = value.replace(' ', 'T');
	return /(?:Z|[+-]\d\d:\d\d)$/i.test(normalized) ? normalized : `${normalized}Z`;
}

function shiftDay(day, offset) {
	return new Date(Date.parse(`${day}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
}

function validateDay(day) {
	if (typeof day !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(day) ||
		!Number.isFinite(Date.parse(`${day}T00:00:00Z`)) || shiftDay(day, 0) !== day) {
		throw ApiError.badRequest('Dates must be valid YYYY-MM-DD values');
	}
}

function dayBoundary(day, formatter) {
	// Find the first instant of the local calendar day, including DST changes.
	const midpoint = Date.parse(`${day}T00:00:00Z`);
	let low = midpoint - 36 * 3600000;
	let high = midpoint + 36 * 3600000;
	while (low < high) {
		const mid = Math.floor((low + high) / 2);
		if (dayOf(mid, formatter) < day) low = mid + 1;
		else high = mid;
	}
	return new Date(low).toISOString();
}

function validateOptions(query = {}, now = new Date()) {
	const timezone = query.timezone || DEFAULT_TIMEZONE;
	let formatter;
	try { formatter = dayFormatter(timezone); } catch { throw ApiError.badRequest('Invalid timezone'); }
	const end = query.end || dayOf(now.toISOString(), formatter);
	validateDay(end);
	const start = query.start || shiftDay(end, -29);
	validateDay(start);
	const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
	if (days < 1 || days > 366) throw ApiError.badRequest('Choose a date range of 1 to 366 days');
	if (query.includeArchived !== undefined && !['true', 'false'].includes(query.includeArchived)) {
		throw ApiError.badRequest('Invalid archive filter');
	}
	return { start, end, timezone, formatter, days, includeArchived: query.includeArchived === 'true',
		languageId: query.language || null, chapterId: query.chapter || null };
}

// Add indexes only. Existing tables and records are never rebuilt or rewritten.
async function ensureActivityIndexes(db) {
	await db.exec(`
		CREATE INDEX IF NOT EXISTS idx_activity_attempt_date ON submission_attempts(julianday(created_at));
		CREATE INDEX IF NOT EXISTS idx_activity_user_date ON submission_attempts(user_id, julianday(created_at));
		CREATE INDEX IF NOT EXISTS idx_activity_completion_date ON user_progress(julianday(completed_at));
	`);
}

async function getFilters() {
	const db = databaseService.db;
	return { timezone: DEFAULT_TIMEZONE,
		languages: await db.all('SELECT id, name FROM languages ORDER BY order_num, name'),
		chapters: await db.all('SELECT id, name, language_id FROM chapters ORDER BY order_num, name') };
}

async function getActivity(query = {}, userId = null) {
	const options = validateOptions(query);
	const { start, end, formatter } = options;
	const db = databaseService.db;
	const users = (await db.all('SELECT id, display_name, email, is_admin, is_archived FROM users'))
		.filter(user => !isAdmin(user) && (options.includeArchived || !user.is_archived));
	if (userId !== null && !users.some(user => String(user.id) === String(userId))) {
		throw ApiError.notFound('Student not found in the selected cohort');
	}
	const cohort = users.filter(user => userId === null || String(user.id) === String(userId));
	const students = new Map(cohort.map(user => [user.id, { id: user.id, name: user.display_name || user.email || `Student ${user.id}`,
		email: user.email, archived: Boolean(user.is_archived), submissions: 0, configurationErrors: 0,
		completed: 0, passed: 0, lastSubmission: null, practiceDays: new Set(), exercises: new Set() }]));
	// Exact local date bounds allow indexed SQL queries, including DST changes.
	const params = [dayBoundary(start, formatter), dayBoundary(shiftDay(end, 1), formatter)];
	let filter = '';
	if (options.languageId) { filter += ' AND c.language_id = ?'; params.push(options.languageId); }
	if (options.chapterId) { filter += ' AND c.id = ?'; params.push(options.chapterId); }
	if (userId !== null) { filter += ' AND a.user_id = ?'; params.push(userId); }
	const rows = await db.all(`
		SELECT a.user_id, a.exercise_id, e.title, l.name AS language,
			strftime('%Y-%m-%dT%H:%M:00Z', a.created_at) AS minute,
			MAX(strftime('%Y-%m-%dT%H:%M:%fZ', a.created_at)) AS latest,
			COUNT(*) AS submissions, SUM(a.passed) AS passed,
			SUM(CASE WHEN a.failure_category = 'configuration_error' THEN 1 ELSE 0 END) AS configuration_errors
		FROM submission_attempts a JOIN exercises e ON e.id = a.exercise_id
		JOIN chapters c ON c.id = e.chapter_id JOIN languages l ON l.id = c.language_id
		WHERE julianday(a.created_at) >= julianday(?) AND julianday(a.created_at) < julianday(?) ${filter}
		GROUP BY a.user_id, a.exercise_id, minute
	`, params);
	const daily = new Map();
	for (let day = start; day <= end; day = shiftDay(day, 1)) {
		daily.set(day, { date: day, submissions: 0, configurationErrors: 0, firstCompletions: 0,
			users: new Set(), practicedExercises: new Set() });
	}
	const exercises = new Map();
	const exerciseSummary = (id, title, language) => {
		if (!exercises.has(id)) exercises.set(id, { id, title, language, submissions: 0,
			passed: 0, configurationErrors: 0, firstCompletions: 0, users: new Set() });
		return exercises.get(id);
	};
	for (const row of rows) {
		const student = students.get(row.user_id);
		if (!student || !row.minute) continue;
		const day = dayOf(row.minute, formatter);
		if (!daily.has(day)) continue;
		const bucket = daily.get(day);
		const exercise = exerciseSummary(row.exercise_id, row.title, row.language);
		student.submissions += row.submissions;
		student.configurationErrors += row.configuration_errors;
		student.passed += row.passed;
		if (!student.lastSubmission || row.latest > student.lastSubmission) student.lastSubmission = row.latest;
		bucket.submissions += row.submissions;
		bucket.configurationErrors += row.configuration_errors;
		exercise.submissions += row.submissions;
		exercise.passed += row.passed;
		exercise.configurationErrors += row.configuration_errors;
		if (row.submissions > row.configuration_errors) {
			student.practiceDays.add(day);
			student.exercises.add(row.exercise_id);
			bucket.users.add(row.user_id);
			bucket.practicedExercises.add(`${row.user_id}:${row.exercise_id}`);
			exercise.users.add(row.user_id);
		}
	}
	// completed_at is permanent once earned, so successful reruns do not count
	// as new completions. This also preserves pre-history completion records.
	const completionFilter = filter.replace('a.user_id', 'p.user_id');
	const completions = await db.all(`
		SELECT p.user_id, p.exercise_id, p.completed_at, e.title, l.name AS language
		FROM user_progress p JOIN exercises e ON e.id = p.exercise_id
		JOIN chapters c ON c.id = e.chapter_id JOIN languages l ON l.id = c.language_id
		WHERE p.completed = 1 AND julianday(p.completed_at) >= julianday(?)
			AND julianday(p.completed_at) < julianday(?) ${completionFilter}
	`, params);
	for (const row of completions) {
		const student = students.get(row.user_id);
		const day = dayOf(utcTimestamp(row.completed_at), formatter);
		if (!student || !daily.has(day)) continue;
		student.completed++;
		daily.get(day).firstCompletions++;
		exerciseSummary(row.exercise_id, row.title, row.language).firstCompletions++;
	}
	const history = await db.get('SELECT MIN(julianday(created_at)) AS first FROM submission_attempts');
	const historyStartsAt = history.first === null ? null
		: new Date((history.first - 2440587.5) * 86400000).toISOString();
	const studentList = [...students.values()].map(student => ({ ...student,
		practiceDays: student.practiceDays.size, exercisesAttempted: student.exercises.size, exercises: undefined }))
		.sort((a, b) => b.practiceDays - a.practiceDays || b.exercisesAttempted - a.exercisesAttempted || a.name.localeCompare(b.name));
	const summary = { students: studentList.length, activeStudents: studentList.filter(s => s.practiceDays > 0).length,
		submissions: studentList.reduce((sum, s) => sum + s.submissions, 0),
		configurationErrors: studentList.reduce((sum, s) => sum + s.configurationErrors, 0),
		firstCompletions: studentList.reduce((sum, s) => sum + s.completed, 0) };
	let timeline = [];
	if (userId !== null) {
		// Keep student detail responses bounded; the summary still covers all runs.
		const timezoneRows = await db.all(`
			SELECT a.id, a.created_at, a.exercise_id, e.title, a.passed, a.runtime_ms,
				a.failure_category, a.failed_test_number
			FROM submission_attempts a JOIN exercises e ON e.id = a.exercise_id
			JOIN chapters c ON c.id = e.chapter_id
			WHERE julianday(a.created_at) >= julianday(?) AND julianday(a.created_at) < julianday(?) ${filter}
			ORDER BY julianday(a.created_at) DESC, a.id DESC LIMIT 200
		`, params);
		timeline = timezoneRows.filter(row => daily.has(dayOf(utcTimestamp(row.created_at), formatter)))
			.slice(0, 200).map(row => ({ ...row, created_at: utcTimestamp(row.created_at) }));
	}
	return { range: { start, end, timezone: options.timezone }, historyStartsAt, summary,
		daily: [...daily.values()].map(day => ({ ...day, activeStudents: day.users.size,
			exercisesPracticed: day.practicedExercises.size, users: undefined, practicedExercises: undefined })),
		students: studentList, exercises: [...exercises.values()].map(ex => ({ ...ex, activeStudents: ex.users.size, users: undefined }))
			.sort((a, b) => b.submissions - a.submissions), timeline };
}

module.exports = { getActivity, getFilters, ensureActivityIndexes, validateOptions };
