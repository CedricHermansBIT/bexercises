// src/routes/auth.js
const express = require('express');
const passport = require('passport');
const config = require('../config');
const { isAdmin } = require('../middleware/adminRole');

const router = express.Router();
const basePath = config.server.basePath || '';
const homePath = `${basePath}/`;

/**
 * Initiate Google OAuth
 */
router.get('/google',
	passport.authenticate('google', { scope: ['profile', 'email'] })
);

/**
 * Google OAuth callback
 */
router.get('/google/callback',
	passport.authenticate('google', { failureRedirect: homePath }),
	(req, res) => {
		req.session.profilePicture = req.user?.picture || null;
		res.redirect(homePath);
	}
);

/**
 * Logout
 */
router.get('/logout', (req, res) => {
	req.logout((err) => {
		if (err) {
			return res.status(500).json({ error: 'Logout failed' });
		}
		res.redirect(homePath);
	});
});

/**
 * Get current user info
 */
router.get('/user', (req, res) => {
	if (req.isAuthenticated()) {
		res.json({
			authenticated: true,
			user: {
				...req.user,
				picture: req.session.profilePicture || req.user.picture || null,
				isAdmin: isAdmin(req.user)
			}
		});
	} else {
		res.json({
			authenticated: false,
			user: null
		});
	}
});

module.exports = router;

