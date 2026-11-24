/* nc_categories — the categories (CMMI practice areas) an NC can be raised under.
 * A category is never deleted: "remove" sets active = 0, so NCs raised under it keep it.
 * The label shown everywhere is "CODE - Name" (or just "Name" when there is no code).
 */
const db = require('../db/connection');
const { now } = require('../utils/dates');

const labelOf = c => (c.code ? `${c.code} - ${c.name}` : c.name);
const withLabel = c => (c ? Object.assign(c, { label: labelOf(c) }) : c);

const NcCategory = {
  labelOf,

  /* with nc_count = NCs raised under each; inactive ones only when asked */
  list: async (includeInactive) => (await db.all(`
      SELECT c.*, (SELECT COUNT(*) FROM ncs n WHERE n.category_id = c.id) AS nc_count
      FROM nc_categories c
      WHERE ? = 1 OR c.active = 1
      ORDER BY c.active DESC, c.sort_order, c.name`, [includeInactive ? 1 : 0])).map(withLabel),

  byId: async (id) => withLabel(await db.get('SELECT * FROM nc_categories WHERE id = ?', [id])),

  /* same code + name, ignoring case (matches the unique index) */
  findSame: async (code, name, exceptId) => withLabel(await db.get(
    'SELECT * FROM nc_categories WHERE lower(coalesce(code, \'\')) = lower(?) AND lower(name) = lower(?) AND id <> ?',
    [code || '', name, exceptId || ''])),

  /* the active category whose label is exactly this text (ignoring case) */
  activeByLabel: async (label) => {
    const all = await db.all('SELECT * FROM nc_categories WHERE active = 1');
    const want = String(label || '').trim().toLowerCase();
    return withLabel(all.find(c => labelOf(c).toLowerCase() === want) || null);
  },

  countActive: async () => (await db.get('SELECT COUNT(*) AS n FROM nc_categories WHERE active = 1')).n,

  create: async ({ code, name, userId }) => {
    const id = db.uid('ncc');
    const next = (await db.get('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM nc_categories')).n;
    await db.run('INSERT INTO nc_categories (id, code, name, active, sort_order, created_at, created_by, updated_at) VALUES (?,?,?,?,?,?,?,?)',
      [id, code || null, name, 1, next, now(), userId || null, now()]);
    return id;
  },

  update: (id, { code, name, active }) => db.run(
    'UPDATE nc_categories SET code = ?, name = ?, active = ?, updated_at = ? WHERE id = ?',
    [code || null, name, active ? 1 : 0, now(), id]),

  /* keep the text label on NCs in step after a rename */
  relabelNcs: (id, label) => db.run('UPDATE ncs SET category = ? WHERE category_id = ?', [label, id])
};

module.exports = NcCategory;
