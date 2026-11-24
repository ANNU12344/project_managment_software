const qualityService = require('../services/quality.service');
const { sendFile } = require('../utils/http');

/* GET /quality */
async function overview(req, res) { res.json(await qualityService.overview(req.user)); }

/* POST /quality/templates (multipart: file, title, description, due_date) */
async function addTemplate(req, res) { res.json({ ok: true, id: await qualityService.addTemplate(req.user, req.file, req.body) }); }

/* POST /quality/templates/:id/submit (multipart: file, project_id, note) */
async function submit(req, res) { res.json(Object.assign({ ok: true }, await qualityService.submit(req.user, req.params.id, req.file, req.body))); }

/* POST /quality/submissions/:id/review (multipart: status, comment, file?) */
async function review(req, res) { await qualityService.review(req.user, req.params.id, req.file, req.body); res.json({ ok: true }); }

/* GET /files/:id */
async function download(req, res) { sendFile(res, await qualityService.download(req.user, req.params.id)); }

module.exports = { overview, addTemplate, submit, review, download };
