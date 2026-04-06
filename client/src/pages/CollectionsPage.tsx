import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Row, Col, Input, Pagination, Spin, Tag, Typography, Empty, Tree, Button } from 'antd';
import { SearchOutlined, FolderOutlined, DeleteOutlined, HomeOutlined } from '@ant-design/icons';
import { collectionApi, categoryApi } from '../api';
import VideoPlayerModal from '../components/VideoPlayerModal';
import FavoriteButton from '../components/FavoriteButton';

const { Text } = Typography;

interface CollectionVideo {
  id: string;
  path: string;
  filename: string;
  durationSeconds: number;
  thumbnailPath: string | null;
  customCategories: string[];
  favoritedAt: string;
}

interface CategoryNode {
  id: number;
  name: string;
  children?: CategoryNode[];
  hasChildren?: boolean;
}

export default function CollectionsPage() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<CollectionVideo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const limit = 50;
  const queryClient = useQueryClient();

  // 获取默认收藏夹（选择 createdAt 最早的）
  const { data: collectionsData } = useQuery({
    queryKey: ['collections'],
    queryFn: () => collectionApi.getAll()
  });

  const collections = collectionsData?.data?.data || [];
  const defaultCollectionId = collections?.[0]?.id;

  // 获取分类树
  const { data: categoriesData } = useQuery({
    queryKey: ['categories-tree'],
    queryFn: () => categoryApi.getTree()
  });

  // 获取所有使用过的分类（包括自定义）
  const { data: customCategoriesData } = useQuery({
    queryKey: ['custom-categories'],
    queryFn: () => collectionApi.getAllCategories()
  });

  // 获取每个分类的视频数量
  const { data: categoryCountsData } = useQuery({
    queryKey: ['category-counts', defaultCollectionId],
    queryFn: () => collectionApi.getCategoryCounts(),
    enabled: !!defaultCollectionId
  });

  const systemCategories = categoriesData?.data?.data || [];
  const customCategories = customCategoriesData?.data?.data || [];
  const categoryCounts = categoryCountsData?.data?.data || {};
  // 合并系统分类和自定义分类，去重
  const allCategoryNames = [...new Set([
    ...systemCategories.map((c: any) => c.name),
    ...customCategories
  ])];

  // 获取收藏视频列表
  const { data: videosData, isLoading, refetch } = useQuery({
    queryKey: ['collection-videos', defaultCollectionId, page, limit, selectedCategory, search],
    queryFn: () => defaultCollectionId ? collectionApi.getVideos(defaultCollectionId, {
      page,
      limit,
      categoryId: selectedCategory || undefined,
      search: search || undefined
    }) : null,
    enabled: !!defaultCollectionId
  });

  const videos: CollectionVideo[] = videosData?.data?.data?.videos || [];
  const pagination = videosData?.data?.data?.pagination || { total: 0, page: 1, limit: 50 };

  const handleVideoClick = (video: CollectionVideo) => {
    setSelectedVideo(video);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedVideo(null), 300);
  };

  const handleRemoveFavorite = async (videoId: string) => {
    if (!defaultCollectionId) return;
    await collectionApi.removeVideo(defaultCollectionId, videoId);
    queryClient.invalidateQueries({ queryKey: ['collection-videos'] });
    refetch();
  };

  // 渲染分类树
  const renderCategoryTree = (categories: CategoryNode[]): any[] => {
    if (!Array.isArray(categories)) return [];
    return categories.map(cat => ({
      title: `${cat.name} ${categoryCounts[cat.name] ? `(${categoryCounts[cat.name]})` : ''}`,
      key: cat.name,
      icon: <FolderOutlined />,
      children: cat.children ? renderCategoryTree(cat.children) : []
    }));
  };

  const categoryTreeData = [
    {
      title: `全部分类 ${videosData?.data?.data?.pagination?.total ? `(${videosData.data.data.pagination.total})` : ''}`,
      key: 'all',
      icon: <FolderOutlined />,
      children: allCategoryNames.map(name => ({
        title: `${name} ${categoryCounts[name] ? `(${categoryCounts[name]})` : ''}`,
        key: name,
        icon: <FolderOutlined />
      }))
    }
  ];

  // 默认展开所有节点
  const defaultExpandedKeys = ['all', ...allCategoryNames];

  return (
    <>
      <Row gutter={[16, 16]}>
        {/* 左侧分类导航 */}
        <Col span={6}>
          <Card title="分类筛选" style={{ minHeight: 'calc(100vh - 160px)', overflow: 'auto' }}>
            <Tree
              showIcon
              defaultExpandAll
              autoExpandParent
              expandedKeys={defaultExpandedKeys}
              selectedKeys={[selectedCategory || 'all']}
              onSelect={(keys) => setSelectedCategory(keys[0] as string)}
              treeData={categoryTreeData}
            />
          </Card>
        </Col>

        {/* 右侧视频列表 */}
        <Col span={18}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>我的收藏</span>
                <Button
                  type="text"
                  icon={<HomeOutlined />}
                  onClick={() => navigate('/')}
                  size="small"
                  title="返回首页"
                >
                  首页
                </Button>
              </div>
            }
            extra={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Pagination
                  current={page}
                  total={pagination.total}
                  pageSize={limit}
                  showSizeChanger
                  onChange={setPage}
                  size="small"
                />
                <Input
                  placeholder="搜索收藏..."
                  prefix={<SearchOutlined />}
                  style={{ width: 200 }}
                  onChange={(e) => setSearch(e.target.value)}
                  allowClear
                />
              </div>
            }
          >
            {isLoading ? (
              <Spin />
            ) : videos.length === 0 ? (
              <Empty description="暂无收藏" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {videos.map((video) => (
                  <Card
                    key={video.id}
                    hoverable
                    cover={
                      <div
                        style={{
                          height: 160,
                          background: '#000',
                          position: 'relative',
                          cursor: 'pointer'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVideoClick(video);
                        }}
                      >
                        {video.thumbnailPath ? (
                          <img
                            src={`http://localhost:3001/thumbnails/${video.thumbnailPath.replace('/thumbnails/', '')}`}
                            alt={video.filename}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: '#666'
                          }}>
                            <FolderOutlined style={{ fontSize: 48 }} />
                          </div>
                        )}
                        <Button
                          type="primary"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            zIndex: 10,
                            opacity: 0,
                            transition: 'opacity 0.2s'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFavorite(video.id);
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                        />
                      </div>
                    }
                    actions={[
                      <FavoriteButton
                        key="fav"
                        videoId={video.id}
                        videoTitle={video.filename}
                        size="small"
                        onFavoriteChange={(isFav) => {
                          if (!isFav) refetch();
                        }}
                      />
                    ]}
                  >
                    <Card.Meta
                      title={
                        <Text ellipsis style={{ fontSize: 14 }} title={video.filename}>
                          {video.filename}
                        </Text>
                      }
                      description={
                        <div>
                          <Text
                            type="secondary"
                            ellipsis
                            style={{ fontSize: 11, display: 'block', maxWidth: '100%' }}
                            title={video.path}
                          >
                            {video.path}
                          </Text>
                          {video.customCategories && video.customCategories.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              {video.customCategories.map((cat, idx) => (
                                <Tag key={idx} color="purple" style={{ fontSize: 10, marginBottom: 4, marginRight: 4 }}>
                                  {cat}
                                </Tag>
                              ))}
                            </div>
                          )}
                        </div>
                      }
                    />
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <VideoPlayerModal
        video={selectedVideo}
        open={isModalOpen}
        onClose={handleClose}
        onVideoDeleted={() => {
          refetch();
        }}
      />
    </>
  );
}
