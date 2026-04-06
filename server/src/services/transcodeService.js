const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const TRANSCODED_DIR = path.join(__dirname, '../../transcoded');

// 确保转码目录存在
if (!fs.existsSync(TRANSCODED_DIR)) {
  fs.mkdirSync(TRANSCODED_DIR, { recursive: true });
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

// 初始化 ffmpeg 和 ffprobe 路径
function initFFmpeg(ffmpegPath) {
  const fp = ffmpegPath || getFfmpegPath();
  ffmpeg.setFfmpegPath(fp);
  // ffprobe 和 ffmpeg 在同一个目录下
  const ffprobePath = path.join(path.dirname(fp), 'ffprobe.exe');
  ffmpeg.setFfprobePath(ffprobePath);
  console.log(`FFmpeg path: ${fp}, FFprobe path: ${ffprobePath}`);
}

/**
 * 检测视频编码格式
 * @param {string} videoPath - 视频文件路径
 * @param {string} ffmpegPath - ffmpeg 路径
 * @returns {Promise<{videoCodec: string, audioCodec: string}>}
 */
function detectCodecs(videoPath, ffmpegPath) {
  // 初始化路径
  initFFmpeg(ffmpegPath);

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

      resolve({
        videoCodec: videoStream?.codec_name || 'unknown',
        audioCodec: audioStream?.codec_name || 'unknown'
      });
    });
  });
}

/**
 * 检查视频是否需要转码（H.265/HEVC 需要转码）
 * @param {string} videoPath - 视频文件路径
 * @param {string} ffmpegPath - ffmpeg 路径
 * @returns {Promise<boolean>}
 */
async function needsTranscoding(videoPath, ffmpegPath) {
  try {
    const codecs = await detectCodecs(videoPath, ffmpegPath);
    // H.265/HEVC 编码需要转码
    const needsVideoTranscode = ['hevc', 'h265', 'vp9', 'av1'].includes(codecs.videoCodec.toLowerCase());
    // AAC 是浏览器最兼容的音频格式
    const needsAudioTranscode = ['ac3', 'eac3', 'dts', 'truehd'].includes(codecs.audioCodec.toLowerCase());

    return needsVideoTranscode || needsAudioTranscode;
  } catch (error) {
    console.error(`检测编码失败 ${videoPath}:`, error.message);
    return false; // 检测失败时假设不需要转码
  }
}

/**
 * 获取转码后的文件路径
 * @param {string} videoPath - 原始视频路径
 * @returns {string}
 */
function getTranscodedPath(videoPath) {
  const filename = path.basename(videoPath, path.extname(videoPath)) + '.mp4';
  return path.join(TRANSCODED_DIR, filename);
}

/**
 * 检查转码文件是否存在且是最新的
 * @param {string} videoPath - 原始视频路径
 * @returns {boolean}
 */
function hasValidTranscodedFile(videoPath) {
  const transcodedPath = getTranscodedPath(videoPath);

  if (!fs.existsSync(transcodedPath)) {
    return false;
  }

  // 检查原始文件是否比转码文件新
  const originalStats = fs.statSync(videoPath);
  const transcodedStats = fs.statSync(transcodedPath);

  return originalStats.mtime <= transcodedStats.mtime;
}

/**
 * 转码视频为 H.264 + AAC
 * @param {string} videoPath - 原始视频路径
 * @param {string} ffmpegPath - ffmpeg 路径
 * @returns {Promise<string>} - 转码后的文件路径
 */
function transcodeVideo(videoPath, ffmpegPath = 'ffmpeg') {
  return new Promise((resolve, reject) => {
    const transcodedPath = getTranscodedPath(videoPath);

    // 如果转码文件已存在且有效，直接返回
    if (hasValidTranscodedFile(videoPath)) {
      console.log(`转码文件已存在：${transcodedPath}`);
      resolve(transcodedPath);
      return;
    }

    console.log(`开始转码：${videoPath} -> ${transcodedPath}`);

    // 设置 ffmpeg 路径
    ffmpeg.setFfmpegPath(ffmpegPath);

    ffmpeg(videoPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset medium',      // 平衡速度和质量
        '-crf 23',            // 质量因子（18-28，越小质量越高）
        '-movflags +faststart' // 优化 Web 播放
      ])
      .on('start', (commandLine) => {
        console.log(`转码命令：${commandLine}`);
      })
      .on('progress', (progress) => {
        const percent = Math.round(progress.percent || 0);
        if (percent % 10 === 0) {
          console.log(`转码进度：${percent}%`);
        }
      })
      .on('end', () => {
        console.log(`转码完成：${transcodedPath}`);
        resolve(transcodedPath);
      })
      .on('error', (err) => {
        console.error(`转码失败 ${videoPath}:`, err.message);
        reject(err);
      })
      .save(transcodedPath);
  });
}

/**
 * 获取可播放的视频路径（转码版或原版）
 * @param {string} videoPath - 原始视频路径
 * @param {string} ffmpegPath - ffmpeg 路径
 * @returns {Promise<{path: string, isTranscoded: boolean}>}
 */
async function getPlayablePath(videoPath, ffmpegPath) {
  // 初始化 ffmpeg 路径
  initFFmpeg(ffmpegPath);

  // 检查是否需要转码
  const needsTranscode = await needsTranscoding(videoPath, ffmpegPath);

  if (needsTranscode) {
    console.log(`视频需要转码：${videoPath}`);

    // 检查是否有有效的转码文件
    if (hasValidTranscodedFile(videoPath)) {
      console.log(`使用现有转码文件：${getTranscodedPath(videoPath)}`);
      return {
        path: getTranscodedPath(videoPath),
        isTranscoded: true
      };
    }

    // 同步转码（阻塞调用）
    try {
      const transcodedPath = await transcodeVideo(videoPath, ffmpegPath);
      return {
        path: transcodedPath,
        isTranscoded: true
      };
    } catch (error) {
      console.error(`转码失败，返回原始路径：${error.message}`);
      return {
        path: videoPath,
        isTranscoded: false
      };
    }
  }

  // 不需要转码，直接返回原始路径
  return {
    path: videoPath,
    isTranscoded: false
  };
}

module.exports = {
  detectCodecs,
  needsTranscoding,
  getTranscodedPath,
  hasValidTranscodedFile,
  transcodeVideo,
  getPlayablePath
};
