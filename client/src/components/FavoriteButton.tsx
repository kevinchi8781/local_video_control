import { useState } from 'react';
import { Button, Modal, App, Tag } from 'antd';
import { StarOutlined, StarFilled } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionApi, categoryApi } from '../api';
import CategorySelector from './CategorySelector';

interface FavoriteButtonProps {
  videoId: string | number;
  videoTitle: string;
  size?: 'small' | 'default' | 'large';
  onFavoriteChange?: (isFavorite: boolean) => void;
}

export default function FavoriteButton({ videoId, videoTitle, size = 'default', onFavoriteChange }: FavoriteButtonProps) {
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // 检查是否已收藏
  const { data: favoriteStatus, refetch } = useQuery({
    queryKey: ['video-favorite', String(videoId)],
    queryFn: () => collectionApi.checkFavorite(String(videoId)),
    enabled: !!videoId,
    retry: false
  });

  const isFavorite = favoriteStatus?.data?.isFavorite;

  // 收藏 mutation
  const addFavoriteMutation = useMutation({
    mutationFn: async () => {
      return collectionApi.addToFavorites(String(videoId), {
        customCategories: selectedCategories
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-favorite', String(videoId)] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['collection-videos'] });
      queryClient.invalidateQueries({ queryKey: ['custom-categories'] });
      onFavoriteChange?.(true);
    }
  });

  // 取消收藏 mutation
  const removeFavoriteMutation = useMutation({
    mutationFn: async () => {
      return collectionApi.removeFromFavorites(String(videoId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-favorite', String(videoId)] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['collection-videos'] });
      queryClient.invalidateQueries({ queryKey: ['custom-categories'] });
      onFavoriteChange?.(false);
    }
  });

  const handleQuickToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFavorite) {
      removeFavoriteMutation.mutate();
      message.success('已取消收藏');
    } else {
      setModalOpen(true);
    }
  };

  const handleConfirmFavorite = () => {
    addFavoriteMutation.mutate(undefined, {
      onSuccess: () => {
        setModalOpen(false);
        message.success('收藏成功');
        refetch();
      }
    });
  };

  return (
    <>
      <Button
        type={isFavorite ? 'primary' : 'default'}
        icon={isFavorite ? <StarFilled /> : <StarOutlined />}
        size={size}
        onClick={handleQuickToggle}
        loading={addFavoriteMutation.isPending || removeFavoriteMutation.isPending}
      >
        {isFavorite ? '已收藏' : '收藏'}
      </Button>

      <Modal
        title="添加到收藏夹"
        open={modalOpen}
        onOk={handleConfirmFavorite}
        onCancel={() => setModalOpen(false)}
        okText="确认收藏"
        cancelText="取消"
        okButtonProps={{ loading: addFavoriteMutation.isPending }}
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: 0, color: '#666' }}>视频：{videoTitle}</p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 8 }}>选择分类（可选）：</p>
          <CategorySelector
            value={selectedCategories}
            onChange={setSelectedCategories}
            multiple
            allowCreate
          />
        </div>
        {selectedCategories.length > 0 && (
          <div>
            <p style={{ marginBottom: 8 }}>已选分类：</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selectedCategories.map((cat, idx) => (
                <Tag key={idx} color="purple">{cat}</Tag>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
