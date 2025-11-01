// frontend/js/components/exerciseMenu.js
/**
 * Exercise Menu Component
 */
class ExerciseMenu {
	constructor(storageService) {
		this.storageService = storageService;
		this.exercises = [];
		this.onExerciseSelect = null;
	}

	/**
	 * Populate the exercise menu
	 * @param {Array} exercises - Array of exercises
	 */
	populate(exercises) {
		this.exercises = exercises;
		const menu = document.getElementById('exercise-menu');
		if (!menu) return;

		menu.innerHTML = '';
		const progress = this.storageService.loadProgress();

		// Group exercises by chapter
		const chapters = this.groupByChapter(exercises);

		// Render chapters
		const chapterOrder = ['Shell scripting', 'Additional exercises'];
		const remainingChapters = Object.keys(chapters).filter(c => !chapterOrder.includes(c));
		const allChapters = [...chapterOrder, ...remainingChapters].filter(c => chapters[c]);

		allChapters.forEach(chapterName => {
			const chapterHeader = document.createElement('li');
			chapterHeader.className = 'chapter-header';
			chapterHeader.innerHTML = `<h3>${chapterName}</h3>`;
			menu.appendChild(chapterHeader);

			chapters[chapterName].forEach((exercise, index) => {
				const li = document.createElement('li');
				const link = document.createElement('a');
				link.href = '#';
				link.className = 'exercise-item';
				link.innerHTML = `<span class="exercise-number">${index + 1}.</span> ${exercise.title}`;
				link.dataset.exerciseId = exercise.id;

				if (progress[exercise.id]?.completed) {
					link.classList.add('completed');
				}

				link.addEventListener('click', (e) => {
					e.preventDefault();
					if (this.onExerciseSelect) {
						this.onExerciseSelect(exercise.id);
					}
				});

				li.appendChild(link);
				menu.appendChild(li);
			});
		});
	}

	/**
	 * Group exercises by chapter
	 * @param {Array} exercises - Array of exercises
	 * @returns {Object} Grouped exercises
	 */
	groupByChapter(exercises) {
		const chapters = {};
		exercises.forEach(exercise => {
			const chapter = exercise.chapter || 'Uncategorized';
			if (!chapters[chapter]) {
				chapters[chapter] = [];
			}
			chapters[chapter].push(exercise);
		});

		// Sort exercises within each chapter by order
		Object.keys(chapters).forEach(chapter => {
			chapters[chapter].sort((a, b) => (a.order || 999) - (b.order || 999));
		});

		return chapters;
	}

	/**
	 * Set active exercise in menu
	 * @param {string} exerciseId - Exercise ID
	 */
	setActive(exerciseId) {
		document.querySelectorAll('.exercise-item').forEach(item => {
			item.classList.remove('active');
		});

		const activeItem = document.querySelector(`[data-exercise-id="${exerciseId}"]`);
		if (activeItem) {
			activeItem.classList.add('active');
		}
	}
}

export default ExerciseMenu;

