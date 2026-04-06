const express = require('express');
const router = express.Router();
const collectionService = require('../services/collectionService');

// GET /api/collections/categories - 获取所有使用过的分类（包括自定义）
router.get('/categories', async (req, res) => {
  try {
    const categories = await collectionService.getAllCustomCategories('default');
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

// GET /api/collections/categories/count - 获取每个分类的视频数量
router.get('/categories/count', async (req, res) => {
  try {
    const counts = await collectionService.getCategoryVideoCounts('default');
    res.json({
      success: true,
      data: counts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/collections/check/:videoId - 检查视频是否已收藏（放在最前面，避免被/:id 拦截）
router.get('/check/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const isFavorite = await collectionService.isVideoFavorite(videoId, 'default');
    res.json({
      success: true,
      isFavorite
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/videos/:videoId/favorite - 快速收藏视频（放在最前面）
router.post('/videos/:videoId/favorite', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { categoryId, customCategories, note } = req.body;

    const defaultCollectionId = await collectionService.getDefaultCollectionId('default');
    if (!defaultCollectionId) {
      return res.status(400).json({
        success: false,
        error: '默认收藏夹不存在'
      });
    }

    await collectionService.addVideo(defaultCollectionId, videoId, { categoryId, customCategories, note });
    res.json({
      success: true,
      message: '收藏成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/videos/:videoId/favorite - 取消收藏（放在最前面）
router.delete('/videos/:videoId/favorite', async (req, res) => {
  try {
    const { videoId } = req.params;
    const defaultCollectionId = await collectionService.getDefaultCollectionId('default');
    if (!defaultCollectionId) {
      return res.status(400).json({
        success: false,
        error: '默认收藏夹不存在'
      });
    }
    await collectionService.removeVideo(defaultCollectionId, videoId);
    res.json({
      success: true,
      message: '已取消收藏'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/collections - 获取所有收藏夹
router.get('/', async (req, res) => {
  try {
    const collections = await collectionService.getAll('default');
    res.json({
      success: true,
      data: collections
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/collections - 创建新收藏夹
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        error: '收藏夹名称不能为空'
      });
    }
    await collectionService.create('default', name, description);
    res.json({
      success: true,
      message: '收藏夹创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/collections/:id - 更新收藏夹
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    await collectionService.update(id, name, description);
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

// DELETE /api/collections/:id - 删除收藏夹
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await collectionService.delete(id);
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

// GET /api/collections/:id/videos - 获取收藏夹中的视频
router.get('/:id/videos', async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit, categoryId, search } = req.query;
    const result = await collectionService.getCollectionVideos(id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      categoryId,
      search
    });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/collections/:id/videos - 添加视频到收藏夹
router.post('/:id/videos', async (req, res) => {
  try {
    const { id } = req.params;
    const { videoId, categoryId, customCategories, note } = req.body;
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: '视频 ID 不能为空'
      });
    }
    await collectionService.addVideo(id, videoId, { categoryId, customCategories, note });
    res.json({
      success: true,
      message: '添加成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/collections/:id/videos/:videoId - 从收藏夹移除视频
router.delete('/:id/videos/:videoId', async (req, res) => {
  try {
    const { id, videoId } = req.params;
    await collectionService.removeVideo(id, videoId);
    res.json({
      success: true,
      message: '移除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
