const statusService = require('../services/status.service');
const M = require('../models');

/* GET /status/:projectId?week= */
async function get(req, res) {
  res.json(await statusService.getStatus(req.params.projectId, req.query.week));
}

/* POST /status/:projectId */
async function save(req, res) {
  res.json(await statusService.saveStatus(req.user, req.params.projectId, req.body || {}));
}

/* DELETE /records/:kind/:id */
async function removeRecord(req, res) {
  await statusService.deleteRecord(req.user, req.params.kind, req.params.id);
  res.json({ ok: true });
}

/* DELETE /milestones/:id, /risks/:id, /dependencies/:id */
const removeWith = model => async (req, res) => {
  await statusService.deleteSimple(req.user, model, req.params.id);
  res.json({ ok: true });
};

module.exports = {
  get, save, removeRecord,
  removeMilestone: removeWith(M.Milestone),
  removeRisk: removeWith(M.Risk),
  removeDependency: removeWith(M.Dependency)
};
