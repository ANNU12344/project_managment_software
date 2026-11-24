/* files — uploaded documents (stored in the database for now) */
const db = require('../db/connection');
const { now } = require('../utils/dates');

const StoredFile = {
  /* f: a multer file ({ originalname, mimetype, size, buffer }) */
  store: async (f, userId) => {
    const id = db.uid('fil');
    await db.run('INSERT INTO files (id,name,mime,size,data,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?)',
      [id, f.originalname.slice(0, 190), f.mimetype || null, f.size, f.buffer, userId, now()]);
    return id;
  },
  get: (id) => db.get('SELECT * FROM files WHERE id=?', [id])
};

module.exports = StoredFile;
