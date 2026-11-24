/* ncs and nc_comments — the auditor's non-conformances and their thread */
const db = require('../db/connection');
const { now } = require('../utils/dates');

const Nc = {
  all: () => db.all('SELECT * FROM ncs ORDER BY raised_date DESC'),
  forProject: (pid) => db.all('SELECT * FROM ncs WHERE project_id = ?', [pid]),
  forProjectNewestFirst: (pid) => db.all('SELECT * FROM ncs WHERE project_id = ? ORDER BY raised_date DESC', [pid]),
  countForProject: async (pid) => (await db.get('SELECT COUNT(*) AS n FROM ncs WHERE project_id=?', [pid])).n,
  create: async (n) => {
    const id = db.uid('nc');
    await db.run('INSERT INTO ncs (id,project_id,ref,title,description,category,category_id,severity,raised_by,raised_date,due_date,status,assigned_to,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, n.project_id, n.ref, n.title, n.description || null, n.category || null, n.category_id || null, n.severity, n.raised_by, n.raised_date, n.due_date || null,
       n.status, n.assigned_to || null, now()]);
    return id;
  },
  update: (id, f) => db.run('UPDATE ncs SET status=?, action_taken=?, due_date=?, severity=?, closed_date=?, updated_at=? WHERE id=?',
    [f.status, f.action_taken, f.due_date, f.severity, f.closed_date, now(), id])
};

const NcComment = {
  forNc: (ncId) => db.all('SELECT * FROM nc_comments WHERE nc_id=? ORDER BY created_at', [ncId]),
  counts: () => db.all('SELECT nc_id, COUNT(*) AS n FROM nc_comments GROUP BY nc_id'),
  add: (ncId, userId, kind, body) => db.run('INSERT INTO nc_comments (id,nc_id,user_id,kind,body,created_at) VALUES (?,?,?,?,?,?)',
    [db.uid('ncc'), ncId, userId, kind, body, now()])
};

module.exports = { Nc, NcComment };
