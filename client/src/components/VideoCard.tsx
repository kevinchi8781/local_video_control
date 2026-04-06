import { Card, Badge, Progress } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import FavoriteButton from './FavoriteButton';

interface Video {
  id?: string | number;
  filename: string;
  thumbnailPath?: string | null;
  durationSeconds?: number | null;
  fileSize?: number | null;
  progressSeconds?: number | null;
  onClick?: () => void;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1000) {
    return `${(mb / 1024).toFixed(1)}GB`;
  }
  return `${mb.toFixed(0)}MB`;
}

interface VideoCardProps extends Video {
  onClick?: () => void;
}

export default function VideoCard({
  id,
  filename,
  thumbnailPath,
  durationSeconds,
  fileSize,
  progressSeconds,
  onClick
}: VideoCardProps) {
  const hasProgress = progressSeconds && progressSeconds > 0;
  const progressPercent = hasProgress && durationSeconds
    ? Math.min(100, Math.round((progressSeconds / durationSeconds) * 100))
    : 0;

  return (
    <Card
      style={{
        cursor: 'default'
      }}
      cover={
        <div
          style={{
            position: 'relative',
            height: 180,
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          {thumbnailPath ? (
            <img
              src={`http://localhost:3001${thumbnailPath}`}
              alt={filename}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          ) : (
            <PlayCircleOutlined style={{ fontSize: 48, color: '#fff' }} />
          )}
          {durationSeconds && (
            <span
              style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                background: 'rgba(0,0,0,0.8)',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 12
              }}
            >
              {formatDuration(durationSeconds)}
            </span>
          )}
          {hasProgress && progressPercent > 0 && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 3,
                background: 'rgba(255,255,255,0.3)'
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: '#722ed1'
                }}
              />
            </div>
          )}
        </div>
      }
      actions={[
        <FavoriteButton
          key="favorite"
          videoId={id || 0}
          videoTitle={filename}
          size="small"
        />
      ]}
    >
      <Card.Meta
        title={
          <Badge
            count={hasProgress ? '继续观看' : ''}
            style={{ backgroundColor: '#722ed1' }}
          >
            <span style={{ fontSize: 14 }}>{filename}</span>
          </Badge>
        }
        description={fileSize ? formatFileSize(fileSize) : undefined}
      />
    </Card>
  );
}
