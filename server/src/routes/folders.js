const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabase } = require('../db/database');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../../data/config.json');

// GET /api/folders - 获取根节点（绑定的文件夹）
router.get('/', async (req, res) => {
  try {
    let config = { folderBindings: [] };
    if (fs.existsSync(CONFIG_FILE)) {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }

    const db = await getDatabase();

    const folders = [];
    for (const binding of config.folderBindings) {
      // 查询该文件夹下的视频数量
      let videoCount = 0;
      try {
        // 使用 INSTR 函数避免 LIKE 中的反斜杠转义问题
        const stmt = db.prepare('SELECT COUNT(*) FROM videos WHERE INSTR(path, ?) = 1');
        stmt.bind([binding.path + '\\']);
        if (stmt.step()) {
          const row = stmt.get();
          videoCount = row[0] || 0;
        }
        stmt.free();
      } catch (e) {
        // 数据库可能还未创建表
        videoCount = 0;
      }

      folders.push({
        id: binding.id,
        label: binding.displayName || path.basename(binding.path),
        path: binding.path,
        isRoot: true,
        videoCount,
        hasChildren: true,
        selectable: true
      });
    }

    res.json({
      success: true,
      data: folders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/folders/:id/children - 获取子文件夹
router.get('/:id/children', async (req, res) => {
  try {
    const { id } = req.params;
    const { path: parentPath } = req.query;

    if (!parentPath) {
      return res.json({
        success: true,
        data: []
      });
    }

    // 扫描子文件夹
    let children = [];

    if (fs.existsSync(parentPath)) {
      const items = fs.readdirSync(parentPath, { withFileTypes: true });
      const db = await getDatabase();

      for (const item of items) {
        if (item.isDirectory() && !item.name.startsWith('.')) {
          const childPath = path.join(parentPath, item.name);

          let videoCount = 0;
          try {
            // 使用 INSTR 函数避免 LIKE 中的反斜杠转义问题
            const stmt = db.prepare('SELECT COUNT(*) FROM videos WHERE INSTR(path, ?) = 1');
            stmt.bind([childPath + '\\']);
            if (stmt.step()) {
              const row = stmt.get();
              videoCount = row[0] || 0;
            }
            stmt.free();
          } catch (e) {
            videoCount = 0;
          }

          // 检查是否有子文件夹或视频
          let hasChildren = false;
          try {
            const subItems = fs.readdirSync(childPath, { withFileTypes: true });
            hasChildren = subItems.some(f => {
              if (f.isDirectory() && !f.name.startsWith('.')) return true;
              if (f.isFile()) {
                const ext = path.extname(f.name).toLowerCase();
                return ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.flv', '.wmv', '.m4v'].includes(ext);
              }
              return false;
            });
          } catch (e) {
            hasChildren = false;
          }

          children.push({
            id: Buffer.from(childPath).toString('base64'),
            label: item.name,
            path: childPath,
            isRoot: false,
            videoCount,
            hasChildren: hasChildren,
            selectable: true
          });
        }
      }
    }

    res.json({
      success: true,
      data: children
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
