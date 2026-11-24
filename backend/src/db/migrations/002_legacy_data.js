/* 002 — one-time data clean-ups that server/migrate.js used to repeat on every start:
 *   - seeded accounts renamed to role-based e-mail addresses
 *   - old list values moved on to the PMO workbook lists (status, type, stage, milestone, IAD)
 *   - action items without an ID get one (ACT-<project code>-NN)
 *   - NC status "In Progress" retired (back to "Open")
 * Every step only touches rows still holding an old value, so running it again changes nothing.
 */
const { LEGACY } = require('../../domain/records');

const LEGACY_EMAILS = {
  's.raghavan@uneecops.in': 'deliveryhead@uneecops.in',
  'm.grover@uneecops.in':   'deliveryhead2@uneecops.in',
  'd.govind@uneecops.in':   'director@uneecops.in',
  'r.sethi@uneecops.in':    'director2@uneecops.in',
  'v.menon@uneecops.in':    'pm1@uneecops.in',
  'a.nair@uneecops.in':     'pm2@uneecops.in',
  'd.barman@uneecops.in':   'pm3@uneecops.in',
  't.qureshi@uneecops.in':  'pm4@uneecops.in',
  'k.iyer@uneecops.in':     'pm5@uneecops.in',
  'p.rao@uneecops.in':      'pm6@uneecops.in'
};

async function renameLegacyEmails(db) {
  let n = 0;
  for (const [oldEmail, newEmail] of Object.entries(LEGACY_EMAILS)) {
    const old = await db.get('SELECT id FROM users WHERE email = ?', [oldEmail]);
    const taken = await db.get('SELECT id FROM users WHERE email = ?', [newEmail]);
    if (old && !taken) { await db.run('UPDATE users SET email = ? WHERE id = ?', [newEmail, old.id]); n++; }
  }
  return n;
}

async function migrateValues(db) {
  let moved = 0;
  /* The old "project type" described the work; the workbook's Project Type is the commercial model,
     which the old commercial_basis column held. */
  const oldKinds = ['Build / Development', 'Implementation', 'AMC / O&M', 'Staff augmentation', 'Product deployment', 'Consulting'];
  for (const k of oldKinds) moved += (await db.run('UPDATE projects SET project_type = commercial_basis WHERE project_type = ?', [k])).changes;
  const plan = [
    ['projects', 'status', LEGACY.projectStatus], ['projects', 'project_type', LEGACY.projectType], ['projects', 'stage', LEGACY.stage],
    ['milestones', 'status', LEGACY.milestoneStatus], ['dependencies', 'status', LEGACY.iadStatus]
  ];
  for (const [table, col, map] of plan) {
    for (const [from, to] of Object.entries(map)) moved += (await db.run(`UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`, [to, from])).changes;
  }
  moved += (await db.run("UPDATE dependencies SET iad_type = 'Dependency' WHERE iad_type IS NULL")).changes;
  moved += (await db.run('UPDATE projects SET commercial_basis = project_type WHERE commercial_basis <> project_type')).changes;
  return moved;
}

async function backfillActionRefs(db) {
  const rows = await db.all('SELECT id, project_id FROM action_items WHERE ref IS NULL ORDER BY created_at');
  for (const a of rows) {
    const p = a.project_id ? await db.get('SELECT code FROM projects WHERE id = ?', [a.project_id]) : null;
    const prefix = p ? `ACT-${p.code}-` : 'ACT-';
    const used = await db.all('SELECT ref FROM action_items WHERE ref LIKE ?', [prefix + '%']);
    const max = used.reduce((m, r) => { const tail = String(r.ref).slice(prefix.length); return /^\d+$/.test(tail) ? Math.max(m, Number(tail)) : m; }, 0);
    await db.run('UPDATE action_items SET ref = ? WHERE id = ?', [prefix + String(max + 1).padStart(2, '0'), a.id]);
  }
  return rows.length;
}

async function retireNcInProgress(db) {
  return (await db.run("UPDATE ncs SET status = 'Open' WHERE status = 'In Progress'")).changes;
}

module.exports = {
  name: 'legacy_data',
  async up(db, log) {
    const r = {
      emails_renamed: await renameLegacyEmails(db),
      values_moved: await migrateValues(db),
      action_refs: await backfillActionRefs(db),
      ncs_reopened: await retireNcInProgress(db)
    };
    log.info('legacy data normalised', r);
  }
};
