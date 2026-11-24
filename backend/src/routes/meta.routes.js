const { Router } = require('express');
const h = require('../utils/async-handler');
const c = require('../controllers/meta.controller');

const r = Router();
r.get('/meta/project-details', c.projectDetails);
r.get('/meta/records', c.records);
r.get('/meta/weekly', c.weekly);
r.get('/meta/faq', h(c.faq));

module.exports = r;
