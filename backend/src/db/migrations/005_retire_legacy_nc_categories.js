/* 005 — retire the three NC categories left over from the old demo data.
 *
 * Before the CMMI practice-area list existed, demo NCs were tagged "Process", "Documentation" or
 * "Configuration". Migration 004 kept those as categories so the NCs stayed linked. Here each such NC
 * is moved to the CMMI category that fits what was found, and the three old categories are deleted.
 *
 * Safe on any database:
 *   - an NC is moved only if it is still under one of the old categories (matched by its ref)
 *   - an old category is deleted only when no NC is linked to it any more
 *   - every move and delete is written to audit_log
 */
const LEGACY = ['Process', 'Documentation', 'Configuration'];

/* NC ref -> CMMI category code, chosen from what each NC records */
const MOVE = {
  'NC-AIS-GJ-01-01': 'RDM',   // Requirement traceability matrix not updated for phase 2
  'NC-AIS-GJ-01-02': 'PR',    // Code review records missing for 3 modules
  'NC-CIMS-BR-01-01': 'PR',   // Design review checklist not signed by reviewer
  'NC-EDIS-UP-01-01': 'CAR',  // Sev-1 incident RCA submitted late
  'NC-MSME-MN-01-01': 'MC',   // Weekly status not shared with client PMU for two weeks
  'NC-AIS-GJ-01-03': 'VV',    // Test plan not baselined before UAT
  'NC-LMS-OD-01-01': 'CM',    // Content migration log incomplete
  'NC-EDIS-UP-01-02': 'CM'    // Configuration register out of date
};

module.exports = {
  name: 'retire_legacy_nc_categories',
  async up(db, log) {
    const now = new Date().toISOString();
    const audit = (action, entity, id, detail) => db.run(
      'INSERT INTO audit_log (id, at, user_id, action, entity, entity_id, detail) VALUES (?,?,?,?,?,?,?)',
      [db.uid('aud'), now, null, action, entity, id, JSON.stringify(detail)]);

    const legacy = await db.all(
      `SELECT id, name FROM nc_categories WHERE code IS NULL AND name IN (${LEGACY.map(() => '?').join(',')})`, LEGACY);
    if (!legacy.length) return;                                      // nothing left over on this database
    const legacyIds = legacy.map(c => c.id);

    let moved = 0;
    for (const [ref, code] of Object.entries(MOVE)) {
      const nc = await db.get(
        `SELECT id, category FROM ncs WHERE ref = ? AND category_id IN (${legacyIds.map(() => '?').join(',')})`, [ref].concat(legacyIds));
      if (!nc) continue;
      const target = await db.get('SELECT id, code, name FROM nc_categories WHERE code = ? AND active = 1', [code]);
      if (!target) { log.warn('target category missing, NC left as it is', { ref, code }); continue; }
      const label = `${target.code} - ${target.name}`;
      await db.run('UPDATE ncs SET category_id = ?, category = ?, updated_at = ? WHERE id = ?', [target.id, label, now, nc.id]);
      await audit('nc.category_moved', 'nc', nc.id, { ref, from: nc.category, to: label, by: 'migration 005' });
      moved++;
    }

    let deleted = 0;
    const kept = [];
    for (const c of legacy) {
      const used = (await db.get('SELECT COUNT(*) AS n FROM ncs WHERE category_id = ?', [c.id])).n;
      if (used) { kept.push(`${c.name} (${used} NC)`); continue; }   // still in use: keep it
      await db.run('DELETE FROM nc_categories WHERE id = ?', [c.id]);
      await audit('nc_category.delete', 'nc_category', c.id, { label: c.name, by: 'migration 005' });
      deleted++;
    }
    log.info('legacy NC categories retired', { ncs_moved: moved, categories_deleted: deleted, kept_because_in_use: kept });
  }
};
