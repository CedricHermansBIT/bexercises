// src/scripts/migrateToDatabase.js
const databaseService = require('../services/databaseService');
const fs = require('fs').promises;
const path = require('path');

async function migrate() {
	console.log('Starting migration from JSON to SQLite...\n');

	try {
		// Initialize database
		await databaseService.init();

		// Read existing JSON data
		const jsonPath = path.join(__dirname, '../../exercises-internal.json');
		const jsonData = JSON.parse(await fs.readFile(jsonPath, 'utf8'));

		console.log(`Found ${jsonData.length} exercises in JSON file`);

		// Create language: bash (for now, all exercises are bash)
		console.log('\nCreating language: bash');
		await databaseService.createLanguage({
			id: 'bash',
			name: 'Shell Scripting',
			description: 'Learn Bash shell scripting fundamentals',
			icon_svg: '<svg>...</svg>', // You can add the actual SVG later
			order_num: 1,
			enabled: true
		});

		// Get unique chapters from exercises
		const chaptersSet = new Set();
		jsonData.forEach(ex => {
			if (ex.chapter) chaptersSet.add(ex.chapter);
		});

		const chapters = Array.from(chaptersSet);
		console.log(`\nFound ${chapters.length} unique chapters`);

		// Create chapters
		for (let i = 0; i < chapters.length; i++) {
			const chapterName = chapters[i];
			const chapterId = chapterName.toLowerCase().replace(/\s+/g, '-');

			console.log(`  Creating chapter: ${chapterName}`);
			await databaseService.createChapter({
				id: chapterId,
				language_id: 'bash',
				name: chapterName,
				order_num: i + 1
			});
		}

		// Migrate exercises
		console.log(`\nMigrating ${jsonData.length} exercises...`);

		for (const exercise of jsonData) {
			const chapterId = (exercise.chapter || 'uncategorized').toLowerCase().replace(/\s+/g, '-');

			console.log(`  Migrating: ${exercise.id}`);

			await databaseService.createExercise({
				id: exercise.id,
				chapter_id: chapterId,
				title: exercise.title,
				description: exercise.description,
				solution: exercise.solution,
				order_num: exercise.order || 0,
				testCases: exercise.testCases || []
			});
		}

		// Migrate fixture files from fixtures directory
		console.log('\nMigrating fixture files...');
		const fixturesDir = path.join(__dirname, '../../fixtures');

		try {
			const files = await fs.readdir(fixturesDir);

			for (const filename of files) {
				const filePath = path.join(fixturesDir, filename);
				const stats = await fs.stat(filePath);

				if (stats.isFile()) {
					const content = await fs.readFile(filePath, 'utf8');
					console.log(`  Migrating file: ${filename}`);
					await databaseService.createFixtureFile(filename, content);
				}
			}
		} catch (error) {
			console.log('  No fixtures directory found or error reading fixtures:', error.message);
		}

		// Verify migration
		console.log('\n=== Migration Summary ===');
		const languages = await databaseService.getLanguages();
		console.log(`Languages: ${languages.length}`);

		for (const lang of languages) {
			const chapters = await databaseService.getChaptersByLanguage(lang.id);
			console.log(`\n${lang.name}:`);
			console.log(`  Chapters: ${chapters.length}`);

			let totalExercises = 0;
			for (const chapter of chapters) {
				const exercises = await databaseService.getExercisesByChapter(chapter.id);
				console.log(`    - ${chapter.name}: ${exercises.length} exercises`);
				totalExercises += exercises.length;
			}
			console.log(`  Total exercises: ${totalExercises}`);
		}

		const fixtures = await databaseService.getFixtureFiles();
		console.log(`\nFixture files: ${fixtures.length}`);

		console.log('\n✅ Migration completed successfully!');

	} catch (error) {
		console.error('❌ Migration failed:', error);
		process.exit(1);
	} finally {
		await databaseService.close();
	}
}

// Run migration
if (require.main === module) {
	migrate().then(() => process.exit(0));
}

module.exports = migrate;

