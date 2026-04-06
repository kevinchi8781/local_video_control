const db = require('./src/db/database');
const fs = require('fs');

(async () => {
  const d = await db.getDatabase();
  const stmt = d.prepare('SELECT id, path FROM videos WHERE id = ?');
  stmt.bind([1275]);
  if (stmt.step()) {
    const row = stmt.get();
    console.log('ID:', row[0]);
    console.log('Path:', row[1]);
    console.log('Exists:', fs.existsSync(row[1]));
  }
  stmt.free();
})();
