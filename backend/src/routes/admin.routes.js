/* Administration. GET /metrics/baseline is open to every signed-in user (screens show the limits). */
const { Router } = require('express');
const h = require('../utils/async-handler');
const { requireRole } = require('../middlewares/auth');
const c = require('../controllers/admin.controller');

const admin = requireRole('admin');

const r = Router();
r.get('/admin/users', admin, h(c.listUsers));
r.post('/admin/users', admin, h(c.createUser));
r.put('/admin/users/:id', admin, h(c.updateUser));

r.get('/admin/projects', admin, h(c.listProjects));
r.post('/admin/projects', admin, h(c.createProject));
r.put('/admin/projects/:id', admin, h(c.updateProject));

r.get('/metrics/baseline', h(c.getBaseline));
r.put('/admin/metrics-baseline', admin, h(c.updateBaseline));

r.get('/admin/weights', requireRole('admin', 'ceo'), h(c.getWeights));
r.put('/admin/weights', admin, h(c.updateWeights));

r.post('/admin/snapshot', requireRole('admin', 'ceo', 'dh'), h(c.snapshot));
r.get('/admin/audit', admin, h(c.audit));

module.exports = r;
