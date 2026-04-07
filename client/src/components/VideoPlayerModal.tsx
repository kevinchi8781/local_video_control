import { Modal, Spin, Slider, Button, App, Popconfirm } from 'antd';
import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  ExpandOutlined,
  CloseOutlined,
  SoundOutlined,
  FullscreenExitOutlined,
  DeleteOutlined,
  VideoCameraOutlined
} from '@ant-design/icons';
import { useState, useRef, useEffect, useCallback } from 'react';
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const artplayerContainerRef = useRef<HTMLDivElement>(null);
  const artplayerRef = useRef<Artplayer | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const [showControls, setShowControls] = useState(true);

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
        locked: true, // 隐藏默认播放按钮，使用自定义控制栏
        miniProgressBar: false,
      });

      artplayerRef.current = art;

      // 监听播放事件
      art.on('play', () => {
        setIsPlaying(true);
        setIsLoading(false);
      });

      art.on('pause', () => {
        setIsPlaying(false);
      });

      // 监听视频元素
      art.on('ready', () => {
        const video = art.video;
        setDuration(video.duration);

        video.addEventListener('timeupdate', () => {
          setCurrentTime(video.currentTime);
        });

        video.addEventListener('waiting', () => {
          setIsLoading(true);
        });

        video.addEventListener('playing', () => {
          setIsLoading(false);
          setIsPlaying(true);
        });

        video.addEventListener('ended', () => {
          setIsPlaying(false);
          setCurrentTime(0);
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
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [video?.id, open, onClose]);

  // 关闭时重置状态并清理 ArtPlayer
  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setCurrentTime(0);
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

  const togglePlay = () => {
    if (!artplayerRef.current) return;

    if (artplayerRef.current.playing) {
      artplayerRef.current.pause();
      setIsPlaying(false);
    } else {
      artplayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (value: number) => {
    if (artplayerRef.current) {
      artplayerRef.current.seek = value;
      setCurrentTime(value);
    }
  };

  const toggleMute = () => {
    if (!artplayerRef.current) return;

    artplayerRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = useCallback((value: number) => {
    if (artplayerRef.current) {
      artplayerRef.current.volume = value;
      setVolume(value);
      setIsMuted(value === 0);
    }
  }, []);

  const toggleFullscreen = () => {
    if (!artplayerRef.current) return;

    // 使用 ArtPlayer 的全屏 API
    artplayerRef.current.fullscreen = !artplayerRef.current.fullscreen;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 2000);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

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

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!artplayerRef.current) return;

    const rect = playerContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const third = rect.width / 3;

    if (x < third) {
      // 左侧三分之一 - 快退 10 秒
      artplayerRef.current.seek = Math.max(0, artplayerRef.current.currentTime - 10);
    } else if (x > 2 * third) {
      // 右侧三分之一 - 快进 10 秒
      artplayerRef.current.seek = Math.min(duration, artplayerRef.current.currentTime + 10);
    } else {
      // 中间三分之一 - 切换播放暂停
      togglePlay();
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
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        onClick={handleContainerClick}
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
              cursor: 'pointer',
              display: showControls ? 'block' : 'none',
              transition: 'opacity 0.3s'
            }}
          >
            <CloseOutlined style={{ color: '#fff', fontSize: 24 }} />
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: showControls ? 'linear-gradient(transparent, rgba(0,0,0,0.8))' : 'transparent',
            padding: showControls ? '16px' : '0',
            transition: 'opacity 0.3s',
            opacity: showControls ? 1 : 0,
            pointerEvents: showControls ? 'auto' : 'none',
            zIndex: 100
          }}
        >
          <Slider
            key="progress-slider"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            style={{ marginBottom: 8 }}
            trackStyle={{ background: '#722ed1' }}
            handleStyle={{ borderColor: '#722ed1' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button
                type="text"
                size="large"
                icon={isPlaying ? <PauseCircleOutlined style={{ fontSize: 32 }} /> : <PlayCircleOutlined style={{ fontSize: 32 }} />}
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                style={{ color: '#fff' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Button
                  type="text"
                  icon={isMuted || volume === 0 ? <SoundOutlined style={{ color: '#ff4d4f' }} /> : <SoundOutlined />}
                  onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                  style={{ color: '#fff' }}
                />
                <Slider
                  key="volume-slider"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  style={{ width: 80 }}
                  trackStyle={{ background: '#722ed1' }}
                  handleStyle={{ borderColor: '#722ed1' }}
                />
              </div>
              <span style={{ color: '#fff', fontSize: 14, minWidth: 120 }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button
                type="text"
                icon={<VideoCameraOutlined />}
                onClick={(e) => { e.stopPropagation(); handleSwitchToPotPlayer(); }}
                style={{ color: '#fff' }}
                title="用 PotPlayer 播放"
              />
              <Popconfirm
                title="确定要删除这个视频吗？"
                description="视频将被移动到回收站"
                onConfirm={handleDelete}
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onOpenChange={(visible) => {
                  if (visible) {
                    // 暂停视频
                    if (artplayerRef.current && isPlaying) {
                      artplayerRef.current.pause();
                    }
                  }
                }}
              >
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  style={{ color: '#ff4d4f' }}
                  title="删除视频"
                />
              </Popconfirm>
              <span style={{ color: '#fff', fontSize: 12, maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={video.filename}>
                {video.filename}
              </span>
              <Button
                type="text"
                icon={isFullscreen ? <FullscreenExitOutlined /> : <ExpandOutlined />}
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                style={{ color: '#fff' }}
                title={isFullscreen ? '退出全屏 (ESC)' : '全屏 (双击)'}
              />
              {!isFullscreen && (
                <Button
                  type="text"
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  style={{ color: '#fff' }}
                  icon={<CloseOutlined />}
                  title="关闭 (ESC)"
                />
              )}
            </div>
          </div>
        </div>

        {!isPlaying && !isLoading && !playbackError && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 50
            }}
          >
            <PlayCircleOutlined style={{ fontSize: 80, color: 'rgba(255,255,255,0.8)' }} />
          </div>
        )}
      </div>
    </Modal>
  );
}
