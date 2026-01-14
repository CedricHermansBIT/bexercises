// src/server.js
const createApp = require('./app');
const config = require('./config');
const databaseService = require('./services/databaseService');
const containerCleanupService = require('./services/containerCleanupService');

async function startServer() {
	try {
		// Initialize database
		console.log('🔄 Initializing database...');
		await databaseService.init();
		console.log('✅ Database ready');

		// Initialize container cleanup service
		console.log('🔄 Initializing container cleanup service...');
		containerCleanupService.init();

		// Run initial cleanup of any orphaned containers from previous runs
		const cleanupResult = await containerCleanupService.cleanupOrphanedContainers();
		if (cleanupResult.removed > 0) {
			console.log(`🧹 Cleaned up ${cleanupResult.removed} orphaned containers`);
		}

		// Start periodic cleanup (every 5 minutes)
		containerCleanupService.startPeriodicCleanup(5 * 60 * 1000);
		console.log('✅ Container cleanup service ready');

		// Create and start app
		const app = createApp();

		const server = app.listen(config.server.port, () => {
			console.log(`🚀 BITLab Server running on port ${config.server.port}`);
			console.log(`   Environment: ${config.server.env}`);
			console.log(`   Frontend: http://localhost:${config.server.port}`);

			if (!config.oauth.google.clientId || !config.oauth.google.clientSecret) {
				console.log('   ⚠️  Google OAuth not configured (see .env.example)');
			}
		});

		// Graceful shutdown handlers
		const gracefulShutdown = async (signal) => {
			console.log(`\n${signal} received. Starting graceful shutdown...`);

			// Stop accepting new connections
			server.close(() => {
				console.log('HTTP server closed');
			});

			// Stop periodic cleanup
			containerCleanupService.stopPeriodicCleanup();

			// Clean up any remaining containers
			console.log('Cleaning up containers...');
			await containerCleanupService.forceCleanupAll();

			console.log('Graceful shutdown complete');
			process.exit(0);
		};

		process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
		process.on('SIGINT', () => gracefulShutdown('SIGINT'));

	} catch (error) {
		console.error('❌ Failed to start server:', error);
		process.exit(1);
	}
}

startServer();

