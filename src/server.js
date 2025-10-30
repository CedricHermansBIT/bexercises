// src/server.js
const createApp = require('./app');
const config = require('./config');

const app = createApp();

app.listen(config.server.port, () => {
	console.log(`🚀 Bash Exercises Server running on port ${config.server.port}`);
	console.log(`   Environment: ${config.server.env}`);
	console.log(`   Frontend: http://localhost:${config.server.port}`);

	if (!config.oauth.google.clientId || !config.oauth.google.clientSecret) {
		console.log('   ⚠️  Google OAuth not configured (see .env.example)');
	}
});

