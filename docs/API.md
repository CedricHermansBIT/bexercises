# API Documentation

This document describes all API endpoints available in the Bash Programming Exercises application.

## Base URL

```
http://localhost:3000
```

## Authentication Endpoints

### Initiate Google OAuth

```
GET /auth/google
```

Redirects to Google OAuth consent screen.

**Response**: Redirect to Google

---

### Google OAuth Callback

```
GET /auth/google/callback
```

Handles OAuth callback from Google.

**Response**: Redirect to `/` on success

---

### Get Current User

```
GET /auth/user
```

Returns information about the currently authenticated user.

**Response**:
```json
{
	"authenticated": true,
	"user": {
		"id": "google-user-id",
		"email": "user@example.com",
		"name": "User Name",
		"picture": "https://..."
	}
}
```

Or if not authenticated:
```json
{
	"authenticated": false,
	"user": null
}
```

---

### Logout

```
GET /auth/logout
```

Logs out the current user and destroys session.

**Response**: Redirect to `/`

---

## Exercise Endpoints

### Get All Exercises

```
GET /api/exercises
```

Returns a list of all available exercises without test cases or solutions.

**Response**:
```json
[
	{
		"id": "hello-world",
		"title": "Hello World",
		"description": "Write a script that prints 'Hello, World!'",
		"solution": "#!/bin/bash\necho \"Hello, World!\"",
		"chapter": "Shell scripting",
		"order": 1
	},
	...
]
```

**Status Codes**:
- `200 OK` - Success
- `500 Internal Server Error` - Server error

---

### Get Exercise by ID

```
GET /api/exercises/:id
```

Returns a single exercise by ID without test cases.

**Parameters**:
- `id` (path) - Exercise ID

**Response**:
```json
{
	"id": "hello-world",
	"title": "Hello World",
	"description": "Write a script that prints 'Hello, World!'",
	"solution": "#!/bin/bash\necho \"Hello, World!\""
}
```

**Status Codes**:
- `200 OK` - Success
- `404 Not Found` - Exercise not found
- `500 Internal Server Error` - Server error

---

### Run Exercise Tests

```
POST /api/exercises/:id/run
```

Executes user's script against exercise test cases.

**Parameters**:
- `id` (path) - Exercise ID

**Request Body**:
```json
{
	"script": "#!/bin/bash\necho \"Hello, World!\""
}
```

**Response**:
```json
{
	"results": [
		{
			"testNumber": 1,
			"arguments": [],
			"expectedOutput": "Hello, World!",
			"expectedExitCode": 0,
			"actualOutput": "Hello, World!",
			"stderr": "",
			"exitCode": 0,
			"timedOut": false,
			"error": null,
			"passed": true
		}
	],
	"statistics": {
		"totalAttempts": 5,
		"successfulAttempts": 3,
		"failedAttempts": 2,
		"lastAttempt": "2024-01-15T10:30:00.000Z",
		"failureReasons": {
			"wrong_output": 1,
			"timeout": 1
		}
	}
}
```

**Status Codes**:
- `200 OK` - Tests executed successfully
- `400 Bad Request` - Missing or invalid script
- `404 Not Found` - Exercise not found
- `500 Internal Server Error` - Server error

---

## Statistics Endpoints

### Get Exercise Statistics

```
GET /api/statistics/:id
```

Returns statistics for a specific exercise.

**Parameters**:
- `id` (path) - Exercise ID

**Response**:
```json
{
	"totalAttempts": 10,
	"successfulAttempts": 7,
	"failedAttempts": 3,
	"lastAttempt": "2024-01-15T10:30:00.000Z",
	"failureReasons": {
		"timeout": 1,
		"wrong_exit_code": 1,
		"wrong_output": 1
	}
}
```

**Status Codes**:
- `200 OK` - Success
- `500 Internal Server Error` - Server error

---

### Get All Statistics

```
GET /api/statistics
```

Returns statistics for all exercises.

**Response**:
```json
{
	"hello-world": {
		"totalAttempts": 10,
		"successfulAttempts": 7,
		"failedAttempts": 3,
		"lastAttempt": "2024-01-15T10:30:00.000Z",
		"failureReasons": { ... }
	},
	"variables": {
		"totalAttempts": 5,
		...
	}
}
```

**Status Codes**:
- `200 OK` - Success
- `500 Internal Server Error` - Server error

---

## Data Models

### Exercise Model

```typescript
{
	id: string;              // Unique exercise identifier
	title: string;           // Exercise title
	description: string;     // Markdown description
	solution: string;        // Reference solution (bash script)
	chapter: string;         // Chapter/category name
	order: number;           // Order within chapter
}
```

### Test Case Model (Internal Only)

```typescript
{
	arguments: string[];           // Command line arguments
	input?: string[];             // Stdin input lines
	expectedOutput: string;        // Expected stdout
	expectedExitCode: number;      // Expected exit code (default: 0)
	fixtures?: string[];          // Required fixture files
	fixturePermissions?: {        // File permissions for fixtures
		[filename: string]: number;
	};
}
```

### Test Result Model

```typescript
{
	testNumber: number;        // Test case number (1-based)
	arguments: string[];       // Arguments used
	expectedOutput: string;    // Expected output
	expectedExitCode: number;  // Expected exit code
	actualOutput: string;      // Actual output received
	stderr: string;           // Standard error output
	exitCode: number;         // Actual exit code
	timedOut: boolean;        // Whether test timed out
	error: string | null;     // Error message if any
	passed: boolean;          // Whether test passed
}
```

### Statistics Model

```typescript
{
	totalAttempts: number;              // Total test runs
	successfulAttempts: number;         // Successful runs
	failedAttempts: number;             // Failed runs
	lastAttempt: string;                // ISO timestamp of last attempt
	failureReasons: {                   // Breakdown of failure types
		[reason: string]: number;       // Count per failure reason
	};
}
```

### User Model

```typescript
{
	id: string;              // Google user ID
	email: string;           // User email
	name: string;            // Display name
	picture: string;         // Profile picture URL
}
```

---

## Error Responses

All endpoints may return error responses in this format:

```json
{
	"error": "Error message",
	"detail": "Detailed error information (development only)"
}
```

Common error status codes:
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - VPN/access denied
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Rate Limiting

Currently, no rate limiting is implemented. Consider adding rate limiting in production.

---

## CORS

CORS is enabled for all origins in development. Update CORS middleware for production.

---

## Examples

### Fetch exercises (JavaScript)

```javascript
const response = await fetch('/api/exercises');
const exercises = await response.json();
```

### Run tests (JavaScript)

```javascript
const response = await fetch('/api/exercises/hello-world/run', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		script: '#!/bin/bash\necho "Hello, World!"'
	})
});
const { results, statistics } = await response.json();
```

### Get current user (JavaScript)

```javascript
const response = await fetch('/auth/user');
const { authenticated, user } = await response.json();

if (authenticated) {
	console.log('Logged in as:', user.name);
}
```

---

## Versioning

Current API version: **v1** (implicit, no version prefix)

Future versions may use `/api/v2/` prefix.
# Project Structure

This document explains the organization and architecture of the Bash Programming Exercises project.

## Directory Structure

```
bexercises/
├── src/                           # Backend source code (Node.js)
│   ├── config/                    # Configuration management
│   │   └── index.js              # Central configuration file
│   ├── middleware/                # Express middleware
│   │   ├── auth.js               # Authentication middleware
│   │   └── cors.js               # CORS configuration
│   ├── routes/                    # API route handlers
│   │   ├── api.js                # Exercise and test API routes
│   │   └── auth.js               # Authentication routes
│   ├── services/                  # Business logic layer
│   │   ├── dockerService.js      # Docker container management
│   │   ├── exerciseService.js    # Exercise data management
│   │   ├── statisticsService.js  # Statistics tracking
│   │   └── testRunner.js         # Test execution logic
│   ├── app.js                     # Express app configuration
│   └── server.js                  # Server entry point
│
├── frontend/                      # Frontend code (Vanilla JS + ES6 Modules)
│   ├── js/                       
│   │   ├── components/           # UI components
│   │   │   ├── authComponent.js  # Authentication UI
│   │   │   ├── exerciseMenu.js   # Exercise list/navigation
│   │   │   ├── statistics.js     # Statistics display
│   │   │   └── testResults.js    # Test results display
│   │   ├── services/             # Frontend services
│   │   │   ├── apiService.js     # Backend API client
│   │   │   └── storageService.js # LocalStorage management
│   │   ├── utils/                # Utility functions
│   │   │   └── urlUtils.js       # URL management
│   │   └── main.js               # Application entry point
│   ├── index.html                # Main HTML file
│   └── styles.css                # Styling
│
├── fixtures/                      # Test fixture files
├── exercises-internal.json        # Exercise definitions (with test cases)
├── statistics.json               # Exercise statistics
├── .env                          # Environment variables (not in git)
├── .env.example                  # Example environment configuration
├── Dockerfile.runner             # Docker image for running tests
├── package.json                  # Node.js dependencies
└── README.md                     # Project documentation
```

## Architecture Overview

### Backend (Node.js/Express)

The backend follows a layered architecture pattern:

1. **Routes Layer** (`src/routes/`)
   - Handles HTTP requests
   - Input validation
   - Delegates to services

2. **Services Layer** (`src/services/`)
   - Business logic
   - Data access
   - External integrations (Docker)

3. **Middleware Layer** (`src/middleware/`)
   - Cross-cutting concerns
   - Authentication
   - CORS

4. **Configuration Layer** (`src/config/`)
   - Centralized configuration
   - Environment variables

### Frontend (Vanilla JS + ES6 Modules)

The frontend uses a component-based architecture:

1. **Components** (`frontend/js/components/`)
   - Self-contained UI modules
   - Responsible for rendering and user interaction

2. **Services** (`frontend/js/services/`)
   - API communication
   - Data persistence
   - Shared business logic

3. **Utilities** (`frontend/js/utils/`)
   - Helper functions
   - Common utilities

## Data Flow

### Exercise Loading Flow
```
User → Frontend (main.js)
     → ApiService.getExercise()
     → Backend API (routes/api.js)
     → ExerciseService.getExerciseById()
     → exercises-internal.json
     → Response back to Frontend
     → Update UI components
```

### Test Execution Flow
```
User clicks "Run Tests"
     → Frontend (main.js)
     → ApiService.runTests()
     → Backend API (routes/api.js)
     → TestRunner.runTests()
     → DockerService.createTempScript()
     → DockerService.runScriptInContainer()
     → Docker executes script
     → Results collected
     → StatisticsService.updateStatistics()
     → Response to Frontend
     → TestResults.display()
```

## Key Design Patterns

### 1. Separation of Concerns
- Each module has a single, well-defined responsibility
- Business logic separated from presentation
- Configuration separated from code

### 2. Dependency Injection
- Services receive dependencies through constructor
- Makes testing easier
- Reduces coupling

### 3. Service Layer Pattern
- Business logic encapsulated in service classes
- Reusable across different routes
- Easier to test and maintain

### 4. Component Pattern (Frontend)
- UI broken into independent components
- Each component manages its own state
- Components communicate through callbacks

## Configuration Management

All configuration is centralized in `src/config/index.js`:

- Server settings (port, environment)
- Session configuration
- OAuth credentials
- Docker settings
- File paths

Configuration is loaded from environment variables (`.env` file).

## Security Considerations

1. **Isolated Execution**: User scripts run in isolated Docker containers
2. **Resource Limits**: Docker containers have memory and process limits
3. **No Network Access**: Containers run with `--network none`
4. **Input Validation**: All API inputs are validated
5. **Session Security**: Secure cookies in production mode
6. **No Sensitive Data Exposure**: Test cases and solutions not exposed to frontend

## Testing Strategy

### Backend Testing
- Unit tests for services
- Integration tests for API routes
- Docker container isolation tests

### Frontend Testing
- Component unit tests
- Service tests with mocked API
- End-to-end tests

## Performance Optimizations

1. **Lazy Loading**: Exercises loaded on demand
2. **Caching**: LocalStorage for user progress
3. **Efficient Docker Usage**: Temp files cleaned up after each test
4. **Connection Pooling**: Reusable HTTP connections

## Extending the Project

### Adding a New Exercise
1. Add exercise definition to `exercises-internal.json`
2. Add fixture files to `fixtures/` if needed
3. Exercise automatically appears in frontend

### Adding a New API Endpoint
1. Create route handler in `src/routes/`
2. Create service method in `src/services/`
3. Register route in `src/app.js`

### Adding a New Frontend Component
1. Create component file in `frontend/js/components/`
2. Import and initialize in `frontend/js/main.js`
3. Add required HTML elements in `frontend/index.html`

## Migration Guide

If migrating from the old structure:

1. **Backend**: Replace `server.js` import with `src/server.js` in package.json
2. **Frontend**: Update HTML to use `<script type="module" src="js/main.js">`
3. **Environment**: Copy `.env` settings (no changes needed)
4. **Run**: Use `npm start` as before

## Future Improvements

- [ ] Add TypeScript for better type safety
- [ ] Add automated testing suite
- [ ] Implement user database for persistent progress
- [ ] Add exercise difficulty ratings
- [ ] Implement hints system
- [ ] Add code templates for different exercise types
- [ ] Add admin panel for managing exercises

