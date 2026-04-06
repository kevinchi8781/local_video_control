const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getDatabase, saveDatabase } = require('../db/database');
const md5 = require('md5');
const transcodeService = require('./transcodeService');

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.flv', '.wmv', '.m4v'];
const THUMBNAIL_DIR = path.join(__dirname, '../../thumbnails');

// 确保缩略图目录存在
if (!fs.existsSync(THUMBNAIL_DIR)) {
  fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
}

// 获取 ffmpeg 路径
function getFfmpegPath() {
  const configFile = path.join(__dirname, '../../data/config.json');
  if (fs.existsSync(configFile)) {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    return config.ffmpegPath || 'ffmpeg';
  }
  return 'ffmpeg';
}

// 检查文件是否是视频
function isVideoFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}

// 获取视频时长
function getVideoDuration(filePath, ffmpegPath) {
  try {
    const cmd = `"${ffmpegPath}" -i "${filePath}" 2>&1 | findstr "Duration"`;
    const output = execSync(cmd, { encoding: 'utf-8' });
    const match = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);

    if (match) {
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const seconds = parseInt(match[3]);
      const centiseconds = parseInt(match[4]);
      return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
    }
  } catch (error) {
    console.error(`获取时长失败 ${filePath}:`, error.message);
  }
  return null;
}

// 生成缩略图
async function generateThumbnail(filePath, ffmpegPath) {
  try {
    // 获取视频时长
    const duration = getVideoDuration(filePath, ffmpegPath);
    if (!duration) return null;

    // 截取 10% 位置的帧，避免片头黑屏
    const seekTime = Math.max(1, duration * 0.1);
    const hours = Math.floor(seekTime / 3600);
    const minutes = Math.floor((seekTime % 3600) / 60);
    const seconds = (seekTime % 60).toFixed(3);
    const timestamp = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${seconds.padStart(6, '0')}`;

    // 生成缩略图文件名（使用路径的 MD5）
    const thumbnailName = md5(filePath) + '.jpg';
    const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailName);

    // 如果缩略图已存在，直接返回
    if (fs.existsSync(thumbnailPath)) {
      return thumbnailName;
    }

    // 使用 ffmpeg 生成缩略图
    const cmd = `"${ffmpegPath}" -ss ${timestamp} -i "${filePath}" -vframes 1 -vf scale=320:180 -y "${thumbnailPath}"`;
    execSync(cmd, { stdio: 'pipe' });

    if (fs.existsSync(thumbnailPath)) {
      return thumbnailName;
    }
  } catch (error) {
    console.error(`生成缩略图失败 ${filePath}:`, error.message);
  }
  return null;
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === null) return null;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1000) {
    return (mb / 1024).toFixed(2) + ' GB';
  }
  return mb.toFixed(2) + ' MB';
}

// 格式化时长
function formatDuration(seconds) {
  if (seconds === null) return '未知';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

// 扫描文件夹
async function scanFolder(folderPath, ffmpegPath) {
  const videos = [];

  function scanRecursive(currentPath) {
    let items;
    try {
      items = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
      console.error(`无法读取目录 ${currentPath}:`, error.message);
      return;
    }

    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith('.')) {
        scanRecursive(path.join(currentPath, item.name));
      } else if (item.isFile() && isVideoFile(item.name)) {
        const fullPath = path.join(currentPath, item.name);
        videos.push(fullPath);
      }
    }
  }

  scanRecursive(folderPath);
  return videos;
}

// 扫描状态
let scanState = {
  isScanning: false,
  currentFile: '',
  processed: 0,
  total: 0,
  new: 0,
  updated: 0,
  skipped: 0,
  generatingThumbnails: false,
  currentPhase: 'scanning' // 'scanning' | 'generating' | 'complete'
};

// 获取扫描状态
function getScanState() {
  return { ...scanState };
}

// 执行扫描（支持增量）
async function executeScan() {
  const configFile = path.join(__dirname, '../../data/config.json');
  if (!fs.existsSync(configFile)) {
    console.log('配置文件不存在，跳过扫描');
    return { scanned: 0, new: 0, updated: 0, skipped: 0, currentPhase: 'complete' };
  }

  const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  const ffmpegPath = getFfmpegPath();

  console.log(`开始扫描，ffmpeg 路径：${ffmpegPath || '自动检测'}`);

  const db = await getDatabase();
  let stats = { scanned: 0, new: 0, updated: 0, skipped: 0, removed: 0 };

  // 更新扫描状态
  scanState.isScanning = true;
  scanState.currentPhase = 'scanning';
  scanState.error = null;
  scanState.processed = 0;
  scanState.generatingThumbnails = false;

  // 收集所有当前扫描到的视频路径
  const allCurrentVideoPaths = new Set();

  // 预加载数据库现有路径，减少查询次数
  const existingVideos = new Map();
  try {
    const stmt = db.prepare('SELECT path, modified_at, thumbnail_path FROM videos');
    while (stmt.step()) {
      const row = stmt.get();
      const pathKey = row[0]; // path is first column
      existingVideos.set(pathKey, {
        modified_at: row[1],
        thumbnail_path: row[2]
      });
    }
    stmt.free();
    console.log(`缓存 ${existingVideos.size} 条现有视频记录`);
  } catch (e) {
    console.log('预加载缓存失败:', e.message);
  }

  // 第一阶段：快速扫描文件
  console.log('【阶段 1/3】快速扫描文件...');
  const newVideosToProcess = [];

  for (const binding of (config.folderBindings || [])) {
    console.log(`扫描绑定文件夹：${binding.path}`);

    const videoPaths = await scanFolder(binding.path, ffmpegPath);
    console.log(`  发现 ${videoPaths.length} 个视频文件`);

    scanState.total += videoPaths.length;

    for (const videoPath of videoPaths) {
      stats.scanned++;
      scanState.processed++;
      scanState.currentFile = videoPath;

      // 添加到当前扫描到的路径集合
      allCurrentVideoPaths.add(videoPath);

      try {
        // 获取文件修改时间
        const fileStats = fs.statSync(videoPath);
        const modifiedAt = fileStats.mtime.toISOString();
        const fileInfo = path.parse(videoPath);

        // 检查是否存在于缓存中
        const existing = existingVideos.get(videoPath);

        // 如果已存在且未修改，跳过
        if (existing && existing.modified_at === modifiedAt) {
          stats.skipped++;
          continue;
        }

        if (existing) {
          // 增量更新：只更新修改时间和扫描时间
          const updateStmt = db.prepare(`
            UPDATE videos SET
              modified_at = ?,
              scanned_at = CURRENT_TIMESTAMP
            WHERE path = ?
          `);
          updateStmt.run([modifiedAt, videoPath]);
          updateStmt.free();

          stats.updated++;
          scanState.updated++;
          console.log(`  更新：${videoPath}`);
        } else {
          // 新文件：先插入记录，缩略图稍后生成
          const insertStmt = db.prepare(`
            INSERT OR REPLACE INTO videos (path, filename, extension, file_size, duration_seconds, thumbnail_path, modified_at)
            VALUES (?, ?, ?, ?, ?, NULL, ?)
          `);
          insertStmt.run([
            videoPath,
            fileInfo.name,
            fileInfo.ext.toLowerCase(),
            fileStats.size,
            null, // duration 稍后填充
            modifiedAt
          ]);
          insertStmt.free();

          stats.new++;
          scanState.new++;
          newVideosToProcess.push({ videoPath, fileInfo, fileStats, modifiedAt });
          console.log(`  新增：${videoPath}`);
        }
      } catch (error) {
        console.error(`处理视频失败 ${videoPath}:`, error.message);
        scanState.error = error.message;
      }

      // 每 20 个文件保存一次数据库，并更新状态
      if (stats.scanned % 20 === 0) {
        saveDatabase();
        // 更新当前状态供前端轮询
        scanState.currentFile = `扫描中：${path.basename(videoPath)}`;
      }
    }
  }

  saveDatabase();

  // 第二阶段：清理失效记录（文件已被删除的视频）
  console.log('【阶段 2/3】清理失效记录...');
  scanState.currentPhase = 'cleaning';
  let removedCount = 0;

  for (const [videoPath, videoInfo] of existingVideos.entries()) {
    if (!allCurrentVideoPaths.has(videoPath)) {
      // 文件已不存在，删除记录
      try {
        const stmt = db.prepare('DELETE FROM videos WHERE path = ?');
        stmt.run([videoPath]);
        stmt.free();
        removedCount++;
        console.log(`  删除失效记录：${videoPath}`);
      } catch (error) {
        console.error(`删除记录失败 ${videoPath}:`, error.message);
      }
    }
  }

  if (removedCount > 0) {
    console.log(`  共删除 ${removedCount} 条失效记录`);
    stats.removed = removedCount;
  }

  saveDatabase();

  // 第三阶段：为新视频生成缩略图和时长
  if (newVideosToProcess.length > 0) {
    console.log(`【阶段 3/3】发现 ${newVideosToProcess.length} 个新视频，开始生成缩略图...`);
    scanState.currentPhase = 'generating';
    scanState.generatingThumbnails = true;
    scanState.processed = 0;
    scanState.total = newVideosToProcess.length;

    for (let i = 0; i < newVideosToProcess.length; i++) {
      const { videoPath, fileInfo, fileStats, modifiedAt } = newVideosToProcess[i];
      scanState.processed = i + 1;

      // 检查是否需要转码
      let needsTranscode = false;
      let transcodedPath = null;
      try {
        needsTranscode = await transcodeService.needsTranscoding(videoPath, ffmpegPath);
        if (needsTranscode) {
          scanState.currentFile = `正在转码：${path.basename(videoPath)}`;
          transcodedPath = await transcodeService.transcodeVideo(videoPath, ffmpegPath);
        } else {
          scanState.currentFile = `正在生成缩略图：${path.basename(videoPath)}`;
        }
      } catch (error) {
        console.error(`转码失败 ${videoPath}:`, error.message);
        scanState.currentFile = `生成缩略图：${path.basename(videoPath)}`;
      }

      try {
        const duration = getVideoDuration(videoPath, ffmpegPath);
        const thumbnail = await generateThumbnail(videoPath, ffmpegPath);

        // 更新记录
        const updateStmt = db.prepare(`
          UPDATE videos SET
            duration_seconds = ?,
            thumbnail_path = ?,
            needs_transcode = ?,
            transcoded_path = ?
          WHERE path = ?
        `);
        updateStmt.run([duration, thumbnail, needsTranscode ? 1 : 0, transcodedPath, videoPath]);
        updateStmt.free();

        console.log(`  处理完成：${videoPath}${needsTranscode ? ' (已转码)' : ''}`);
      } catch (error) {
        console.error(`生成缩略图失败 ${videoPath}:`, error.message);
      }

      // 每 5 个文件保存一次
      if ((i + 1) % 5 === 0) {
        saveDatabase();
      }
    }
  }

  saveDatabase();
  scanState.isScanning = false;
  scanState.generatingThumbnails = false;
  scanState.currentPhase = 'complete';

  const result = {
    scanned: stats.scanned,
    new: stats.new,
    updated: stats.updated,
    skipped: stats.skipped,
    removed: stats.removed,
    currentPhase: scanState.currentPhase
  };

  console.log(`扫描完成:`, result);
  return result;
}

module.exports = {
  isVideoFile,
  getVideoDuration,
  generateThumbnail,
  formatFileSize,
  formatDuration,
  scanFolder,
  executeScan,
  getScanState,
  getFfmpegPath
};
