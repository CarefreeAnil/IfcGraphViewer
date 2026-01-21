/**
 * IFC5 Tree Browser Component
 * Displays hierarchical tree structure for IFC5 (.ifcx) files
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, ChevronDown, Box, Circle, Minus, Database, BarChart3 } from 'lucide-react';
import { ComposedObject } from '@/types/ifc5';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VirtualList } from '@/components/VirtualList';

interface IFC5TreeBrowserProps {
  composedObject: ComposedObject;
  onNodeSelect?: (path: string, node: ComposedObject) => void;
  selectedPath?: string | null;
}

interface TreeNodeProps {
  node: ComposedObject;
  level: number;
  onNodeSelect?: (path: string, node: ComposedObject) => void;
  selectedPath?: string | null;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle?: (path: string) => void;
}

const getNodeIcon = (type?: string) => {
  switch (type) {
    case 'Mesh':
      return <Box className="w-4 h-4 text-blue-500" />;
    case 'Curve':
      return <Minus className="w-4 h-4 text-green-500" />;
    case 'Points':
      return <Circle className="w-4 h-4 text-purple-500" />;
    default:
      return <Database className="w-4 h-4 text-gray-500" />;
  }
};

const getNodeColor = (type?: string) => {
  switch (type) {
    case 'Mesh':
      return 'bg-card border-blue-500/30 hover:bg-secondary';
    case 'Curve':
      return 'bg-card border-green-500/30 hover:bg-secondary';
    case 'Points':
      return 'bg-card border-purple-500/30 hover:bg-secondary';
    default:
      return 'bg-card border-gray-500/30 hover:bg-secondary';
  }
};

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  onNodeSelect,
  selectedPath,
  hasChildren,
  isExpanded,
  onToggle,
}) => {
  const isSelected = selectedPath === node.name;
  const displayName = node.name.split('/').pop() || node.name || 'root';

  const handleClick = () => {
    console.log('[IFC5TreeBrowser] Node clicked:', node.name);
    onNodeSelect?.(node.name, node);
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggle?.(node.name);
    }
  };

  const getAttributeCount = () => {
    if (!node.attributes) return 0;
    return Object.keys(node.attributes).filter(
      key => !key.startsWith('_') && !key.startsWith('usd::')
    ).length;
  };

  const attributeCount = getAttributeCount();

  return (
    <div className="select-none">
      <div
        className={`
          flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer border
          transition-colors duration-150
          ${isSelected ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50 bg-card' : getNodeColor(node.type)}
        `}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        <div className="flex items-center gap-1 flex-shrink-0" onClick={handleChevronClick}>
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-600 hover:text-gray-700" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600 hover:text-gray-700" />
            )
          ) : (
            <div className="w-4" />
          )}
        </div>

        {getNodeIcon(node.type)}

        <span className="font-medium text-sm truncate flex-1 text-foreground" title={node.name}>
          {displayName}
        </span>

        {node.type && (
          <Badge variant="outline" className="text-xs px-1.5 py-0">
            {node.type}
          </Badge>
        )}

        {attributeCount > 0 && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {attributeCount}
          </Badge>
        )}
      </div>
    </div>
  );
};

export const IFC5TreeBrowser: React.FC<IFC5TreeBrowserProps> = ({
  composedObject,
  onNodeSelect,
  selectedPath,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showStats, setShowStats] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerHeight, setContainerHeight] = useState(400);
  const itemHeight = 36;

  if (!composedObject) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
        <p className="text-sm">IFC5 data not loaded. Please reload the file.</p>
      </div>
    );
  }

  const setInitialExpanded = (root: ComposedObject) => {
    const initial = new Set<string>();
    const walk = (node: ComposedObject, level: number) => {
      if (level < 2) {
        initial.add(node.name);
      }
      node.children?.forEach((child) => walk(child, level + 1));
    };
    walk(root, 0);
    setExpandedNodes(initial);
  };

  React.useEffect(() => {
    setInitialExpanded(composedObject);
  }, [composedObject]);

  const toggleNode = (path: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const matchesSearch = (node: ComposedObject, term: string) => {
    const name = node.name.split('/').pop() || node.name;
    return (
      name.toLowerCase().includes(term.toLowerCase()) ||
      node.type?.toLowerCase().includes(term.toLowerCase())
    );
  };

  const hasMatchingDescendant = (node: ComposedObject, term: string): boolean => {
    if (!node.children) return false;
    for (const child of node.children) {
      if (matchesSearch(child, term)) return true;
      if (hasMatchingDescendant(child, term)) return true;
    }
    return false;
  };

  const visibleNodes = useMemo(() => {
    const list: Array<{ node: ComposedObject; level: number; hasChildren: boolean; isExpanded: boolean }> = [];
    const term = searchTerm.trim();

    const walk = (node: ComposedObject, level: number) => {
      const hasChildren = !!node.children?.length;
      const match = term ? matchesSearch(node, term) : true;
      const childMatch = term ? hasMatchingDescendant(node, term) : false;
      const shouldShow = !term || match || childMatch;

      if (!shouldShow) return;

      const shouldExpand =
        expandedNodes.has(node.name) ||
        (!!term && childMatch) ||
        (!!selectedPath && node.name && selectedPath.startsWith(node.name));

      list.push({ node, level, hasChildren, isExpanded: shouldExpand });

      if (hasChildren && shouldExpand) {
        node.children!.forEach((child) => walk(child, level + 1));
      }
    };

    walk(composedObject, 0);
    return list;
  }, [composedObject, expandedNodes, searchTerm, selectedPath]);

  // Calculate statistics
  const stats = useMemo(() => {
    let totalNodes = 0;
    let meshCount = 0;
    let curveCount = 0;
    let pointsCount = 0;
    let groupCount = 0;

    const traverse = (node: ComposedObject) => {
      totalNodes++;
      switch (node.type) {
        case 'Mesh': meshCount++; break;
        case 'Curve': curveCount++; break;
        case 'Points': pointsCount++; break;
        default: groupCount++; break;
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };

    traverse(composedObject);

    return { totalNodes, meshCount, curveCount, pointsCount, groupCount };
  }, [composedObject]);

  useLayoutEffect(() => {
    if (!listContainerRef.current) return;
    const container = listContainerRef.current;
    const handleResize = () => setContainerHeight(container.clientHeight || 400);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    if (!selectedPath || !listRef.current) return;
    
    // Ensure the selected item's parent is expanded
    const pathParts = selectedPath.split('/');
    for (let i = 0; i < pathParts.length - 1; i++) {
      const parentPath = pathParts.slice(0, i + 1).join('/');
      setExpandedNodes(prev => new Set([...prev, parentPath]));
    }
  }, [selectedPath]);

  // Separate effect for scrolling - only trigger on selectedPath change, not visibleNodes change
  React.useEffect(() => {
    if (!selectedPath || !listRef.current) return;
    
    // Find and scroll to the selected item
    // Use a small delay to ensure visibleNodes is updated with expanded parents
    const timeoutId = setTimeout(() => {
      const index = visibleNodes.findIndex((item) => item.node.name === selectedPath);
      if (index !== -1 && listRef.current) {
        const targetTop = Math.max(0, index * itemHeight - containerHeight / 2 + itemHeight / 2);
        listRef.current.scrollTop = targetTop;
      }
    }, 50);
    
    return () => clearTimeout(timeoutId);
  }, [selectedPath, itemHeight, containerHeight]);

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-4 border-b space-y-3 bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">IFC5 Model Tree</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Navigate the IFC5 (.ifcx) structure
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowStats(!showStats)}
            className="h-7 px-2"
            title="Toggle Statistics"
          >
            <BarChart3 className={`w-3 h-3 ${showStats ? 'text-primary' : ''}`} />
          </Button>
        </div>

        <Input
          type="text"
          placeholder="Search nodes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-8 text-sm"
        />

        {showStats && (
          <div className="flex items-center gap-2 text-xs px-1">
            <div className="flex items-center gap-1">
              <Box className="w-3 h-3 text-blue-500" />
              <span className="text-muted-foreground">{stats.meshCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <Minus className="w-3 h-3 text-green-500" />
              <span className="text-muted-foreground">{stats.curveCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <Circle className="w-3 h-3 text-purple-500" />
              <span className="text-muted-foreground">{stats.pointsCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <Database className="w-3 h-3 text-gray-500" />
              <span className="text-muted-foreground">{stats.groupCount}</span>
            </div>
          </div>
        )}
      </div>

      <div ref={listContainerRef} className="flex-1 bg-card">
        <VirtualList
          ref={listRef}
          items={visibleNodes}
          itemHeight={itemHeight}
          containerHeight={containerHeight}
          className="p-2"
          renderItem={(item) => (
            <TreeNode
              node={item.node}
              level={item.level}
              onNodeSelect={onNodeSelect}
              selectedPath={selectedPath}
              hasChildren={item.hasChildren}
              isExpanded={item.isExpanded}
              onToggle={toggleNode}
            />
          )}
        />
      </div>
    </div>
  );
};
