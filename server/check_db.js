const { getDatabase } = require('./src/db/database');

(async () => {
  try {
    const db = await getDatabase();

    // 检查表结构
    const stmt = db.prepare('PRAGMA table_info(videos)');
    stmt.bind([]);
    console.log('videos 表结构:');
    while(stmt.step()) { console.log(stmt.get()); }
    stmt.free();

    // 检查记录数
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM videos');
    countStmt.bind([]);
    if(countStmt.step()) { console.log('视频总数:', countStmt.get()); }
    countStmt.free();

    // 检查示例记录
    const sampleStmt = db.prepare('SELECT * FROM videos LIMIT 1');
    sampleStmt.bind([]);
    if(sampleStmt.step()) { console.log('示例记录:', sampleStmt.get()); }
    sampleStmt.free();

    // 检查无效记录
    const fs = require('fs');
    const checkStmt = db.prepare('SELECT id, filename, path FROM videos');
    checkStmt.bind([]);
    console.log('\n检查无效记录:');
    let invalidCount = 0;
    while(checkStmt.step()) {
      const row = checkStmt.get();
      if (row[2] && !fs.existsSync(row[2])) {
        console.log('无效记录:', row);
        invalidCount++;
      }
    }
    checkStmt.free();
    console.log('无效记录总数:', invalidCount);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
