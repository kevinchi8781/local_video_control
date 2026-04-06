import { useState, useEffect } from 'react';
import { Tree, Spin } from 'antd';
const { TreeNode } = Tree;
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
  selectable: boolean;
  key?: string;
  children?: FolderNode[];
}

interface ScanStatus {
  isScanning: boolean;
  currentFile: string;
  processed: number;
  total: number;
  new: number;
  updated: number;
  error: string | null;
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
      return res.data.data as FolderNode[];
    }
  });

  // 初始化树数据
  useEffect(() => {
    if (data) {
      // 确保 data 是数组
      setTreeData(Array.isArray(data) ? data : []);
    }
  }, [data]);

  const loadChildren = async (node: FolderNode): Promise<FolderNode[]> => {
    if (!node.hasChildren) {
      return [];
    }

    const res = await folderApi.getChildren(node.id, node.path);
    const children = res.data.data as FolderNode[];

    // 确保子节点有 key
    return children.map(child => ({
      ...child,
      key: `${child.id}-${child.path}`
    }));
  };

  const handleExpand = async (keys: React.Key[], info: any) => {
    setExpandedKeys(keys);

    // 如果是展开节点且是首次展开
    if (info.expanded && info.node.children === undefined) {
      const children = await loadChildren(info.node);

      // 更新树数据
      const updateTreeData = (nodes: FolderNode[]): FolderNode[] => {
        return nodes.map(node => {
          if (node.id === info.node.id) {
            return { ...node, children };
          }
          if (node.children) {
            return { ...node, children: updateTreeData(node.children) };
          }
          return node;
        });
      };
      setTreeData(updateTreeData(treeData));
    }
  };

  const handleSelect = (keys: React.Key[], info: any) => {
    setSelectedKeys(keys);
    if (info.selected && onFolderSelect) {
      onFolderSelect(info.node);
    }
  };

  const renderTreeNodes = (nodes: FolderNode[]) => {
    return nodes.map(node => {
      const key = `${node.id}-${node.path}`;
      return (
        <Tree.TreeNode
          key={key}
          title={`${node.label} (${node.videoCount || 0})`}
          icon={<FolderOutlined />}
          isLeaf={!node.hasChildren}
        >
          {node.children && renderTreeNodes(node.children)}
        </Tree.TreeNode>
      );
    });
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
        onExpand={handleExpand}
        onSelect={handleSelect}
      >
        {renderTreeNodes(treeData)}
      </Tree>
    </div>
  );
}
