const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db/database');

// GET /api/history - 获取播放历史
router.get('/', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const db = await getDatabase();

    const stmt = db.prepare(`
      SELECT h.*, v.filename, v.path, v.thumbnail_path, v.duration_seconds
      FROM watch_history h
      JOIN videos v ON h.video_id = v.id
      ORDER BY h.last_watched_at DESC
      LIMIT ?
    `);
    stmt.bind([parseInt(limit)]);

    const history = [];
    while (stmt.step()) {
      const row = stmt.get();
      history.push({
        id: row['id'],
        videoId: row['video_id'],
        filename: row['filename'],
        path: row['path'],
        thumbnailPath: row['thumbnail_path'] ? `/thumbnails/${row['thumbnail_path']}` : null,
        progressSeconds: row['progress_seconds'],
        durationSeconds: row['duration_seconds'],
        isCompleted: row['is_completed'] === 1,
        lastWatchedAt: row['last_watched_at']
      });
    }
    stmt.free();

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/history/continue - 获取继续观看列表（有进度但未完成）
router.get('/continue', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const db = await getDatabase();

    const stmt = db.prepare(`
      SELECT h.*, v.filename, v.path, v.thumbnail_path, v.duration_seconds
      FROM watch_history h
      JOIN videos v ON h.video_id = v.id
      WHERE h.progress_seconds > 0 AND h.is_completed = 0
      ORDER BY h.last_watched_at DESC
      LIMIT ?
    `);
    stmt.bind([parseInt(limit)]);

    const history = [];
    while (stmt.step()) {
      const row = stmt.get();
      history.push({
        id: row['id'],
        videoId: row['video_id'],
        filename: row['filename'],
        progressSeconds: row['progress_seconds'],
        durationSeconds: row['duration_seconds'],
        progressPercent: Math.round((row['progress_seconds'] / row['duration_seconds']) * 100),
        lastWatchedAt: row['last_watched_at']
      });
    }
    stmt.free();

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
