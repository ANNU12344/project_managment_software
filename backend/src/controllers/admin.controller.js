const adminService = require('../services/admin.service');
const snapshotService = require('../services/snapshot.service');

/* ---------- users ---------- */
async function listUsers(req, res) { res.json({ users: await adminService.listUsers() }); }
async function createUser(req, res) { res.json({ ok: true, id: await adminService.createUser(req.user, req.body || {}) }); }
async function updateUser(req, res) { await adminService.updateUser(req.user, req.params.id, req.body || {}); res.json({ ok: true }); }

/* ---------- engagements ---------- */
async function listProjects(req, res) { res.json(await adminService.listProjects()); }
async function createProject(req, res) { res.json({ ok: true, id: await adminService.createProject(req.user, req.body || {}) }); }
async function updateProject(req, res) { await adminService.updateProject(req.user, req.params.id, req.body); res.json({ ok: true }); }

/* ---------- baseline, weights ---------- */
async function getBaseline(req, res) { res.json(await adminService.getBaseline()); }
async function updateBaseline(req, res) { res.json({ ok: true, changed: await adminService.updateBaseline(req.user, (req.body || {}).baseline) }); }
async function getWeights(req, res) { res.json(await adminService.getWeights()); }
async function updateWeights(req, res) { await adminService.updateWeights(req.user, (req.body || {}).weights); res.json({ ok: true }); }

/* ---------- snapshot, audit log ---------- */
async function snapshot(req, res) { res.json(await snapshotService.takeSnapshot((req.body || {}).week_ending)); }
async function audit(req, res) { res.json({ log: await adminService.auditLog() }); }

module.exports = {
  listUsers, createUser, updateUser, listProjects, createProject, updateProject,
  getBaseline, updateBaseline, getWeights, updateWeights, snapshot, audit
};
