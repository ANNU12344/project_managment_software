/* Sign-in, password hashing, and the administrator's "view as another user". */
const bcrypt = require('bcryptjs');
const M = require('../models');
const { forbidden, notFound, AppError } = require('../utils/errors');

const hash = (pw) => bcrypt.hash(String(pw), 10);

/* the user object kept in the session */
const sessionUser = u => ({ id: u.id, email: u.email, name: u.name, role: u.role, bu: u.bu });

async function login(email, password) {
  const u = email ? await M.User.byEmail(email) : null;
  const ok = u ? await bcrypt.compare(String(password), u.password_hash) : false;
  if (!ok) {
    await M.AuditLog.log(null, 'login.fail', 'user', null, { email });
    throw new AppError(401, 'bad_credentials');
  }
  await M.AuditLog.log(u.id, 'login.ok', 'user', u.id, null);
  return sessionUser(u);
}

/* The administrator signs in once and switches into any account to see exactly what that role
   sees. The real identity is kept in the session, so switching back never needs a password, and
   every switch is written to the audit log. */
function realAdmin(session) {
  const real = session.realUser || session.user;
  return real && real.role === 'admin' ? real : null;
}

async function switchableUsers(session) {
  if (!realAdmin(session)) throw forbidden();
  const users = (await M.User.all()).filter(u => u.active);
  return users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, bu: u.bu }));
}

/* mutates the session; returns { user, real } */
async function switchTo(session, userId) {
  const real = realAdmin(session);
  if (!real) throw forbidden();
  const target = await M.User.byId(userId);
  if (!target || !target.active) throw notFound();
  if (target.id === real.id) { delete session.realUser; session.user = real; }
  else { session.realUser = real; session.user = sessionUser(target); }
  await M.AuditLog.log(real.id, 'switch.user', 'user', target.id, { role: target.role, email: target.email });
  return { user: session.user, real: session.realUser || null };
}

async function stopSwitch(session) {
  if (session.realUser) {
    await M.AuditLog.log(session.realUser.id, 'switch.stop', 'user', session.user.id, null);
    session.user = session.realUser; delete session.realUser;
  }
  return { user: session.user, real: null };
}

module.exports = { hash, login, switchableUsers, switchTo, stopSwitch };
