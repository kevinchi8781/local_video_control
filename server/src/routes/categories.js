const express = require('express');
const router = express.Router();
const categoryService = require('../services/categoryService');

// GET /api/categories - 获取所有分类
router.get('/', async (req, res) => {
  try {
    const categories = await categoryService.getAll();
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/categories/tree - 获取分类树
router.get('/tree', async (req, res) => {
  try {
    const tree = await categoryService.getTree();
    res.json({
      success: true,
      data: tree
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/categories - 创建新分类
router.post('/', async (req, res) => {
  try {
    const { name, parentId, description, color, icon } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        error: '分类名称不能为空'
      });
    }
    await categoryService.create(name, parentId, { description, color, icon });
    res.json({
      success: true,
      message: '分类创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/categories/:id - 更新分类
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, icon } = req.body;
    await categoryService.update(id, name, description, color, icon);
    res.json({
      success: true,
      message: '更新成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/categories/:id - 删除分类
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await categoryService.delete(id);
    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/categories/:id/video-count - 获取分类下的视频数量
router.get('/:id/video-count', async (req, res) => {
  try {
    const { id } = req.params;
    const count = await categoryService.getVideoCount(id);
    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
