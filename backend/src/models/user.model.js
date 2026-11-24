/* users */
const db = require('../db/connection');
const { now } = require('../utils/dates');

const User = {
  byEmail: (email) => db.get('SELECT * FROM users WHERE email = ? AND active = 1', [String(email).toLowerCase()]),
  byId: (id) => db.get('SELECT * FROM users WHERE id = ?', [id]),
  /* never returns password_hash */
  all: () => db.all('SELECT id,email,name,role,bu,active FROM users ORDER BY role, name'),
  create: async (u) => {
    const id = db.uid('usr');
    await db.run(
      'INSERT INTO users (id,email,name,password_hash,role,bu,active,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [id, u.email.toLowerCase(), u.name, u.password_hash, u.role, u.bu || null, u.active === 0 ? 0 : 1, now()]);
    return id;
  },
  update: (id, u) => db.run('UPDATE users SET name=?, role=?, bu=?, active=? WHERE id=?',
    [u.name, u.role, u.bu || null, u.active ? 1 : 0, id]),
  setPassword: (id, hash) => db.run('UPDATE users SET password_hash=? WHERE id=?', [hash, id]),
  setEmail: (id, email) => db.run('UPDATE users SET email=? WHERE id=?', [String(email).toLowerCase(), id])
};

module.exports = User;
