const express = require('express');
const { ensureAuthenticated } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { createAvatarService } = require('../services/avatarService');

function createAvatarRouter(database = require('../services/databaseService')) {
    const router = express.Router();
    const service = createAvatarService(database);
    router.use(ensureAuthenticated);
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
