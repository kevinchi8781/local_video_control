# Local Video Panel Manager

A Node.js + React based local video file management tool, supporting folder binding, tree navigation, thumbnail preview, video playback, and progress tracking.

## Quick Start

> Want to get started quickly? Follow the steps below:

```bash
# 1. Make sure Node.js 18+ and FFmpeg are installed

# 2. Install backend dependencies and start
cd server
npm install
npm run dev          # Backend runs on http://localhost:3001

# 3. Open a new terminal, install frontend dependencies and start
cd ../client
npm install
npm run dev          # Frontend runs on http://localhost:5173

# 4. Open browser and visit http://localhost:5173
# 5. Bind video folder in settings page
# 6. Click "Scan Video Library" button
# 7. Start browsing and playing videos
```

## Features

- **Folder Binding**: Bind multiple local folders as video sources
- **Tree Navigation**: Left-side folder hierarchy display with lazy loading
- **Video Scanning**: Automatically scan bound folders and recognize common video formats (mp4, mkv, avi, webm, etc.)
- **Thumbnail Generation**: Use ffmpeg to capture video keyframes as covers
- **Video Playback**: Built-in player supporting streaming, seeking, and progress tracking
- **Search & Filter**: Search by filename, filter by category
- **Watch History**: Record recent playback and support resume watching

## Tech Stack

**Backend:**
- Node.js + Express
- sql.js (SQLite JavaScript implementation)
- fluent-ffmpeg (video processing)

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Ant Design (UI components)
- TanStack Query (data fetching)
- React Router (routing)

## System Requirements

- Node.js 18+
- FFmpeg (for video duration extraction and thumbnail generation)

## Installation

### 1. Install FFmpeg

Windows users can use one of the following methods:

**Method A: Use existing ffmpeg**
If you already have ffmpeg (e.g., `E:\AI\claude-code-sound\ffmpeg-8.1-full_build\bin\ffmpeg.exe`), just configure the path in app settings.

**Method B: Download ffmpeg**
1. Visit https://www.gyan.dev/ffmpeg/builds/
2. Download release-full.zip
3. After extracting, add the `bin` folder path to system environment variable PATH

### 2. Install Backend Dependencies

```bash
cd server
npm install
```

### 3. Initialize Database

```bash
npm run init-db
```

### 4. Start Backend

```bash
npm run dev
```

The backend will run on `http://localhost:3001`

### 5. Install Frontend Dependencies

```bash
cd ../client
npm install
```

### 6. Start Frontend

```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## Usage

1. **Bind Folder**:
   - Visit settings page (`/settings`)
   - Enter video folder path (e.g., `D:\Videos`)
   - Click "Add" button

2. **Configure FFmpeg** (Optional):
   - Enter ffmpeg path in settings page
   - If not configured, defaults to ffmpeg in system PATH

3. **Scan Videos**:
   - Click "Scan Video Library" button on home page
   - Wait for scan to complete, videos will appear in the list

4. **Browse Videos**:
   - Click folders in left tree navigation to view corresponding videos
   - Click video card to enter playback page

5. **Play Videos**:
   - Supports play/pause, progress seeking
   - Automatically records playback progress
   - Resume watching next time you open

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/config | Get configuration |
| POST | /api/config | Save configuration |
| POST | /api/config/folder | Add folder binding |
| DELETE | /api/config/folder/:id | Remove folder binding |
| GET | /api/folders | Get root folder list |
| GET | /api/folders/:id/children | Get child folders |
| GET | /api/videos | Get video list (supports pagination, search, filter) |
| GET | /api/videos/:id | Get video details |
| GET | /api/videos/:id/stream | Video stream |
| POST | /api/videos/:id/progress | Report playback progress |
| GET | /api/history | Get playback history |
| GET | /api/history/continue | Get resume watching list |
| POST | /api/scan | Execute scan |

## Project Structure

```
videoBoard/
├── server/                 # Backend code
│   ├── src/
│   │   ├── db/            # Database related
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business services
│   │   └── index.js       # Entry file
│   ├── data/              # Database and config files
│   ├── thumbnails/        # Thumbnail cache
│   └── package.json
├── client/                # Frontend code
│   ├── src/
│   │   ├── api/          # API client
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   └── App.tsx       # App entry
│   └── package.json
└── README.md
```

## Development Notes

- Backend port: 3001
- Frontend port: 5173
- Database location: `server/data/videos.db`
- Config file: `server/data/config.json`
- Thumbnail cache: `server/thumbnails/`

## Notes

1. First scan of a large number of videos may take a long time
2. Thumbnail generation depends on ffmpeg, please ensure it's correctly installed
3. Video path changes may cause thumbnails to become invalid
4. Recommended to regularly clean up unused thumbnail cache

## License

MIT
