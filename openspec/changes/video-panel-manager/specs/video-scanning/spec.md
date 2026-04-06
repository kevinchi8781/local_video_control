## ADDED Requirements

### Requirement: 系统递归扫描绑定文件夹识别视频文件
系统遍历所有绑定文件夹及其子目录，识别常见视频格式。

#### Scenario: 扫描一级文件夹
- **WHEN** 用户触发扫描绑定文件夹
- **THEN** 系统遍历该路径下所有子目录

#### Scenario: 识别视频文件格式
- **WHEN** 扫描到文件扩展名为 .mp4, .mkv, .avi, .webm, .mov, .flv, .wmv
- **THEN** 系统标记为视频文件，提取元数据

#### Scenario: 忽略非视频文件
- **WHEN** 扫描到非视频文件（如.txt, .jpg）
- **THEN** 系统跳过该文件，不存入数据库

#### Scenario: 扫描深层嵌套目录
- **WHEN** 文件夹包含多层子目录（如 /Movies/Action/2024/）
- **THEN** 系统递归遍历所有层级，正确记录完整路径

### Requirement: 提取视频元数据存入数据库
系统从视频文件中提取关键信息并存储。

#### Scenario: 提取基础元数据
- **WHEN** 发现新视频文件
- **THEN** 系统提取文件名、文件大小、文件路径、扩展名

#### Scenario: 提取视频时长
- **WHEN** 使用 ffprobe 分析视频文件
- **THEN** 系统获取视频时长（秒），存入数据库

#### Scenario: 增量扫描避免重复
- **WHEN** 扫描已存在的视频文件
- **THEN** 系统比对文件路径和修改时间，未变化则跳过

#### Scenario: 记录扫描状态
- **WHEN** 扫描完成
- **THEN** 系统在数据库更新 `scanned_at` 时间戳
