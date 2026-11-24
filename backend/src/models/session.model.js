/* sessions — express-session rows (sid -> JSON), with an expiry in epoch ms */
const db = require('../db/connection');

const Session = {
  get: (sid) => db.get('SELECT sess, expires_at FROM sessions WHERE sid = ?', [sid]),
  set: (sid, sess, expiresAt) => db.run(
    'INSERT INTO sessions (sid, sess, expires_at) VALUES (?,?,?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires_at = excluded.expires_at',
    [sid, sess, expiresAt]),
  touch: (sid, expiresAt) => db.run('UPDATE sessions SET expires_at = ? WHERE sid = ?', [expiresAt, sid]),
  destroy: (sid) => db.run('DELETE FROM sessions WHERE sid = ?', [sid]),
  purgeExpired: (at) => db.run('DELETE FROM sessions WHERE expires_at < ?', [at])
};

module.exports = Session;
