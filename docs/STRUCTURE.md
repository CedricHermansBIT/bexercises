# BITLab Project Structure

This document provides an overview of the BITLab project architecture and file organization.

## Project Overview

BITLab is a web-based platform for programming exercises with automated testing. It uses:
- **Backend**: Node.js + Express
- **Frontend**: Vanilla JavaScript (ES6 modules)
- **Database**: SQLite with better-sqlite3
- **Authentication**: Google OAuth 2.0 via Passport.js
- **Code Execution**: Docker containers for isolation

## Directory Structure

```
BITLab/
├── data/                           # Database files
│   ├── exercises.db                # Main SQLite database
│   ├── exercises.db-shm            # Shared memory file (WAL mode)
│   └── exercises.db-wal            # Write-ahead log (WAL mode)
│
├── docs/                           # Documentation
│   ├── DEVELOPMENT.md              # Development guide
│   ├── FIRST_ADMIN_SETUP.md        # First admin setup instructions
│   ├── QUICKSTART.md               # Quick setup guide
│   └── STRUCTURE.md                # This file
│
├── fixtures/                       # Test fixtures for exercises
│   ├── README.md                   # Fixtures documentation
│   ├── empty.txt                   # Empty file for testing
│   ├── FASTQ.txt                   # Sample FASTQ data
│   ├── minefield.txt               # Grid data for minefield exercise
│   ├── testfile                    # Generic test file
│   └── testfile2                   # Another test file
│
├── frontend/                       # Client-side application
│   ├── index.html                  # Entry point (redirects to login)
│   ├── styles.css                  # Global styles
│   │
│   ├── js/                         # JavaScript modules
│   │   ├── main.js                 # Main entry point
│   │   │
│   │   ├── components/             # Reusable UI components
│   │   │   ├── authComponent.js    # Authentication handling
│   │   │   ├── exerciseMenu.js     # Exercise navigation menu
│   │   │   ├── statistics.js       # Statistics display
│   │   │   └── testResults.js      # Test results viewer
│   │   │
│   │   ├── pages/                  # Page controllers
│   │   │   ├── adminPage.js        # Admin panel logic
│   │   │   ├── exercisesPage.js    # Exercise list page
│   │   │   ├── languagesPage.js    # Language selection page
│   │   │   ├── leaderboardPage.js  # Leaderboard display
│   │   │   ├── loginPage.js        # Login page controller
│   │   │   └── workspacePage.js    # Code editor workspace
│   │   │
│   │   ├── services/               # API and storage services
│   │   │   ├── apiService.js       # Backend API client
│   │   │   └── storageService.js   # LocalStorage/SessionStorage wrapper
│   │   │
│   │   └── utils/                  # Utility functions
│   │       ├── basePathUtils.js    # Base path handling
│   │       ├── navigationUtils.js  # Page navigation
│   │       ├── resizeUtils.js      # Window resize handling
│   │       └── urlUtils.js         # URL manipulation
│   │
│   └── pages/                      # HTML pages
│       ├── admin.html              # Admin dashboard
│       ├── exercises.html          # Exercise list view
│       ├── languages.html          # Language selection
│       ├── leaderboard.html        # Leaderboard view
│       ├── login.html              # Login page
│       └── workspace.html          # Code editor
│
├── src/                            # Backend source code
│   ├── app.js                      # Express app configuration
│   ├── server.js                   # Server entry point
│   │
│   ├── config/                     # Configuration
│   │   └── index.js                # Environment config loader
│   │
│   ├── middleware/                 # Express middleware
│   │   ├── adminAuth.js            # Admin authorization middleware
│   │   ├── auth.js                 # Passport authentication setup
│   │   └── cors.js                 # CORS configuration
│   │
│   ├── routes/                     # API route handlers
│   │   ├── admin.js                # Admin-only endpoints
│   │   ├── api.js                  # Public API endpoints
│   │   └── auth.js                 # Authentication routes
│   │
│   ├── scripts/                    # Utility scripts
│   │   ├── fixFixtures.js          # Fix fixture file permissions
│   │   └── migrateToDatabase.js    # Data migration script
│   │
│   └── services/                   # Business logic
│       ├── databaseService.js      # Database operations
│       ├── dockerService.js        # Docker container management
│       ├── exerciseService.js      # Exercise CRUD operations
│       ├── statisticsService.js    # Stats and leaderboard logic
│       └── testRunner.js           # Test execution engine
│
├── .env                            # Environment variables (not in repo)
├── Dockerfile.runner               # Docker image for code execution
├── eslint.config.js                # ESLint configuration
├── exercises-internal.json         # Exercise definitions (legacy/backup)
├── LICENSE                         # Project license
├── package.json                    # Node.js dependencies
└── README.md                       # Project readme
```

## Core Components

### Backend Architecture

#### 1. Application Entry (`src/server.js`, `src/app.js`)
- `server.js`: Starts the HTTP server
- `app.js`: Configures Express middleware, routes, and static file serving

#### 2. Configuration (`src/config/index.js`)
Centralized configuration from environment variables:
- Server settings (port, base path)
- Session configuration
- OAuth credentials
- Docker settings
- File paths

#### 3. Middleware
- **auth.js**: Configures Passport.js with Google OAuth strategy
- **adminAuth.js**: Protects admin-only routes
- **cors.js**: CORS policy for API endpoints

#### 4. Routes
- **auth.js**: `/auth/*` - Login/logout, OAuth callbacks
- **api.js**: `/api/*` - Public endpoints (exercises, submissions, stats)
- **admin.js**: `/api/admin/*` - Admin endpoints (requires admin role)

#### 5. Services

##### Database Service (`databaseService.js`)
Manages SQLite database operations:
- User management
- Exercise storage
- Submission tracking
- Statistics queries
- Language configuration

Tables:
- `users` - User accounts with Google OAuth data
- `languages` - Programming languages configuration
- `exercises` - Exercise metadata and order
- `test_cases` - Individual test cases for exercises
- `submissions` - User code submissions
- `exercise_progress` - User completion status

##### Exercise Service (`exerciseService.js`)
Business logic for exercises:
- Load exercises (public vs admin views)
- Create/update/delete exercises
- Manage test cases
- Reorder exercises
- Handle fixtures

##### Docker Service (`dockerService.js`)
Manages code execution in isolated containers:
- Create temporary scripts
- Copy fixture files
- Run containers with resource limits
- Capture output and exit codes
- Cleanup temporary files

##### Test Runner (`testRunner.js`)
Executes test suites:
- Runs all test cases for an exercise
- Compares expected vs actual output
- Handles timeouts and errors
- Returns detailed test results

##### Statistics Service (`statisticsService.js`)
Aggregates data for:
- User progress tracking
- Exercise completion rates
- Leaderboards
- Submission history

### Frontend Architecture

#### Page Structure
Each page follows a similar pattern:
1. HTML file in `frontend/pages/`
2. JavaScript controller in `frontend/js/pages/`
3. Imports shared components and services

#### Components

##### Auth Component (`authComponent.js`)
Centralized authentication:
- Check authentication status
- Load user profile
- Handle logout
- Update UI with user info

##### Exercise Menu (`exerciseMenu.js`)
Sidebar navigation for exercises:
- Display exercise list
- Show completion status
- Highlight current exercise
- Navigate between exercises

##### Test Results (`testResults.js`)
Display test execution results:
- Show passed/failed tests
- Display expected vs actual output
- Show error messages
- Format test details

##### Statistics (`statistics.js`)
Display user and global statistics:
- Completion rates
- Best solutions
- Recent activity

#### Services

##### API Service (`apiService.js`)
Centralized HTTP client:
- All backend API calls
- Error handling
- Response parsing
- Base path aware

##### Storage Service (`storageService.js`)
Wrapper for browser storage:
- LocalStorage for persistent data (solutions)
- SessionStorage for temporary data (current exercise)
- JSON serialization

#### Utilities
- **navigationUtils.js**: Page routing and redirects
- **basePathUtils.js**: Handles deployment subdirectory paths
- **urlUtils.js**: URL construction helpers
- **resizeUtils.js**: Responsive layout adjustments

## Data Flow

### User Authentication
1. User clicks "Sign in with Google"
2. Redirected to Google OAuth
3. Google redirects back to `/auth/google/callback`
4. Passport creates/updates user in database
5. Session created, user redirected to languages page

### Exercise Submission
1. User writes code in workspace editor
2. Code saved to localStorage (auto-save)
3. User clicks "Run Tests"
4. Frontend sends POST to `/api/exercises/:id/submit`
5. Backend creates temporary directory
6. Script and fixtures copied to temp directory
7. Docker container created and executed for each test
8. Results compared against expected output
9. Submission saved to database
10. Results returned to frontend
11. Frontend displays test results
12. Cleanup temporary files

### Admin Exercise Management
1. Admin navigates to admin panel
2. Loads exercises via `/api/admin/exercises`
3. Creates/edits exercise with test cases
4. Saves to database via `/api/admin/exercises`
5. Test cases and fixtures stored
6. Exercise appears for all users

## Docker Execution Model

### Runner Image
- Based on `debian:bookworm-slim`
- Minimal tools (bash, coreutils)
- Non-root user (UID 1000)
- No network access
- Resource limits applied

### Execution Flow
1. Create temp directory on host
2. Write user script to temp directory
3. Copy required fixtures
4. Mount temp directory into container
5. Run script with arguments and stdin
6. Capture stdout, stderr, exit code
7. Apply timeout (default 30s)
8. Remove container and temp directory

### Security
- Non-root execution
- Resource limits (memory, PIDs)
- No network access
- Isolated filesystem
- Timeout enforcement

## Configuration

### Environment Variables

Required:
- `GOOGLE_CLIENT_ID`: OAuth client ID
- `GOOGLE_CLIENT_SECRET`: OAuth client secret

Optional:
- `PORT`: Server port (default: 3000)
- `BASE_PATH`: URL prefix for subdirectory deployment
- `SESSION_SECRET`: Session encryption key
- `CALLBACK_URL`: OAuth callback URL
- `RUNNER_IMAGE`: Docker image name
- `PER_TEST_TIMEOUT_MS`: Test timeout in milliseconds
- `MAX_PARALLEL_TESTS`: Concurrent test limit
- `DOCKER_MEMORY`: Container memory limit
- `DOCKER_PIDS_LIMIT`: Container process limit

### Base Path Support

BITLab supports deployment in subdirectories (e.g., `example.com/bitlab/`):
- Set `BASE_PATH=/bitlab` in `.env`
- All routes mounted at base path
- Frontend automatically detects base path
- Static files served from both root and base path

## Database Schema

See `src/services/databaseService.js` for complete schema definitions.

Key tables:
- **users**: Authentication and authorization
- **languages**: Programming language metadata
- **exercises**: Exercise definitions and ordering
- **test_cases**: Individual test specifications
- **submissions**: User code and results
- **exercise_progress**: Completion tracking

## Development Workflow

1. **Install dependencies**: `npm install`
2. **Build Docker image**: `docker build -f Dockerfile.runner -t bitlab-runner:latest .`
3. **Configure `.env`**: Set required environment variables
4. **Start server**: `npm start`
5. **Make changes**: Edit files in `src/` or `frontend/`
6. **Restart server**: Manual restart required (no hot reload)
7. **Test**: Submit exercises through the UI

## Testing

Currently manual testing via UI. Future improvements:
- Unit tests for services
- Integration tests for API endpoints
- E2E tests for user flows

## Deployment

See [QUICKSTART.md](QUICKSTART.md) for deployment instructions.

Key considerations:
- Set `NODE_ENV=production`
- Use strong `SESSION_SECRET`
- Configure proper `CALLBACK_URL`
- Set resource limits appropriately
- Ensure Docker is available
- Secure the database file
- Use HTTPS in production

