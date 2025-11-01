// src/scripts/fixFixtures.js
// Script to link fixtures from exercises-internal.json to test cases in database

const databaseService = require('../services/databaseService');
const fs = require('fs').promises;
const path = require('path');

async function fixFixtures() {
	console.log('Fixing fixture links in database...\n');

	try {
		// Initialize database
		await databaseService.init();

		// Read existing JSON data
		const jsonPath = path.join(__dirname, '../../exercises-internal.json');
		const jsonData = JSON.parse(await fs.readFile(jsonPath, 'utf8'));

		console.log(`Processing ${jsonData.length} exercises from JSON file\n`);

		for (const exercise of jsonData) {
			console.log(`Processing exercise: ${exercise.id}`);

			// Get the exercise from database with its test cases
			const dbExercise = await databaseService.getExerciseWithTests(exercise.id);

			if (!dbExercise) {
				console.log(`  ⚠️  Exercise not found in database, skipping`);
				continue;
			}

			// Check if exercise has test cases with fixtures in JSON
			if (!exercise.testCases || !Array.isArray(exercise.testCases)) {
				console.log(`  No test cases in JSON, skipping`);
				continue;
			}

			let fixturesLinked = 0;

			for (let i = 0; i < exercise.testCases.length; i++) {
				const jsonTestCase = exercise.testCases[i];
				const dbTestCase = dbExercise.testCases[i];

				if (!dbTestCase) {
					console.log(`  ⚠️  Test case ${i} not found in database`);
					continue;
				}

				// Check if this test case has fixtures in JSON
				if (jsonTestCase.fixtures && Array.isArray(jsonTestCase.fixtures) && jsonTestCase.fixtures.length > 0) {
					console.log(`  Test case ${i + 1}: Linking ${jsonTestCase.fixtures.length} fixtures`);

					for (const fixtureName of jsonTestCase.fixtures) {
						// Get fixture from database
						const fixture = await databaseService.getFixtureFile(fixtureName);

						if (fixture) {
							// Link fixture to test case
							await databaseService.db.run(`
								INSERT OR IGNORE INTO test_case_fixtures (test_case_id, fixture_id)
								VALUES (?, ?)
							`, [dbTestCase.id, fixture.id]);

							console.log(`    ✓ Linked: ${fixtureName}`);
							fixturesLinked++;
						} else {
							console.log(`    ⚠️  Fixture not found in database: ${fixtureName}`);
						}
					}
				}
			}

			if (fixturesLinked > 0) {
				console.log(`  ✓ Linked ${fixturesLinked} fixtures for exercise ${exercise.id}\n`);
			} else {
				console.log(`  No fixtures to link\n`);
			}
		}

		// Verify the fix
		console.log('\n=== Verification ===');
		const result = await databaseService.db.get(`
			SELECT COUNT(*) as count FROM test_case_fixtures
		`);
		console.log(`Total fixture links in database: ${result.count}`);

		// Check one specific exercise
		const mineCounter = await databaseService.getExerciseWithTests('mine-counter');
		if (mineCounter) {
			console.log(`\nmine-counter exercise test cases:`);
			mineCounter.testCases.forEach((tc, i) => {
				console.log(`  Test ${i + 1}: ${tc.fixtures.length} fixtures - ${tc.fixtures.join(', ')}`);
			});
		}

		console.log('\n✅ Fixture fixing completed successfully!');

	} catch (error) {
		console.error('❌ Fixture fixing failed:', error);
		process.exit(1);
	} finally {
		await databaseService.close();
	}
}

// Run script
if (require.main === module) {
	fixFixtures().then(() => process.exit(0));
}

module.exports = fixFixtures;

