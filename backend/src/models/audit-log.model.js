/* audit_log — every login, save, upload, approval and setting change */
const db = require('../db/connection');
const { now } = require('../utils/dates');

const AuditLog = {
  log: (userId, action, entity, entityId, detail) =>
    db.run('INSERT INTO audit_log (id,at,user_id,action,entity,entity_id,detail) VALUES (?,?,?,?,?,?,?)',
      [db.uid('aud'), now(), userId || null, action, entity || null, entityId || null,
       detail ? JSON.stringify(detail).slice(0, 4000) : null]),
  recent: () => db.all('SELECT * FROM audit_log ORDER BY at DESC')
};

module.exports = AuditLog;
