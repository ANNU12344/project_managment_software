/* 004 — NC categories get their own table instead of a list in code / a JSON blob in `config`.
 *
 *   nc_categories   one row per category (CMMI practice area): code, name, active, sort order
 *   ncs.category_id the category an NC was raised under (ncs.category keeps the label as text,
 *                   so exports and older screens still read it)
 *
 * Seeding, once:
 *   - the list saved in config 'nc_practice_areas' if someone had edited it, else the organisation's
 *     23 CMMI practice areas (below — this is the only place they are written down)
 *   - every category already used on an NC but not in that list is added as inactive, so old NCs
 *     keep their category without it being offered for new NCs
 *   - ncs.category_id is filled by matching the label; the config row is removed
 */

/* The organisation's 23 CMMI practice areas — the starting list. */
const INITIAL = [
  'PLAN - Planning', 'MC - Monitor and Control', 'EST - Estimating', 'RSK - Risk and Opportunity Management',
  'OT - Organizational Training', 'CM - Configuration Management', 'CAR - Causal Analysis and Resolution',
  'DAR - Decision Analysis and Resolution', 'RDM - Requirements Development and Management', 'PR - Peer Reviews',
  'VV - Verification and Validation', 'PQA - Process Quality Assurance', 'GOV - Governance',
  'II - Implementation Infrastructure', 'PAD - Process Asset Development', 'PCM - Process Management',
  'MPM - Managing Performance and Measurement', 'TS - Technical Solution', 'PI - Product Integration',
  'CONT - Continuity', 'IRP - Incident Resolution and Prevention', 'SDM - Service Delivery Management',
  'STSM - Strategic Service Management'
];

/* "PR - Peer Reviews" -> { code: 'PR', name: 'Peer Reviews' }; no " - " -> no code */
function split(label) {
  const s = String(label).trim(), k = s.indexOf(' - ');
  return k > 0 ? { code: s.slice(0, k).trim(), name: s.slice(k + 3).trim() } : { code: null, name: s };
}

module.exports = {
  name: 'nc_categories',
  async up(db, log) {
    await db.exec(`CREATE TABLE IF NOT EXISTS nc_categories (
      id TEXT PRIMARY KEY,
      code TEXT NULL,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      created_by TEXT NULL REFERENCES users(id),
      updated_at TEXT NOT NULL
    );`);
    /* the same code + name (ignoring case) cannot be added twice */
    await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_nc_categories_label ON nc_categories (lower(coalesce(code, \'\')), lower(name));');

    const ncCols = (await db.all('PRAGMA table_info(ncs)')).map(c => c.name);
    if (ncCols.indexOf('category_id') < 0) await db.exec('ALTER TABLE ncs ADD COLUMN category_id TEXT NULL REFERENCES nc_categories(id);');
    await db.exec('CREATE INDEX IF NOT EXISTS ix_ncs_category ON ncs(category_id);');

    if ((await db.get('SELECT COUNT(*) AS n FROM nc_categories')).n) return;     // already seeded

    const saved = await db.get("SELECT v FROM config WHERE k = 'nc_practice_areas'");
    let list = INITIAL;
    if (saved) { try { const v = JSON.parse(saved.v); if (Array.isArray(v) && v.length) list = v; } catch (e) { /* keep INITIAL */ } }

    const now = new Date().toISOString();
    const byLabel = {};
    let order = 0;
    const insert = async (label, active) => {
      const key = String(label).trim().toLowerCase();
      if (!key || byLabel[key]) return;
      const { code, name } = split(label);
      const id = db.uid('ncc');
      await db.run('INSERT INTO nc_categories (id, code, name, active, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
        [id, code, name, active ? 1 : 0, ++order, now, now]);
      byLabel[key] = id;
    };
    for (const label of list) await insert(label, true);

    /* categories already on NCs that are not in the list: kept, but not offered for new NCs */
    const used = await db.all('SELECT DISTINCT category FROM ncs WHERE category IS NOT NULL AND trim(category) <> \'\'');
    let retired = 0;
    for (const u of used) if (!byLabel[u.category.trim().toLowerCase()]) { await insert(u.category, false); retired++; }

    let linked = 0;
    for (const n of await db.all('SELECT id, category FROM ncs WHERE category IS NOT NULL')) {
      const id = byLabel[n.category.trim().toLowerCase()];
      if (id) { await db.run('UPDATE ncs SET category_id = ? WHERE id = ?', [id, n.id]); linked++; }
    }
    await db.run("DELETE FROM config WHERE k = 'nc_practice_areas'");
    log.info('nc categories moved to their own table', { categories: order, inactive_from_old_ncs: retired, ncs_linked: linked, from: saved ? 'config' : 'initial list' });
  }
};
