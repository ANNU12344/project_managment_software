const { Router } = require('express');
const h = require('../utils/async-handler');
const c = require('../controllers/ai.controller');

const r = Router();
r.get('/ai/status', h(c.status));
r.post('/ai/brief', h(c.brief));
r.post('/ai/project/:id', h(c.analyse));
r.post('/ai/narrative/:id', h(c.narrative));
r.post('/ai/escalation/:id', h(c.escalation));
r.post('/ai/ask', h(c.ask));

module.exports = r;
