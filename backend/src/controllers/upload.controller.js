const uploadService = require('../services/upload.service');
const timesheetService = require('../services/timesheet.service');
const { sendXlsx } = require('../utils/http');

/* POST /upload — validate a PMO workbook, nothing written yet */
async function stage(req, res) {
  res.json(await uploadService.stage(req.user, req.file));
}

/* POST /upload/:id/commit */
async function commit(req, res) {
  res.json(await uploadService.commit(req.user, req.params.id));
}

/* GET /uploads */
async function list(req, res) {
  res.json(await uploadService.listOwn(req.user));
}

/* GET /timesheets/template */
function timesheetTemplate(req, res) {
  sendXlsx(res, 'DCC-Timesheet-Template.xlsx', timesheetService.template());
}

/* POST /timesheets/upload */
async function timesheetStage(req, res) {
  res.json(await timesheetService.stage(req.user, req.file));
}

/* POST /timesheets/:id/commit */
async function timesheetCommit(req, res) {
  res.json(await timesheetService.commit(req.user, req.params.id));
}

/* GET /timesheets */
async function timesheets(req, res) {
  res.json(await timesheetService.overview(req.user));
}

module.exports = { stage, commit, list, timesheetTemplate, timesheetStage, timesheetCommit, timesheets };
