const express = require('express');
const crypto = require('node:crypto');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { createMcpServer } = require('./server');

function createMcpRouter({ token = process.env.BITLAB_MCP_TOKEN || '',
	allowedHosts = (process.env.BITLAB_MCP_ALLOWED_HOSTS || 'localhost,127.0.0.1,[::1]').split(',').map(host => host.trim()),
	serverFactory = createMcpServer } = {}) {
	if (token && token.length < 32) throw new Error('BITLAB_MCP_TOKEN must have at least 32 characters');
	const router = express.Router();
	router.use((req, res, next) => {
		if (!token) return res.status(404).json({ error: 'MCP is disabled' });
		const provided = Buffer.from(req.headers.authorization || '');
		const expected = Buffer.from(`Bearer ${token}`);
		if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
			res.setHeader('WWW-Authenticate', 'Bearer realm="BITLab MCP"');
			return res.status(401).json({ error: 'Invalid MCP token' });
		}
		let hostname;
		try { hostname = new URL(`http://${req.headers.host}`).hostname; } catch { /* rejected below */ }
		if (!allowedHosts.includes(hostname) || req.headers.origin) {
			return res.status(403).json({ error: 'MCP host or browser origin is not allowed' });
		}
		next();
	});
	router.use(express.json({ limit: '1mb' }));
	router.post('/', async (req, res, next) => {
		const server = serverFactory();
		const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
		res.once('close', () => { void server.close().catch(() => {}); });
		try {
			await server.connect(transport);
			await transport.handleRequest(req, res, req.body);
		} catch (error) {
			next(error);
		}
	});
	router.all('/', (_req, res) => res.status(405).set('Allow', 'POST').json({ error: 'Use stateless MCP POST requests' }));
	return router;
}

module.exports = createMcpRouter;
