const { getDatabase, saveDatabase } = require('../db/database');

const categoryService = {
  // 获取所有分类（扁平）
  async getAll() {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT * FROM collection_categories ORDER BY sort_order, id');
    stmt.bind([]);

    const categories = [];
    while (stmt.step()) {
      const row = stmt.get();
      categories.push({
        id: row[0],
        name: row[1],
        parentId: row[2],
        description: row[3],
        sortOrder: row[4],
        color: row[5],
        icon: row[6],
        createdAt: row[7],
        updatedAt: row[8]
      });
    }
    stmt.free();
    return categories;
  },

  // 获取分类树
  async getTree() {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT * FROM collection_categories ORDER BY sort_order, id');
    stmt.bind([]);

    const categories = [];
    while (stmt.step()) {
      const row = stmt.get();
      categories.push({
        id: row[0],
        name: row[1],
        parentId: row[2],
        description: row[3],
        sortOrder: row[4],
        color: row[5],
        icon: row[6],
        createdAt: row[7],
        updatedAt: row[8]
      });
    }
    stmt.free();

    // 构建树形结构
    return buildCategoryTree(categories);
  },

  // 创建分类
  async create(name, parentId, options = {}) {
    const db = await getDatabase();
    const { description, color, icon, sortOrder } = options;
    const stmt = db.prepare(`
      INSERT INTO collection_categories (name, parent_id, description, color, icon, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run([name, parentId || null, description || null, color || '#722ed1', icon || null, sortOrder || 0]);
    stmt.free();
    saveDatabase();
  },

  // 更新分类
  async update(id, name, description, color, icon) {
    const db = await getDatabase();
    const stmt = db.prepare(`
      UPDATE collection_categories
      SET name = ?, description = ?, color = ?, icon = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run([name, description, color, icon, id]);
    stmt.free();
    saveDatabase();
  },

  // 删除分类
  async delete(id) {
    const db = await getDatabase();
    // 先将子分类的 parent_id 设为 null
    const updateStmt = db.prepare('UPDATE collection_categories SET parent_id = NULL WHERE parent_id = ?');
    updateStmt.run([id]);
    updateStmt.free();

    // 删除分类
    const stmt = db.prepare('DELETE FROM collection_categories WHERE id = ?');
    stmt.run([id]);
    stmt.free();
    saveDatabase();
  },

  // 获取分类下的视频数量
  async getVideoCount(categoryId) {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT COUNT(*) FROM video_collection_map WHERE category_id = ?');
    stmt.bind([categoryId]);
    let count = 0;
    if (stmt.step()) {
      count = stmt.get()[0];
    }
    stmt.free();
    return count;
  }
};

// 构建分类树
function buildCategoryTree(categories, parentId = null) {
  return categories
    .filter(cat => cat.parentId === parentId)
    .map(cat => ({
      ...cat,
      children: buildCategoryTree(categories, cat.id),
      hasChildren: categories.some(c => c.parentId === cat.id)
    }));
}

module.exports = categoryService;
