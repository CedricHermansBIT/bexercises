// src/routes/auth.js
const express = require('express');
const passport = require('passport');

const router = express.Router();

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
	passport.authenticate('google', { failureRedirect: '/' }),
	(req, res) => {
		res.redirect('/');
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
		res.redirect('/');
	});
});

/**
 * Get current user info
 */
router.get('/user', (req, res) => {
	if (req.isAuthenticated()) {
		// Determine if user is admin
		const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
		const adminDomain = process.env.ADMIN_DOMAIN || '@bitlab.nl';

		const isAdmin =
			req.user.role === 'admin' ||
			req.user.isAdmin === true ||
			adminEmails.includes(req.user.email) ||
			req.user.email?.endsWith(adminDomain);

		res.json({
			authenticated: true,
			user: {
				...req.user,
				isAdmin
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

