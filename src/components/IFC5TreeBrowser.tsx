/**
 * IFC5 Tree Browser Component
 * Displays hierarchical tree structure for IFC5 (.ifcx) files
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight, ChevronDown,
  Box, Circle, Minus, Database, BarChart3,
  Building2, Layers, Globe, Home, Square, DoorOpen, AppWindow, Folder,
  X, ChevronsDownUp, ChevronsUpDown
} from 'lucide-react';
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

/** Highlight the first occurrence of `term` within `text` */
function HighlightMatch({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-300/60 text-foreground rounded-[2px] px-[1px]">
        {text.slice(idx, idx + term.length)}
      </mark>
      {text.slice(idx + term.length)}
    </>
  );
}

/**
 * Search a single attribute value deeply.
 * Returns the matching snippet string if found, or null.
 */
function searchAttrValue(val: unknown, term: string): string | null {
  if (typeof val === 'string') {
    return val.toLowerCase().includes(term) ? val : null;
  }
  if (typeof val === 'number') {
    return String(val).includes(term) ? String(val) : null;
  }
  if (Array.isArray(val)) {
    for (const item of val) {
      const hit = searchAttrValue(item, term);
      if (hit !== null) return hit;
    }
    return null;
  }
  if (val !== null && typeof val === 'object') {
    for (const v of Object.values(val as Record<string, unknown>)) {
      const hit = searchAttrValue(v, term);
      if (hit !== null) return hit;
    }
    return null;
  }
  return null;
}

interface TreeNodeProps {
  node: ComposedObject;
  level: number;
  onNodeSelect?: (path: string, node: ComposedObject) => void;
  selectedPath?: string | null;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle?: (path: string) => void;
  /** Active search term for highlighting */
  searchTerm?: string;
  /** Attribute key + snippet that triggered the match (shown as sub-text) */
  matchHint?: string;
}

/** Extract the IFC class code from a ComposedObject's attributes */
const getIfcClass = (node: ComposedObject): string | null => {
  // After convertToComposedObject() the {code,uri} object is flattened:
  //   bsi::ifc::class::code => "IfcWall"
  const flatCode = node.attributes?.['bsi::ifc::class::code'];
  if (typeof flatCode === 'string') return flatCode;
  // Fallback for unflattened (raw IFC5Node) data
  const cls = node.attributes?.['bsi::ifc::class'];
  if (typeof cls === 'string') return cls;
  if (cls && typeof cls === 'object' && 'code' in cls) return (cls as any).code as string;
  return null;
};

const getNodeIcon = (node: ComposedObject) => {
  const ifcClass = getIfcClass(node)?.toLowerCase() || '';

  // Geometry types take priority
  if (node.type === 'Mesh')   return <Box className="w-4 h-4 text-blue-400" />;
  if (node.type === 'Curve')  return <Minus className="w-4 h-4 text-green-400" />;
  if (node.type === 'Points') return <Circle className="w-4 h-4 text-purple-400" />;

  // Spatial hierarchy
  if (ifcClass.includes('ifcproject'))         return <Folder className="w-4 h-4 text-sky-400" />;
  if (ifcClass.includes('ifcsite'))            return <Globe className="w-4 h-4 text-sky-500" />;
  if (ifcClass.includes('ifcbuilding') && !ifcClass.includes('storey')) return <Building2 className="w-4 h-4 text-sky-500" />;
  if (ifcClass.includes('ifcbuildingstorey'))  return <Layers className="w-4 h-4 text-sky-400" />;
  if (ifcClass.includes('ifcspace') && !ifcClass.includes('spatialzone')) return <Home className="w-4 h-4 text-sky-300" />;

  // Physical elements
  if (ifcClass.includes('ifcwall'))            return <Square className="w-4 h-4 text-orange-400" />;
  if (ifcClass.includes('ifcslab') || ifcClass.includes('ifcroof')) return <Square className="w-4 h-4 text-orange-500" />;
  if (ifcClass.includes('ifccolumn') || ifcClass.includes('ifcbeam')) return <Box className="w-4 h-4 text-orange-400" />;
  if (ifcClass.includes('ifcstair') || ifcClass.includes('ifcramp')) return <Layers className="w-4 h-4 text-orange-400" />;
  if (ifcClass.includes('ifcwindow'))          return <AppWindow className="w-4 h-4 text-amber-400" />;
  if (ifcClass.includes('ifcdoor'))            return <DoorOpen className="w-4 h-4 text-amber-400" />;
  if (ifcClass.includes('ifcopeningelement'))  return <AppWindow className="w-4 h-4 text-amber-300" />;
  if (['ifcflow', 'ifcpipe', 'ifcduct', 'ifcdistribution'].some(c => ifcClass.includes(c)))
                                               return <Circle className="w-4 h-4 text-teal-400" />;
  if (ifcClass.includes('material'))           return <Circle className="w-4 h-4 text-fuchsia-400" />;

  return <Database className="w-4 h-4 text-gray-400" />;
};

const getNodeColor = (node: ComposedObject): string => {
  const ifcClass = getIfcClass(node)?.toLowerCase() || '';

  if (node.type === 'Mesh')   return 'bg-card border-blue-500/30 hover:bg-secondary';
  if (node.type === 'Curve')  return 'bg-card border-green-500/30 hover:bg-secondary';
  if (node.type === 'Points') return 'bg-card border-purple-500/30 hover:bg-secondary';

  if (['ifcproject', 'ifcsite', 'ifcbuilding', 'ifcbuildingstorey',
       'ifcspace', 'ifcspatialelement'].some(c => ifcClass.includes(c)))
    return 'bg-card border-sky-500/30 hover:bg-secondary';

  if (['ifcwall', 'ifcslab', 'ifcbeam', 'ifccolumn', 'ifcroof',
       'ifcstair', 'ifccurtainwall', 'ifcmember',
       'ifcbuildingelement'].some(c => ifcClass.includes(c)))
    return 'bg-card border-orange-500/30 hover:bg-secondary';

  if (['ifcwindow', 'ifcdoor', 'ifcopeningelement'].some(c => ifcClass.includes(c)))
    return 'bg-card border-amber-500/30 hover:bg-secondary';

  if (['ifcflow', 'ifcpipe', 'ifcduct', 'ifcdistribution'].some(c => ifcClass.includes(c)))
    return 'bg-card border-teal-500/30 hover:bg-secondary';

  if (ifcClass.includes('material'))
    return 'bg-card border-fuchsia-500/30 hover:bg-secondary';

  return 'bg-card border-gray-500/30 hover:bg-secondary';
};

const getFriendlyName = (node: ComposedObject): string => {
  let displayName = node.name.split('/').pop() || node.name || 'root';
  if (node.attributes) {
    const nameAttr = node.attributes['bsi::ifc::name'] || node.attributes['ifc::name'];
    if (nameAttr && typeof nameAttr === 'string' && nameAttr !== '$') {
      displayName = nameAttr;
    } else {
      const materialAttr = node.attributes['bsi::ifc::material'];
      if (materialAttr) {
        if (materialAttr.name && materialAttr.name !== '$' && materialAttr.name !== 'Unnamed') {
          displayName = materialAttr.name;
        } else if (materialAttr.code && materialAttr.code !== '$') {
          displayName = materialAttr.code;
        }
      }
    }
  }
  return displayName;
};

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  onNodeSelect,
  selectedPath,
  hasChildren,
  isExpanded,
  onToggle,
  searchTerm = '',
  matchHint,
}) => {
  const isSelected = selectedPath === node.name;
  const displayName = getFriendlyName(node);
  const ifcClass = getIfcClass(node);

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
          flex flex-col py-1.5 px-2 rounded-md cursor-pointer border
          transition-colors duration-150
          ${isSelected ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50 bg-card' : getNodeColor(node)}
        `}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        title={node.name}
      >
        <div className="flex items-center gap-2">
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

          {getNodeIcon(node)}

          <span className="font-medium text-sm truncate flex-1 text-foreground">
            <HighlightMatch text={displayName} term={searchTerm} />
          </span>

          {/* Show IFC class code if available, otherwise fall back to geometric type */}
          {ifcClass ? (
            <Badge variant="outline" className="text-xs px-1.5 py-0 font-mono shrink-0">
              <HighlightMatch text={ifcClass} term={searchTerm} />
            </Badge>
          ) : node.type ? (
            <Badge variant="outline" className="text-xs px-1.5 py-0 shrink-0">
              {node.type}
            </Badge>
          ) : null}

          {attributeCount > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 shrink-0">
              {attributeCount}
            </Badge>
          )}
        </div>

        {/* Match hint: show the attribute snippet that matched the search */}
        {matchHint && (
          <div
            className="text-[10px] text-yellow-600 dark:text-yellow-400 truncate mt-0.5 font-mono"
            style={{ paddingLeft: '28px' }}
          >
            {matchHint}
          </div>
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
  const itemHeight = 40; // slightly taller to accommodate match hints
  // Always-fresh ref to visibleNodes — fixes stale-closure bug in the scroll effect
  const visibleNodesRef = useRef<typeof visibleNodes>([])

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

  /** Expand all nodes in the tree */
  const expandAll = () => {
    const all = new Set<string>();
    const walk = (node: ComposedObject) => {
      all.add(node.name);
      node.children?.forEach(walk);
    };
    walk(composedObject);
    setExpandedNodes(all);
  };

  /** Collapse all nodes except the root */
  const collapseAll = () => {
    setExpandedNodes(new Set([composedObject.name]));
  };

  /**
   * Returns the match hint string if this node matches `term`, or null if no match.
   * Priority: friendly name > IFC class > path > attribute key > attribute value.
   */
  const getMatchInfo = (node: ComposedObject, term: string): { matches: boolean; hint?: string } => {
    const lower = term.toLowerCase();

    // 1. Friendly name
    if (getFriendlyName(node).toLowerCase().includes(lower)) return { matches: true };

    // 2. Node type
    if (node.type?.toLowerCase().includes(lower)) return { matches: true };

    // 3. IFC class code
    const ifcClass = getIfcClass(node);
    if (ifcClass?.toLowerCase().includes(lower)) return { matches: true };

    // 4. Full path (path segments)
    if (node.name.toLowerCase().includes(lower)) {
      return { matches: true, hint: `path: ${node.name}` };
    }

    // 5. Attribute keys and values (covers GUIDs, names, codes, classifications, etc.)
    if (node.attributes) {
      for (const [key, val] of Object.entries(node.attributes)) {
        // Skip internal and large geometry keys for perf
        if (key.startsWith('__internal_') || key.includes('mesh::') || key.includes('basiscurves::')) continue;

        if (key.toLowerCase().includes(lower)) {
          return { matches: true, hint: `attr: ${key.split('::').pop() ?? key}` };
        }
        const snippet = searchAttrValue(val, lower);
        if (snippet !== null) {
          const shortKey = key.split('::').pop() ?? key;
          const shortVal = snippet.length > 30 ? snippet.slice(0, 30) + '…' : snippet;
          return { matches: true, hint: `${shortKey}: ${shortVal}` };
        }
      }
    }

    return { matches: false };
  };

  const hasMatchingDescendant = (node: ComposedObject, term: string): boolean => {
    if (!node.children) return false;
    for (const child of node.children) {
      if (getMatchInfo(child, term).matches) return true;
      if (hasMatchingDescendant(child, term)) return true;
    }
    return false;
  };

  const visibleNodes = useMemo(() => {
    const list: Array<{
      node: ComposedObject;
      level: number;
      hasChildren: boolean;
      isExpanded: boolean;
      matchHint?: string;
    }> = [];
    const term = searchTerm.trim();

    const walk = (node: ComposedObject, level: number) => {
      const hasChildren = !!node.children?.length;
      const matchInfo = term ? getMatchInfo(node, term) : { matches: true };
      const childMatch = term ? hasMatchingDescendant(node, term) : false;
      const shouldShow = !term || matchInfo.matches || childMatch;

      if (!shouldShow) return;

      const shouldExpand =
        expandedNodes.has(node.name) ||
        (!!term && childMatch) ||
        (!!selectedPath && node.name && selectedPath.startsWith(node.name));

      list.push({
        node,
        level,
        hasChildren,
        isExpanded: shouldExpand,
        matchHint: term && matchInfo.matches ? matchInfo.hint : undefined,
      });

      if (hasChildren && shouldExpand) {
        node.children!.forEach((child) => walk(child, level + 1));
      }
    };

    walk(composedObject, 0);
    return list;
  }, [composedObject, expandedNodes, searchTerm, selectedPath]);

  // Keep ref in sync with latest visibleNodes so scroll callbacks aren't stale
  visibleNodesRef.current = visibleNodes;

  // Count exact matches (not ancestors that just have match in descendants)
  const matchCount = useMemo(() => {
    if (!searchTerm.trim()) return 0;
    return visibleNodes.filter(item => item.matchHint !== undefined || getMatchInfo(item.node, searchTerm.trim()).matches).length;
  }, [visibleNodes, searchTerm]);

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

    // Find and scroll to the selected item.
    // visibleNodesRef.current is always fresh (updated synchronously above),
    // so even if the tree auto-expands after selectedPath changes the ref holds
    // the latest list by the time the timer fires.
    const timeoutId = setTimeout(() => {
      const index = visibleNodesRef.current.findIndex((item) => item.node.name === selectedPath);
      if (index !== -1 && listRef.current) {
        const targetTop = Math.max(0, index * itemHeight - containerHeight / 2 + itemHeight / 2);
        listRef.current.scrollTop = targetTop;
      }
    }, 80); // 80 ms — enough for one extra React render cycle after expansion

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
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={expandAll}
              className="h-7 px-2"
              title="Expand all nodes"
            >
              <ChevronsUpDown className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={collapseAll}
              className="h-7 px-2"
              title="Collapse all nodes"
            >
              <ChevronsDownUp className="w-3 h-3" />
            </Button>
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
        </div>

        {/* Search bar with match count and clear button */}
        <div className="relative">
          <Input
            type="text"
            placeholder="Search nodes, GUID, path, attribute…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 text-sm pr-16"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchTerm && matchCount > 0 && (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {matchCount} match{matchCount !== 1 ? 'es' : ''}
              </span>
            )}
            {searchTerm && matchCount === 0 && (
              <span className="text-[10px] text-red-400 whitespace-nowrap">no match</span>
            )}
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-muted-foreground hover:text-foreground"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

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
            <span className="text-muted-foreground ml-auto">{stats.totalNodes} total</span>
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
              searchTerm={searchTerm.trim()}
              matchHint={item.matchHint}
            />
          )}
        />
      </div>
    </div>
  );
};
