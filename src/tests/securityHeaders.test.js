const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const securityHeaders = require('../middleware/securityHeaders');
const cors = require('../middleware/cors');

test('security headers restrict scripts and anonymous CORS access', async () => {
	const app = express();
	app.use(securityHeaders);
	app.use(cors);
	app.get('/probe', (_req, res) => res.send('ok'));
	const server = app.listen(0);
	try {
		const url = `http://127.0.0.1:${server.address().port}/probe`;
		const response = await fetch(url, { headers: { Origin: 'https://untrusted.example' } });
		assert.equal(response.status, 200);
		assert.equal(response.headers.get('access-control-allow-origin'), null);
		assert.match(response.headers.get('content-security-policy'), /script-src 'self' https:\/\/cdnjs.cloudflare.com/);
		assert.doesNotMatch(response.headers.get('content-security-policy'), /unsafe-inline.*script/);
		assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
		const preflight = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'https://untrusted.example' } });
		assert.equal(preflight.status, 403);
	} finally {
		await new Promise(resolve => server.close(resolve));
	}
});
