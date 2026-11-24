/* Weekly status form and record deletes. */
const { Router } = require('express');
const h = require('../utils/async-handler');
const c = require('../controllers/status.controller');

const r = Router();
r.get('/status/:projectId', h(c.get));
r.post('/status/:projectId', h(c.save));
r.delete('/records/:kind/:id', h(c.removeRecord));
r.delete('/milestones/:id', h(c.removeMilestone));
r.delete('/risks/:id', h(c.removeRisk));
r.delete('/dependencies/:id', h(c.removeDependency));

module.exports = r;
