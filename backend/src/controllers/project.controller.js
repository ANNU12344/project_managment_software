const projectService = require('../services/project.service');

/* GET /projects/:id */
async function get(req, res) {
  res.json(await projectService.projectForApi(req.user, req.params.id));
}

/* PUT /projects/:id/dates */
async function updateDates(req, res) {
  await projectService.updateDates(req.user, req.params.id, req.body || {});
  res.json({ ok: true });
}

/* GET /projects/:id/weekly */
async function weekly(req, res) {
  res.json(await projectService.weeklyRegister(req.user, req.params.id));
}

/* PUT /projects/:id/weekly/:week */
async function saveWeekly(req, res) {
  await projectService.saveWeeklyEffort(req.user, req.params.id, req.params.week, req.body);
  res.json({ ok: true });
}

/* GET /projects/:id/weeks */
async function weeks(req, res) {
  res.json(await projectService.weeks(req.user, req.params.id));
}

/* GET /projects/:id/weeks/:week */
async function week(req, res) {
  res.json(await projectService.week(req.user, req.params.id, req.params.week));
}

/* GET /projects/:id/compare?a=&b= */
async function compare(req, res) {
  res.json(await projectService.compare(req.user, req.params.id, req.query.a, req.query.b));
}

module.exports = { get, updateDates, weekly, saveWeekly, weeks, week, compare };
