import { useRef, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button, Slider, message } from 'antd';
import { videoApi } from '../api';
import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  LeftOutlined
} from '@ant-design/icons';

export default function VideoPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const { data: videoData } = useQuery({
    queryKey: ['video', id],
    queryFn: async () => {
      const res = await videoApi.getVideo(id!);
      return res.data.data;
    },
    enabled: !!id
  });

  const reportProgressMutation = useMutation({
    mutationFn: ({ id, progressSeconds, isCompleted }: { id: string; progressSeconds: number; isCompleted: boolean }) =>
      videoApi.reportProgress(id, progressSeconds, isCompleted),
    onError: () => {
      // 静默失败
    }
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setProgress(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (id) {
        reportProgressMutation.mutate({ id, progressSeconds: 0, isCompleted: true });
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, [id]);

  // 每 5 秒上报进度
  useEffect(() => {
    const interval = setInterval(() => {
      if (id && progress > 0) {
        const isCompleted = progress >= duration * 0.95;
        reportProgressMutation.mutate({
          id,
          progressSeconds: progress,
          isCompleted
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [id, progress, duration]);

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = value;
    setProgress(value);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (!videoData) {
    return <div>加载中...</div>;
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Button
        icon={<LeftOutlined />}
        onClick={() => navigate('/')}
        style={{ marginBottom: 16 }}
      >
        返回列表
      </Button>

      <div style={{
        background: '#000',
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative'
      }}>
        <video
          ref={videoRef}
          src={videoApi.getStreamUrl(id!)}
          style={{ width: '100%', maxHeight: '70vh' }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        <div style={{
          padding: 16,
          background: 'rgba(0,0,0,0.8)'
        }}>
          <h2 style={{ color: '#fff', margin: '0 0 16px' }}>
            {videoData.filename}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="primary"
              size="large"
              icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={handlePlayPause}
            >
              {isPlaying ? '暂停' : '播放'}
            </Button>

            <Slider
              style={{ flex: 1 }}
              min={0}
              max={duration || 100}
              value={progress}
              onChange={handleSeek}
              tipFormatter={formatTime}
            />

            <span style={{ color: '#fff', minWidth: 100 }}>
              {formatTime(progress)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
