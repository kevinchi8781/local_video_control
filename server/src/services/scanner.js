const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getDatabase, saveDatabase } = require('../db/database');
const md5 = require('md5');

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

// 获取视频时长（使用 ffprobe，比 ffmpeg 快 10 倍以上）
function getVideoDuration(filePath, ffmpegPath) {
  try {
    // ffprobe 通常和 ffmpeg 在同一目录
    const ffprobePath = ffmpegPath.replace(/ffmpeg(?:\.exe)?$/i, 'ffprobe.exe');
    const cmd = `"${ffprobePath}" -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
    const duration = parseFloat(output.trim());
    if (!isNaN(duration) && duration > 0) {
      return duration;
    }
  } catch (error) {
    console.error(`ffprobe 获取时长失败 ${filePath}:`, error.message);
  }
  return null;
}

// 生成缩略图和时长（一次性获取，避免两次 ffmpeg 调用）
async function generateThumbnailAndDuration(filePath, ffmpegPath) {
  // 先获取视频时长
  const duration = getVideoDuration(filePath, ffmpegPath);
  if (!duration) return { duration: null, thumbnail: null };

  try {
    // 计算截取位置：20% 处，最少 5 秒，最多 60 秒
    const seekTime = Math.min(60, Math.max(5, duration * 0.2));
    const timestamp = seekTime.toFixed(2); // 直接用秒数，不需要时分秒格式

    const thumbnailName = md5(filePath) + '.jpg';
    const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailName);

    // 如果缩略图已存在，直接返回
    if (fs.existsSync(thumbnailPath)) {
      return { duration, thumbnail: thumbnailName };
    }

    // 使用 ffmpeg 快速生成缩略图（-ss 在 -i 前面，关键帧跳转）
    const cmd = `"${ffmpegPath}" -ss ${timestamp} -i "${filePath}" -vframes 1 -vf scale=320:180 -y "${thumbnailPath}"`;
    execSync(cmd, { stdio: 'pipe' });

    if (fs.existsSync(thumbnailPath)) {
      return { duration, thumbnail: thumbnailName };
    }
  } catch (error) {
    console.error(`生成缩略图失败 ${filePath}:`, error.message);
  }
  // 即使缩略图生成失败，duration 已经获取到了，仍然返回
  return { duration, thumbnail: null };
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
  currentPhase: 'idle' // 'idle' | 'scanning' | 'generating' | 'cleaning' | 'complete'
};

// 获取扫描状态
function getScanState() {
  return { ...scanState };
}

// 设置扫描状态（供外部初始化）
function setScanState(partialState) {
  scanState = { ...scanState, ...partialState };
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
    // 不要重置 processed 和 total，保持累计进度
    // scanState.processed = 0;
    // scanState.total = newVideosToProcess.length;

    for (let i = 0; i < newVideosToProcess.length; i++) {
      const { videoPath, fileInfo, fileStats, modifiedAt } = newVideosToProcess[i];
      scanState.processed = i + 1;
      scanState.total = newVideosToProcess.length;
      scanState.currentFile = `正在生成缩略图：${path.basename(videoPath)}`;

      try {
        const result = await generateThumbnailAndDuration(videoPath, ffmpegPath);

        // 更新记录
        const updateStmt = db.prepare(`
          UPDATE videos SET
            duration_seconds = ?,
            thumbnail_path = ?
          WHERE path = ?
        `);
        updateStmt.run([result.duration, result.thumbnail, videoPath]);
        updateStmt.free();

        console.log(`  处理完成：${videoPath}`);
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
  // 保持 final stats 供前端最后一次轮询显示
  // 不重置 processed 和 total，让前端看到最终统计

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
  generateThumbnailAndDuration,
  formatFileSize,
  formatDuration,
  scanFolder,
  executeScan,
  getScanState,
  setScanState,
  getFfmpegPath
};
