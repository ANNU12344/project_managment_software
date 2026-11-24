/* Sessions, kept in the SQLite `sessions` table so a restart does not sign everyone out. */
const session = require('express-session');
const config = require('../config');
const logger = require('../utils/logger');
const { Session } = require('../models');

const PURGE_EVERY_MS = 60 * 60 * 1000;

class SqliteStore extends session.Store {
  constructor() {
    super();
    this.timer = setInterval(() => {
      Session.purgeExpired(Date.now()).catch(err => logger.warn('session purge failed', { err }));
    }, PURGE_EVERY_MS);
    this.timer.unref();
  }

  expiry(sess) {
    const c = sess && sess.cookie;
    if (c && c.expires) return new Date(c.expires).getTime();
    return Date.now() + config.session.maxAgeMs;
  }

  get(sid, cb) {
    Session.get(sid).then(row => {
      if (!row || row.expires_at < Date.now()) return cb(null, null);
      cb(null, JSON.parse(row.sess));
    }).catch(cb);
  }

  set(sid, sess, cb) {
    Session.set(sid, JSON.stringify(sess), this.expiry(sess)).then(() => cb && cb(null)).catch(err => cb && cb(err));
  }

  touch(sid, sess, cb) {
    Session.touch(sid, this.expiry(sess)).then(() => cb && cb(null)).catch(err => cb && cb(err));
  }

  destroy(sid, cb) {
    Session.destroy(sid).then(() => cb && cb(null)).catch(err => cb && cb(err));
  }

  close() { clearInterval(this.timer); }
}

const store = new SqliteStore();

const middleware = session({
  name: config.session.name,
  secret: config.session.secret,
  store,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.session.cookieSecure,
    maxAge: config.session.maxAgeMs
  }
});

module.exports = { sessionMiddleware: middleware, sessionStore: store };
