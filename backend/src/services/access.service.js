/* Who may see and change what. Every scope and permission rule lives here. */
const M = require('../models');
const { notFound, forbidden } = require('../utils/errors');

/* Row-level scope. No Client Partner role exists at Uneecops: the Delivery Head owns the client relationship too. */
async function visibleTo(user) {
  const all = await M.Project.all();
  if (user.role === 'ceo' || user.role === 'admin' || user.role === 'auditor') return all;
  if (user.role === 'director') return all.filter(p => p.bu === user.bu);
  if (user.role === 'dh') return all.filter(p => p.dh_user_id === user.id);
  if (user.role === 'pm') return all.filter(p => p.pm_user_id === user.id);
  return [];
}

/* Weekly status, records and project details: the project's PM, or the administrator. */
const canEditStatus = (user, project) =>
  user.role === 'admin' || (user.role === 'pm' && project.pm_user_id === user.id);

/* Project start / end dates: the project's Delivery Head or the PMO administrator, never the PM. */
const canEditDates = (user, p) => user.role === 'admin' || (user.role === 'dh' && p.dh_user_id === user.id);

const isAuditor = u => u.role === 'auditor' || u.role === 'admin';

/* The project, if it exists and is in the user's scope; otherwise throws 404 / 403. */
async function scopedProject(user, pid) {
  const p = await M.Project.byId(pid);
  if (!p) throw notFound();
  const visible = await visibleTo(user);
  if (!visible.some(v => v.id === p.id)) throw forbidden();
  return { p, canEdit: canEditStatus(user, p) };
}

/* Field-level policy, applied on the way out so one query serves every role. Project managers
   maintain their project's value, budget and actual cost, so they see those and the net margin
   computed from them. Bid margin and receivables stay hidden. */
function redactProject(user, row) {
  const r = Object.assign({}, row);
  if (user.role === 'pm') {
    delete r.margin_at_bid;
    delete r.margin_at_completion; delete r.unbilled_wip; delete r.ar_over_90;
  }
  return r;
}

module.exports = { visibleTo, canEditStatus, canEditDates, isAuditor, scopedProject, redactProject };
