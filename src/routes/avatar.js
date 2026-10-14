const express = require('express');
const { isAdmin } = require('../middleware/adminRole');
const { ensureAuthenticated } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { createAvatarService } = require('../services/avatarService');

function createAvatarRouter(database = require('../services/databaseService')) {
    const router = express.Router();
    const service = createAvatarService(database);
    router.use(ensureAuthenticated);
    router.get('/profiles/:userId', asyncHandler(async (req, res) => {
        const id = Number(req.params.userId);
        if (!/^[1-9]\d*$/.test(req.params.userId) || !Number.isSafeInteger(id)) throw ApiError.notFound('Profile not found');
        const user = await database.getUserById(id);
        if (!user || user.is_archived || (isAdmin(user) && !isAdmin(req.user))) throw ApiError.notFound('Profile not found');
        const [activity, awards, appearances] = await Promise.all([
            database.db.get(`SELECT COALESCE(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END),0) AS completed,
                COALESCE(SUM(attempts),0) AS testRuns FROM user_progress WHERE user_id = ?`, [id]),
            database.db.get(`SELECT COUNT(*) AS achievements, COALESCE(SUM(a.points),0) AS points
                FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id WHERE ua.user_id = ?`, [id]),
            service.getAppearances([id])
        ]);
        res.set('Cache-Control', 'no-store');
        res.json({ id, displayName: user.display_name || 'Anonymous', avatar: appearances.get(id), stats: { ...activity, ...awards } });
    }));
    router.get('/appearance', asyncHandler(async (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json({ selection: (await service.getAppearances([req.user.id])).get(req.user.id) });
    }));
    router.get('/', asyncHandler(async (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json(await service.getState(req.user.id));
    }));
    router.put('/', asyncHandler(async (req, res) => {
        try { res.json(await service.saveSelection(req.user.id, req.body)); }
        catch (error) {
            if (/Invalid saved look|Choose a complete avatar|Unknown avatar|Unlock this item/.test(error.message)) throw ApiError.badRequest(error.message);
            throw error;
        }
    }));
    router.put('/looks/:slot', asyncHandler(async (req, res) => {
        try { res.json(await service.saveLook(req.user.id, Number(req.params.slot), req.body)); }
        catch (error) { if (/Invalid saved look|Choose|Unknown avatar|Unlock this item/.test(error.message)) throw ApiError.badRequest(error.message); throw error; }
    }));
    router.delete('/looks/:slot', asyncHandler(async (req, res) => {
        try { res.json(await service.deleteLook(req.user.id, Number(req.params.slot))); }
        catch (error) { if (/Invalid saved look/.test(error.message)) throw ApiError.badRequest(error.message); throw error; }
    }));
    return router;
}
module.exports = createAvatarRouter;
