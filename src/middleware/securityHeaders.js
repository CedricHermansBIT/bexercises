const csp = [
	"default-src 'self'",
	"base-uri 'self'",
	"object-src 'none'",
	"frame-ancestors 'none'",
	"script-src 'self' https://cdnjs.cloudflare.com",
	"style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
	"font-src 'self' data: https://fonts.gstatic.com",
	"img-src 'self' data: https:",
	"connect-src 'self'",
	"frame-src https://www.youtube.com",
	"form-action 'self'"
].join('; ');

function securityHeaders(_req, res, next) {
	res.setHeader('Content-Security-Policy', csp);
	res.setHeader('X-Content-Type-Options', 'nosniff');
	res.setHeader('X-Frame-Options', 'DENY');
	res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
	res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	next();
}

module.exports = securityHeaders;
