/* Workbook uploads: stage (validate, store the result), commit (write the staged rows), list. */
const M = require('../models');
const workbook = require('./workbook.service');
const state = require('./project-state.service');
const { badRequest, notFound } = require('../utils/errors');

async function stage(user, file) {
  if (!file) throw badRequest('no_file');
  const result = await workbook.parseAndValidate(file.buffer, user);
  const id = await M.Upload.create({
    userId: user.id, filename: file.originalname, rowsOk: result.summary.rows_ok, rowsError: result.errors.length,
    report: { summary: result.summary, errors: result.errors, staged: result.staged }
  });
  return { upload_id: id, ok: result.ok, summary: result.summary, errors: result.errors.slice(0, 200) };
}

async function commit(user, uploadId) {
  const row = await M.Upload.getOwn(uploadId, user.id);
  if (!row) throw notFound();
  if (row.committed) throw badRequest('already_committed');
  const payload = JSON.parse(row.report);
  if (payload.errors.length) throw badRequest('has_errors', undefined, { count: payload.errors.length });
  const out = await workbook.commit(payload.staged, user);
  await M.Upload.markCommitted(uploadId);
  for (const pid of (out.project_ids || [])) await state.saveWeek(pid, user.id);
  await M.AuditLog.log(user.id, 'upload.commit', 'upload', uploadId, out);
  return { ok: true, applied: out };
}

async function listOwn(user) {
  return { uploads: (await M.Upload.listOwn(user.id)).slice(0, 20) };
}

module.exports = { stage, commit, listOwn };
