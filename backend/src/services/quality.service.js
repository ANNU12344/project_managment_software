/* Quality reports: the auditor's templates, the PM's filled versions, the auditor's reviewed versions. */
const M = require('../models');
const access = require('./access.service');
const { QR_STATUS } = require('../domain/quality');
const { notFound, forbidden, validation } = require('../utils/errors');

async function overview(user) {
  const visible = await access.visibleTo(user);
  const map = {}; visible.forEach(p => map[p.id] = p);
  const users = await M.User.all(); const nm = id => (users.find(u => u.id === id) || {}).name || null;
  const all = await M.QualityReport.all();
  const dec = r => Object.assign({}, r, { project_code: r.project_id && map[r.project_id] ? map[r.project_id].code : null, uploaded_by_name: nm(r.uploaded_by), reviewed_by_name: nm(r.reviewed_by) });
  return {
    templates: all.filter(r => r.kind === 'template').map(dec),
    submissions: all.filter(r => r.kind === 'submission' && map[r.project_id]).map(dec),
    reviews: all.filter(r => r.kind === 'review' && map[r.project_id]).map(dec),
    projects: visible.filter(p => access.canEditStatus(user, p)).map(p => ({ id: p.id, code: p.code, name: p.name })),
    statuses: QR_STATUS, can_template: access.isAuditor(user)
  };
}

async function addTemplate(user, file, b) {
  if (!access.isAuditor(user)) throw forbidden();
  if (!file) throw validation('Attach the template file');
  b = b || {};
  const title = String(b.title || '').trim() || file.originalname;
  const fileId = await M.StoredFile.store(file, user.id);
  const id = await M.QualityReport.createTemplate({ title: title.slice(0, 190), description: b.description, fileId, dueDate: b.due_date, userId: user.id });
  await M.AuditLog.log(user.id, 'quality.template', 'quality', id, { title });
  return id;
}

async function submit(user, templateId, file, b) {
  const t = await M.QualityReport.getTemplate(templateId);
  if (!t) throw notFound();
  b = b || {};
  const s = await access.scopedProject(user, b.project_id);
  if (!s.canEdit) throw forbidden();
  if (!file) throw validation('Attach your filled report');
  const version = (await M.QualityReport.countSubmissions(t.id, s.p.id)) + 1;
  const fileId = await M.StoredFile.store(file, user.id);
  const id = await M.QualityReport.createSubmission({ title: t.title, note: b.note, projectId: s.p.id, templateId: t.id, version, fileId, userId: user.id });
  await M.AuditLog.log(user.id, 'quality.submit', 'quality', id, { project: s.p.code, version });
  return { id, version };
}

async function review(user, submissionId, file, b) {
  if (!access.isAuditor(user)) throw forbidden();
  const sub = await M.QualityReport.getSubmission(submissionId);
  if (!sub) throw notFound();
  b = b || {};
  if (QR_STATUS.indexOf(b.status) < 0) throw validation(`Status: ${QR_STATUS.join(', ')}`);
  if (b.status === 'Rework requested' && !String(b.comment || '').trim()) throw validation('Say what needs reworking');
  await M.QualityReport.setReview(sub.id, b.status, b.comment, user.id);
  if (file) {
    const fileId = await M.StoredFile.store(file, user.id);
    await M.QualityReport.createReview({ sub, comment: b.comment, fileId, status: b.status, userId: user.id });
  }
  await M.AuditLog.log(user.id, 'quality.review', 'quality', sub.id, { status: b.status, file: !!file });
}

/* A stored file, if the user may see the report it belongs to. Templates are open to everyone signed in. */
async function download(user, fileId) {
  const ref = await M.QualityReport.byFile(fileId);
  if (!ref) throw notFound();
  if (ref.kind !== 'template') await access.scopedProject(user, ref.project_id);
  const f = await M.StoredFile.get(fileId);
  if (!f) throw notFound();
  return f;
}

module.exports = { overview, addTemplate, submit, review, download };
