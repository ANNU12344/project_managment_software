/* projects */
const db = require('../db/connection');
const { now } = require('../utils/dates');

const Project = {
  all: () => db.all('SELECT * FROM projects ORDER BY code'),
  byId: (id) => db.get('SELECT * FROM projects WHERE id = ?', [id]),
  byCode: (code) => db.get('SELECT * FROM projects WHERE code = ?', [code]),
  create: async (p) => {
    const id = db.uid('prj');
    await db.run(`INSERT INTO projects
      (id,code,name,client,bu,project_type,commercial_basis,status,pm_user_id,dh_user_id,contract_value,margin_at_bid,start_date,end_date,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, p.code, p.name, p.client, p.bu, p.project_type, p.commercial_basis, p.status || 'In Progress',
       p.pm_user_id || null, p.dh_user_id || null, p.contract_value || 0, p.margin_at_bid || 0,
       p.start_date || null, p.end_date || null, now()]);
    return id;
  },
  update: (id, p) => db.run(`UPDATE projects SET name=?,client=?,bu=?,project_type=?,commercial_basis=?,
      status=?,pm_user_id=?,dh_user_id=?,contract_value=?,margin_at_bid=?,start_date=?,end_date=? WHERE id=?`,
    [p.name, p.client, p.bu, p.project_type, p.commercial_basis, p.status, p.pm_user_id || null,
     p.dh_user_id || null, p.contract_value || 0, p.margin_at_bid || 0, p.start_date || null, p.end_date || null, id]),

  /* Project details maintained by the PM (screen or upload). Only the listed keys are
     written; anything not supplied keeps its current value. */
  updateDetails: async (id, d, userId) => {
    const { FIELDS } = require('../domain/project-details');
    const keys = FIELDS.map(f => f.key).filter(k => d[k] !== undefined);
    if (!keys.length) return 0;
    await db.run(`UPDATE projects SET ${keys.map(k => k + '=?').join(',')}, details_updated_at=?, details_updated_by=? WHERE id=?`,
      keys.map(k => d[k] === '' ? null : d[k]).concat([now(), userId || null, id]));
    return keys.length;
  }
};

module.exports = Project;
