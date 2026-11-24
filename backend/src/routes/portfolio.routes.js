const { Router } = require('express');
const h = require('../utils/async-handler');
const c = require('../controllers/portfolio.controller');

const r = Router();
r.get('/portfolio', h(c.portfolio));
r.get('/clients', h(c.clients));
r.get('/history/portfolio', h(c.history));

module.exports = r;
