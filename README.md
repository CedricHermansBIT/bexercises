# BITLab

A web-based platform for programming exercises with automated testing and Docker-based code execution.

## Overview

BITLab is an educational platform that allows students to practice programming by solving exercises with instant feedback. Code submissions are executed in isolated Docker containers and tested against predefined test cases.

### Key Features

- 🔐 **Google OAuth Authentication** - Secure login via Google accounts
- 🐳 **Docker-based Execution** - Safe, isolated code execution environment
- ✅ **Automated Testing** - Instant feedback with detailed test results
- 📊 **Progress Tracking** - Monitor student progress and completion rates
- 🏆 **Leaderboards** - Gamification with rankings and statistics
- 👨‍💼 **Admin Panel** - Full exercise management and user administration
- 🌐 **Multi-language Support** - Extensible to multiple programming languages
- 💾 **Auto-save** - Automatic saving of work in progress

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- Docker
- Google OAuth credentials

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd BITLab

# Install dependencies
npm install

# Create environment configuration
cp .env.example .env
# Edit .env with your configuration

# Build Docker runner image
docker build -f Dockerfile.runner -t bitlab-runner:latest .

# Start the server
npm start
```

The application will be available at `http://localhost:3000`

For detailed setup instructions, see [QUICKSTART.md](docs/QUICKSTART.md).

## Documentation

- **[Quickstart Guide](docs/QUICKSTART.md)** - Get up and running quickly
- **[First Admin Setup](docs/FIRST_ADMIN_SETUP.md)** - Create your first administrator account
- **[Development Guide](docs/DEVELOPMENT.md)** - Contribute to the project
- **[Project Structure](docs/STRUCTURE.md)** - Understand the codebase architecture

## Architecture

### Technology Stack

- **Backend**: Node.js, Express.js
- **Frontend**: Vanilla JavaScript (ES6 modules)
- **Database**: SQLite with WAL mode
- **Authentication**: Passport.js with Google OAuth 2.0
- **Code Execution**: Docker containers

### Project Structure

```
BITLab/
├── frontend/          # Client-side application
│   ├── pages/        # HTML pages
│   └── js/           # JavaScript modules
├── src/              # Backend source code
│   ├── routes/       # API endpoints
│   ├── services/     # Business logic
│   └── middleware/   # Express middleware
├── data/             # SQLite database
├── fixtures/         # Test fixtures for exercises
└── docs/             # Documentation
```

For detailed architecture documentation, see [STRUCTURE.md](docs/STRUCTURE.md).

## Usage

### For Students

1. **Login** with your Google account
2. **Select a language** (e.g., Bash, Python)
3. **Choose an exercise** from the list
4. **Write your solution** in the code editor
5. **Run tests** to get instant feedback
6. **View progress** and compete on leaderboards

### For Administrators

1. **Access admin panel** after being promoted to admin
2. **Create exercises** with test cases and fixtures
3. **Manage languages** and their availability
4. **View statistics** and user submissions
5. **Monitor progress** across all students

See [FIRST_ADMIN_SETUP.md](docs/FIRST_ADMIN_SETUP.md) for admin account setup.

## Features in Detail

### Automated Testing

Each exercise includes multiple test cases with:
- Command-line arguments
- Standard input
- Expected output
- Expected exit code
- Fixture files (test data)

Code is executed in isolated Docker containers with:
- Resource limits (memory, CPU, processes)
- Timeout enforcement (default 30s per test)
- No network access
- Non-root execution

### Progress Tracking

- Exercise completion status
- Best submission tracking
- Historical submissions
- Personal statistics

### Leaderboards

- Exercise-specific rankings
- Global completion statistics
- Time-based ordering
- Submission counts

### Admin Capabilities

- Full CRUD operations for exercises
- Test case management
- Fixture file handling
- User management
- Exercise reordering
- Statistics and analytics

## Configuration

Environment variables (in `.env`):

```env
# Server
PORT=3000
BASE_PATH=                    # Optional: for subdirectory deployment

# Authentication
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
CALLBACK_URL=http://localhost:3000/auth/google/callback

# Security
SESSION_SECRET=your-random-secret-key

# Docker
RUNNER_IMAGE=bitlab-runner:latest
PER_TEST_TIMEOUT_MS=30000
MAX_PARALLEL_TESTS=4
DOCKER_MEMORY=256m
DOCKER_PIDS_LIMIT=128
```

See [QUICKSTART.md](docs/QUICKSTART.md) for detailed configuration.

## Security

BITLab implements multiple security measures:

- **OAuth 2.0** for authentication
- **Session management** with secure cookies
- **Isolated code execution** in Docker containers
- **Resource limits** to prevent abuse
- **Non-root container execution**
- **No network access** from containers
- **Timeout enforcement** on code execution
- **Input validation** on all endpoints
- **SQL injection protection** via parameterized queries

## Development

### Setting Up Development Environment

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Build Docker image
docker build -f Dockerfile.runner -t bitlab-runner:latest .

# Start development server
npm start
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed development guidelines.

## API Endpoints

### Authentication
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - OAuth callback
- `POST /auth/logout` - Logout

### Public API
- `GET /api/user` - Get current user
- `GET /api/languages` - List available languages
- `GET /api/exercises` - List exercises for a language
- `GET /api/exercises/:id` - Get exercise details
- `POST /api/exercises/:id/submit` - Submit solution
- `GET /api/leaderboard/:exerciseId` - Get leaderboard
- `GET /api/submissions/history` - Get submission history

### Admin API (requires admin role)
- `GET /api/admin/exercises` - Get all exercises with test cases
- `POST /api/admin/exercises` - Create exercise
- `PUT /api/admin/exercises/:id` - Update exercise
- `DELETE /api/admin/exercises/:id` - Delete exercise
- `GET /api/admin/users` - List all users
- `PUT /api/admin/users/:id/admin` - Toggle admin status
- `GET /api/admin/statistics` - Get platform statistics

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `SESSION_SECRET`
- [ ] Configure HTTPS
- [ ] Set appropriate `CALLBACK_URL`
- [ ] Secure database file permissions
- [ ] Configure Docker resource limits
- [ ] Set up regular database backups
- [ ] Configure reverse proxy (nginx/Apache)
- [ ] Enable firewall rules
- [ ] Monitor disk space (Docker can accumulate)

### Subdirectory Deployment

To deploy at a subdirectory (e.g., `example.com/bitlab/`):

1. Set `BASE_PATH=/bitlab` in `.env`
2. Configure reverse proxy to forward requests
3. Update OAuth callback URL

## Troubleshooting

### Docker Issues

```bash
# Check Docker is running
docker ps

# Verify runner image exists
docker images | grep bitlab-runner

# Rebuild image
docker build -f Dockerfile.runner -t bitlab-runner:latest .

# Clean up containers
docker container prune
```

### Database Issues

```bash
# Check database file
ls -lh data/exercises.db

# Access database
sqlite3 data/exercises.db

# Reset database (WARNING: deletes all data)
rm data/exercises.db*
npm start  # Recreates tables
```

### Authentication Issues

- Verify Google OAuth credentials
- Check callback URL matches exactly
- Ensure cookies are enabled
- Clear browser cache and cookies

## License

See [LICENSE](LICENSE) file for details.

## Support

For issues, questions, or contributions:

1. Check the [documentation](docs/)
2. Search existing issues
3. Create a new issue with detailed information

## Acknowledgments

Built with:
- [Express.js](https://expressjs.com/) - Web framework
- [Passport.js](http://www.passportjs.org/) - Authentication
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Database
- [Docker](https://www.docker.com/) - Containerization

---

**BITLab** - Learn to code through practice and instant feedback.

