const express = require('express');
const cors = require('cors');
const path = require('path');

// 初始化数据库
require('./db/init');

const configRoutes = require('./routes/config');
const folderRoutes = require('./routes/folders');
const videoRoutes = require('./routes/videos');
const historyRoutes = require('./routes/history');
const scanRoutes = require('./routes/scan');
const collectionRoutes = require('./routes/collections');
const categoryRoutes = require('./routes/categories');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务（缩略图）
app.use('/thumbnails', express.static(path.join(__dirname, '../thumbnails')));

// API 路由
app.use('/api/config', configRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/categories', categoryRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
});
