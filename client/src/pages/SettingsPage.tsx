import { useState } from 'react';
import { Card, Input, Button, Space, Table, message, Modal, Divider, type ColumnsType } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '../api';
import { FolderOutlined, DeleteOutlined } from '@ant-design/icons';

interface FolderBinding {
  id: string;
  displayName: string;
  path: string;
}

interface Config {
  ffmpegPath?: string;
  folderBindings: FolderBinding[];
}

export default function SettingsPage() {
  const [folderPath, setFolderPath] = useState('');
  const [ffmpegPath, setFfmpegPath] = useState('');
  const queryClient = useQueryClient();

  const { data: configData, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      try {
        const res = await configApi.getConfig();
        return res.data.data as Config;
      } catch (error) {
        message.error('获取配置失败');
        throw error;
      }
    }
  });

  const saveConfigMutation = useMutation({
    mutationFn: configApi.saveConfig,
    onSuccess: () => {
      message.success('配置已保存');
      queryClient.invalidateQueries({ queryKey: ['config'] });
    }
  });

  const addFolderMutation = useMutation({
    mutationFn: configApi.addFolder,
    onSuccess: () => {
      message.success('文件夹已添加');
      setFolderPath('');
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    }
  });

  const removeFolderMutation = useMutation({
    mutationFn: configApi.removeFolder,
    onSuccess: () => {
      message.success('文件夹已移除');
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    }
  });

  const handleSaveFFmpeg = () => {
    saveConfigMutation.mutate({
      ffmpegPath,
      folderBindings: configData?.folderBindings || []
    });
  };

  const handleAddFolder = () => {
    if (!folderPath.trim()) {
      message.error('请输入文件夹路径');
      return;
    }
    addFolderMutation.mutate(folderPath.trim());
  };

  const handleRemoveFolder = (id: string) => {
    Modal.confirm({
      title: '确认移除',
      content: '确定要移除这个绑定的文件夹吗？',
      onOk: () => removeFolderMutation.mutate(id)
    });
  };

  if (isLoading) {
    return <div>加载中...</div>;
  }

  const columns: ColumnsType<FolderBinding> = [
    {
      title: '文件夹名称',
      dataIndex: 'displayName',
      key: 'displayName'
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveFolder(record.id)}
        >
          移除
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card title="FFmpeg 配置" style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="FFmpeg 路径（可选）"
            value={ffmpegPath}
            onChange={e => setFfmpegPath(e.target.value)}
            defaultValue={configData?.ffmpegPath || ''}
          />
          <Button type="primary" onClick={handleSaveFFmpeg}>
            保存
          </Button>
        </Space.Compact>
        <p style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
          提示：如未自动识别 ffmpeg，请手动配置路径（例如 C:\Program Files\ffmpeg\bin\ffmpeg.exe）
        </p>
      </Card>

      <Divider />

      <Card title="文件夹绑定">
        <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
          <Input
            placeholder="输入文件夹路径"
            value={folderPath}
            onChange={e => setFolderPath(e.target.value)}
            onPressEnter={handleAddFolder}
          />
          <Button
            type="primary"
            icon={<FolderOutlined />}
            onClick={handleAddFolder}
            loading={addFolderMutation.isPending}
          >
            添加
          </Button>
        </Space.Compact>

        <Table
          columns={columns}
          dataSource={configData?.folderBindings || []}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: '暂无绑定的文件夹' }}
        />
      </Card>
    </div>
  );
}
