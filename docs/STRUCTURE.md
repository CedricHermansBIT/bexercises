# BITLab Project Structure

A reference guide to help you understand where everything is in the BITLab codebase.

## Quick Overview

**Tech Stack:**
- **Backend:** Node.js + Express + SQLite
- **Frontend:** Vanilla JavaScript (ES6 modules)
- **Authentication:** Google OAuth 2.0
- **Code Execution:** Docker containers

**Key Directories:**
- `frontend/` - User interface (HTML, CSS, JS)
- `src/` - Backend code (API, database, Docker)
- `docs/` - Documentation (this file!)
- `data/` - SQLite database
- `fixtures/` - Test files for exercises

## Directory Structure

```
BITLab/
├── frontend/                       # User interface
│   ├── pages/                      # HTML pages
│   │   ├── admin/                  # Admin interface pages
│   │   ├── achievements.html
│   │   ├── exercises.html
│   │   ├── languages.html
│   │   ├── leaderboard.html
│   │   ├── login.html
│   │   └── workspace.html          # Code editor
│   │
│   ├── js/                         # JavaScript modules
│   │   ├── pages/                  # Page controllers
│   │   │   ├── admin/              # Admin page logic
│   │   │   └── *.js                # User page controllers
│   │   ├── components/             # Reusable UI components
│   │   ├── services/               # API & storage
│   │   └── utils/                  # Helper functions
│   │
│   ├── styles.css                  # Global styles
│   └── admin.css                   # Admin styles
│
├── src/                            # Backend code
│   ├── routes/                     # API endpoints
│   │   ├── api.js                  # Public API
│   │   ├── admin.js                # Admin API
│   │   └── auth.js                 # Authentication
│   │
│   ├── services/                   # Business logic
│   │   ├── databaseService.js      # Database operations
│   │   ├── dockerService.js        # Code execution
│   │   ├── exerciseService.js      # Exercise management
│   │   ├── testRunner.js           # Test execution
│   │   └── statisticsService.js    # Stats & leaderboards
│   │
│   ├── middleware/                 # Express middleware
│   ├── config/                     # Configuration
│   ├── app.js                      # Express setup
│   └── server.js                   # Server entry point
│
├── data/                           # Database files
│   └── exercises.db                # SQLite database
│
├── fixtures/                       # Test files for exercises
│
├── docs/                           # Documentation
│   ├── QUICKSTART.md
│   ├── FIRST_ADMIN_SETUP.md
│   ├── MULTI_LANGUAGE_SUPPORT.md
│   ├── CUSTOM_DOCKER_IMAGE_GUIDE.md
│   ├── CODE_TEMPLATES.md
│   ├── SERVICE_SETUP.md
│   └── STRUCTURE.md                # This file
│
├── .env                            # Environment configuration
├── Dockerfile.runner               # Docker image for code execution
├── package.json                    # Dependencies
└── README.md                       # Project readme
```

## Key Components

### Backend Services

**Database Service** (`databaseService.js`)
- Manages SQLite database
- User accounts, exercises, test cases, submissions
- Progress tracking and statistics
- Language configuration

**Docker Service** (`dockerService.js`)
- Executes code in isolated containers
- Applies resource limits and timeouts
- Captures output and verifies files
- Handles cleanup

**Test Runner** (`testRunner.js`)
- Runs test suites for exercises
- Compares expected vs actual results
- Returns detailed test results

**Exercise Service** (`exerciseService.js`)
- CRUD operations for exercises
- Test case management
- Exercise ordering

### Frontend Components

**Auth Component** - User authentication and profile
**Achievement Notifications** - Achievement popups
**Test Results** - Display test execution results
**Exercise Menu** - Sidebar navigation
**Theme Toggle** - Dark/light mode switching

### API Routes

**Public API** (`/api/*`)
- Get exercises, submit solutions
- View leaderboards and statistics
- Track progress

**Admin API** (`/api/admin/*`)
- Manage exercises and test cases
- User administration
- Language configuration

**Authentication** (`/auth/*`)
- Google OAuth login/logout

## How Code Execution Works

### Exercise Submission Flow
1. User writes code in the workspace editor
2. Code auto-saved to browser storage
3. User clicks "Run Tests"
4. Backend creates temporary directory
5. Copies code and fixture files to temp directory
6. Docker container executes code for each test case
7. Results compared: stdout, stderr, exit code, file hashes
8. Results returned and displayed to user
9. Submission saved to database
10. Temporary files cleaned up

### Docker Execution
- Code runs in isolated containers (no network access)
- Resource limits applied (memory, CPU, processes)
- 30-second timeout per test
- Non-root execution for security
- Automatic cleanup after execution

## Database Schema

Main tables:
- **users** - Authentication and roles
- **languages** - Programming language configuration
- **chapters** - Exercise organization
- **exercises** - Exercise definitions
- **test_cases** - Test specifications with expected results
- **user_progress** - Completion tracking
- **achievements** - Achievement definitions
- **user_achievements** - Earned achievements

See `src/services/databaseService.js` for complete schema.

## Configuration

Key environment variables:

**Required:**
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret

**Optional:**
- `PORT` - Server port (default: 3000)
- `BASE_PATH` - URL prefix for subdirectory deployment
- `SESSION_SECRET` - Session encryption key
- `RUNNER_IMAGE` - Docker image (default: bitlab-runner:latest)
- `PER_TEST_TIMEOUT_MS` - Test timeout (default: 30000)
- `MAX_PARALLEL_TESTS` - Concurrent tests (default: 4)
- `DOCKER_MEMORY` - Container memory limit (default: 256m)
- `DOCKER_PIDS_LIMIT` - Process limit (default: 128)

See [QUICKSTART.md](QUICKSTART.md) for detailed configuration.

## Subdirectory Deployment

To deploy at `example.com/bitlab/`:
1. Set `BASE_PATH=/bitlab` in `.env`
2. Configure reverse proxy to forward requests
3. Update OAuth callback URL

Frontend automatically detects and uses the base path.

## Making Changes

1. **Frontend changes** - Edit files in `frontend/`, refresh browser
2. **Backend changes** - Edit files in `src/`, restart server
3. **Database changes** - Edit `databaseService.js`, delete `data/exercises.db*`, restart
4. **Docker changes** - Edit `Dockerfile.runner`, rebuild image

No hot reload - manual restart required for backend changes.

## Related Documentation

- [QUICKSTART.md](QUICKSTART.md) - Installation and setup
- [FIRST_ADMIN_SETUP.md](FIRST_ADMIN_SETUP.md) - Admin account creation
- [SERVICE_SETUP.md](SERVICE_SETUP.md) - Production deployment

