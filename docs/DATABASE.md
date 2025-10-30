# Database Migration Guide

## Overview

BITLab now uses SQLite database for storing exercises, users, and progress data. This provides better structure, relationships, and query capabilities compared to flat JSON files.

## Database Schema

### Tables

- **languages** - Programming languages (bash, python, javascript, etc.)
- **chapters** - Chapters within each language
- **exercises** - Individual exercises
- **test_cases** - Test cases for each exercise
- **users** - User accounts
- **user_progress** - User completion status and attempts
- **fixture_files** - Shared fixture files for exercises
- **test_case_fixtures** - Junction table linking test cases to fixtures

## Migration from JSON

### First-time Setup

1. **Run the migration script:**
   ```bash
   npm run migrate
   ```

   This will:
   - Create the SQLite database at `data/exercises.db`
   - Create all necessary tables
   - Import all exercises from `exercises-internal.json`
   - Import all fixture files from `fixtures/` directory
   - Set up the initial "bash" language

2. **Start the server:**
   ```bash
   npm start
   ```

   The server will automatically:
   - Initialize the database on startup
   - Use database for all queries
   - Fall back to JSON if database fails (for safety)

### Verifying Migration

After migration, check:
- Database file exists at `data/exercises.db`
- Server starts without errors
- Admin panel shows all exercises
- Files tab shows all fixtures

## Database Location

- **Development:** `data/exercises.db`
- **Production:** Same location (ensure `data/` directory is writable)

## Backup

To backup your database:
```bash
# Copy the database file
cp data/exercises.db data/exercises.backup.db

# Or use SQLite backup command
sqlite3 data/exercises.db ".backup data/exercises.backup.db"
```

## Querying the Database

You can query the database directly:
```bash
sqlite3 data/exercises.db

# Example queries:
SELECT * FROM languages;
SELECT * FROM chapters WHERE language_id = 'bash';
SELECT COUNT(*) FROM exercises;
SELECT * FROM user_progress WHERE user_id = 1;
```

## Key Features

### Multi-language Support
Easily add new languages:
```javascript
await databaseService.createLanguage({
  id: 'python',
  name: 'Python',
  description: 'Learn Python programming',
  order_num: 2
});
```

### User Progress Tracking
Track user completions and attempts:
```javascript
await databaseService.saveUserProgress(userId, exerciseId, {
  completed: true,
  last_submission: scriptCode
});
```

### Efficient Queries
Get exercises for specific language/chapter:
```javascript
const exercises = await databaseService.getExercisesByChapter(chapterId);
```

### Statistics
Get user statistics:
```javascript
const stats = await databaseService.getUserStatistics(userId);
// Returns: total_attempts, total_completed, avg_attempts, byLanguage
```

## Migration Rollback

If you need to go back to JSON-only:

1. Stop the server
2. Remove/rename `data/exercises.db`
3. The system will automatically fall back to JSON files
4. Restart the server

## Future Enhancements

- [ ] Add Python language
- [ ] Add JavaScript language
- [ ] Implement user authentication with database
- [ ] Add exercise difficulty levels
- [ ] Add tags/categories for exercises
- [ ] Add exercise recommendations based on progress
- [ ] Add leaderboards and achievements

