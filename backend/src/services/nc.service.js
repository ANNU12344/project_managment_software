/* Audit: non-conformances raised by the auditor, answered by the project manager,
 * and the NC categories (CMMI practice areas) kept in the nc_categories table.
 */
const M = require('../models');
const access = require('./access.service');
const state = require('./project-state.service');
const { NC_STATUS, NC_SEVERITY } = require('../domain/quality');
const { today } = require('../utils/dates');
const { notFound, forbidden, validation, badRequest, AppError } = require('../utils/errors');

/* labels of the active categories, for the "Raise an NC" dropdown and the FAQ */
const categoryLabels = async () => (await M.NcCategory.list(false)).map(c => c.label);

async function ncList(user, where) {
  const visible = await access.visibleTo(user);
  const map = {}; visible.forEach(p => map[p.id] = p);
  const users = await M.User.all(); const nm = id => (users.find(u => u.id === id) || {}).name || null;
  const rows = (await M.Nc.all()).filter(n => map[n.project_id] && (!where || where(n)));
  const counts = await M.NcComment.counts();
  return rows.map(n => Object.assign({}, n, {
    project_code: map[n.project_id].code, project_name: map[n.project_id].name,
    raised_by_name: nm(n.raised_by), assigned_to_name: nm(n.assigned_to || map[n.project_id].pm_user_id),
    comments: ((counts.find(c => c.nc_id === n.id) || {}).n) || 0,
    overdue: n.status !== 'Closed' && n.due_date && n.due_date < today()
  }));
}

async function findVisible(user, id) {
  const n = (await ncList(user, x => x.id === id))[0];
  if (!n) throw notFound();
  return n;
}

async function list(user) {
  const cats = await M.NcCategory.list(false);
  return {
    ncs: await ncList(user), statuses: NC_STATUS, severities: NC_SEVERITY,
    categories: cats.map(c => c.label),                                   // labels (kept for older screens)
    category_options: cats.map(c => ({ id: c.id, label: c.label })),      // for the dropdown: send the id back
    can_raise: access.isAuditor(user)
  };
}

async function get(user, id) {
  const n = await findVisible(user, id);
  const users = await M.User.all();
  const comments = (await M.NcComment.forNc(n.id)).map(c => {
    const u = users.find(x => x.id === c.user_id) || {};
    return Object.assign(c, { user_name: u.name, user_role: u.role });
  });
  return { nc: n, comments };
}

async function raise(user, b) {
  if (!access.isAuditor(user)) throw forbidden();
  b = b || {};
  const s = await access.scopedProject(user, b.project_id);
  if (!String(b.title || '').trim()) throw validation('Give the non-conformance a title');
  if (NC_SEVERITY.indexOf(b.severity) < 0) throw validation(`Severity: ${NC_SEVERITY.join(', ')}`);
  /* category: by id (the dropdown sends category_id) or, for older callers, by its label */
  let cat = null;
  if (b.category_id) {
    cat = await M.NcCategory.byId(b.category_id);
    if (!cat || !cat.active) throw validation('Choose a category from the list');
  } else if (b.category) {
    cat = await M.NcCategory.activeByLabel(b.category);
    if (!cat) throw validation('Choose a category from the list');
  }
  const n = (await M.Nc.countForProject(s.p.id)) + 1;
  const id = await M.Nc.create({
    project_id: s.p.id, ref: `NC-${s.p.code}-${String(n).padStart(2, '0')}`, title: String(b.title).trim().slice(0, 190),
    description: b.description, category: cat ? cat.label : null, category_id: cat ? cat.id : null, severity: b.severity, raised_by: user.id, raised_date: today(),
    due_date: b.due_date, status: 'Open', assigned_to: b.assigned_to || s.p.pm_user_id
  });
  await state.refresh(s.p.id, user.id);
  await M.AuditLog.log(user.id, 'nc.raise', 'nc', id, { project: s.p.code, severity: b.severity });
  return id;
}

/* PM: Closure requested + action taken. Auditor: anything, incl. Closed and Reopened. */
async function update(user, id, b) {
  const n = await findVisible(user, id);
  const p = await M.Project.byId(n.project_id);
  b = b || {};
  const auditor = access.isAuditor(user), owner = user.id === (n.assigned_to || p.pm_user_id) || access.canEditStatus(user, p);
  if (!auditor && !owner) throw forbidden();
  const next = b.status || n.status;
  if (NC_STATUS.indexOf(next) < 0) throw validation(`Status: ${NC_STATUS.join(', ')}`);
  if (!auditor && ['Closed', 'Reopened', 'Open'].indexOf(next) >= 0 && next !== n.status)
    throw new AppError(403, 'validation', 'Only the auditor can close or reopen a non-conformance — request closure instead');
  if (!auditor && next === 'Closure requested' && !String(b.action_taken || n.action_taken || '').trim())
    throw validation('Describe the action taken before requesting closure');
  await M.Nc.update(n.id, {
    status: next, action_taken: b.action_taken !== undefined ? b.action_taken : n.action_taken,
    due_date: auditor && b.due_date !== undefined ? b.due_date : n.due_date, severity: auditor && b.severity ? b.severity : n.severity,
    closed_date: next === 'Closed' ? (n.closed_date || today()) : null
  });
  if (next !== n.status || (b.comment && String(b.comment).trim())) {
    const kind = next !== n.status ? 'status' : 'comment';
    const body = (next !== n.status ? `Status: ${n.status} → ${next}. ` : '') + String(b.comment || '').trim();
    await M.NcComment.add(n.id, user.id, kind, body);
  }
  await state.refresh(p.id, user.id);
  await M.AuditLog.log(user.id, 'nc.update', 'nc', n.id, { from: n.status, to: next });
}

async function comment(user, id, text) {
  const n = await findVisible(user, id);
  const body = String(text || '').trim();
  if (!body) throw validation('Write a comment');
  await M.NcComment.add(n.id, user.id, 'comment', body.slice(0, 4000));
}

/* ---------------- NC categories (table nc_categories) ----------------
   Anyone signed in reads them; the auditor or administrator adds, edits and removes.
   Remove = deactivate: NCs already raised under a category keep it. */

const MAX_ACTIVE = 100;

/* clean and check { code, name }; code is optional, upper-case letters / digits / & */
function cleanCategory(b) {
  const code = String(b.code || '').trim().toUpperCase().replace(/\s+/g, '');
  const name = String(b.name || '').trim().replace(/\s+/g, ' ');
  if (!name) throw validation('Give the category a name', { fields: { name: 'Required' } });
  if (name.length > 85) throw validation('The category name can be at most 85 characters', { fields: { name: 'At most 85 characters' } });
  if (code && !/^[A-Z0-9&]{1,12}$/.test(code)) throw validation('The code can only have letters, digits or &, at most 12', { fields: { code: 'Letters, digits or &, at most 12' } });
  return { code: code || null, name };
}

/* { categories: [{ id, code, name, label, active, sort_order, nc_count }], can_edit } */
async function listCategories(user, includeInactive) {
  return { categories: await M.NcCategory.list(!!includeInactive), can_edit: access.isAuditor(user) };
}

async function addCategory(user, b) {
  if (!access.isAuditor(user)) throw forbidden();
  const c = cleanCategory(b || {});
  const same = await M.NcCategory.findSame(c.code, c.name);
  if (same && same.active) throw badRequest('duplicate_category', `“${same.label}” is already in the list`);
  if ((await M.NcCategory.countActive()) >= MAX_ACTIVE) throw validation(`At most ${MAX_ACTIVE} active categories`);
  let id;
  if (same) { await M.NcCategory.update(same.id, { code: same.code, name: same.name, active: true }); id = same.id; }   // was removed earlier: bring it back
  else id = await M.NcCategory.create({ code: c.code, name: c.name, userId: user.id });
  const cat = await M.NcCategory.byId(id);
  await M.AuditLog.log(user.id, same ? 'nc_category.restore' : 'nc_category.add', 'nc_category', id, { label: cat.label });
  return cat;
}

/* edit code / name, or set active (true restores a removed category) */
async function updateCategory(user, id, b) {
  if (!access.isAuditor(user)) throw forbidden();
  const cur = await M.NcCategory.byId(id);
  if (!cur) throw notFound();
  b = b || {};
  const c = cleanCategory({ code: b.code !== undefined ? b.code : cur.code, name: b.name !== undefined ? b.name : cur.name });
  const active = b.active !== undefined ? !!b.active : !!cur.active;
  if (await M.NcCategory.findSame(c.code, c.name, cur.id)) throw badRequest('duplicate_category', 'Another category already has that code and name');
  if (active && !cur.active && (await M.NcCategory.countActive()) >= MAX_ACTIVE) throw validation(`At most ${MAX_ACTIVE} active categories`);
  if (!active && cur.active && (await M.NcCategory.countActive()) <= 1) throw validation('Keep at least one category');
  await M.NcCategory.update(cur.id, { code: c.code, name: c.name, active });
  const next = await M.NcCategory.byId(cur.id);
  if (next.label !== cur.label) await M.NcCategory.relabelNcs(cur.id, next.label);
  await M.AuditLog.log(user.id, 'nc_category.update', 'nc_category', cur.id, { from: cur.label, to: next.label, active });
  return next;
}

async function removeCategory(user, id) {
  return updateCategory(user, id, { active: false });
}

module.exports = {
  categoryLabels, list, get, raise, update, comment,
  listCategories, addCategory, updateCategory, removeCategory
};
