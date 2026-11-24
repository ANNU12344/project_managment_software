/* The /api router. Public routes first, then everything behind requireAuth. */
const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth');
const { apiNotFound } = require('../middlewares/error-handler');
const { publicRoutes, switchRoutes } = require('./auth.routes');

const api = Router();

/* public */
api.use(publicRoutes);

/* signed in */
api.use(requireAuth);
api.use(switchRoutes);
api.use(require('./portfolio.routes'));
api.use(require('./meta.routes'));
api.use(require('./project.routes'));
api.use(require('./status.routes'));
api.use(require('./upload.routes'));
api.use(require('./export.routes'));
api.use(require('./ai.routes'));
api.use(require('./action.routes'));
api.use(require('./admin.routes'));
api.use(require('./audit.routes'));

api.use(apiNotFound);

module.exports = api;
