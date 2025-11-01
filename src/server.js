// src/server.js
const createApp = require('./app');
const config = require('./config');
const databaseService = require('./services/databaseService');

async function startServer() {
	try {
		// Initialize database
		console.log('🔄 Initializing database...');
		await databaseService.init();
		console.log('✅ Database ready');

		// Create and start app
		const app = createApp();

		app.listen(config.server.port, () => {
			console.log(`🚀 BITLab Server running on port ${config.server.port}`);
			console.log(`   Environment: ${config.server.env}`);
			console.log(`   Frontend: http://localhost:${config.server.port}`);

			if (!config.oauth.google.clientId || !config.oauth.google.clientSecret) {
				console.log('   ⚠️  Google OAuth not configured (see .env.example)');
			}
		});
	} catch (error) {
		console.error('❌ Failed to start server:', error);
		process.exit(1);
	}
}

startServer();

