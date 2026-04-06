import { Row, Col, Empty } from 'antd';
import VideoCard from './VideoCard';
import VideoPlayerModal from './VideoPlayerModal';
import { useState } from 'react';

interface Video {
  id?: string | number;
  filename: string;
  thumbnailPath?: string | null;
  durationSeconds?: number | null;
  fileSize?: number | null;
  progressSeconds?: number | null;
}

interface VideoGridProps {
  videos: Video[];
  onVideoDeleted?: () => void;
}

export default function VideoGrid({ videos, onVideoDeleted }: VideoGridProps) {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleVideoClick = (video: Video) => {
    setSelectedVideo(video);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedVideo(null), 300);
  };

  if (!videos || videos.length === 0) {
    return <Empty description="暂无视频" />;
  }

  return (
    <>
      <Row gutter={[16, 16]}>
        {videos.map((video, index) => (
          <Col
            key={video.id || index}
            xs={24}
            sm={12}
            md={8}
            lg={6}
            xl={4}
          >
            <VideoCard
              {...video}
              onClick={() => handleVideoClick(video)}
            />
          </Col>
        ))}
      </Row>
      <VideoPlayerModal
        video={selectedVideo}
        open={isModalOpen}
        onClose={handleClose}
        onVideoDeleted={onVideoDeleted}
      />
    </>
  );
}
