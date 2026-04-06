const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabase } = require('../db/database');
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

const CONFIG_FILE = path.join(__dirname, '../../data/config.json');
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.flv', '.wmv', '.m4v'];

// GET /api/videos - 获取视频列表（支持分页、过滤、搜索）
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      folderId,
      folderPath,
      search,
      durationMin,
      durationMax,
      sortBy = 'filename',
      sortOrder = 'asc'
    } = req.query;

    const db = await getDatabase();
    const offset = (page - 1) * limit;

    // 构建 WHERE 子句
    const conditions = [];
    const params = [];

    // 按文件夹过滤 - 使用 INSTR 避免反斜杠转义问题
    if (folderPath) {
      conditions.push('INSTR(path, ?) = 1');
      params.push(folderPath + '\\');
    }

    // 按搜索词过滤
    if (search) {
      conditions.push('filename LIKE ?');
      params.push(`%${search}%`);
    }

    // 按时长过滤
    if (durationMin) {
      conditions.push('duration_seconds >= ?');
      params.push(parseFloat(durationMin));
    }
    if (durationMax) {
      conditions.push('duration_seconds <= ?');
      params.push(parseFloat(durationMax));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 排序
    const orderColumn = sortBy === 'duration' ? 'duration_seconds' :
                        sortBy === 'size' ? 'file_size' :
                        sortBy === 'created' ? 'created_at' : 'filename';
    const order = sortOrder === 'desc' ? 'DESC' : 'ASC';

    // 查询总数
    let total = 0;
    const countStmt = db.prepare(`SELECT COUNT(*) FROM videos ${whereClause}`);
    if (params.length > 0) {
      countStmt.bind(params);
    }
    if (countStmt.step()) {
      const totalResult = countStmt.get();
      total = totalResult[0] || 0;
    }
    countStmt.free();

    // 查询数据
    const dataStmt = db.prepare(`
      SELECT id, path, filename, extension, file_size, duration_seconds, thumbnail_path, folder_id, scanned_at
      FROM videos ${whereClause}
      ORDER BY ${orderColumn} ${order}
      LIMIT ? OFFSET ?
    `);
    const dataParams = [...params, parseInt(limit), offset];
    dataStmt.bind(dataParams);

    const videos = [];
    while (dataStmt.step()) {
      const row = dataStmt.get();
      videos.push({
        id: row[0],
        path: row[1],
        filename: row[2],
        extension: row[3],
        fileSize: row[4],
        durationSeconds: row[5],
        thumbnailPath: row[6] ? `/thumbnails/${row[6]}` : null,
        folderId: row[7],
        scannedAt: row[8]
      });
    }
    dataStmt.free();

    res.json({
      success: true,
      data: {
        videos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/videos/check-invalid - 检查无效视频记录（文件不存在但数据库有记录）
router.get('/check-invalid', async (req, res) => {
  try {
    console.log('[check-invalid] Starting check...');
    const db = await getDatabase();
    const stmt = db.prepare('SELECT id, filename, path FROM videos');
    stmt.bind([]);

    const invalidVideos = [];
    let totalChecked = 0;
    while (stmt.step()) {
      const row = stmt.get();
      totalChecked++;
      if (row[2] && !fs.existsSync(row[2])) {
        console.log('[check-invalid] Found invalid:', row[0], row[2]);
        invalidVideos.push({
          id: row[0],
          filename: row[1],
          path: row[2]
        });
      }
    }
    stmt.free();

    console.log('[check-invalid] Checked', totalChecked, 'videos, found', invalidVideos.length, 'invalid');
    res.json({
      success: true,
      data: {
        invalid: invalidVideos,
        count: invalidVideos.length
      }
    });
  } catch (error) {
    console.error('[check-invalid] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/videos/cleanup-invalid - 清理无效视频记录（删除数据库中文件不存在的记录）
router.post('/cleanup-invalid', async (req, res) => {
  try {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT id, path FROM videos');
    stmt.bind([]);

    const deletedIds = [];
    while (stmt.step()) {
      const row = stmt.get();
      if (row[1] && !fs.existsSync(row[1])) {
        const deleteStmt = db.prepare('DELETE FROM videos WHERE id = ?');
        deleteStmt.run([row[0]]);
        deletedIds.push(row[0]);
      }
    }
    stmt.free();
    saveDatabase();

    res.json({
      success: true,
      data: {
        deletedIds,
        count: deletedIds.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/videos/:id - 获取单个视频详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDatabase();

    const stmt = db.prepare('SELECT * FROM videos WHERE id = ?');
    stmt.bind([id]);
    stmt.step();
    const row = stmt.get();
    stmt.free();

    if (!row) {
      return res.status(404).json({
        success: false,
        error: '视频不存在'
      });
    }

    res.json({
      success: true,
      data: {
        id: row['id'],
        path: row['path'],
        filename: row['filename'],
        fileSize: row['file_size'],
        durationSeconds: row['duration_seconds'],
        thumbnailPath: row['thumbnail_path']
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/videos/:id/stream - 视频流（直接返回原始文件，不转码）
router.get('/:id/stream', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDatabase();

    console.log(`[Stream] Request for video ${id}`);

    const stmt = db.prepare('SELECT path, filename FROM videos WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.get();
      const videoPath = row[0];
      const filename = row[1];
      stmt.free();

      console.log(`[Stream] Video path: ${videoPath}`);

      if (!fs.existsSync(videoPath)) {
        console.log(`[Stream] Video file not found: ${videoPath}`);
        return res.status(404).json({
          error: '视频文件不存在',
          path: videoPath,
          filename: filename
        });
      }

      // 直接返回原始文件，支持 Range 请求（用于拖拽进度）
      const stats = fs.statSync(videoPath);
      const fileSize = stats.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': 'video/mp4'
        });

        const stream = fs.createReadStream(videoPath, { start, end });
        stream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4'
        });
        fs.createReadStream(videoPath).pipe(res);
      }
    } else {
      stmt.free();
      res.status(404).json({
        success: false,
        error: '视频不存在'
      });
    }
  } catch (error) {
    console.error('[Stream] Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.end();
    }
  }
});

// GET /api/videos/:id/play-local - 本地 PotPlayer 播放
router.get('/:id/play-local', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDatabase();

    const stmt = db.prepare('SELECT path FROM videos WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.get();
      const videoPath = row[0];
      stmt.free();

      if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ success: false, error: '视频文件不存在' });
      }

      // 使用 execFile 启动 PotPlayer（Windows）
      const potPlayerPath = 'C:\\Program Files\\DAUM\\PotPlayer\\PotPlayerMini64.exe';

      if (!fs.existsSync(potPlayerPath)) {
        return res.status(404).json({ success: false, error: 'PotPlayer 未安装' });
      }

      execFile(potPlayerPath, [videoPath], { detached: true }, (err) => {
        if (err) {
          console.error('启动 PotPlayer 失败:', err);
        }
      });

      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: '视频不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/videos/:id - 删除视频（移到回收站）
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDatabase();

    const stmt = db.prepare('SELECT path FROM videos WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.get();
      const videoPath = row[0];
      stmt.free();

      if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ success: false, error: '视频文件不存在' });
      }

      // 使用 PowerShell 移动到回收站
      const recycleCommand = `
        $file = "${videoPath.replace(/\\/g, '/')}"
        if (Test-Path $file) {
          $shell = New-Object -ComObject Shell.Application
          $folder = $shell.Namespace((Split-Path $file))
          $item = $folder.ParseName((Split-Path $file -Leaf))
          $item.InvokeVerb("Delete")
          Write-Output "Deleted"
        } else {
          Write-Output "NotFound"
        }
      `;

      try {
        const { execSync } = require('child_process');
        execSync(`powershell -Command "${recycleCommand}"`, { encoding: 'utf-8' });
      } catch (error) {
        // 忽略错误
      }

      // 从数据库删除记录
      const deleteStmt = db.prepare('DELETE FROM videos WHERE id = ?');
      deleteStmt.run([id]);
      deleteStmt.free();
      saveDatabase();

      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: '视频记录不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/videos/:id/progress - 上报播放进度
router.post('/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;
    const { progressSeconds, isCompleted } = req.body;

    const db = await getDatabase();

    // 检查记录是否存在
    const checkStmt = db.prepare('SELECT id FROM watch_history WHERE video_id = ?');
    checkStmt.bind([id]);
    const exists = checkStmt.step();
    checkStmt.free();

    if (exists) {
      // 更新
      const updateStmt = db.prepare(`
        UPDATE watch_history
        SET progress_seconds = ?, is_completed = ?, last_watched_at = CURRENT_TIMESTAMP
        WHERE video_id = ?
      `);
      updateStmt.run([progressSeconds || 0, isCompleted ? 1 : 0, id]);
      updateStmt.free();
    } else {
      // 插入
      const insertStmt = db.prepare(`
        INSERT INTO watch_history (video_id, progress_seconds, is_completed)
        VALUES (?, ?, ?)
      `);
      insertStmt.run([id, progressSeconds || 0, isCompleted ? 1 : 0]);
      insertStmt.free();
    }

    saveDatabase();

    res.json({
      success: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
