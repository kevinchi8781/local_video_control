const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabase } = require('../db/database');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../../data/config.json');

// 确保配置目录存在
if (!fs.existsSync(path.dirname(CONFIG_FILE))) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
}

// GET /api/config - 获取配置
router.get('/', async (req, res) => {
  try {
    let config = { ffmpegPath: '', folderBindings: [] };

    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      config = JSON.parse(content);
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/config - 保存配置
router.post('/', async (req, res) => {
  try {
    const { ffmpegPath, folderBindings } = req.body;

    const config = {
      ffmpegPath: ffmpegPath || '',
      folderBindings: folderBindings || []
    };

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/config/folder - 添加文件夹绑定
router.post('/folder', async (req, res) => {
  try {
    const { path: folderPath } = req.body;

    if (!folderPath) {
      return res.status(400).json({
        success: false,
        error: '文件夹路径不能为空'
      });
    }

    // 验证路径存在
    if (!fs.existsSync(folderPath)) {
      return res.status(400).json({
        success: false,
        error: '文件夹路径不存在'
      });
    }

    // 验证是文件夹不是文件
    const stats = fs.statSync(folderPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({
        success: false,
        error: '路径不是文件夹'
      });
    }

    // 读取现有配置
    let config = { ffmpegPath: '', folderBindings: [] };
    if (fs.existsSync(CONFIG_FILE)) {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }

    // 检查是否已存在
    const exists = config.folderBindings.some(b => b.path === folderPath);
    if (exists) {
      return res.status(400).json({
        success: false,
        error: '该路径已绑定'
      });
    }

    // 添加新绑定
    config.folderBindings.push({
      id: Date.now().toString(),
      path: folderPath,
      displayName: path.basename(folderPath),
      createdAt: new Date().toISOString()
    });

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/config/folder/:id - 删除文件夹绑定
router.delete('/folder/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let config = { ffmpegPath: '', folderBindings: [] };
    if (fs.existsSync(CONFIG_FILE)) {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }

    config.folderBindings = config.folderBindings.filter(b => b.id !== id);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
