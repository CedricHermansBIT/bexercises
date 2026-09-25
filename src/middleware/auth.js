// src/middleware/auth.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const config = require('../config');
const databaseService = require('../services/databaseService');
const { isAdmin } = require('./adminRole');

async function resolveSessionUser(id) {
	// Existing sessions may contain the old serialized user object.
	const userId = typeof id === 'object' ? id?.id : id;
	if (!userId) return false;
	const dbUser = await databaseService.getUserById(userId);
	if (!dbUser) return false;
	return {
		id: dbUser.id,
		googleId: dbUser.google_id,
		email: dbUser.email,
		name: dbUser.display_name,
		isAdmin: isAdmin(dbUser)
	};
}

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
					// Archiving is for cohort management, not a login ban. A returning
					// student becomes active again after a successful Google sign-in.
					if (dbUser.is_archived) {
						await databaseService.db.run(
							'UPDATE users SET is_archived = 0, archived_at = NULL WHERE id = ?',
							[dbUser.id]
						);
						dbUser.is_archived = 0;
						dbUser.archived_at = null;
					}
					// Update last login
					await databaseService.updateUserLogin(dbUser.id);
					dbUser = await databaseService.updateUserProfile(dbUser.id, email, displayName);
				}

				// Return user object for session
				const user = {
					id: dbUser.id,
					googleId: googleId,
					email: dbUser.email,
					name: dbUser.display_name,
					picture: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
					isAdmin: isAdmin(dbUser)
				};

				return done(null, user);
			} catch (error) {
				console.error('Error in OAuth callback:', error);
				return done(error, null);
			}
		}));

	} else {
		console.warn('WARNING: Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file');
	}
	passport.serializeUser((user, done) => done(null, user.id));
	passport.deserializeUser((id, done) => {
		resolveSessionUser(id).then(user => done(null, user), done);
	});
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
	ensureAuthenticated,
	resolveSessionUser
};

