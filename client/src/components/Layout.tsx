import { useState, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Drawer, Button, theme, message, Progress, Breadcrumb } from 'antd';
import { SettingOutlined, CloseOutlined, SyncOutlined, ReloadOutlined, StarOutlined, HomeOutlined } from '@ant-design/icons';
import SettingsPage from '../pages/SettingsPage';

const { Header, Content } = AntLayout;

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ processed: number; total: number; new: number; updated: number } | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const {
    token: { colorBgContainer, borderRadiusLG }
  } = theme.useToken();

  const isCollectionsPage = location.pathname === '/collections';

  const handleStarClick = () => {
    if (isCollectionsPage) {
      navigate('/');
    } else {
      navigate('/collections');
    }
  };

  const closeSettings = () => {
    setIsSettingsDrawerOpen(false);
  };

  const handleSync = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setScanProgress({ processed: 0, total: 0, new: 0, updated: 0 });

    let hasShownMessage = false;

    try {
      const response = await fetch('/api/scan', { method: 'POST' });
      if (response.ok) {
        // 等待 100ms 让后端开始扫描并更新状态
        await new Promise(resolve => setTimeout(resolve, 100));

        // 快速轮询扫描状态（200ms 一次）
        pollIntervalRef.current = setInterval(async () => {
          try {
            const statusRes = await fetch('/api/scan/status');
            const { data } = await statusRes.json();

            console.log('[Scan Status]', data);

            setScanProgress({
              processed: data.processed || 0,
              total: data.total || 0,
              new: data.new || 0,
              updated: data.updated || 0
            });

            if (!data.isScanning && !hasShownMessage) {
              hasShownMessage = true;

              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }

              // 立即刷新视频列表
              window.dispatchEvent(new Event('videos-refresh'));

              // 只显示一个汇总提示
              const { new: newCount, updated: updatedCount } = data;
              if (newCount === 0 && updatedCount === 0) {
                message.info('扫描完成，无新增或更新');
              } else if (newCount > 0 && updatedCount > 0) {
                message.success(`扫描完成：新增 ${newCount} 个，更新 ${updatedCount} 个`);
              } else if (newCount > 0) {
                message.success(`扫描完成：新增 ${newCount} 个`);
              } else {
                message.success(`扫描完成：更新 ${updatedCount} 个`);
              }

              setIsSyncing(false);
              setScanProgress(null);
            }
          } catch (e) {
            console.error('轮询失败:', e);
          }
        }, 200);
      } else {
        message.error('扫描失败');
        setIsSyncing(false);
        setScanProgress(null);
      }
    } catch (error) {
      message.error('扫描请求失败');
      setIsSyncing(false);
      setScanProgress(null);
    }
  };

  // 清理轮询
  useState(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  });

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          padding: '0 24px',
          background: colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2
            style={{ margin: 0, cursor: 'pointer' }}
            onClick={() => navigate('/')}
            title="返回首页"
          >
            本地视频管理器
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            type={isCollectionsPage ? 'primary' : 'text'}
            icon={isCollectionsPage ? <HomeOutlined /> : <StarOutlined />}
            onClick={handleStarClick}
            style={{ fontSize: 18 }}
            title={isCollectionsPage ? '返回首页' : '我的收藏'}
          >
            {isCollectionsPage ? '首页' : ''}
          </Button>
          {isSyncing && scanProgress && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 250 }}>
              <Progress
                percent={scanProgress.total > 0 ? Math.round((scanProgress.processed / scanProgress.total) * 100) : 100}
                size="small"
                status={scanProgress.total === 0 && scanProgress.processed === 0 ? 'normal' : 'active'}
                format={() => {
                  if (scanProgress.total === 0) {
                    return '扫描完成';
                  }
                  const phaseText = `[${scanProgress.processed}/${scanProgress.total}]`;
                  const countText = scanProgress.new > 0 ? `(新：${scanProgress.new})` : '';
                  return `${phaseText} ${countText}`.trim();
                }}
                style={{ marginBottom: 0, width: 200 }}
                strokeColor={scanProgress.new > 0 ? '#52c41a' : '#1890ff'}
              />
            </div>
          )}
          <Button
            type="default"
            icon={isSyncing ? <SyncOutlined spin /> : <ReloadOutlined />}
            onClick={handleSync}
            loading={isSyncing}
            disabled={isSyncing}
          >
            {isSyncing ? '扫描中...' : '刷新'}
          </Button>
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={() => setIsSettingsDrawerOpen(true)}
            style={{ fontSize: 18 }}
          />
        </div>
      </Header>
      <Content
        style={{
          margin: 24,
          padding: 24,
          background: colorBgContainer,
          borderRadius: borderRadiusLG,
          minHeight: 'calc(100vh - 121px)'
        }}
      >
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            {
              title: <HomeOutlined />,
              href: '/',
              onClick: (e) => { e.preventDefault(); navigate('/'); }
            },
            ...(isCollectionsPage ? [{
              title: '我的收藏',
              href: '/collections'
            }] : [])
          ]}
        />
        <Outlet />
      </Content>

      {/* Settings Drawer - Full height overlay from top to bottom */}
      <Drawer
        title="设置"
        placement="right"
        onClose={closeSettings}
        open={isSettingsDrawerOpen}
        size="large"
        styles={{
          body: { padding: 0 }
        }}
        closeIcon={<CloseOutlined />}
      >
        <SettingsPage />
      </Drawer>
    </AntLayout>
  );
}
