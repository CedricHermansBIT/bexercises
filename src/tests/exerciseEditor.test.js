const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Load the real page methods without starting authentication or CodeMirror.
function editorPage(elements) {
	const document = {
		getElementById: id => elements[id],
		createElement: () => ({ style: {} }),
		addEventListener: () => {}
	};
	const context = vm.createContext({ document, console: { log() {} },
		localStorage: { setItem() {} }, sessionStorage: { getItem: () => null },
		setTimeout: fn => fn(), alert: message => { throw new Error(message); } });
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
		'test-preview'].map(id => [id, { style: {}, value: '' }]));
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
