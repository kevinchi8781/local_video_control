import { Modal, Spin, Button, App, Popconfirm } from 'antd';
import {
  CloseOutlined,
  DeleteOutlined,
  VideoCameraOutlined
} from '@ant-design/icons';
import { useState, useRef, useEffect } from 'react';
import Artplayer from 'artplayer';

interface VideoPlayerModalProps {
  video: {
    id: string | number;
    filename: string;
    durationSeconds?: number | null;
  } | null;
  open: boolean;
  onClose: () => void;
  onVideoDeleted?: () => void;
}

export default function VideoPlayerModal({ video, open, onClose, onVideoDeleted }: VideoPlayerModalProps) {
  const { message } = App.useApp();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const artplayerContainerRef = useRef<HTMLDivElement>(null);
  const artplayerRef = useRef<Artplayer | null>(null);

  // Use useEffect with delay to allow Ant Design Modal portal to mount
  useEffect(() => {
    if (!video || !open) {
      return;
    }

    // Wait for portal to mount
    const timer = setTimeout(() => {
      const container = artplayerContainerRef.current;
      if (!container) {
        console.error('Artplayer container not found - Modal portal may not have mounted');
        return;
      }

      // 清理旧的实例
      if (artplayerRef.current) {
        artplayerRef.current.destroy();
        artplayerRef.current = null;
      }

      const streamUrl = `http://localhost:3001/api/videos/${video.id}/stream`;
      setIsLoading(true);
      setPlaybackError(null);

      const art = new Artplayer({
        container: container,
        url: streamUrl,
        autoplay: true,
        theme: '#722ed1',
        playbackRate: true,
        hotkey: true,
        pip: true,
        fullscreen: true,
        setting: true,
        type: 'auto',
        // 添加自定义按钮到控制栏
        layers: [
          {
            name: 'PotPlayer',
            position: 'right',
            html: '<div style="color:#fff;cursor:pointer;padding:0 10px;">📺 PotPlayer</div>',
            click: () => {
              handleSwitchToPotPlayer();
            },
            tooltip: '用 PotPlayer 播放',
          },
        ],
      });

      artplayerRef.current = art;

      // 监听视频元素
      art.on('ready', () => {
        const video = art.video;

        video.addEventListener('waiting', () => {
          setIsLoading(true);
        });

        video.addEventListener('playing', () => {
          setIsLoading(false);
        });
      });

      // 监听错误
      art.on('error', (err: unknown) => {
        console.error('ArtPlayer error:', err);
        setIsLoading(false);
        setPlaybackError('视频无法播放，请使用 PotPlayer');
      });

      // 监听 canplay
      art.on('canplay', () => {
        setIsLoading(false);
      });
    }, 0);

    return () => {
      clearTimeout(timer);
      if (artplayerRef.current) {
        artplayerRef.current.destroy();
      }
    };
  }, [video?.id, open, onClose]);

  // 关闭时重置状态并清理 ArtPlayer
  useEffect(() => {
    if (!open) {
      setIsFullscreen(false);
      if (artplayerRef.current) {
        artplayerRef.current.pause();
      }
    }
  }, [open]);

  // 全屏监听
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // 键盘快捷键
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          onClose();
        }
        return;
      }
      // ArtPlayer 已内置空格和方向键支持，这里不需要重复实现
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleDelete = async () => {
    if (!video?.id) return;

    try {
      const res = await fetch(`http://localhost:3001/api/videos/${video.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        message.success('视频已删除到回收站');
        onClose();
        onVideoDeleted?.();
      } else {
        message.error('删除失败：' + data.error);
      }
    } catch (err) {
      console.error('HandleDelete error:', err);
      message.error('删除失败');
    }
  };

  const handleSwitchToPotPlayer = async () => {
    if (!video?.id) return;

    try {
      const res = await fetch(`http://localhost:3001/api/videos/${video.id}/play-local`);
      const data = await res.json();
      if (data.success) {
        message.success('正在调用 PotPlayer 播放...');
        // 关闭浏览器播放器
        setTimeout(() => onClose(), 500);
      } else {
        message.error('调用 PotPlayer 失败');
      }
    } catch (err) {
      console.error('HandleSwitchToPotPlayer error:', err);
      message.error('调用 PotPlayer 失败');
    }
  };

  if (!video) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="90vw"
      style={{ maxWidth: '1200px' }}
      styles={{ body: { padding: 0, background: '#000' } }}
      closeIcon={null}
      mask={{ closable: false }}
      styles={{
        body: { padding: 0, background: '#000' },
        header: { background: '#141414', borderBottom: '1px solid #303030', padding: '12px 24px' }
      }}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontSize: 16 }}>{video.filename}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              icon={<VideoCameraOutlined />}
              onClick={() => handleSwitchToPotPlayer()}
              size="small"
              style={{ background: '#722ed1', borderColor: '#722ed1', color: '#fff' }}
            >
              PotPlayer
            </Button>
            <Popconfirm
              title="确定要删除这个视频吗？"
              onConfirm={handleDelete}
              okText="确定"
              cancelText="取消"
              placement="left"
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                size="small"
              >
                删除
              </Button>
            </Popconfirm>
            <Button
              icon={<CloseOutlined />}
              onClick={onClose}
              size="small"
              style={{ marginLeft: 8 }}
            >
              关闭
            </Button>
          </div>
        </div>
      }
    >
      <div
        ref={playerContainerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: isFullscreen ? '100vh' : 'calc(90vw * 9 / 16)',
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {isLoading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10
          }}>
            <Spin size="large" />
          </div>
        )}

        {playbackError && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            color: '#fff',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: 16, marginBottom: 16 }}>{playbackError}</p>
            <Button
              type="primary"
              icon={<VideoCameraOutlined />}
              onClick={() => handleSwitchToPotPlayer()}
              size="large"
            >
              使用 PotPlayer 播放
            </Button>
          </div>
        )}

        {/* ArtPlayer container */}
        <div
          ref={artplayerContainerRef}
          style={{
            width: '100%',
            height: '100%'
          }}
        />

        {isFullscreen && (
          <div
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              zIndex: 1000,
              background: 'rgba(0,0,0,0.6)',
              borderRadius: '50%',
              padding: 8,
              cursor: 'pointer'
            }}
          >
            <CloseOutlined style={{ color: '#fff', fontSize: 24 }} />
          </div>
        )}
      </div>
    </Modal>
  );
}
