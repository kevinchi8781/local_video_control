const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/videos.db');

let dbInstance = null;

async function getDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  return dbInstance;
}

function saveDatabase() {
  if (!dbInstance) return;

  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// 定期自动保存（每 30 秒）
setInterval(() => {
  saveDatabase();
}, 30000);

// 进程退出时保存
process.on('SIGINT', () => {
  saveDatabase();
  process.exit();
});

module.exports = {
  getDatabase,
  saveDatabase
};
