# Development Guide

This guide helps developers set up their environment and contribute to the project.

## Prerequisites

- **Node.js** 14.0.0 or higher
- **Docker** 20.10 or higher
- **Git** for version control
- A code editor (VS Code recommended)

## Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bexercises
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Build Docker runner image**
   ```bash
   docker build -t bexercises-runner:latest -f Dockerfile.runner .
   ```

5. **Create required directories**
   ```bash
   mkdir -p tmp fixtures
   chmod 755 tmp
   ```

## Running the Development Server

### Standard Mode
```bash
npm start
```

### Watch Mode (Node 18+)
Automatically restarts on file changes:
```bash
npm run dev
```

The server will start on http://localhost:3000

## Project Structure

See [STRUCTURE.md](./STRUCTURE.md) for detailed architecture documentation.

## Code Style Guide

### Backend (Node.js)

- Use modern JavaScript (ES6+)
- Use async/await for asynchronous code
- Add JSDoc comments for functions
- Follow single responsibility principle
- Keep functions small and focused

Example:
```javascript
/**
 * Get exercise by ID
 * @param {string} id - Exercise ID
 * @returns {Promise<Object|null>} Exercise object or null
 */
async function getExerciseById(id) {
	const all = await loadExercisesInternal();
	return all.find(e => e.id === id) || null;
}
```

### Frontend (JavaScript)

- Use ES6 modules
- Use classes for components
- Keep components independent
- Use meaningful variable names
- Add comments for complex logic

Example:
```javascript
/**
 * Test Results Component
 */
class TestResults {
	constructor() {
		this.resultsContainer = document.getElementById('test-results');
	}

	/**
	 * Display test results
	 * @param {Array} results - Array of test result objects
	 */
	display(results) {
		// Implementation
	}
}
```

## Adding New Features

### 1. Adding a New Service (Backend)

Create a new file in `src/services/`:

```javascript
// src/services/myService.js
const config = require('../config');

/**
 * My service description
 */
class MyService {
	async doSomething() {
		// Implementation
	}
}

module.exports = MyService;
```

Use in routes:
```javascript
const MyService = require('../services/myService');
const myService = new MyService();
```

### 2. Adding a New API Route

Create route handler in `src/routes/`:

```javascript
// src/routes/myRoutes.js
const express = require('express');
const router = express.Router();

router.get('/my-endpoint', async (req, res) => {
	try {
		// Implementation
		res.json({ success: true });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

module.exports = router;
```

Register in `src/app.js`:
```javascript
const myRoutes = require('./routes/myRoutes');
app.use('/api/my', myRoutes);
```

### 3. Adding a New Frontend Component

Create component file:

```javascript
// frontend/js/components/myComponent.js
class MyComponent {
	constructor() {
		this.element = document.getElementById('my-component');
	}

	render(data) {
		// Update UI
	}
}

export default MyComponent;
```

Use in main.js:
```javascript
import MyComponent from './components/myComponent.js';

class ExerciseApp {
	constructor() {
		this.myComponent = new MyComponent();
	}
}
```

## Testing

### Manual Testing

1. **Start the server**
   ```bash
   npm start
   ```

2. **Open browser**
   Navigate to http://localhost:3000

3. **Test functionality**
   - Load exercises
   - Run tests
   - Check statistics
   - Test authentication (if configured)

### Testing Docker Integration

Test Docker runner manually:
```bash
# Create a test script
echo '#!/bin/bash\necho "Hello World"' > /tmp/test.sh
chmod +x /tmp/test.sh

# Run in container
docker run --rm \
  -v /tmp:/home/runner:rw \
  bexercises-runner:latest \
  bash /home/runner/test.sh
```

## Common Development Tasks

### Updating Exercise Data

Edit `exercises-internal.json`:
```json
{
	"id": "unique-id",
	"title": "Exercise Title",
	"description": "Description in markdown",
	"chapter": "Shell scripting",
	"order": 1,
	"testCases": [
		{
			"arguments": ["arg1", "arg2"],
			"expectedOutput": "expected output\n",
			"expectedExitCode": 0
		}
	],
	"solution": "#!/bin/bash\n# Solution code"
}
```

### Adding Fixture Files

1. Add file to `fixtures/` directory
2. Reference in exercise test case:
```json
{
	"testCases": [
		{
			"fixtures": ["myfile.txt"],
			"fixturePermissions": {
				"myfile.txt": 0o644
			}
		}
	]
}
```

### Debugging

#### Backend Debugging
Add logging:
```javascript
console.log('Debug info:', data);
console.error('Error occurred:', error);
```

Run with inspector:
```bash
node --inspect src/server.js
```

#### Frontend Debugging
Use browser DevTools:
- Console for logs
- Network tab for API calls
- Application tab for LocalStorage

Add breakpoints in source code.

## Environment Variables

Key environment variables in `.env`:

```bash
# Server
PORT=3000
NODE_ENV=development

# Session
SESSION_SECRET=your-secret-key

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
CALLBACK_URL=http://localhost:3000/auth/google/callback

# Docker
RUNNER_IMAGE=bexercises-runner:latest
PER_TEST_TIMEOUT_MS=30000
DOCKER_MEMORY=256m
DOCKER_PIDS_LIMIT=128

# Paths
TEMP_DIR=/srv/bexercises/tmp
```

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `SESSION_SECRET`
- [ ] Configure proper `CALLBACK_URL` for OAuth
- [ ] Set up HTTPS
- [ ] Configure firewall rules
- [ ] Set up monitoring
- [ ] Configure log rotation
- [ ] Set up automated backups

### Docker Deployment

Build production image:
```bash
docker build -t bexercises:latest .
```

Run container:
```bash
docker run -d \
  -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd)/exercises-internal.json:/app/exercises-internal.json:ro \
  -v $(pwd)/fixtures:/app/fixtures:ro \
  --name bexercises \
  bexercises:latest
```

## Troubleshooting

### Docker Issues

**Problem**: "Cannot connect to Docker daemon"
**Solution**: Ensure Docker is running and user has permissions

**Problem**: "Permission denied" on temp files
**Solution**: Check permissions on `/srv/bexercises/tmp`

### Frontend Issues

**Problem**: "Failed to fetch exercises"
**Solution**: Check backend is running and CORS is configured

**Problem**: Module import errors
**Solution**: Ensure using `type="module"` in script tag

### Authentication Issues

**Problem**: OAuth callback fails
**Solution**: Verify CALLBACK_URL matches Google Console settings

## Contributing

1. Create a feature branch
2. Make changes following code style
3. Test thoroughly
4. Update documentation
5. Submit pull request

## Getting Help

- Check existing documentation
- Review code comments
- Search issues on GitHub
- Ask in team chat

## Useful Resources

- [Express.js Documentation](https://expressjs.com/)
- [Passport.js Guide](http://www.passportjs.org/)
- [Docker Documentation](https://docs.docker.com/)
- [MDN Web Docs](https://developer.mozilla.org/)

