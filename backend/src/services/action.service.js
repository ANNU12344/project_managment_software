/* Action items: raised by DH / Director / CEO / admin / auditor, answered by the owner. */
const M = require('../models');
const access = require('./access.service');
const { SENIOR_ROLES } = require('../domain/roles');
const { notFound, forbidden, validation } = require('../utils/errors');

async function list(user) {
  const [all, visible, users] = await Promise.all([M.ActionItem.all(), access.visibleTo(user), M.User.all()]);
  const ids = visible.map(p => p.id);
  const mine = all.filter(a => !a.project_id || ids.indexOf(a.project_id) >= 0 || a.owner_user_id === user.id);
  const pmap = {}; visible.forEach(p => pmap[p.id] = p.code);
  const nameOf = id => (users.find(u => u.id === id) || {}).name || null;
  return mine.map(a => Object.assign({}, a, {
    project_code: a.project_id ? (pmap[a.project_id] || '—') : null,
    owner_name: nameOf(a.owner_user_id),
    raised_by_name: nameOf(a.raised_by)
  }));
}

async function create(user, b) {
  if (!String(b.title || '').trim()) throw validation(undefined, { fields: { title: 'Required' } });
  if (!b.owner_user_id) throw validation(undefined, { fields: { owner_user_id: 'An action item needs a named owner' } });
  if (!b.due_date) throw validation(undefined, { fields: { due_date: 'An action item needs a date' } });
  const id = await M.ActionItem.create({
    project_id: b.project_id || null, title: b.title, detail: b.detail,
    raised_by: user.id, raised_by_role: user.role,
    owner_user_id: b.owner_user_id, due_date: b.due_date, priority: b.priority
  });
  await M.AuditLog.log(user.id, 'action.create', 'action', id, { title: b.title });
  return id;
}

async function update(user, id, b) {
  const a = await M.ActionItem.get(id);
  if (!a) throw notFound();
  const isOwner = a.owner_user_id === user.id, isRaiser = a.raised_by === user.id;
  const senior = SENIOR_ROLES.indexOf(user.role) >= 0;
  if (!isOwner && !isRaiser && !senior) throw forbidden();
  await M.ActionItem.update(a.id, {
    status: b.status || a.status, response: b.response,
    owner_user_id: b.owner_user_id || a.owner_user_id,
    due_date: b.due_date || a.due_date, priority: b.priority || a.priority
  });
  await M.AuditLog.log(user.id, 'action.update', 'action', a.id, { status: b.status });
}

module.exports = { list, create, update };
