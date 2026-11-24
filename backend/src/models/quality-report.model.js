/* quality_reports — auditor templates, PM submissions, auditor reviews */
const db = require('../db/connection');
const { now } = require('../utils/dates');

const QualityReport = {
  all: () => db.all('SELECT * FROM quality_reports ORDER BY uploaded_at DESC'),
  getTemplate: (id) => db.get("SELECT * FROM quality_reports WHERE id=? AND kind='template'", [id]),
  getSubmission: (id) => db.get("SELECT * FROM quality_reports WHERE id=? AND kind='submission'", [id]),
  byFile: (fileId) => db.get('SELECT * FROM quality_reports WHERE file_id=?', [fileId]),
  countSubmissions: async (templateId, pid) => (await db.get("SELECT COUNT(*) AS n FROM quality_reports WHERE kind='submission' AND template_id=? AND project_id=?", [templateId, pid])).n,
  createTemplate: async ({ title, description, fileId, dueDate, userId }) => {
    const id = db.uid('qrt');
    await db.run('INSERT INTO quality_reports (id,kind,title,description,file_id,status,due_date,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, 'template', title, description || null, fileId, 'Active', dueDate || null, userId, now()]);
    return id;
  },
  createSubmission: async ({ title, note, projectId, templateId, version, fileId, userId }) => {
    const id = db.uid('qrs');
    await db.run('INSERT INTO quality_reports (id,kind,title,description,project_id,template_id,version,file_id,status,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [id, 'submission', title, note || null, projectId, templateId, version, fileId, 'Submitted', userId, now()]);
    return id;
  },
  createReview: async ({ sub, comment, fileId, status, userId }) => {
    const id = db.uid('qrv');
    await db.run('INSERT INTO quality_reports (id,kind,title,description,project_id,template_id,parent_id,version,file_id,status,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, 'review', sub.title + ' — auditor version', comment || null, sub.project_id, sub.template_id, sub.id, sub.version, fileId, status, userId, now()]);
    return id;
  },
  setReview: (id, status, comment, userId) => db.run('UPDATE quality_reports SET status=?, review_comment=?, reviewed_by=?, reviewed_at=? WHERE id=?',
    [status, comment || null, userId, now(), id])
};

module.exports = QualityReport;
