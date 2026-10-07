const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Load the real page methods without starting authentication or CodeMirror.
function editorPage(elements, overrides = {}) {
	const document = {
		getElementById: id => elements[id],
		createElement: () => ({ style: {} }),
		addEventListener: () => {}
	};
	const context = vm.createContext({ document, console: { log() {} },
		localStorage: { setItem() {} }, sessionStorage: { getItem: () => null },
		setTimeout: fn => fn(), alert: message => { throw new Error(message); }, ...overrides });
	const source = fs.readFileSync('frontend/js/pages/admin/exercisesPage.js', 'utf8')
		.replace(/^import .*;\r?\n/gm, '');
	vm.runInContext(source + '\n globalThis.Page = ExercisesPage;', context);
	return Object.create(context.Page.prototype);
}

function chapterSelect() {
	return {
		options: [], selected: '',
		set innerHTML(_value) { this.options = []; this.selected = ''; },
		get value() { return this.selected; },
		set value(value) { this.selected = this.options.some(option => option.value === value) ? value : ''; },
		appendChild(option) { this.options.push(option); if (!this.selected) this.selected = option.value; }
	};
}

test('editing an exercise restores its language and chapter after building the options', async () => {
	const elements = Object.fromEntries(['editor-title', 'exercise-id', 'exercise-title',
		'exercise-description', 'admin-language-select', 'admin-welcome', 'exercise-editor',
		'test-preview', 'save-exercise-btn'].map(id => [id, { style: {}, value: '' }]));
	elements['exercise-chapter'] = chapterSelect();
	elements['exercise-chapter'].appendChild({ value: 'Other language chapter' });
	const page = editorPage(elements);
	page.selectedLanguage = 'python';
	page.languages = [{ id: 'python' }, { id: 'linux-basics', exercise_type: 'programming' }];
	page.exercises = [{ chapter: 'First chapter', language_id: 'linux-basics' }];
	const exercise = { id: 'redirect-output', language_id: 'linux-basics',
		chapter: 'Chapter 5 - Input and output', solution: 'ls -l > listing.txt', testCases: [] };
	page.apiService = { getExerciseWithTests: async () => exercise };
	page.solutionEditor = { setValue() {}, setOption() {}, refresh() {} };
	page.renderTestCases = page.populateExerciseList = page.updateNewExerciseButton = () => {};
	await page.editExercise(exercise.id);
	assert.equal(page.selectedLanguage, 'linux-basics');
	assert.equal(elements['admin-language-select'].value, 'linux-basics');
	assert.equal(elements['exercise-chapter'].value, exercise.chapter);
	assert.equal(page.currentLanguageId, 'linux-basics');
});

function savingPage() {
	const elements = Object.fromEntries(['exercise-id', 'exercise-title', 'exercise-description',
		'exercise-chapter', 'new-chapter-input', 'save-exercise-btn', 'back-to-workspace-btn',
		'editor-title', 'exercise-save-status', 'exercise-editor'].map(id => [id, { value: '', style: {} }]));
	elements['exercise-id'].value = 'redirect-output';
	elements['exercise-title'].value = 'Redirect output';
	elements['exercise-description'].value = 'Save the listing.';
	elements['exercise-chapter'].value = 'I/O';
	elements['exercise-editor'].style.display = 'block';
	const navigation = [], alerts = [], calls = [];
	const page = editorPage(elements, { navigateTo: url => navigation.push(url),
		alert: message => alerts.push(message), sessionStorage: { removeItem() {} } });
	page.selectedLanguage = 'bash';
	page.exercises = [];
	page.testCases = [{ expectedOutput: '', expectedStderr: '', expectedExitCode: 0 }];
	page.solutionEditor = { getValue: () => 'ls -l > listing.txt' };
	page.apiService = {
		createExercise: async () => calls.push('create'),
		updateExercise: async () => calls.push('update')
	};
	page.loadExercises = async () => calls.push('refresh');
	return { page, elements, navigation, alerts, calls };
}

test('saving stays in the editor and subsequent saves update the created exercise', async () => {
	const { page, elements, calls, navigation, alerts } = savingPage();
	await page.saveExercise();
	assert.equal(page.currentExercise.id, 'redirect-output');
	assert.equal(elements['exercise-editor'].style.display, 'block');
	assert.equal(elements['exercise-id'].disabled, true);
	assert.match(elements['exercise-save-status'].textContent, /^Saved/);
	await page.saveExercise();
	assert.deepEqual(calls, ['create', 'refresh', 'update', 'refresh']);
	assert.deepEqual(navigation, []);
	assert.deepEqual(alerts, []);
});

test('workspace action saves first and stays in the editor if saving fails', async () => {
	const { page, navigation, alerts, elements, calls } = savingPage();
	page.currentExercise = { id: 'redirect-output', order: 1 };
	page.apiService.updateExercise = async () => { throw new Error('Network error'); };
	await page.returnToWorkspace();
	assert.deepEqual(navigation, []);
	assert.equal(elements['exercise-editor'].style.display, 'block');
	assert.equal(elements['save-exercise-btn'].disabled, false);
	assert.equal(elements['back-to-workspace-btn'].disabled, false);
	assert.match(alerts[0], /Failed to save/);
	page.apiService.updateExercise = async () => calls.push('update');
	await page.returnToWorkspace();
	assert.deepEqual(calls, ['update', 'refresh']);
	assert.deepEqual(navigation, ['workspace.html?exercise=redirect-output']);
});
