## ADDED Requirements

### Requirement: 视频流式传输支持 Range 请求
后端提供视频流接口，支持 HTTP Range 头实现 Seek 功能。

#### Scenario: 返回视频流
- **WHEN** 前端请求 `GET /api/videos/:id/stream`
- **THEN** 系统使用 `fs.createReadStream` 返回视频文件流

#### Scenario: 处理 Range 请求头
- **WHEN** 请求头包含 `Range: bytes=0-1048575`
- **THEN** 系统返回 206 Partial Content，仅传输指定字节范围

#### Scenario: 支持大文件传输
- **WHEN** 视频文件大于 1GB
- **THEN** 系统使用流式传输，不一次性加载到内存

### Requirement: 记录视频播放进度
系统记录用户观看进度，支持继续观看。

#### Scenario: 记录播放位置
- **WHEN** 视频播放中，前端定时上报播放进度
- **THEN** 系统保存最后播放位置（秒）到数据库

#### Scenario: 继续观看
- **WHEN** 用户再次播放已有进度的视频
- **THEN** 系统从上次结束位置开始播放

#### Scenario: 进度归零
- **WHEN** 视频播放完成（>95%）
- **THEN** 系统清除播放进度，标记为"已观看"

### Requirement: 最近播放列表
系统展示用户最近播放的视频列表。

#### Scenario: 记录播放历史
- **WHEN** 用户开始播放视频
- **THEN** 系统在 `watch_history` 表记录视频 ID 和开始时间

#### Scenario: 获取最近播放
- **WHEN** 前端请求 `GET /api/history`
- **THEN** 系统返回最近 50 条播放记录，按时序降序
