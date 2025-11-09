# BITLab

A web-based platform for programming exercises with automated testing and Docker-based code execution.

## Overview

BITLab is an educational platform that allows students to practice programming by solving exercises with instant feedback. Code submissions are executed in isolated Docker containers and tested against predefined test cases.

### Key Features

- 🔐 **Google OAuth Authentication** - Secure login via Google accounts
- 🐳 **Docker-based Execution** - Safe, isolated code execution environment
- ✅ **Automated Testing** - Instant feedback with detailed test results
- 📝 **Multi-faceted Verification** - Verify stdout, stderr, exit codes, and output file hashes (SHA-256)
- 📊 **Progress Tracking** - Monitor student progress and completion rates
- 🏆 **Leaderboards** - Gamification with rankings and statistics
- 👨‍💼 **Admin Panel** - Full exercise management and user administration
- 🔍 **Bulk Test Verification** - Re-verify all exercises after system changes
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

**Essential Guides:**
- **[Quickstart Guide](docs/QUICKSTART.md)** - Installation and setup
- **[First Admin Setup](docs/FIRST_ADMIN_SETUP.md)** - Create your first admin account
- **[Multi-Language Support](docs/MULTI_LANGUAGE_SUPPORT.md)** - Add new programming languages
- **[Custom Docker Images](docs/CUSTOM_DOCKER_IMAGE_GUIDE.md)** - Configure custom execution environments
- **[Code Templates](docs/CODE_TEMPLATES.md)** - Customize starter code per language

**Advanced:**
- **[Service Setup](docs/SERVICE_SETUP.md)** - Run BITLab as a system service (production)

## Technology Stack

**Backend:** Node.js + Express + SQLite  
**Frontend:** Vanilla JavaScript (ES6 modules)  
**Authentication:** Google OAuth 2.0  
**Code Execution:** Docker containers  

### Security Features

- Isolated code execution in Docker containers
- Resource limits (memory, CPU, processes)
- 30-second timeout per test
- No network access from containers
- OAuth 2.0 authentication
- Session management with secure cookies

## How It Works

### For Students
1. Login with Google
2. Select a programming language
3. Choose an exercise
4. Write and test your code
5. Get instant feedback
6. Track progress and earn achievements

### For Admins
Access the admin panel to:
- Create exercises with multiple test cases
- Manage languages and chapters
- Configure Docker execution environments
- Track student progress
- Manage user accounts and permissions

See [FIRST_ADMIN_SETUP.md](docs/FIRST_ADMIN_SETUP.md) for admin setup.

## Configuration

Key environment variables in `.env`:

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

See [QUICKSTART.md](docs/QUICKSTART.md) for complete configuration details.

## Deployment

For production deployment:
- Set `NODE_ENV=production`
- Use a strong `SESSION_SECRET`
- Configure HTTPS with a reverse proxy
- Set up regular database backups
- See [SERVICE_SETUP.md](docs/SERVICE_SETUP.md) for systemd service setup

## Troubleshooting

**Docker not working?**
```bash
docker ps                                           # Check Docker is running
docker images | grep bitlab-runner                  # Verify image exists
docker build -f Dockerfile.runner -t bitlab-runner:latest .  # Rebuild if needed
```

**Authentication issues?**
- Verify Google OAuth credentials
- Check callback URL matches exactly
- Clear browser cookies

**Database issues?**
```bash
rm data/exercises.db*    # Reset database (WARNING: deletes all data)
npm start                # Recreates tables
```

## Support

For issues or questions:
1. Check the [documentation](docs/)
2. Review troubleshooting steps above
3. Create an issue with detailed information

---

**BITLab** - Learn to code through practice and instant feedback.

