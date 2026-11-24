const { Router } = require('express');
const h = require('../utils/async-handler');
const { requireRole } = require('../middlewares/auth');
const { ACTION_RAISERS } = require('../domain/roles');
const c = require('../controllers/action.controller');

const r = Router();
r.get('/actions', h(c.list));
r.post('/actions', requireRole(...ACTION_RAISERS), h(c.create));
r.put('/actions/:id', h(c.update));

module.exports = r;
