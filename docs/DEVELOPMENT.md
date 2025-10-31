# BITLab Development Guide

This guide is for developers who want to contribute to BITLab or customize it for their needs.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Code Style](#code-style)
- [Adding Features](#adding-features)
- [Common Tasks](#common-tasks)
- [Testing](#testing)
- [Debugging](#debugging)
- [Contributing](#contributing)

## Development Setup

### Prerequisites

- Node.js v14+
- Docker
- Git
- A code editor (VS Code, WebStorm, etc.)

### Initial Setup

1. **Clone and install**:
   ```bash
   git clone <repository-url>
   cd BITLab
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build Docker runner**:
   ```bash
   docker build -f Dockerfile.runner -t bitlab-runner:latest .
   ```

4. **Start development server**:
   ```bash
   npm start
   ```

### Development Tools

- **ESLint**: Code linting configured in `eslint.config.js`
- **SQLite Browser**: For inspecting the database
- **Docker Desktop**: For container management
- **Browser DevTools**: For frontend debugging

## Project Architecture

See [STRUCTURE.md](STRUCTURE.md) for detailed architecture documentation.

### Key Technologies

- **Backend**: Express.js (Node.js)
- **Frontend**: Vanilla JavaScript (ES6 modules)
- **Database**: SQLite with better-sqlite3
- **Authentication**: Passport.js (Google OAuth)
- **Code Execution**: Docker containers

### Design Patterns

- **Service Layer**: Business logic separated from routes
- **Module Pattern**: Frontend uses ES6 modules
- **Middleware Chain**: Express middleware for auth, CORS, etc.
- **Repository Pattern**: Database service abstracts queries

## Code Style

### JavaScript

- Use `const` and `let`, avoid `var`
- Use arrow functions for callbacks
- Use async/await over promises
- Use template literals for strings
- Add JSDoc comments for functions
- Use meaningful variable names

Example:
```javascript
/**
 * Submit a solution for an exercise
 * @param {string} exerciseId - Exercise identifier
 * @param {string} script - User's code
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Submission results
 */
async function submitSolution(exerciseId, script, userId) {
    const exercise = await exerciseService.getExerciseWithTests(exerciseId);
    const results = await testRunner.runTests(exercise, script);
    
    await databaseService.saveSubmission({
        userId,
        exerciseId,
        script,
        results
    });
    
    return results;
}
```

### File Organization

- One class/module per file
- Group related functionality in services
- Keep routes thin, logic in services
- Use meaningful file and directory names

### Error Handling

- Always use try-catch for async operations
- Log errors to console with context
- Return appropriate HTTP status codes
- Provide helpful error messages

Example:
```javascript
router.post('/exercises/:id/submit', async (req, res) => {
    try {
        const { script } = req.body;
        
        if (!script || typeof script !== 'string') {
            return res.status(400).json({ 
                error: 'Invalid script provided' 
            });
        }
        
        const results = await submitSolution(
            req.params.id, 
            script, 
            req.user.id
        );
        
        res.json(results);
    } catch (error) {
        console.error('Submission error:', error);
        res.status(500).json({ 
            error: 'Failed to submit solution',
            detail: error.message 
        });
    }
});
```

## Adding Features

### Adding a New API Endpoint

1. **Add route handler** in appropriate file (`src/routes/api.js` or `src/routes/admin.js`):

```javascript
router.get('/my-endpoint', async (req, res) => {
    try {
        const data = await myService.getData();
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to get data' });
    }
});
```

2. **Add service method** if needed (`src/services/myService.js`):

```javascript
async function getData() {
    // Business logic here
    return data;
}

module.exports = { getData };
```

3. **Update frontend API service** (`frontend/js/services/apiService.js`):

```javascript
async getMyData() {
    const response = await fetch(`${this.basePath}/api/my-endpoint`, {
        credentials: 'include'
    });
    return this.handleResponse(response);
}
```

### Adding a New Page

1. **Create HTML file** in `frontend/pages/mypage.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Page - BITLab</title>
    <link rel="stylesheet" href="../styles.css">
</head>
<body>
    <div id="app"></div>
    <script type="module" src="../js/pages/mypage.js"></script>
</body>
</html>
```

2. **Create page controller** in `frontend/js/pages/mypage.js`:

```javascript
import ApiService from '../services/apiService.js';
import AuthComponent from '../components/authComponent.js';

class MyPage {
    constructor() {
        this.apiService = new ApiService();
        this.authComponent = new AuthComponent(this.apiService);
        this.init();
    }

    async init() {
        const isAuthenticated = await this.authComponent.checkAuth();
        if (!isAuthenticated) {
            window.location.href = './login.html';
            return;
        }

        await this.loadData();
        this.setupEventListeners();
    }

    async loadData() {
        const data = await this.apiService.getMyData();
        this.render(data);
    }

    render(data) {
        // Update DOM
    }

    setupEventListeners() {
        // Add event listeners
    }
}

new MyPage();
```

### Adding a New Exercise

Exercises are stored in the database. Use the admin panel to create exercises, or use the database directly:

```javascript
// Example: Adding via database service
await db.createExercise({
    languageId: 'bash',
    title: 'My Exercise',
    description: 'Exercise description',
    difficulty: 'easy',
    starterCode: '#!/bin/bash\n\n',
    testCases: [
        {
            arguments: ['arg1'],
            input: [],
            expectedOutput: 'expected output',
            expectedExitCode: 0,
            fixtures: ['testfile']
        }
    ]
});
```

### Adding a New Language

1. **Add language to database** (via admin panel or script):

```sql
INSERT INTO languages (id, name, description, icon_svg, order_num, enabled)
VALUES ('python', 'Python', 'Python programming', '<svg>...</svg>', 2, 1);
```

2. **Update Docker runner** if needed (`Dockerfile.runner`):

```dockerfile
# Add Python support
RUN apt-get update && apt-get install -y python3
```

3. **Rebuild Docker image**:
```bash
docker build -f Dockerfile.runner -t bitlab-runner:latest .
```

## Common Tasks

### Database Migrations

When changing the database schema:

1. Update schema in `src/services/databaseService.js`
2. Create migration function:

```javascript
async function migrate() {
    await this.db.exec(`
        ALTER TABLE exercises ADD COLUMN new_field TEXT;
    `);
}
```

3. Run migration (manual or via script)

### Adding Fixtures

1. Add file to `fixtures/` directory
2. Reference in test case:

```javascript
{
    fixtures: ['myfile.txt'],
    fixturePermissions: { 'myfile.txt': 0o644 }
}
```

### Debugging Docker Execution

Enable verbose logging in `dockerService.js`:

```javascript
console.log('Running command:', cmd);
console.log('Container output:', output);
```

Or run containers manually:

```bash
docker run --rm -it bitlab-runner:latest bash
```

### Clearing User Data

Reset a user's progress:

```sql
DELETE FROM submissions WHERE user_id = 'user-id';
DELETE FROM exercise_progress WHERE user_id = 'user-id';
```

### Backing Up Database

```bash
cp data/exercises.db data/exercises.db.backup
```

Restore:
```bash
cp data/exercises.db.backup data/exercises.db
```

## Testing

### Manual Testing

1. Test authentication flow
2. Test exercise submission
3. Test admin functions
4. Test with different browsers
5. Test error cases

### API Testing with curl

```bash
# Test authentication endpoint
curl -X POST http://localhost:3000/api/exercises/ex1/submit \
  -H "Content-Type: application/json" \
  -d '{"script":"#!/bin/bash\necho test"}' \
  --cookie-jar cookies.txt

# Test admin endpoint
curl http://localhost:3000/api/admin/exercises \
  --cookie cookies.txt
```

### Load Testing

Test concurrent submissions:

```bash
# Install artillery
npm install -g artillery

# Create test config
artillery quick --count 10 --num 5 http://localhost:3000
```

## Debugging

### Backend Debugging

Add debug statements:

```javascript
console.log('Debug:', { variable, data });
console.error('Error occurred:', error);
```

Use Node.js inspector:

```bash
node --inspect src/server.js
```

Then open Chrome DevTools → Node icon

### Frontend Debugging

Use browser DevTools:
- Console for logs
- Network tab for API calls
- Application tab for storage
- Sources tab for breakpoints

Add breakpoints:

```javascript
debugger; // Execution will pause here
```

### Database Debugging

View queries:

```javascript
// In databaseService.js
console.log('Query:', sql, params);
```

Use SQLite browser:
```bash
sqlite3 data/exercises.db
.tables
.schema users
SELECT * FROM users;
```

### Docker Debugging

View container logs:

```bash
docker ps -a
docker logs <container-id>
```

Inspect running container:

```bash
docker exec -it <container-id> bash
```

## Performance Optimization

### Backend

- Use database indexes for frequent queries
- Limit concurrent Docker containers
- Cache exercise data in memory
- Use connection pooling

### Frontend

- Minimize API calls
- Use localStorage for caching
- Lazy load components
- Debounce auto-save

### Docker

- Reduce image size
- Set appropriate resource limits
- Clean up containers promptly
- Use shared base images

## Security Best Practices

### Authentication

- Always check `req.user` exists
- Use `requireAdmin` middleware for admin routes
- Set secure session cookies in production
- Rotate session secrets periodically

### Code Execution

- Never trust user input
- Enforce resource limits (memory, CPU, PIDs)
- Use non-root user in containers
- Disable network access
- Apply timeouts

### Database

- Use parameterized queries (prevents SQL injection)
- Validate input before database operations
- Set appropriate file permissions
- Regular backups

### API

- Validate all input
- Return appropriate error codes
- Don't expose sensitive data
- Rate limit submissions

## Contributing

### Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/my-feature
   ```

2. Make changes and commit:
   ```bash
   git add .
   git commit -m "Add my feature"
   ```

3. Push and create pull request:
   ```bash
   git push origin feature/my-feature
   ```

### Commit Messages

Use clear, descriptive commit messages:

- `feat: Add user statistics dashboard`
- `fix: Correct test timeout handling`
- `docs: Update API documentation`
- `refactor: Simplify exercise service`
- `test: Add submission tests`

### Code Review Checklist

- [ ] Code follows style guide
- [ ] Functions have JSDoc comments
- [ ] Error handling is appropriate
- [ ] No console.logs in production code
- [ ] Security considerations addressed
- [ ] Manual testing completed
- [ ] Documentation updated

## Useful Commands

```bash
# Start server
npm start

# Run with debugging
node --inspect src/server.js

# Rebuild Docker image
docker build -f Dockerfile.runner -t bitlab-runner:latest .

# View running containers
docker ps

# Clean up stopped containers
docker container prune

# Database backup
cp data/exercises.db data/exercises.db.backup

# Check database size
ls -lh data/exercises.db

# View database tables
sqlite3 data/exercises.db .tables

# Check port usage
netstat -ano | findstr :3000
```

## Resources

- [Express.js Documentation](https://expressjs.com/)
- [Docker Documentation](https://docs.docker.com/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Passport.js Guide](http://www.passportjs.org/docs/)
- [MDN Web Docs](https://developer.mozilla.org/)

## Getting Help

- Check documentation in `docs/`
- Review code comments
- Search existing issues
- Ask in project discussions
- Read error messages carefully

## Future Enhancements

Potential areas for improvement:

- [ ] Add more language support (Python, JavaScript, Java)
- [ ] Implement automated tests
- [ ] Add code syntax highlighting in workspace
- [ ] Real-time collaboration features
- [ ] Export/import exercises
- [ ] API rate limiting
- [ ] WebSocket support for live updates
- [ ] Progressive web app features
- [ ] Offline mode
- [ ] Mobile-responsive design improvements

