# Quick Start Guide

This guide provides the essential steps to get the Bash Programming Exercises platform running on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js**: Version 14.0 or higher.
- **Docker**: The latest stable version.
- **Git**: For cloning the repository.

## Installation

1. **Clone the Repository**
   Open your terminal and run the following command:
   ```bash
   git clone <repository-url>
   cd bexercises
   ```

2. **Install Dependencies**
   Install the required Node.js packages:
   ```bash
   npm install
   ```

3. **Build the Docker Runner**
   The exercises are run in an isolated Docker container. Build the image with:
   ```bash
   docker build -t bexercises-runner:latest -f Dockerfile.runner .
   ```

4. **Create Required Directories**
   The application needs a `tmp` directory for temporary script files.
   ```bash
   mkdir -p tmp
   ```

## Running the Application

Once the installation is complete, you can start the server:
```bash
npm start
```
The server will start on `http://localhost:3000`.

For development, you can use the `dev` script to automatically restart the server on file changes:
```bash
npm run dev
```

## Accessing the Platform

Open your web browser and navigate to:
[http://localhost:3000](http://localhost:3000)

You should see the main interface with the list of exercises on the left.

## Optional: Google Authentication

To enable Google Authentication for tracking user progress:
1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Edit the `.env` file and add your Google OAuth 2.0 credentials.
3. Restart the server.

## What's Next?

- **Explore the Code**: Check out the [Project Structure](STRUCTURE.md) documentation to understand how the project is organized.
- **Contribute**: Read the [Development Guide](DEVELOPMENT.md) for information on our coding standards and contribution process.
- **API Details**: Refer to the [API Documentation](API.md) for details on the available endpoints.

