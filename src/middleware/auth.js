// src/middleware/auth.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const config = require('../config');

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
		(accessToken, refreshToken, profile, done) => {
			const user = {
				id: profile.id,
				email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
				name: profile.displayName,
				picture: profile.photos && profile.photos[0] ? profile.photos[0].value : null
			};
			return done(null, user);
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

