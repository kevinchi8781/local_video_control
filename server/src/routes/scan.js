const express = require('express');
const router = express.Router();
const { executeScan, getScanState } = require('../services/scanner');

// POST /api/scan - 执行扫描
router.post('/', async (req, res) => {
  try {
    console.log('收到扫描请求');

    // 先更新扫描状态，让前端轮询时能立即看到扫描中
    const { setScanState } = require('../services/scanner');
    setScanState({
      isScanning: true,
      currentPhase: 'scanning',
      processed: 0,
      total: 0,
      new: 0,
      updated: 0,
      skipped: 0,
      currentFile: '准备扫描...'
    });

    res.json({
      success: true,
      message: '扫描已开始'
    });

    // 异步执行扫描
    setImmediate(async () => {
      try {
        const stats = await executeScan();
        console.log('扫描结果:', stats);
      } catch (error) {
        console.error('扫描失败:', error);
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/scan/status - 获取扫描状态
router.get('/status', async (req, res) => {
  const state = getScanState();
  res.json({
    success: true,
    data: state
  });
});

module.exports = router;
