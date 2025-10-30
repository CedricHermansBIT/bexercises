# 💻 BITLab

An interactive web-based platform for learning and practicing programming through hands-on exercises. Write, test, and validate your code against comprehensive test suites, all running in isolated Docker containers for security and consistency.

## ✨ Features

- 🌍 **Multi-Language Support** - Start with Bash, expand to Python, JavaScript, SQL, and more
- ✅ **Interactive Code Editor** - Write code with syntax highlighting powered by CodeMirror
- 🔐 **Google Authentication** - Secure login with Google OAuth 2.0 (optional)
- 🧪 **Automated Test Suites** - Each exercise includes multiple test cases with expected outputs
- 🐳 **Isolated Execution** - Scripts run in ephemeral Docker containers for security and consistency
- 📈 **Progress Tracking** - Track your completion status across all exercises
- 💾 **Auto-Save** - Solutions are automatically saved to browser localStorage
- 📁 **Fixture File Support** - Exercises can include test files with specific permissions
- 🎯 **Comprehensive Coverage** - Topics include variables, loops, conditionals, file operations, and more
- 📊 **Statistics** - View success rates and common failure patterns per exercise
- 🎨 **Modern UI** - Hyprland-inspired dark theme with smooth animations

## 🌐 Supported Languages

### Currently Available
- **Bash** - Shell scripting and automation

### Coming Soon
- **Python** - General-purpose programming
- **JavaScript** - Web development essentials  
- **SQL** - Database queries
- **C** - Systems programming
- **Java** - Object-oriented programming

## 🏗️ Architecture

The project follows a modern, modular architecture for maintainability and scalability:

### Backend (Node.js/Express)
- **Layered Architecture** - Routes, Services, Middleware separation
- **`src/routes/`** - API endpoints for exercises, authentication, and statistics
- **`src/services/`** - Business logic for Docker execution, exercise management, and statistics
- **`src/middleware/`** - Authentication and CORS configuration
- **`src/config/`** - Centralized configuration management
- **Docker Integration** - Executes user scripts in isolated containers with resource limits

### Frontend (ES6 Modules)
- **Component-Based** - Modular UI components for better organization
- **`frontend/js/components/`** - Reusable UI components (auth, menu, results, statistics)
- **`frontend/js/services/`** - API client and storage management
- **`frontend/js/utils/`** - Helper utilities
- **Modern JavaScript** - ES6 modules, async/await, classes

### Exercise System
Each exercise includes:
- **Description** - Problem statement with examples (Markdown)
- **Test Cases** - Arguments, expected output, and exit codes
- **Fixtures** (optional) - Test files with configurable permissions
- **Solution** - Reference implementation (exposed to frontend)
- **Statistics** - Tracking of attempts and failure patterns

## 📚 Documentation

This project includes comprehensive documentation to help you get started and contribute effectively.

- **[Quick Start Guide](docs/QUICKSTART.md)**: The fastest way to get the project running locally.
- **[Development Guide](docs/DEVELOPMENT.md)**: A detailed guide for developers, covering setup, code style, and more.
- **[API Documentation](docs/API.md)**: A complete reference for all API endpoints.
- **[Project Structure](docs/STRUCTURE.md)**: An in-depth look at the project's architecture and design.

   cd bitlab

## Setup

### Prerequisites
- **Node.js** 14+ 
- **Docker** (for running user scripts in containers)
- **Linux/Unix** environment (tested on Debian/Ubuntu)

### Installation
   docker build -t bitlab-runner:latest -f Dockerfile.runner .
1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bexercises
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Build the Docker runner image**
   ```bash
   docker build -t bexercises-runner:latest -f Dockerfile.runner .
   ```

4. **Create required directories**
   ```bash
   mkdir -p tmp fixtures
   chmod 755 tmp
   ```

5. **Start the server**
   ```bash
   npm start
   ```
   
   The server will start on port 3000 by default.

### Google Authentication Setup (Optional)

The platform supports Google OAuth 2.0 authentication. To enable it:

1. **Follow the detailed setup guide**: See [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md) for complete instructions

2. **Quick setup**:
   - Create a Google Cloud project
   - Configure OAuth consent screen
   - Create OAuth 2.0 credentials
   - Copy `.env.example` to `.env` and add your credentials
   
3. **Without authentication**: The platform works without authentication. If you skip this step, users won't see the login button, but all features will work.

### Systemd Service (Optional)

For production deployment, you can set up a systemd service:

```ini
# /etc/systemd/system/bexercises.service
[Unit]
Description=Bash execution server
After=network.target

[Service]
Type=simple
User=bashexec
WorkingDirectory=/srv/bexercises
ExecStart=/usr/bin/node /srv/bexercises/server.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl enable bexercises
sudo systemctl start bexercises
```

### Nginx Reverse Proxy (Optional)

```nginx
server {
    listen 80;
    server_name exercises.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Usage

### Accessing the Platform

1. Open your browser and navigate to `http://localhost:3000`
2. Browse the exercise list in the left sidebar
3. Select an exercise to view its description
4. Write your Bash script in the code editor
5. Click "Run Tests" to validate your solution
6. View test results and iterate until all tests pass

### Adding New Exercises

Edit `exercises-internal.json` to add new exercises:

```json
{
  "id": "my-exercise",
  "title": "My Exercise Title",
  "chapter": "Shell scripting",
  "order": 15,
  "description": "Exercise description with examples...",
  "solution": "#!/bin/bash\necho 'solution'",
  "testCases": [
    {
      "arguments": ["arg1", "arg2"],
      "input": ["line1", "line2"],
      "expectedOutput": "expected output\n",
      "expectedExitCode": 0,
      "fixtures": ["testfile.txt"],
      "fixturePermissions": {
        "testfile.txt": 438
      }
    }
  ]
}
```

**Exercise Fields:**
- `id` - Unique identifier (kebab-case)
- `title` - Display title for the exercise
- `chapter` - Chapter/category name (e.g., "Shell scripting", "Additional exercises")
- `order` - Numeric order within the chapter (used for sorting)
- `description` - Problem description with examples
- `solution` - Reference solution (not exposed to frontend)
- `testCases` - Array of test cases

**Test Case Fields:**
- `arguments` - Command-line arguments passed to script
- `input` - Lines piped to stdin (optional)
- `expectedOutput` - Expected stdout content
- `expectedExitCode` - Expected exit code (default: 0)
- `fixtures` - Array of fixture files to copy from `fixtures/` directory
- `fixturePermissions` - Object mapping fixture filenames to octal permissions (as decimal)

**Permission Values:**
- `511` = `0o777` = `rwxrwxrwx` (read, write, execute for all)
- `493` = `0o755` = `rwxr-xr-x` (rwx for owner, r-x for others)
- `438` = `0o666` = `rw-rw-rw-` (read-write for all, no execute)
- `420` = `0o644` = `rw-r--r--` (rw for owner, r for others)

### Adding Fixture Files

1. Place files in the `fixtures/` directory
2. Reference them in test cases using the `fixtures` array
3. Optionally set specific permissions with `fixturePermissions`

## Security Features

### Container Isolation
- **No Network Access** - `--network none` prevents external connections
- **Memory Limits** - 256MB per container prevents resource exhaustion
- **Process Limits** - Max 128 processes prevents fork bombs
- **Read-Write Mounts** - Tmpdir mounted with appropriate permissions
- **Non-Root User** - Scripts run as unprivileged `runner` user

### Resource Management
- **Automatic Cleanup** - Temporary directories removed after test execution
- **Timeout Protection** - 30-second timeout per test case
- **Ephemeral Containers** - Containers automatically removed after execution

## API Endpoints

### `GET /api/exercises`
Returns list of all exercises (without solutions or test cases)

**Response:**
```json
[
  {
    "id": "script-args",
    "title": "Command line arguments",
    "chapter": "Shell scripting",
    "order": 1,
    "description": "...",
    "solution": "..."
  }
]
```

Exercises are grouped by `chapter` and sorted by `order` in the frontend.
    "solution": "..."
  }
]
```

### `GET /api/exercises/:id`
Returns details for a specific exercise (without test cases)

### `POST /api/exercises/:id/run`
Executes user script against test cases

**Request:**
```json
{
  "script": "#!/bin/bash\necho \"Hello $1\""
}
```

**Response:**
```json
{
  "results": [
    {
      "testNumber": 1,
      "arguments": ["World"],
      "expectedOutput": "Hello World",
      "actualOutput": "Hello World",
      "exitCode": 0,
      "expectedExitCode": 0,
      "passed": true,
      "stderr": "",
      "timedOut": false,
      "error": null
    }
  ]
}
```

## File Structure

```
bexercises/
├── server.js                    # Express server
├── package.json                 # Node.js dependencies
├── exercises-internal.json      # Exercise definitions
├── Dockerfile.runner            # Docker image for script execution
├── frontend/
│   ├── index.html              # Main UI
│   ├── app.js                  # Client-side JavaScript
│   ├── styles.css              # Styling
│   └── exercises-data.js       # Exercise metadata cache
├── fixtures/                    # Test files for exercises
│   ├── FASTQ.txt
│   ├── testfile
│   ├── testfile2
│   └── minefield.txt
└── tmp/                         # Temporary script directories (auto-cleaned)
```

## Development

### Running in Development Mode

```bash
# Start the server with auto-reload
npm start

# Or use nodemon for development
npx nodemon server.js
```

### Debugging

Enable detailed logging:
```javascript
// In server.js, logs are written to stderr
console.error('Debug message:', data);
```

View logs:
```bash
# If using systemd
sudo journalctl -u bexercises -f

# Or check stderr output
node server.js 2>&1 | tee server.log
```

### Testing Individual Exercises

Use curl to test the API:
```bash
# List exercises
curl http://localhost:3000/api/exercises

# Run a test
curl -X POST http://localhost:3000/api/exercises/script-args/run \
  -H "Content-Type: application/json" \
  -d '{"script": "echo \"My name is $1 and I am $2 years old.\""}'
```

## Troubleshooting

### Permission Denied Errors

**Problem:** Scripts fail with "Permission denied"

**Solution:**
- Ensure tmpdir has `755` permissions
- Ensure script.sh has `777` permissions
- Check Docker can access the mounted volume

### Fixture Files Not Found

**Problem:** Tests fail because fixture files aren't accessible

**Solution:**
- Verify files exist in `fixtures/` directory
- Check `fixturePermissions` are set correctly
- Ensure tmpdir is mounted with `rw` (read-write) access

### Container Timeouts

**Problem:** Tests timeout after 30 seconds

**Solution:**
- Optimize script performance
- Check for infinite loops
- Increase `PER_TEST_TIMEOUT_MS` in server.js if needed

### Memory Issues

**Problem:** Container runs out of memory

**Solution:**
- Increase memory limit in Docker args (default: 256m)
- Optimize script to use less memory
- Check for memory leaks in loops

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add exercises or improve functionality
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the terms of the MIT license.

## Acknowledgments

- CodeMirror for the code editor
- Express.js for the backend framework
- Docker for containerization

---

**Happy Bash Learning! 🎉**
