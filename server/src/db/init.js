const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/videos.db');

// 确保 data 目录存在
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

async function initDatabase() {
  const SQL = await initSqlJs();

  // 尝试加载现有数据库
  let db;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('Creating new database');
  }

  // 创建表结构
  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      display_name TEXT,
      parent_id INTEGER,
      video_count INTEGER DEFAULT 0,
      scanned_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES folders(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      filename TEXT NOT NULL,
      extension TEXT NOT NULL,
      folder_id INTEGER,
      file_size INTEGER,
      duration_seconds REAL,
      thumbnail_path TEXT,
      modified_at DATETIME,
      scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      needs_transcode BOOLEAN DEFAULT 0,
      transcoded_path TEXT,
      FOREIGN KEY (folder_id) REFERENCES folders(id)
    )
  `);

  // 为现有数据库添加转码相关列（如果不存在）
  try {
    db.run(`ALTER TABLE videos ADD COLUMN needs_transcode BOOLEAN DEFAULT 0`);
  } catch (e) {
    // 列已存在，忽略
  }
  try {
    db.run(`ALTER TABLE videos ADD COLUMN transcoded_path TEXT`);
  } catch (e) {
    // 列已存在，忽略
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS watch_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id INTEGER NOT NULL,
      progress_seconds REAL DEFAULT 0,
      is_completed BOOLEAN DEFAULT 0,
      last_watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (video_id) REFERENCES videos(id)
    )
  `);

  // 收藏分类表
  db.run(`
    CREATE TABLE IF NOT EXISTS collection_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      color TEXT DEFAULT '#722ed1',
      icon TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES collection_categories(id) ON DELETE SET NULL
    )
  `);

  // 收藏夹表
  db.run(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT DEFAULT 'default',
      name TEXT DEFAULT '默认收藏夹',
      description TEXT,
      is_default BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 视频收藏关联表
  db.run(`
    CREATE TABLE IF NOT EXISTS video_collection_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      video_id INTEGER NOT NULL,
      category_id INTEGER,
      custom_categories TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES collection_categories(id) ON DELETE SET NULL,
      UNIQUE(collection_id, video_id)
    )
  `);

  // 创建索引
  db.run(`CREATE INDEX IF NOT EXISTS idx_videos_folder ON videos(folder_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_videos_filename ON videos(filename)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_watch_history_video ON watch_history(video_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_categories_parent ON collection_categories(parent_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_map_collection ON video_collection_map(collection_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_map_video ON video_collection_map(video_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_map_category ON video_collection_map(category_id)`);

  // 插入默认收藏夹
  db.run(`INSERT OR IGNORE INTO collections (name, is_default) VALUES ('默认收藏夹', 1)`);

  // 保存数据库
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);

  db.close();
  console.log(`Database initialized at ${DB_PATH}`);
}

initDatabase().catch(console.error);
