// src/middleware/auth.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const config = require('../config');
const databaseService = require('../services/databaseService');

/**
 * Configure Passport authentication strategies
 */
function configurePassport() {
	if (config.oauth.google.clientId && config.oauth.google.clientSecret) {
		passport.use(new GoogleStrategy({
			clientID: config.oauth.google.clientId,
			clientSecret: config.oauth.google.clientSecret,
			callbackURL: config.oauth.google.callbackURL
		},
		async (accessToken, refreshToken, profile, done) => {
			try {
				const googleId = profile.id;
				const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
				const displayName = profile.displayName;

				// Check if user exists in database
				let dbUser = await databaseService.getUserByGoogleId(googleId);

				if (!dbUser) {
					// Create new user
					dbUser = await databaseService.createUser({
						google_id: googleId,
						email: email,
						display_name: displayName,
						is_admin: false
					});
					console.log(`New user created: ${displayName} (${email})`);
				} else {
					// Update last login
					await databaseService.updateUserLogin(dbUser.id);
				}

				// Return user object for session
				const user = {
					id: dbUser.id,
					googleId: googleId,
					email: email,
					name: displayName,
					picture: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
					isAdmin: dbUser.is_admin === 1
				};

				return done(null, user);
			} catch (error) {
				console.error('Error in OAuth callback:', error);
				return done(error, null);
			}
		}));

		passport.serializeUser((user, done) => {
			done(null, user);
		});

		passport.deserializeUser((user, done) => {
			done(null, user);
		});
	} else {
		console.warn('WARNING: Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file');
	}
}

/**
 * Middleware to ensure user is authenticated
 */
function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}
	res.status(401).json({ error: 'Not authenticated' });
}

module.exports = {
	configurePassport,
	ensureAuthenticated
};

