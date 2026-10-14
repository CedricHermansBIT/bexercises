const path = require('node:path');
const { isAdmin } = require('./adminRole');

// Run before static serving, including encoded paths that static middleware decodes.
function createPageAccess(basePath = '') {
    const prefixes = [...new Set([path.posix.normalize(`${basePath}/pages`), '/pages'])];
    return (req, res, next) => {
        let pathname;
        try { pathname = path.posix.normalize(decodeURIComponent(req.path)); }
        catch { return res.status(400).send('Invalid path'); }
        const lowerPath = pathname.toLowerCase();
        const prefix = prefixes.find(value => lowerPath === value.toLowerCase() || lowerPath.startsWith(`${value.toLowerCase()}/`));
        if (!prefix) return next();
        const page = pathname.slice(prefix.length).toLowerCase();
        if (page === '/login.html') return next();
        res.set('Cache-Control', 'no-store');
        if (!req.isAuthenticated()) return res.redirect(302, `${prefix}/login.html`);
        const adminPage = page === '/admin' || page === '/admin.html' || page.startsWith('/admin/');
        // The former admin avatar URL redirects to the shared student studio.
        if (adminPage && page !== '/admin/avatar.html' && !isAdmin(req.user)) {
            return res.redirect(302, `${prefix}/languages.html`);
        }
        next();
    };
}
module.exports = createPageAccess;
