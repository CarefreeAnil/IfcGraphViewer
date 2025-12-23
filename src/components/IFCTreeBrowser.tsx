import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { toast } from 'sonner';
import { GraphNode, GraphEdge } from '@/types/graph';
import { getEntityDef, getEntityColor, getEntityDisplayName, getEntityCategory } from '@/lib/ifcSchema';

interface TreeNode {
  id: string;
  label: string;
  ifcType: string;
  expressId?: number;
  children: TreeNode[];
  level: number;
  hasReferences: boolean;
  isGraphVisible?: boolean;
}

interface IFCTreeBrowserProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  onNodeSelect: (node: GraphNode | null) => void;
}

// Build tree structure from graph
function buildTreeStructure(nodes: GraphNode[], edges: GraphEdge[]): TreeNode[] {
  const nodeMap = new Map<string, GraphNode>();
  const treeNodeMap = new Map<string, TreeNode>();
  const childrenMap = new Map<string, Set<string>>();
  const referenceMap = new Map<string, Set<string>>();

  // Build maps
  nodes.forEach((node) => nodeMap.set(node.id, node));
  
  // Find parent-child relationships
  edges.forEach((edge) => {
    if (!childrenMap.has(edge.source)) {
      childrenMap.set(edge.source, new Set());
    }
    childrenMap.get(edge.source)?.add(edge.target);

    // Track references for auto-expansion
    if (!referenceMap.has(edge.source)) {
      referenceMap.set(edge.source, new Set());
    }
    referenceMap.get(edge.source)?.add(edge.target);
  });

  // Find root nodes (nodes with no parents)
  const childNodeIds = new Set<string>();
  edges.forEach((edge) => {
    childNodeIds.add(edge.target);
  });

  // Build tree nodes recursively
  function buildNode(nodeId: string, level: number): TreeNode {
    if (treeNodeMap.has(nodeId)) {
      return treeNodeMap.get(nodeId)!;
    }

    const graphNode = nodeMap.get(nodeId);
    if (!graphNode) return null as any;

    const children: TreeNode[] = [];
    const childIds = childrenMap.get(nodeId) || new Set();
    
    childIds.forEach((childId) => {
      const childNode = buildNode(childId, level + 1);
      if (childNode) {
        children.push(childNode);
      }
    });

    // Sort children by label
    children.sort((a, b) => a.label.localeCompare(b.label));

    const treeNode: TreeNode = {
      id: graphNode.id,
      label: graphNode.label,
      ifcType: graphNode.ifcType,
      expressId: graphNode.expressId,
      children,
      level,
      hasReferences: referenceMap.has(nodeId) && (referenceMap.get(nodeId)?.size || 0) > 0,
      isGraphVisible: graphNode.isGraphVisible !== false, // Default to true for backward compatibility
    };

    treeNodeMap.set(nodeId, treeNode);
    return treeNode;
  }

  // Get root nodes
  const rootIds = nodes
    .filter((n) => !childNodeIds.has(n.id))
    .map((n) => n.id)
    .sort();

  const roots: TreeNode[] = [];
  rootIds.forEach((id) => {
    const node = buildNode(id, 0);
    if (node) {
      roots.push(node);
    }
  });

  return roots;
}

// Tree item component
interface TreeItemProps {
  node: TreeNode;
  selected: boolean;
  onSelect: (nodeId: string) => void;
  expanded: Map<string, boolean>;
  onToggleExpanded: (nodeId: string) => void;
}

const TreeItem = ({ node, selected, onSelect, expanded, onToggleExpanded }: TreeItemProps) => {
  const isExpanded = expanded.get(node.id) ?? (node.hasReferences ? true : node.children.length === 0);
  const schemaDef = getEntityDef(node.ifcType);
  const schemaColor = schemaDef?.color || '#888';

  return (
    <div>
      <div
        className={`
          flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors
          ${selected 
            ? 'bg-primary/20 border border-primary/40' 
            : 'hover:bg-muted/50'
          }
        `}
        onClick={() => onSelect(node.id)}
      >
        {node.children.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded(node.id);
            }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}
        
        {/* Schema color indicator */}
        <div 
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: schemaColor }}
          title={schemaDef?.displayName}
        />
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {node.label}
            {node.isGraphVisible === false && (
              <span className="ml-2 text-xs text-muted-foreground opacity-60">(hidden in graph)</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">{node.ifcType}</div>
        </div>
        {node.hasReferences && (
          <ExternalLink className="w-3 h-3 opacity-40 flex-shrink-0" />
        )}
      </div>

      {isExpanded && node.children.length > 0 && (
        <div className="pl-4 border-l border-border ml-2">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              selected={selected}
              onSelect={onSelect}
              expanded={expanded}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const IFCTreeBrowser = ({ nodes, edges, selectedNodeId, onNodeSelect }: IFCTreeBrowserProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Map<string, boolean>>(new Map());

  const tree = useMemo(() => buildTreeStructure(nodes, edges), [nodes, edges]);

  // Filter nodes based on search query
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    
    const query = searchQuery.toLowerCase();
    return nodes.filter(
      (n) =>
        n.label.toLowerCase().includes(query) ||
        n.ifcType.toLowerCase().includes(query) ||
        (n.id && n.id.toLowerCase().includes(query))
    );
  }, [nodes, searchQuery]);

  const handleToggleExpanded = useCallback((nodeId: string) => {
    const newExpanded = new Map(expanded);
    newExpanded.set(nodeId, !newExpanded.get(nodeId));
    setExpanded(newExpanded);
  }, [expanded]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Find inverse references for selected node
  const inverseEdges = useMemo(() => {
    if (!selectedNodeId) return [];
    return edges.filter((e) => e.target === selectedNodeId);
  }, [edges, selectedNodeId]);

  const forwardEdges = useMemo(() => {
    if (!selectedNodeId) return [];
    return edges.filter((e) => e.source === selectedNodeId);
  }, [edges, selectedNodeId]);

  return (
    <div className="h-full flex flex-col bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="border-b border-border p-4 space-y-3 flex-shrink-0">
        <h3 className="text-sm font-semibold">IFC Model Browser</h3>
        <Input
          placeholder="Search entities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* Main Tree View (Top) */}
      <ResizablePanelGroup direction="vertical" className="flex-1 overflow-hidden">
        <ResizablePanel defaultSize={60} minSize={30} className="overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="p-4 space-y-1">
              {searchQuery.trim() ? (
                // Show flat list when searching
                filteredNodes.map((node) => (
                  <div
                    key={node.id}
                    onClick={() => onNodeSelect(node)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors text-sm
                      ${selectedNodeId === node.id
                        ? 'bg-primary/20 border border-primary/40'
                        : 'hover:bg-muted/50'
                      }
                    `}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{node.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{node.ifcType}</div>
                    </div>
                  </div>
                ))
              ) : (
                // Show tree structure when not searching
                tree.map((node) => (
                  <TreeItem
                    key={node.id}
                    node={node}
                    selected={selectedNodeId === node.id}
                    onSelect={(id) => {
                      const graphNode = nodes.find((n) => n.id === id);
                      onNodeSelect(graphNode || null);
                    }}
                    expanded={expanded}
                    onToggleExpanded={handleToggleExpanded}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle />

        {/* Inverse References Panel (Bottom) */}
        <ResizablePanel defaultSize={40} minSize={20} className="overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="p-4">
              {selectedNode ? (
                <InverseReferencesPanel
                  selectedNode={selectedNode}
                  nodes={nodes}
                  edges={edges}
                  onNodeSelect={onNodeSelect}
                  inverseEdges={inverseEdges}
                  forwardEdges={forwardEdges}
                />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <p className="text-sm">Select an entity to view inverse references</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

// Inverse References Panel
interface InverseReferencesPanelProps {
  selectedNode: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeSelect: (node: GraphNode | null) => void;
  inverseEdges: GraphEdge[];
  forwardEdges: GraphEdge[];
}

const InverseReferencesPanel = ({
  selectedNode,
  nodes,
  edges,
  onNodeSelect,
  inverseEdges,
  forwardEdges,
}: InverseReferencesPanelProps) => {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const handleCopyId = useCallback(() => {
    navigator.clipboard.writeText(selectedNode.id);
    toast.success('Entity ID copied to clipboard');
  }, [selectedNode.id]);

  return (
    <div className="space-y-4">
      {/* Selected Entity Info */}
      <div className="bg-muted/30 rounded-lg p-3 space-y-2 sticky top-0 z-10">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-foreground">{selectedNode.label}</div>
            <div className="text-xs text-muted-foreground">{selectedNode.ifcType}</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyId}
            className="h-7 w-7 p-0"
            title="Copy ID"
          >
            <Copy className="w-3 h-3" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground break-all font-mono">{selectedNode.id}</div>
      </div>

      {/* Properties */}
      {Object.keys(selectedNode.properties).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Properties</h4>
          <div className="bg-muted/20 rounded p-2 space-y-1 max-h-40 overflow-y-auto">
            {Object.entries(selectedNode.properties).slice(0, 10).map(([key, value]) => (
              <div key={key} className="text-xs">
                <span className="font-medium text-foreground">{key}:</span>
                <span className="text-muted-foreground ml-1">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
            {Object.keys(selectedNode.properties).length > 10 && (
              <div className="text-xs text-muted-foreground italic">
                +{Object.keys(selectedNode.properties).length - 10} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inverse References (incoming edges) */}
      {inverseEdges.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">
            Referenced By ({inverseEdges.length})
          </h4>
          <div className="space-y-1.5">
            {inverseEdges.map((edge) => {
              const refNode = nodeMap.get(edge.source);
              return (
                <div
                  key={edge.id}
                  onClick={() => refNode && onNodeSelect(refNode)}
                  className="p-2 rounded-md bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-xs font-medium text-foreground truncate">{refNode?.label}</div>
                    <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                  </div>
                  <div className="text-xs text-muted-foreground">{refNode?.ifcType}</div>
                  <div className="text-xs text-primary/70 mt-1">← {edge.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Forward References (outgoing edges) */}
      {forwardEdges.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">
            References ({forwardEdges.length})
          </h4>
          <div className="space-y-1.5">
            {forwardEdges.map((edge) => {
              const refNode = nodeMap.get(edge.target);
              return (
                <div
                  key={edge.id}
                  onClick={() => refNode && onNodeSelect(refNode)}
                  className="p-2 rounded-md bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-xs font-medium text-foreground truncate">{refNode?.label}</div>
                    <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                  </div>
                  <div className="text-xs text-muted-foreground">{refNode?.ifcType}</div>
                  <div className="text-xs text-primary/70 mt-1">{edge.label} →</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {inverseEdges.length === 0 && forwardEdges.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No references found</p>
        </div>
      )}
    </div>
  );
};
