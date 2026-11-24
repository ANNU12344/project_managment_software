/* action_items */
const db = require('../db/connection');
const { now } = require('../utils/dates');

/* Action item ID, like an NC's: ACT-<project code>-01, -02 … per project, or ACT-01 … for an item
   not tied to a project. Next number = highest in use + 1, so the IDs never repeat. */
async function nextRef(projectId) {
  const p = projectId ? await db.get('SELECT code FROM projects WHERE id=?', [projectId]) : null;
  const prefix = p ? `ACT-${p.code}-` : 'ACT-';
  const rows = await db.all('SELECT ref FROM action_items WHERE ref LIKE ?', [prefix + '%']);
  const max = rows.reduce((m, r) => {
    const tail = String(r.ref).slice(prefix.length);
    return /^\d+$/.test(tail) ? Math.max(m, Number(tail)) : m;     // ACT-01 must not count ACT-CIMS-BR-01-01
  }, 0);
  return prefix + String(max + 1).padStart(2, '0');
}

const ActionItem = {
  nextRef,
  create: async (a) => {
    const id = db.uid('act');
    const ref = await nextRef(a.project_id);
    await db.run(`INSERT INTO action_items (id,ref,project_id,title,detail,raised_by,raised_by_role,owner_user_id,due_date,priority,status,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, ref, a.project_id || null, a.title, a.detail || null, a.raised_by, a.raised_by_role,
       a.owner_user_id || null, a.due_date || null, a.priority || 'Medium', 'Open', now()]);
    return id;
  },
  all: () => db.all('SELECT * FROM action_items ORDER BY status, due_date'),
  get: (id) => db.get('SELECT * FROM action_items WHERE id=?', [id]),
  update: (id, a) => db.run('UPDATE action_items SET status=?, response=?, owner_user_id=?, due_date=?, priority=?, closed_at=? WHERE id=?',
    [a.status, a.response || null, a.owner_user_id || null, a.due_date || null, a.priority || 'Medium',
     a.status === 'Closed' ? now() : null, id])
};

module.exports = ActionItem;
