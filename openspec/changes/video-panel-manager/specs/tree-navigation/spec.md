## ADDED Requirements

### Requirement: 生成文件夹树形结构 API
后端提供接口返回层级化的文件夹结构供前端渲染树形导航。

#### Scenario: 获取根节点列表
- **WHEN** 前端请求 `GET /api/folders`
- **THEN** 系统返回所有绑定文件夹作为根节点

#### Scenario: 懒加载子节点
- **WHEN** 前端请求 `GET /api/folders/:id/children`
- **THEN** 系统返回该文件夹下的子文件夹列表（不包含视频文件）

#### Scenario: 节点包含视频数量
- **WHEN** 返回文件夹节点
- **THEN** 每个节点包含该文件夹及子文件夹内的视频总数

#### Scenario: 处理空文件夹
- **WHEN** 文件夹下无子文件夹且无视频
- **THEN** 系统返回空数组，前端显示为空节点

### Requirement: 前端树形导航交互
前端使用 Ant Design Tree 组件渲染可展开的文件夹树。

#### Scenario: 点击文件夹节点
- **WHEN** 用户点击树形节点
- **THEN** 右侧面板加载该文件夹下的视频列表

#### Scenario: 展开/收起子节点
- **WHEN** 用户点击节点展开图标
- **THEN** 前端发起 API 请求加载子节点，动态渲染

#### Scenario: 高亮当前选中节点
- **WHEN** 用户选中某个文件夹
- **THEN** 该节点在树中高亮显示
