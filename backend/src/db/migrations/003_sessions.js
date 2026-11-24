/* 003 — login sessions are kept in the database, so a restart or a redeploy does not sign everyone out. */
module.exports = {
  name: 'sessions',
  async up(db) {
    await db.exec(`CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );`);
    await db.exec('CREATE INDEX IF NOT EXISTS ix_sessions_exp ON sessions(expires_at);');
  }
};
