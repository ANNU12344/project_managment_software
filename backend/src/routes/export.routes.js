const { Router } = require('express');
const h = require('../utils/async-handler');
const c = require('../controllers/export.controller');

const r = Router();
r.get('/export/portfolio.xlsx', h(c.portfolio));
r.get('/export/project/:id.xlsx', h(c.project));

module.exports = r;
