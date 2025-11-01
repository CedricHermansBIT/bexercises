# BITLab Service Setup Guide

This guide explains how to set up BITLab to run as a persistent service that starts automatically on system boot.

## Table of Contents

- [Linux (systemd)](#linux-systemd)
- [Windows](#windows)
- [Docker](#docker)
- [Process Managers](#process-managers)
- [Monitoring and Logs](#monitoring-and-logs)

## Linux (systemd)

Most modern Linux distributions use systemd for service management. This is the recommended approach for production deployments.

### Prerequisites

- BITLab installed in `/opt/bitlab` (or your preferred location)
- Node.js installed system-wide
- Docker installed and running
- Non-root user to run the service (e.g., `bitlab`)

### Step 1: Create a Service User

It's a security best practice to run services as a dedicated non-root user:

```bash
# Create a system user for BITLab
sudo useradd -r -s /bin/bash -d /opt/bitlab -m bitlab

# Set ownership of the application directory
sudo chown -R bitlab:bitlab /opt/bitlab

# Add the bitlab user to the docker group (required for Docker operations)
sudo usermod -aG docker bitlab
```

### Step 2: Install BITLab

```bash
# Switch to the bitlab user
sudo -u bitlab -i

# Clone or copy the application
cd /opt/bitlab
git clone <repository-url> .

# Install dependencies
npm install --production

# Build Docker runner image
docker build -f Dockerfile.runner -t bitlab-runner:latest .

# Exit back to your admin user
exit
```

### Step 3: Create Environment File

Create the configuration file with secure permissions:

```bash
# Create .env file
sudo -u bitlab nano /opt/bitlab/.env
```

Add your configuration (see [QUICKSTART.md](QUICKSTART.md) for all options):

```env
# Server Configuration
NODE_ENV=production
PORT=3000
BASE_PATH=

# Session Secret - MUST be a strong random string in production
SESSION_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_STRING

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
CALLBACK_URL=https://yourdomain.com/auth/google/callback

# Docker Configuration
RUNNER_IMAGE=bitlab-runner:latest
PER_TEST_TIMEOUT_MS=30000
MAX_PARALLEL_TESTS=4
DOCKER_MEMORY=256m
DOCKER_PIDS_LIMIT=128

# Paths
TEMP_DIR=/opt/bitlab/tmp
```

Secure the environment file:

```bash
sudo chmod 600 /opt/bitlab/.env
```

### Step 4: Create systemd Service File

Create the service file:

```bash
sudo nano /etc/systemd/system/bitlab.service
```

Add the following configuration:

```ini
[Unit]
Description=BITLab - Programming Exercise Platform
Documentation=https://github.com/your-org/bitlab
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=bitlab
Group=bitlab
WorkingDirectory=/opt/bitlab
Environment=NODE_ENV=production

# Load environment variables from .env file
EnvironmentFile=/opt/bitlab/.env

# Start command
ExecStart=/usr/bin/node /opt/bitlab/src/server.js

# Restart policy
Restart=always
RestartSec=10

# Security settings
NoNewPrivileges=true
PrivateTmp=true

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=bitlab

# Resource limits
LimitNOFILE=65535
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
```

### Step 5: Enable and Start the Service

```bash
# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable bitlab

# Start the service
sudo systemctl start bitlab

# Check the status
sudo systemctl status bitlab
```

### Step 6: Verify the Service

```bash
# Check if the service is running
sudo systemctl status bitlab

# View recent logs
sudo journalctl -u bitlab -n 50

# Follow logs in real-time
sudo journalctl -u bitlab -f

# Check if the application is listening on the port
sudo netstat -tlnp | grep :3000
```

### Managing the Service

```bash
# Start the service
sudo systemctl start bitlab

# Stop the service
sudo systemctl stop bitlab

# Restart the service
sudo systemctl restart bitlab

# Reload configuration (if supported)
sudo systemctl reload bitlab

# Check status
sudo systemctl status bitlab

# View logs
sudo journalctl -u bitlab

# View logs from today
sudo journalctl -u bitlab --since today

# View last 100 lines
sudo journalctl -u bitlab -n 100

# Follow logs in real-time
sudo journalctl -u bitlab -f
```

### Updating the Application

When you need to update BITLab:

```bash
# Stop the service
sudo systemctl stop bitlab

# Switch to bitlab user
sudo -u bitlab -i
cd /opt/bitlab

# Pull latest changes
git pull

# Install any new dependencies
npm install --production

# Rebuild Docker image if needed
docker build -f Dockerfile.runner -t bitlab-runner:latest .

# Exit back to admin user
exit

# Start the service
sudo systemctl start bitlab

# Check logs for any errors
sudo journalctl -u bitlab -f
```

## Windows

For Windows servers, you can use either Windows Service or Task Scheduler.

### Option 1: Using node-windows (Recommended)

Install node-windows to create a Windows service:

```powershell
# Install node-windows globally
npm install -g node-windows

# Create a service installation script
```

Create `install-service.js`:

```javascript
const Service = require('node-windows').Service;

// Create a new service object
const svc = new Service({
  name: 'BITLab',
  description: 'BITLab Programming Exercise Platform',
  script: 'C:\\path\\to\\bitlab\\src\\server.js',
  env: {
    name: 'NODE_ENV',
    value: 'production'
  }
});

// Listen for the "install" event
svc.on('install', function(){
  svc.start();
});

// Install the service
svc.install();
```

Run the installation:

```powershell
node install-service.js
```

Manage the service:

```powershell
# Start service
net start BITLab

# Stop service
net stop BITLab

# Check status
sc query BITLab
```

### Option 2: Using Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Name: "BITLab"
4. Trigger: "When the computer starts"
5. Action: "Start a program"
6. Program: `C:\Program Files\nodejs\node.exe`
7. Arguments: `C:\path\to\bitlab\src\server.js`
8. Working directory: `C:\path\to\bitlab`

## Docker

Run BITLab as a Docker container with automatic restart.

### Create Docker Compose File

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  bitlab:
    build: .
    container_name: bitlab
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    env_file:
      - .env
    volumes:
      - ./data:/app/data
      - ./fixtures:/app/fixtures
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      - runner
    networks:
      - bitlab-network

  runner:
    build:
      context: .
      dockerfile: Dockerfile.runner
    image: bitlab-runner:latest
    container_name: bitlab-runner
    networks:
      - bitlab-network

networks:
  bitlab-network:
    driver: bridge
```

Create main `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy application
COPY . .

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "src/server.js"]
```

Start the service:

```bash
# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down

# Restart
docker-compose restart
```

### Enable Docker Compose to Start on Boot

Create systemd service for docker-compose:

```bash
sudo nano /etc/systemd/system/bitlab-docker.service
```

```ini
[Unit]
Description=BITLab Docker Compose Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/bitlab
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Enable:

```bash
sudo systemctl enable bitlab-docker
sudo systemctl start bitlab-docker
```

## Process Managers

### PM2 (Recommended for Node.js)

PM2 is a production process manager for Node.js applications.

#### Installation

```bash
# Install PM2 globally
sudo npm install -g pm2
```

#### Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'bitlab',
    script: './src/server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

#### Usage

```bash
# Start the application
pm2 start ecosystem.config.js

# Save the PM2 process list
pm2 save

# Generate startup script
pm2 startup

# Follow the instructions from the output to enable PM2 on boot

# View status
pm2 status

# View logs
pm2 logs bitlab

# Restart
pm2 restart bitlab

# Stop
pm2 stop bitlab

# Monitor
pm2 monit
```

### Forever

Another alternative for keeping Node.js applications running:

```bash
# Install forever
sudo npm install -g forever

# Start application
forever start src/server.js

# List running processes
forever list

# Stop application
forever stop src/server.js

# Restart
forever restart src/server.js
```

## Monitoring and Logs

### Log Management

#### Using journalctl (systemd)

```bash
# View all logs
sudo journalctl -u bitlab

# View logs from today
sudo journalctl -u bitlab --since today

# View logs from specific time
sudo journalctl -u bitlab --since "2025-10-31 14:00:00"

# View last N lines
sudo journalctl -u bitlab -n 100

# Follow logs in real-time
sudo journalctl -u bitlab -f

# Export logs to file
sudo journalctl -u bitlab > bitlab-logs.txt

# View logs with priority (error, warning, etc.)
sudo journalctl -u bitlab -p err
```

#### Log Rotation

Configure logrotate for application logs:

```bash
sudo nano /etc/logrotate.d/bitlab
```

```
/opt/bitlab/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 bitlab bitlab
    sharedscripts
    postrotate
        systemctl reload bitlab > /dev/null 2>&1 || true
    endscript
}
```

### Health Monitoring

#### Simple Health Check Script

Create `scripts/healthcheck.sh`:

```bash
#!/bin/bash

# Check if service is running
if ! systemctl is-active --quiet bitlab; then
    echo "BITLab service is not running!"
    exit 1
fi

# Check if port is listening
if ! nc -z localhost 3000; then
    echo "BITLab is not responding on port 3000!"
    exit 1
fi

# Check HTTP response
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$response" != "200" ]; then
    echo "BITLab returned HTTP $response"
    exit 1
fi

echo "BITLab is healthy"
exit 0
```

#### Add to Cron for Regular Checks

```bash
# Edit crontab
crontab -e

# Add health check every 5 minutes
*/5 * * * * /opt/bitlab/scripts/healthcheck.sh || systemctl restart bitlab
```

### Performance Monitoring

#### Using PM2 Plus (formerly Keymetrics)

```bash
pm2 plus
```

Follow the prompts to set up monitoring dashboard.

#### Using htop

```bash
# Install htop
sudo apt-get install htop

# Monitor resources
htop
```

#### Docker Stats

```bash
# Monitor container resources
docker stats bitlab
```

## Reverse Proxy Setup

It's recommended to run BITLab behind a reverse proxy like Nginx or Apache.

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy settings
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeout for long-running tests
        proxy_read_timeout 90s;
    }

    # Static files
    location /static {
        alias /opt/bitlab/frontend;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/bitlab /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Troubleshooting

### Service Won't Start

```bash
# Check service status
sudo systemctl status bitlab

# View detailed logs
sudo journalctl -u bitlab -n 100 --no-pager

# Check if port is already in use
sudo netstat -tlnp | grep :3000

# Check file permissions
ls -la /opt/bitlab
```

### Permission Issues

```bash
# Fix ownership
sudo chown -R bitlab:bitlab /opt/bitlab

# Fix permissions
sudo chmod 755 /opt/bitlab
sudo chmod 600 /opt/bitlab/.env
```

### Docker Socket Permission Denied

```bash
# Add user to docker group
sudo usermod -aG docker bitlab

# Restart service
sudo systemctl restart bitlab
```

### High Memory Usage

```bash
# Check memory usage
free -h

# Check process memory
ps aux | grep node

# Reduce MAX_PARALLEL_TESTS in .env
# Set DOCKER_MEMORY limit
```

### Database Lock Issues

```bash
# Check for stale connections
lsof /opt/bitlab/data/exercises.db

# Stop service and check
sudo systemctl stop bitlab
rm /opt/bitlab/data/exercises.db-shm
rm /opt/bitlab/data/exercises.db-wal
sudo systemctl start bitlab
```

## Security Considerations

1. **Run as non-root user**: Always run the service as a dedicated user
2. **Secure .env file**: Set permissions to 600 (readable only by owner)
3. **Use strong SESSION_SECRET**: Generate a random string for production
4. **Enable HTTPS**: Use SSL/TLS certificates (Let's Encrypt recommended)
5. **Keep Docker secure**: Limit container resources and disable network access
6. **Regular updates**: Keep Node.js, Docker, and dependencies up to date
7. **Firewall rules**: Only expose necessary ports (usually just 443 for HTTPS)
8. **Monitor logs**: Regularly check for suspicious activity

## Backup and Recovery

### Automated Backup Script

Create `scripts/backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/opt/backups/bitlab"
DATE=$(date +%Y%m%d-%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
cp /opt/bitlab/data/exercises.db "$BACKUP_DIR/exercises-$DATE.db"

# Backup environment config
cp /opt/bitlab/.env "$BACKUP_DIR/env-$DATE.bak"

# Keep only last 30 days of backups
find "$BACKUP_DIR" -name "exercises-*.db" -mtime +30 -delete
find "$BACKUP_DIR" -name "env-*.bak" -mtime +30 -delete

echo "Backup completed: $DATE"
```

Add to cron for daily backups:

```bash
# Daily backup at 2 AM
0 2 * * * /opt/bitlab/scripts/backup.sh
```

## Additional Resources

- [QUICKSTART.md](QUICKSTART.md) - Initial setup guide
- [DEVELOPMENT.md](DEVELOPMENT.md) - Development information
- [systemd documentation](https://www.freedesktop.org/software/systemd/man/)
- [PM2 documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Docker documentation](https://docs.docker.com/)
- [Nginx documentation](https://nginx.org/en/docs/)

