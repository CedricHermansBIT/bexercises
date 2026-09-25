function isAdmin(user) {
	if (!user) return false;
	const email = String(user.email || '').trim().toLowerCase();
	const adminEmails = (process.env.ADMIN_EMAILS || '').split(',')
		.map(value => value.trim().toLowerCase()).filter(Boolean);
	const adminDomain = (process.env.ADMIN_DOMAIN || '').trim().toLowerCase();
	return user.is_admin === 1 || user.isAdmin === true || user.role === 'admin'
		|| (email && adminEmails.includes(email))
		|| Boolean(email && adminDomain && email.endsWith(adminDomain));
}

module.exports = { isAdmin };
