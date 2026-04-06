const { getDatabase, saveDatabase } = require('../db/database');

const collectionService = {
  // 获取所有收藏夹
  async getAll(userId = 'default') {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT * FROM collections WHERE user_id = ? ORDER BY created_at ASC');
    stmt.bind([userId]);

    const collections = [];
    while (stmt.step()) {
      const row = stmt.get();
      collections.push({
        id: row[0],
        userId: row[1],
        name: row[2],
        description: row[3],
        isDefault: row[4],
        createdAt: row[5],
        updatedAt: row[6]
      });
    }
    stmt.free();
    return collections;
  },

  // 创建收藏夹
  async create(userId, name, description) {
    const db = await getDatabase();
    const stmt = db.prepare(`
      INSERT INTO collections (user_id, name, description)
      VALUES (?, ?, ?)
    `);
    stmt.run([userId, name, description]);
    stmt.free();
    saveDatabase();
  },

  // 更新收藏夹
  async update(id, name, description) {
    const db = await getDatabase();
    const stmt = db.prepare(`
      UPDATE collections SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run([name, description, id]);
    stmt.free();
    saveDatabase();
  },

  // 删除收藏夹
  async delete(id) {
    const db = await getDatabase();
    const stmt = db.prepare('DELETE FROM collections WHERE id = ?');
    stmt.run([id]);
    stmt.free();
    saveDatabase();
  },

  // 添加视频到收藏夹
  async addVideo(collectionId, videoId, options = {}) {
    const db = await getDatabase();
    const { categoryId, customCategories, note } = options;

    // 检查是否已存在
    const checkStmt = db.prepare('SELECT id FROM video_collection_map WHERE collection_id = ? AND video_id = ?');
    checkStmt.bind([collectionId, videoId]);
    if (checkStmt.step()) {
      checkStmt.free();
      throw new Error('视频已在收藏夹中');
    }
    checkStmt.free();

    // 插入关联记录
    const insertStmt = db.prepare(`
      INSERT INTO video_collection_map (collection_id, video_id, category_id, custom_categories, note)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertStmt.run([
      collectionId,
      videoId,
      categoryId || null,
      customCategories ? JSON.stringify(customCategories) : null,
      note || null
    ]);
    insertStmt.free();
    saveDatabase();
  },

  // 从收藏夹移除视频
  async removeVideo(collectionId, videoId) {
    const db = await getDatabase();
    const stmt = db.prepare('DELETE FROM video_collection_map WHERE collection_id = ? AND video_id = ?');
    stmt.run([collectionId, videoId]);
    stmt.free();
    saveDatabase();
  },

  // 获取收藏夹中的视频列表
  async getCollectionVideos(collectionId, filters = {}) {
    const db = await getDatabase();
    const { categoryId, page = 1, limit = 50, search } = filters;
    const offset = (page - 1) * limit;

    const conditions = ['m.collection_id = ?'];
    const params = [collectionId];

    if (categoryId && categoryId !== 'all') {
      // 按 custom_categories 过滤（JSON 数组包含分类名称）
      conditions.push('m.custom_categories LIKE ?');
      params.push(`%"${categoryId}"%`);
    }

    if (search) {
      conditions.push('v.filename LIKE ?');
      params.push(`%${search}%`);
    }

    const whereClause = conditions.join(' AND ');

    // 获取总数
    const countStmt = db.prepare(`SELECT COUNT(*) FROM video_collection_map m JOIN videos v ON m.video_id = v.id WHERE ${whereClause}`);
    countStmt.bind(params);
    let total = 0;
    if (countStmt.step()) {
      total = countStmt.get()[0];
    }
    countStmt.free();

    // 获取视频列表
    const stmt = db.prepare(`
      SELECT v.id, v.path, v.filename, v.duration_seconds, v.thumbnail_path,
             m.custom_categories, m.note, m.created_at as favorited_at
      FROM video_collection_map m
      JOIN videos v ON m.video_id = v.id
      WHERE ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `);
    stmt.bind([...params, limit, offset]);

    const videos = [];
    while (stmt.step()) {
      const row = stmt.get();
      videos.push({
        id: row[0],
        path: row[1],
        filename: row[2],
        durationSeconds: row[3],
        thumbnailPath: row[4] ? `/thumbnails/${row[4]}` : null,
        customCategories: row[5] ? JSON.parse(row[5]) : [],
        note: row[6],
        favoritedAt: row[7]
      });
    }
    stmt.free();

    return { videos, pagination: { total, page, limit } };
  },

  // 检查视频是否已收藏
  async isVideoFavorite(videoId, userId = 'default') {
    const db = await getDatabase();
    const stmt = db.prepare(`
      SELECT m.id FROM video_collection_map m
      JOIN collections c ON m.collection_id = c.id
      WHERE m.video_id = ? AND c.user_id = ?
    `);
    stmt.bind([videoId, userId]);
    const exists = stmt.step();
    stmt.free();
    return exists;
  },

  // 获取默认收藏夹 ID
  async getDefaultCollectionId(userId = 'default') {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT id FROM collections WHERE user_id = ? AND is_default = 1');
    stmt.bind([userId]);
    if (stmt.step()) {
      const row = stmt.get();
      stmt.free();
      return row[0];
    }
    stmt.free();

    // 如果没有默认收藏夹，返回第一个
    const stmt2 = db.prepare('SELECT id FROM collections WHERE user_id = ? LIMIT 1');
    stmt2.bind([userId]);
    if (stmt2.step()) {
      const row = stmt2.get();
      stmt2.free();
      return row[0];
    }
    stmt2.free();

    return null;
  },

  // 获取所有使用过的自定义分类
  async getAllCustomCategories(userId = 'default') {
    const db = await getDatabase();
    const stmt = db.prepare(`
      SELECT DISTINCT m.custom_categories
      FROM video_collection_map m
      JOIN collections c ON m.collection_id = c.id
      WHERE c.user_id = ? AND m.custom_categories IS NOT NULL
    `);
    stmt.bind([userId]);

    const categories = new Set();
    while (stmt.step()) {
      const row = stmt.get();
      if (row[0]) {
        try {
          const arr = JSON.parse(row[0]);
          if (Array.isArray(arr)) {
            arr.forEach(cat => categories.add(cat));
          }
        } catch (e) {
          // Ignore invalid JSON
        }
      }
    }
    stmt.free();

    return Array.from(categories);
  },

  // 获取每个分类的视频数量
  async getCategoryVideoCounts(userId = 'default') {
    const db = await getDatabase();
    const stmt = db.prepare(`
      SELECT m.custom_categories
      FROM video_collection_map m
      JOIN collections c ON m.collection_id = c.id
      WHERE c.user_id = ? AND m.custom_categories IS NOT NULL
    `);
    stmt.bind([userId]);

    const counts = {};
    while (stmt.step()) {
      const row = stmt.get();
      if (row[0]) {
        try {
          const arr = JSON.parse(row[0]);
          if (Array.isArray(arr)) {
            arr.forEach(cat => {
              counts[cat] = (counts[cat] || 0) + 1;
            });
          }
        } catch (e) {
          // Ignore invalid JSON
        }
      }
    }
    stmt.free();

    return counts;
  }
};

module.exports = collectionService;
