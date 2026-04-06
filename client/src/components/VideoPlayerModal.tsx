import { Modal, message, Spin, Slider, Button, App, Popconfirm } from 'antd';
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
import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';

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
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [loadedVideoId, setLoadedVideoId] = useState<string | number | null>(null);
  const [potPlayerCalled, setPotPlayerCalled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showControls, setShowControls] = useState(true);

  // 设置视频 ref 并加载视频
  const setVideoRef = useCallback((videoEl: HTMLVideoElement | null) => {
    videoRef.current = videoEl;
    if (videoEl && video && open && !videoEl.src) {
      console.log('setVideoRef: Loading video, videoId:', video.id);
      setIsLoading(true);
      setPlaybackError(null);
      setIsBuffering(true);

      const streamUrl = `http://localhost:3001/api/videos/${video.id}/stream`;
      videoEl.src = streamUrl;
      videoEl.preload = 'auto';
      videoEl.volume = volume;
      videoEl.muted = isMuted;

      const handleLoadedData = async () => {
        console.log('Video data loaded (setVideoRef), readyState:', videoEl.readyState);
        try {
          await videoEl.play();
          setIsPlaying(true);
          setIsLoading(false);
          setIsBuffering(false);
        } catch (err) {
          console.log('自动播放等待用户交互:', (err as Error).name);
          setIsLoading(false);
          setIsBuffering(false);
        }
        videoEl.removeEventListener('loadeddata', handleLoadedData);
      };

      const handleError = (e: Event) => {
        const target = e.target as HTMLVideoElement;
        console.error('Video load error (setVideoRef):', target.error);
        setIsLoading(false);
        setIsBuffering(false);
        if (target.error) {
          setPlaybackError('视频加载失败：' + target.error.message);
        }
        videoEl.removeEventListener('error', handleError);
      };

      videoEl.addEventListener('loadeddata', handleLoadedData, { once: true });
      videoEl.addEventListener('error', handleError, { once: true });

      videoEl.load();
    }
  }, [video?.id, open, volume, isMuted]);

  // 调试：监听 video 和 open 的变化
  useEffect(() => {
    console.log('VideoPlayerModal render:', { video, open, videoId: video?.id });
  }, [video, open]);

  // 使用 useLayoutEffect 确保在 DOM 渲染后立即执行
  useLayoutEffect(() => {
    console.log('VideoPlayerModal useLayoutEffect check:', { video, open, hasRef: !!videoRef.current, videoId: video?.id });
    if (!video || !open || !videoRef.current) {
      console.log('VideoPlayerModal useLayoutEffect early return:', { videoOk: !!video, openOk: open, refOk: !!videoRef.current });
      return;
    }

    console.log('VideoPlayerModal useLayoutEffect: video=', video, 'open=', open, 'video.id=', video.id);

    const videoEl = videoRef.current;
    const streamUrl = `http://localhost:3001/api/videos/${video.id}/stream`;

    console.log('Loading video (layout):', video.id, streamUrl);
    setIsLoading(true);
    setPlaybackError(null);
    setIsBuffering(true);

    // 先尝试在浏览器播放
    videoEl.src = streamUrl;
    videoEl.preload = 'auto';
    videoEl.load();

    // 应用当前音量设置（保持上一个视频的设置）
    videoEl.volume = volume;
    videoEl.muted = isMuted;

    // 监听 loadeddata 事件，数据加载完成后自动播放
    const handleLoadedData = async () => {
      console.log('Video data loaded, readyState:', videoEl.readyState);
      try {
        await videoEl.play();
        setIsPlaying(true);
        setIsLoading(false);
        setIsBuffering(false);
      } catch (err) {
        // 自动播放被阻止是正常现象，等待用户手动点击
        console.log('自动播放等待用户交互:', (err as Error).name);
        setIsLoading(false);
        setIsBuffering(false);
      }
    };

    // 监听错误
    const handleError = (e: Event) => {
      const target = e.target as HTMLVideoElement;
      console.error('Video load error:', target.error);
      setIsLoading(false);
      setIsBuffering(false);
      if (target.error) {
        setPlaybackError('视频加载失败：' + target.error.message);
      }
    };

    // 监听 canplay 事件
    const handleCanPlay = () => {
      console.log('Video can play, readyState:', videoEl.readyState);
      setIsLoading(false);
      setIsBuffering(false);
    };

    videoEl.addEventListener('loadeddata', handleLoadedData, { once: true });
    videoEl.addEventListener('error', handleError, { once: true });
    videoEl.addEventListener('canplay', handleCanPlay, { once: true });

    return () => {
      videoEl.removeEventListener('loadeddata', handleLoadedData);
      videoEl.removeEventListener('error', handleError);
      videoEl.removeEventListener('canplay', handleCanPlay);
    };
  }, [video?.id, open]);

  // 弹窗打开且 videoRef 就绪时加载视频（备用）
  useEffect(() => {
    if (!video || !open) {
      console.log('useEffect: skipping, video or open is false');
      return;
    }

    // 等待 videoRef 就绪
    if (!videoRef.current) {
      console.log('useEffect: videoRef not ready, waiting...');
      return;
    }

    const videoEl = videoRef.current;
    // 如果 src 已经设置，说明已经加载过了
    if (videoEl.src) {
      console.log('useEffect: src already set, skipping');
      return;
    }

    console.log('useEffect: Loading video, videoId:', video.id);
    setIsLoading(true);
    setPlaybackError(null);
    setIsBuffering(true);

    const streamUrl = `http://localhost:3001/api/videos/${video.id}/stream`;
    videoEl.src = streamUrl;
    videoEl.preload = 'auto';
    videoEl.load();

    // 应用当前音量设置
    videoEl.volume = volume;
    videoEl.muted = isMuted;

    // 添加事件监听器
    const handleLoadedData = async () => {
      console.log('Video data loaded (useEffect), readyState:', videoEl.readyState);
      try {
        await videoEl.play();
        setIsPlaying(true);
        setIsLoading(false);
        setIsBuffering(false);
      } catch (err) {
        console.log('自动播放等待用户交互:', (err as Error).name);
        setIsLoading(false);
        setIsBuffering(false);
      }
      videoEl.removeEventListener('loadeddata', handleLoadedData);
    };

    const handleError = (e: Event) => {
      const target = e.target as HTMLVideoElement;
      console.error('Video load error (useEffect):', target.error);
      setIsLoading(false);
      setIsBuffering(false);
      if (target.error) {
        setPlaybackError('视频加载失败：' + target.error.message);
      }
      videoEl.removeEventListener('error', handleError);
    };

    videoEl.addEventListener('loadeddata', handleLoadedData, { once: true });
    videoEl.addEventListener('error', handleError, { once: true });

    return () => {
      videoEl.removeEventListener('loadeddata', handleLoadedData);
      videoEl.removeEventListener('error', handleError);
    };
  }, [video?.id, open]);

  // 清理函数
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
    };
  }, []);

  // 关闭时重置状态
  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setCurrentTime(0);
      setIsFullscreen(false);
      setIsBuffering(false);
      if (videoRef.current) {
        videoRef.current.pause();
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
      if (e.key === ' ') {
        e.preventDefault();
        if (videoRef.current?.paused) {
          videoRef.current.play();
        } else {
          videoRef.current.pause();
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        if (videoRef.current) {
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
        }
        return;
      }
      if (e.key === 'ArrowRight') {
        if (videoRef.current) {
          videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, duration]);

  const togglePlay = () => {
    if (!videoRef.current) return;

    const videoEl = videoRef.current;

    // 检查传入的 video prop 是否有 id
    console.log('togglePlay called:', {
      readyState: videoEl.readyState,
      src: videoEl.src ? 'set' : 'not set',
      videoPropId: video?.id,
      open: open
    });

    // 如果视频还没有加载，先加载
    if (!videoEl.src) {
      console.log('Video src not set, setting src and loading...');
      setIsLoading(true);
      setPlaybackError(null);
      setIsBuffering(true);

      // 使用传入的 video prop 的 id
      const videoId = video?.id;
      console.log('Using videoId:', videoId);

      if (!videoId) {
        console.error('video.id is empty or undefined!');
        setPlaybackError('视频 ID 为空，无法播放');
        setIsLoading(false);
        setIsBuffering(false);
        return;
      }

      const streamUrl = `http://localhost:3001/api/videos/${videoId}/stream`;
      console.log('Setting video src to:', streamUrl);
      videoEl.src = streamUrl;
      videoEl.preload = 'auto';
      videoEl.volume = volume;
      videoEl.muted = isMuted;

      // 添加事件监听器
      const handleLoadedData = async () => {
        console.log('Video data loaded (from togglePlay), readyState:', video.readyState);
        try {
          await video.play();
          setIsPlaying(true);
          setIsLoading(false);
          setIsBuffering(false);
        } catch (err) {
          console.log('自动播放等待用户交互:', (err as Error).name);
          setIsLoading(false);
          setIsBuffering(false);
        }
        video.removeEventListener('loadeddata', handleLoadedData);
      };

      const handleError = (e: Event) => {
        const target = e.target as HTMLVideoElement;
        console.error('Video load error (from togglePlay):', target.error);
        setIsLoading(false);
        setIsBuffering(false);
        if (target.error) {
          setPlaybackError('视频加载失败：' + target.error.message);
        }
        video.removeEventListener('error', handleError);
      };

      video.addEventListener('loadeddata', handleLoadedData, { once: true });
      video.addEventListener('error', handleError, { once: true });

      video.load();
      return;
    }

    // readyState 0 = HAVE_NOTHING, 1 = HAVE_METADATA, 2 = HAVE_CURRENT_DATA, 3 = HAVE_FUTURE_DATA, 4 = HAVE_ENOUGH_DATA
    if (video.readyState < 2) {
      console.log('Video not ready yet (readyState=' + video.readyState + '), waiting for loadeddata...');
      // 视频数据还不足，触发 load 并等待 loadeddata 事件自动播放
      setIsLoading(true);
      video.load();
      return;
    }

    if (video.paused) {
      video.play().catch((err) => {
        if (err.name === 'NotSupportedError') {
          setPlaybackError('此视频格式不支持');
          message.error('视频格式不支持');
        }
        console.log('Play error:', err.name);
      });
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
      // 不再这里自动播放，由 useEffect 中的 play() 处理
    }
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    setIsBuffering(false);
  };

  const handleWaiting = () => {
    setIsBuffering(true);
  };

  const handlePlaying = () => {
    setIsLoading(false);
    setIsBuffering(false);
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleProgress = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    // 无需处理
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    let errorMsg = '视频加载失败';

    if (v.error) {
      switch (v.error.code) {
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMsg = '视频格式不支持';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMsg = '网络错误';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMsg = '视频解码失败';
          break;
        case MediaError.MEDIA_ERR_ABORTED:
          return;
      }
    }

    setPlaybackError(errorMsg);
    setIsLoading(false);
    setIsBuffering(false);

    // 不再这里调用 PotPlayer，由 useEffect 中的超时逻辑统一处理
  };

  const handleSeek = (value: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value;
      setCurrentTime(value);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = useCallback((value: number) => {
    if (videoRef.current) {
      videoRef.current.volume = value;
      setVolume(value);
      setIsMuted(value === 0);
    }
  }, []);

  const handleVolumeAfterChange = () => {
    // 音量调节完成后不需要做什么
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;

    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch((err) => {
        message.error('全屏失败：' + err.message);
      });
    } else {
      document.exitFullscreen();
    }
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
      message.error('调用 PotPlayer 失败');
    }
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = playerContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const third = rect.width / 3;

    if (x < third) {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
      }
    } else if (x > 2 * third) {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
      }
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
            <p>{playbackError}</p>
            <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>提示：请尝试重新扫描视频以进行转码</p>
          </div>
        )}

        <video
          ref={setVideoRef}
          style={{
            width: '100%',
            height: '100%',
            cursor: 'pointer'
          }}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={(e) => {
            console.log('Video can play', e.currentTarget.readyState);
            handleCanPlay();
          }}
          onLoadedData={(e) => {
            console.log('Video data loaded, ready state:', e.currentTarget.readyState);
          }}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onPause={handlePause}
          onProgress={handleProgress}
          onError={(e) => {
            console.error('Video error:', e);
            handleError(e);
          }}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          onDoubleClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
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
                    if (videoRef.current && isPlaying) {
                      videoRef.current.pause();
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
