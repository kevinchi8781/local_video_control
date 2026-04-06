import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { folderApi, videoApi, historyApi } from '../api';
import FolderTree from '../components/FolderTree';
import VideoGrid from '../components/VideoGrid';
import { Row, Col, Card, Input, Pagination, Select, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

interface FolderNode {
  id: string;
  label: string;
  path: string;
  isRoot: boolean;
  videoCount: number;
  hasChildren: boolean;
  selectable: boolean;
}

export default function HomePage() {
  const [selectedFolder, setSelectedFolder] = useState<FolderNode | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('filename');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const queryClient = useQueryClient();

  // 监听全局刷新事件
  useEffect(() => {
    const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    };
    window.addEventListener('videos-refresh', handleRefresh);
    return () => window.removeEventListener('videos-refresh', handleRefresh);
  }, [queryClient]);

  const { data: foldersData } = useQuery({
    queryKey: ['folders'],
    queryFn: folderApi.getRootFolders
  });

  const { data: videosData, isLoading } = useQuery({
    queryKey: ['videos', { page, limit, folderPath: selectedFolder?.path, search, sortBy, sortOrder }],
    queryFn: () => videoApi.getVideos({
      page,
      limit,
      folderPath: selectedFolder?.path || undefined,
      search: search || undefined,
      sortBy,
      sortOrder
    })
  });

  const { data: historyData } = useQuery({
    queryKey: ['history'],
    queryFn: () => historyApi.getHistory(5)
  });

  const folders = foldersData?.data?.data || [];
  const videos = videosData?.data?.data?.videos || [];
  const pagination = videosData?.data?.data?.pagination || { total: 0, page: 1, limit: 50, totalPages: 0 };
  const history = historyData?.data?.data || [];

  const handleFolderSelect = (folder: FolderNode) => {
    setSelectedFolder(folder);
    setPage(1); // 切换文件夹时重置页码
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handlePageChange = (newPage: number, newLimit?: number) => {
    setPage(newPage);
    if (newLimit && newLimit !== limit) {
      setLimit(newLimit);
      setPage(1);
    }
  };

  return (
    <Row gutter={[16, 16]}>
      <Col span={6}>
        <Card title="文件夹导航" style={{ height: 'calc(100vh - 160px)', overflow: 'auto' }}>
          <FolderTree onFolderSelect={handleFolderSelect} />
        </Card>
      </Col>
      <Col span={18}>
        <Card
          title={selectedFolder ? `视频库 - ${selectedFolder.label}` : '视频库'}
          extra={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Pagination
                current={page}
                total={pagination.total}
                pageSize={limit}
                showSizeChanger
                pageSizeOptions={['20', '50', '100']}
                onChange={handlePageChange}
                showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
                size="small"
              />
              <Input
                placeholder="搜索视频..."
                prefix={<SearchOutlined />}
                style={{ width: 200 }}
                onChange={(e) => handleSearch(e.target.value)}
                allowClear
              />
              <Select
                value={sortBy}
                onChange={(value) => setSortBy(value)}
                style={{ width: 120 }}
                options={[
                  { label: '文件名', value: 'filename' },
                  { label: '时长', value: 'duration' },
                  { label: '大小', value: 'size' },
                  { label: '添加时间', value: 'created' }
                ]}
              />
              <Select
                value={sortOrder}
                onChange={(value) => setSortOrder(value)}
                style={{ width: 100 }}
                options={[
                  { label: '升序', value: 'asc' },
                  { label: '降序', value: 'desc' }
                ]}
              />
            </div>
          }
        >
          {isLoading ? <Spin /> : <VideoGrid videos={videos} onVideoDeleted={() => {
            queryClient.invalidateQueries({ queryKey: ['videos'] });
            queryClient.invalidateQueries({ queryKey: ['folders'] });
          }} />}
        </Card>
        {!isLoading && pagination.total > 0 && (
          <Card style={{ marginTop: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <Pagination
                current={page}
                total={pagination.total}
                pageSize={limit}
                showSizeChanger
                pageSizeOptions={['20', '50', '100']}
                onChange={handlePageChange}
                showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
              />
            </div>
          </Card>
        )}
      </Col>
      {history.length > 0 && (
        <Col span={24}>
          <Card title="继续观看">
            <VideoGrid videos={history.map(h => ({
              id: h.videoId,
              filename: h.filename,
              thumbnailPath: h.thumbnailPath,
              durationSeconds: h.durationSeconds,
              progressSeconds: h.progressSeconds
            }))} onVideoDeleted={() => {
              queryClient.invalidateQueries({ queryKey: ['videos'] });
              queryClient.invalidateQueries({ queryKey: ['history'] });
            }} />
          </Card>
        </Col>
      )}
    </Row>
  );
}
