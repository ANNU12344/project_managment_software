/* Administration: users, engagements, process baseline, health-index weights, audit log. */
const M = require('../models');
const auth = require('./auth.service');
const state = require('./project-state.service');
const MX = require('../domain/metrics');
const H = require('../domain/health');
const { notFound, badRequest, validation } = require('../utils/errors');

/* ---------- users ---------- */
const listUsers = () => M.User.all();

async function createUser(actor, b) {
  if (!b.email || !b.name || !b.role) throw validation();
  if (await M.User.byEmail(b.email)) throw badRequest('duplicate_email');
  const id = await M.User.create({ email: b.email, name: b.name, role: b.role, bu: b.bu, password_hash: await auth.hash(b.password || 'Welcome@123') });
  await M.AuditLog.log(actor.id, 'user.create', 'user', id, { email: b.email, role: b.role });
  return id;
}

async function updateUser(actor, id, b) {
  await M.User.update(id, b);
  if (b.password) await M.User.setPassword(id, await auth.hash(b.password));
}

/* ---------- engagements ---------- */
async function listProjects() {
  return { projects: await M.Project.all(), users: await M.User.all() };
}

async function createProject(actor, b) {
  if (await M.Project.byCode(b.code)) throw badRequest('duplicate_code');
  const id = await M.Project.create(b);
  await M.AuditLog.log(actor.id, 'project.create', 'project', id, { code: b.code });
  return id;
}

const EDITABLE = ['name', 'client', 'bu', 'project_type', 'commercial_basis', 'status', 'pm_user_id', 'dh_user_id',
  'contract_value', 'margin_at_bid', 'start_date', 'end_date'];

/* Edit an engagement — the only way to correct who it is assigned to. Fields not sent
   keep their current value, and a reassignment is written to the audit log by name. */
async function updateProject(actor, id, b) {
  const cur = await M.Project.byId(id);
  if (!cur) throw notFound();
  b = b || {};
  const next = Object.assign({}, cur);
  EDITABLE.forEach(k => { if (b[k] !== undefined) next[k] = b[k]; });
  if (!String(next.name || '').trim() || !String(next.client || '').trim() || !String(next.bu || '').trim())
    throw validation('Name, client and business unit are required');
  const users = await M.User.all();
  const nm = uid => (users.find(u => u.id === uid) || {}).name || null;
  for (const [k, role] of [['pm_user_id', 'pm'], ['dh_user_id', 'dh']]) {
    if (next[k] && !users.some(u => u.id === next[k] && u.role === role && u.active))
      throw validation(`That ${role === 'pm' ? 'project manager' : 'Delivery Head'} is not an active user in that role`);
  }
  await M.Project.update(cur.id, next);
  await state.recompute(cur.id);
  const changes = {};
  if (cur.pm_user_id !== next.pm_user_id) changes.pm = { from: nm(cur.pm_user_id), to: nm(next.pm_user_id) };
  if (cur.dh_user_id !== next.dh_user_id) changes.dh = { from: nm(cur.dh_user_id), to: nm(next.dh_user_id) };
  if (cur.status !== next.status) changes.status = { from: cur.status, to: next.status };
  await M.AuditLog.log(actor.id, 'project.update', 'project', cur.id, Object.assign({ code: cur.code }, changes));
}

/* ---------- process performance baseline ---------- */
const baselineOf = async () => Object.assign({}, MX.BASELINE, await M.AppConfig.get('metric_baseline', MX.BASELINE));

/* Everyone can read it (screens show limits); only the administrator changes it. */
async function getBaseline() {
  const b = await baselineOf();
  return {
    metrics: MX.METRICS.map(m => Object.assign({ key: m.key, label: m.label, unit: m.unit, formula: m.formula }, b[m.key])),
    defaults: MX.BASELINE, person_day_hours: MX.PD_HOURS
  };
}

async function updateBaseline(actor, baseline) {
  const c = MX.cleanBaseline(baseline);
  if (c.errors.length) throw validation(c.errors.join('; '));
  const before = await baselineOf();
  const next = Object.assign({}, before, c.baseline);
  await M.AppConfig.set('metric_baseline', next);
  const changed = Object.keys(c.baseline).filter(k => JSON.stringify(before[k]) !== JSON.stringify(next[k]));
  await M.AuditLog.log(actor.id, 'baseline.update', 'config', 'metric_baseline', { changed });
  return changed;
}

/* ---------- health-index weights ---------- */
async function getWeights() {
  return { weights: H.weightsFrom(await M.AppConfig.get('health_weights', H.DEFAULT_WEIGHTS)), defaults: H.DEFAULT_WEIGHTS, labels: H.LABELS };
}

async function updateWeights(actor, w) {
  w = w || {};
  const keys = Object.keys(H.DEFAULT_WEIGHTS);
  if (Object.keys(w).some(k => keys.indexOf(k) < 0) || keys.some(k => isNaN(Number(w[k])) || Number(w[k]) < 0))
    throw validation(`Give a weight of 0 or more for each of: ${keys.map(k => H.LABELS[k]).join(', ')}`);
  keys.forEach(k => { w[k] = Number(w[k]); });
  const total = Object.values(w).reduce((a, b) => a + Number(b || 0), 0);
  if (Math.round(total) !== 100) throw validation(`Weights must total 100, got ${total}`);
  await M.AppConfig.set('health_weights', w);
  for (const p of await M.Project.all()) await state.recompute(p.id);
  await M.AuditLog.log(actor.id, 'weights.update', 'config', 'health_weights', w);
}

/* ---------- audit log ---------- */
async function auditLog() {
  const [log, users] = await Promise.all([M.AuditLog.recent(), M.User.all()]);
  const nameOf = id => (users.find(u => u.id === id) || {}).name || null;
  return log.slice(0, 200).map(a => Object.assign({}, a, { user_name: nameOf(a.user_id) }));
}

module.exports = {
  listUsers, createUser, updateUser, listProjects, createProject, updateProject,
  baselineOf, getBaseline, updateBaseline, getWeights, updateWeights, auditLog
};
