# BITLab Quickstart Guide

Get BITLab up and running in minutes.

## Prerequisites

- **Node.js** (v16 or higher)
- **Docker** (for isolated code execution)
- **Google OAuth Credentials** (for user authentication)

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd BITLab
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
BASE_PATH=

# Session Secret (CHANGE THIS IN PRODUCTION!)
SESSION_SECRET=your-random-secret-key-change-in-production

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
CALLBACK_URL=http://localhost:3000/auth/google/callback

# Docker Runner Configuration
RUNNER_IMAGE=bitlab-runner:latest
PER_TEST_TIMEOUT_MS=30000
MAX_PARALLEL_TESTS=4
DOCKER_MEMORY=256m
DOCKER_PIDS_LIMIT=128
```

### 4. Build the Docker Runner Image

The Docker runner provides an isolated environment for executing student code:

```bash
docker build -f Dockerfile.runner -t bitlab-runner:latest .
```

### 5. Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URIs:
   - `http://localhost:3000/auth/google/callback` (for development)
   - Your production URL + `/auth/google/callback` (for production)
6. Copy the Client ID and Client Secret to your `.env` file

### 6. Start the Server

```bash
npm start
```

The application will be available at `http://localhost:3000`

### 7. Set Up the First Admin

See [FIRST_ADMIN_SETUP.md](FIRST_ADMIN_SETUP.md) for detailed instructions on creating your first admin user.

## Quick Test

1. Open your browser to `http://localhost:3000`
2. Click "Sign in with Google"
3. After authentication, you'll be redirected to the languages page
4. Select a language to view and attempt exercises

## Next Steps

- **Admin Setup**: Create your first admin account - see [FIRST_ADMIN_SETUP.md](FIRST_ADMIN_SETUP.md)
- **Production**: Run as a system service - see [SERVICE_SETUP.md](SERVICE_SETUP.md)
- **Custom Docker**: Use custom execution environments - build or have your own Docker images, provide the name in the language settings

## Troubleshooting

### Docker Container Issues

If tests are failing to run:
- Verify Docker is running: `docker ps`
- Check if the runner image exists: `docker images | grep bitlab-runner`
- Rebuild the image if needed: `docker build -f Dockerfile.runner -t bitlab-runner:latest .`

### Authentication Issues

- Verify your Google OAuth credentials are correct
- Check that the callback URL matches exactly (including protocol and port)
- Ensure cookies are enabled in your browser

### Database Issues

The SQLite database is created automatically in the `data/` directory. If you encounter issues:
- Delete the database files: `data/exercises.db*`
- Restart the server to recreate tables

## Default Configuration

- **Port**: 3000
- **Session Duration**: 24 hours
- **Test Timeout**: 30 seconds per test
- **Max Parallel Tests**: 4
- **Docker Memory Limit**: 256 MB
- **Docker PID Limit**: 128 processes

