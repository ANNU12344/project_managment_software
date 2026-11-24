const { Router } = require('express');
const h = require('../utils/async-handler');
const c = require('../controllers/project.controller');

const r = Router();
r.get('/projects/:id', h(c.get));
r.put('/projects/:id/dates', h(c.updateDates));
r.get('/projects/:id/weekly', h(c.weekly));
r.put('/projects/:id/weekly/:week', h(c.saveWeekly));
r.get('/projects/:id/weeks', h(c.weeks));
r.get('/projects/:id/weeks/:week', h(c.week));
r.get('/projects/:id/compare', h(c.compare));

module.exports = r;
