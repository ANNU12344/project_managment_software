const authService = require('../services/auth.service');
const config = require('../config');
const { ROLES } = require('../domain/roles');
const { unauthorized } = require('../utils/errors');

/* POST /login — regenerates the session id on sign-in (prevents session fixation) */
async function login(req, res) {
  const body = req.body || {};
  const user = await authService.login(body.email, body.password);
  await new Promise((resolve, reject) => req.session.regenerate(err => (err ? reject(err) : resolve())));
  req.session.user = user;
  res.json({ user });
}

/* POST /logout */
function logout(req, res, next) {
  req.session.destroy(err => (err ? next(err) : res.clearCookie(config.session.name).json({ ok: true })));
}

/* GET /me */
function me(req, res) {
  if (!req.session.user) throw unauthorized();
  res.json({ user: req.session.user, real: req.session.realUser || null, roles: ROLES });
}

/* GET /switch/users */
async function switchUsers(req, res) {
  res.json({ users: await authService.switchableUsers(req.session) });
}

/* POST /switch */
async function switchTo(req, res) {
  res.json(await authService.switchTo(req.session, (req.body || {}).user_id));
}

/* POST /switch/stop */
async function stopSwitch(req, res) {
  res.json(await authService.stopSwitch(req.session));
}

module.exports = { login, logout, me, switchUsers, switchTo, stopSwitch };
