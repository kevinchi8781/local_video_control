# 本地视频面板管理器

一个基于 Node.js + React 的本地视频文件管理工具，支持文件夹绑定、树形导航、缩略图预览、视频播放和进度记录。

## 功能特性

- **文件夹绑定**: 绑定多个本地文件夹作为视频源
- **树形导航**: 左侧展示文件夹层级结构，支持懒加载
- **视频扫描**: 自动扫描绑定文件夹，识别常见视频格式（mp4、mkv、avi、webm 等）
- **缩略图生成**: 使用 ffmpeg 截取视频关键帧作为封面
- **视频播放**: 内嵌播放器，支持流式传输、Seek、进度记录
- **搜索过滤**: 按文件名搜索、按分类过滤
- **观看历史**: 记录最近播放，支持继续观看

## 技术栈

**后端:**
- Node.js + Express
- sql.js (SQLite JavaScript 实现)
- fluent-ffmpeg (视频处理)

**前端:**
- React 18 + TypeScript
- Vite (构建工具)
- Ant Design (UI 组件)
- TanStack Query (数据获取)
- React Router (路由)

## 系统要求

- Node.js 18+
- FFmpeg (用于视频时长提取和缩略图生成)

## 安装步骤

### 1. 安装 FFmpeg

Windows 用户可以使用以下方式之一：

**方式 A: 使用已有的 ffmpeg**
如果你已经有 ffmpeg（如 `E:\AI\claude-code-sound\ffmpeg-8.1-full_build\bin\ffmpeg.exe`），在应用设置中配置路径即可。

**方式 B: 下载 ffmpeg**
1. 访问 https://www.gyan.dev/ffmpeg/builds/
2. 下载 release-full.zip
3. 解压后将 `bin` 文件夹路径添加到系统环境变量 PATH

### 2. 安装后端依赖

```bash
cd server
npm install
```

### 3. 初始化数据库

```bash
npm run init-db
```

### 4. 启动后端

```bash
npm run dev
```

后端将运行在 `http://localhost:3001`

### 5. 安装前端依赖

```bash
cd ../client
npm install
```

### 6. 启动前端

```bash
npm run dev
```

前端将运行在 `http://localhost:5173`

## 使用说明

1. **绑定文件夹**:
   - 访问设置页面 (`/settings`)
   - 输入视频文件夹路径（如 `D:\Videos`）
   - 点击"添加"按钮

2. **配置 FFmpeg** (可选):
   - 在设置页面输入 ffmpeg 路径
   - 如不配置，默认使用系统 PATH 中的 ffmpeg

3. **扫描视频**:
   - 在首页点击"扫描视频库"按钮
   - 等待扫描完成，视频将出现在列表中

4. **浏览视频**:
   - 左侧树形导航点击文件夹查看对应视频
   - 点击视频卡片进入播放页面

5. **播放视频**:
   - 支持播放/暂停、进度拖拽
   - 自动记录播放进度
   - 下次打开可继续观看

## API 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/config | 获取配置 |
| POST | /api/config | 保存配置 |
| POST | /api/config/folder | 添加文件夹绑定 |
| DELETE | /api/config/folder/:id | 删除文件夹绑定 |
| GET | /api/folders | 获取根文件夹列表 |
| GET | /api/folders/:id/children | 获取子文件夹 |
| GET | /api/videos | 获取视频列表（支持分页、搜索、过滤） |
| GET | /api/videos/:id | 获取视频详情 |
| GET | /api/videos/:id/stream | 视频流 |
| POST | /api/videos/:id/progress | 上报播放进度 |
| GET | /api/history | 获取播放历史 |
| GET | /api/history/continue | 获取继续观看列表 |
| POST | /api/scan | 执行扫描 |

## 项目结构

```
videoBoard/
├── server/                 # 后端代码
│   ├── src/
│   │   ├── db/            # 数据库相关
│   │   ├── routes/        # API 路由
│   │   ├── services/      # 业务服务
│   │   └── index.js       # 入口文件
│   ├── data/              # 数据库和配置文件
│   ├── thumbnails/        # 缩略图缓存
│   └── package.json
├── client/                # 前端代码
│   ├── src/
│   │   ├── api/          # API 客户端
│   │   ├── components/   # React 组件
│   │   ├── pages/        # 页面组件
│   │   └── App.tsx       # 应用入口
│   └── package.json
└── README.md
```

## 开发说明

- 后端端口：3001
- 前端端口：5173
- 数据库位置：`server/data/videos.db`
- 配置文件：`server/data/config.json`
- 缩略图缓存：`server/thumbnails/`

## 注意事项

1. 首次扫描大量视频可能需要较长时间
2. 缩略图生成依赖 ffmpeg，请确保正确安装
3. 视频路径变更可能导致缩略图失效
4. 建议定期清理无用的缩略图缓存

## License

MIT
