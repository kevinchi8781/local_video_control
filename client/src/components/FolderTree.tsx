import { useState, useEffect, useCallback } from 'react';
import { Tree, Spin } from 'antd';
import type { DataNode } from 'antd/es/tree';
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
}

interface FolderTreeProps {
  onFolderSelect?: (folder: FolderNode) => void;
}

function makeKey(id: string, path: string): string {
  return `${id}-${path}`;
}

function mapFolderToTreeNode(folder: FolderNode): DataNode {
  return {
    key: makeKey(folder.id, folder.path),
    title: `${folder.label} (${folder.videoCount})`,
    icon: <FolderOutlined />,
    isLeaf: !folder.hasChildren,
    selectable: true,
    ...folder
  };
}

export default function FolderTree({ onFolderSelect }: FolderTreeProps) {
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [treeData, setTreeData] = useState<DataNode[]>([]);

  // Load root folders
  const { data: rootData, isLoading: isLoadingRoots, error } = useQuery({
    queryKey: ['folders', 'root'],
    queryFn: async () => {
      const res = await folderApi.getRootFolders();
      return (res.data.data || []) as FolderNode[];
    },
    onError: (err) => {
      console.error('Failed to load root folders:', err);
    }
  });

  // Initialize tree data when root folders load
  useEffect(() => {
    if (rootData && rootData.length > 0 && treeData.length === 0) {
      setTreeData(rootData.map(mapFolderToTreeNode));
    }
  }, [rootData, treeData.length]);

  // Load child nodes on demand
  const loadData = useCallback(async (node: DataNode): Promise<void> => {
    const folderNode = node as unknown as FolderNode & { key: string };
    const res = await folderApi.getChildren(folderNode.id, folderNode.path);
    const childFolders = (res.data.data || []) as FolderNode[];
    const childNodes = childFolders.map(mapFolderToTreeNode);

    // Update tree data with loaded children
    setTreeData(prevData => updateNodeChildren(prevData, node.key as string, childNodes));
  }, []);

  // Recursively update node children in tree
  function updateNodeChildren(nodes: DataNode[], targetKey: string, children: DataNode[]): DataNode[] {
    return nodes.map(node => {
      if (node.key === targetKey) {
        return { ...node, children };
      }
      if (node.children && node.children.length > 0) {
        return { ...node, children: updateNodeChildren(node.children, targetKey, children) };
      }
      return node;
    });
  }

  const handleSelect = (keys: React.Key[], info: { selected: boolean; node: DataNode }) => {
    setSelectedKeys(keys);
    if (info.selected && onFolderSelect) {
      const folder = info.node as unknown as FolderNode;
      onFolderSelect(folder);
    }
  };

  if (isLoadingRoots) {
    return <Spin />;
  }

  if (error) {
    return <div className="text-red-500">Failed to load folders: {error.message}</div>;
  }

  if (!rootData || rootData.length === 0) {
    return <div className="text-gray-500">No folders available</div>;
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
        loadData={loadData}
        treeData={treeData}
      />
    </div>
  );
}
