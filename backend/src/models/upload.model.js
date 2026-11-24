/* uploads — a staged workbook or timesheet file, validated, waiting to be committed */
const db = require('../db/connection');
const { now } = require('../utils/dates');

const Upload = {
  create: async ({ userId, filename, rowsOk, rowsError, report }) => {
    const id = db.uid('upl');
    await db.run('INSERT INTO uploads (id,uploaded_by,filename,uploaded_at,rows_ok,rows_error,committed,report) VALUES (?,?,?,?,?,?,?,?)',
      [id, userId, filename, now(), rowsOk, rowsError, 0, JSON.stringify(report)]);
    return id;
  },
  getOwn: (id, userId) => db.get('SELECT * FROM uploads WHERE id=? AND uploaded_by=?', [id, userId]),
  markCommitted: (id) => db.run('UPDATE uploads SET committed=1 WHERE id=?', [id]),
  listOwn: (userId) => db.all('SELECT id,filename,uploaded_at,rows_ok,rows_error,committed FROM uploads WHERE uploaded_by=? ORDER BY uploaded_at DESC', [userId])
};

module.exports = Upload;
