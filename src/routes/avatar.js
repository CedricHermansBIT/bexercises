const express = require('express');
const requireAdmin = require('../middleware/adminAuth');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { createAvatarService } = require('../services/avatarService');

function createAvatarRouter(database = require('../services/databaseService')) {
    const router = express.Router();
    const service = createAvatarService(database);
    router.use(requireAdmin);
    router.get('/', asyncHandler(async (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json(await service.getState(req.user.id));
    }));
    router.put('/', asyncHandler(async (req, res) => {
        try { res.json(await service.saveSelection(req.user.id, req.body)); }
        catch (error) {
            if (/Choose a character|Unknown avatar|Unlock this item/.test(error.message)) throw ApiError.badRequest(error.message);
            throw error;
        }
    }));
    return router;
}
module.exports = createAvatarRouter;
