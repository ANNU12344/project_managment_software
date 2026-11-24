const actionService = require('../services/action.service');

/* GET /actions */
async function list(req, res) {
  res.json({ actions: await actionService.list(req.user) });
}

/* POST /actions */
async function create(req, res) {
  const id = await actionService.create(req.user, req.body || {});
  res.json({ ok: true, id });
}

/* PUT /actions/:id */
async function update(req, res) {
  await actionService.update(req.user, req.params.id, req.body || {});
  res.json({ ok: true });
}

module.exports = { list, create, update };
