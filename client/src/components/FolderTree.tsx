import { useState } from 'react';
import { Tree, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { folderApi } from '../api';
import { FolderOutlined } from '@ant-design/icons';

interface FolderNode {
  id: string;
  label: string;
  path: string;
  isRoot: boolean;
  videoCount: number;
  hasChildren: boolean;
  key: string;
  children?: FolderNode[];
  isLoading?: boolean;
}

interface FolderTreeProps {
  onFolderSelect?: (folder: FolderNode) => void;
}

export default function FolderTree({ onFolderSelect }: FolderTreeProps) {
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [treeData, setTreeData] = useState<FolderNode[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['folders'],
    queryFn: async () => {
      const res = await folderApi.getRootFolders();
      const folders = res.data.data as any[];
      return folders.map(f => ({
        ...f,
        key: `${f.id}-${f.path}`,
        children: f.hasChildren ? [] : undefined
      }));
    }
  });

  useState(() => {
    if (data) {
      setTreeData(data);
    }
  });

  const onLoadData = async ({ key, children, ...node }: any) => {
    if (children && children.length > 0) {
      return Promise.resolve();
    }

    const res = await folderApi.getChildren(node.id, node.path);
    const childNodes = (res.data.data || []).map((child: any) => ({
      ...child,
      key: `${child.id}-${child.path}`,
      children: child.hasChildren ? [] : undefined
    }));

    const updateTreeData = (nodes: FolderNode[]): FolderNode[] => {
      return nodes.map(node => {
        if (node.key === key) {
          return { ...node, children: childNodes };
        }
        if (node.children) {
          return { ...node, children: updateTreeData(node.children) };
        }
        return node;
      });
    };

    setTreeData(updateTreeData(treeData));
  };

  const handleSelect = (keys: React.Key[], info: any) => {
    setSelectedKeys(keys);
    if (info.selected && onFolderSelect) {
      onFolderSelect(info.node);
    }
  };

  if (isLoading) {
    return <Spin />;
  }

  return (
    <div>
      <Tree
        showIcon
        defaultExpandAll={false}
        expandedKeys={expandedKeys}
        selectedKeys={selectedKeys}
        onExpand={setExpandedKeys}
        onSelect={handleSelect}
        loadData={onLoadData}
        treeData={treeData}
      />
    </div>
  );
}
