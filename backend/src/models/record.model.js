/* Workbook records: milestones, billing, risks, IAD (dependencies), defects, PCI audits, weekly activities.
 * One upsert for all of them, driven by domain/records.js: a row is matched on its spec's key
 * fields within the project, then updated or inserted.
 */
const db = require('../db/connection');
const { now, today, weekEnding } = require('../utils/dates');
const { RECORDS: REC, raidSplit, raidRows } = require('../domain/records');

const EXTRA_COLS = { milestones: ['value_cr', 'slip_reason'], risks: ['category'], dependencies: ['committed_date'] };
const INSERT_DEFAULTS = {
  milestones: () => ({ status: 'Yet to Start', is_billing: 0 }),
  risks: () => ({ probability: '', status: 'Open', raised_date: today() }),
  dependencies: () => ({ status: 'Open', iad_type: 'Dependency', raised_date: today() }),
  billing: () => ({ status: 'Open' }),
  defects: () => ({ total: 0 }),
  pci_audits: () => ({}),
  weekly_activities: () => ({ week_ending: weekEnding() })
};
const ORDER = { milestones: 'baseline_date', risks: 'ref', dependencies: 'ref', billing: 'billing_date', defects: 'defect_type', pci_audits: 'audit_date', weekly_activities: 'week_ending' };

function recordModel(spec) {
  const table = spec.table;
  const cols = spec.cols.map(c => c.key).concat(EXTRA_COLS[table] || []);
  const order = ORDER[table];
  const find = (pid, r) => db.get(`SELECT id FROM ${table} WHERE project_id = ? AND ${spec.key.map(k => `(${k} = ? OR (${k} IS NULL AND ? IS NULL))`).join(' AND ')}`,
    [pid].concat(...spec.key.map(k => [r[k] === undefined ? null : r[k], r[k] === undefined ? null : r[k]])));
  return {
    table,
    forProject: (pid) => db.all(`SELECT * FROM ${table} WHERE project_id = ? ORDER BY ${order}`, [pid]),
    forProjects: async (ids) => ids.length ? (await db.all(`SELECT * FROM ${table}`)).filter(r => ids.indexOf(r.project_id) >= 0) : [],
    get: (id) => db.get(`SELECT * FROM ${table} WHERE id = ?`, [id]),
    remove: (id) => db.run(`DELETE FROM ${table} WHERE id = ?`, [id]),
    upsert: async (pid, r) => {
      r = Object.assign({}, r);
      const fromName = r._refFromName; delete r._refFromName;
      let ex = fromName ? null : await find(pid, r);
      /* A milestone uploaded without an ID is matched on its name, keeping the ID it already has. */
      if (!ex && spec.altKey) {
        ex = await db.get(`SELECT id FROM ${table} WHERE project_id = ? AND ${spec.altKey.map(k => `${k} = ?`).join(' AND ')}`, [pid].concat(spec.altKey.map(k => r[k])));
        if (ex && fromName) delete r.ref;
      }
      if (!ex && fromName) ex = await find(pid, r);
      const present = cols.filter(c => r[c] !== undefined);
      const val = c => (r[c] === '' ? null : r[c]);
      if (ex) {
        if (present.length) await db.run(`UPDATE ${table} SET ${present.map(c => c + '=?').join(',')}, updated_at=? WHERE id=?`,
          present.map(val).concat([now(), ex.id]));
        return ex.id;
      }
      const row = Object.assign(INSERT_DEFAULTS[table](), r);
      const ins = cols.filter(c => row[c] !== undefined);
      const id = db.uid(table.slice(0, 3));
      await db.run(`INSERT INTO ${table} (id,project_id,${ins.join(',')},updated_at) VALUES (?,?,${ins.map(() => '?').join(',')},?)`,
        [id, pid].concat(ins.map(c => (row[c] === '' && ['probability', 'status'].indexOf(c) < 0 ? null : row[c]))).concat([now()]));
      return id;
    }
  };
}

const Milestone = recordModel(REC.milestones);
const Risk = recordModel(REC.risks);
const Dependency = recordModel(REC.iad);
const Billing = recordModel(REC.billing);
const Defect = recordModel(REC.defects);
const PciAudit = recordModel(REC.pci);
const Activity = recordModel(REC.activities);

/* RAID log: a row goes to the risks or the IAD items by its type; if its type changed, the copy
   in the other store is removed so an item is never counted twice. */
const Raid = {
  upsert: async (pid, r) => {
    const sp = raidSplit(r);
    const id = await (sp.kind === 'risks' ? Risk : Dependency).upsert(pid, sp.data);
    await db.run(`DELETE FROM ${sp.kind === 'risks' ? 'dependencies' : 'risks'} WHERE project_id = ? AND ref = ?`, [pid, r.ref]);
    return id;
  },
  get: async (id) => (await Risk.get(id)) || (await Dependency.get(id)),
  remove: async (id) => { await Risk.remove(id); await Dependency.remove(id); },
  forProject: async (pid) => raidRows(await Risk.forProject(pid), await Dependency.forProject(pid))
};

/* kind (as used in the API and the upload) -> model */
const RECORD_MODELS = { milestones: Milestone, risks: Risk, iad: Dependency, raid: Raid, billing: Billing, defects: Defect, pci: PciAudit, activities: Activity };

module.exports = { Milestone, Risk, Dependency, Billing, Defect, PciAudit, Activity, Raid, RECORD_MODELS };
