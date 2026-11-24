/* Workbook and timesheet uploads. */
const { Router } = require('express');
const h = require('../utils/async-handler');
const upload = require('../middlewares/upload');
const c = require('../controllers/upload.controller');

const r = Router();
r.post('/upload', upload.workbook, h(c.stage));
r.post('/upload/:id/commit', h(c.commit));
r.get('/uploads', h(c.list));

r.get('/timesheets/template', c.timesheetTemplate);
r.post('/timesheets/upload', upload.document, h(c.timesheetStage));
r.post('/timesheets/:id/commit', h(c.timesheetCommit));
r.get('/timesheets', h(c.timesheets));

module.exports = r;
