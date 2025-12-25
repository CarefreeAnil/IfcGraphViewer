import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Tag, ChevronRight, ChevronDown, FileCode, Hash, Box } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GraphNode, NodeType } from '@/types/graph';
import { getEntityDef, getEntityDisplayName, getEntityColor } from '@/lib/ifcSchema';

interface PropertyViewerProps {
  nodes: GraphNode[];
  onNodeSelect: (node: GraphNode) => void;
  selectedNodeId: string | null;
}

const TYPE_COLORS: Record<NodeType, string> = {
  building: 'bg-node-building/20 text-node-building border-node-building/30',
  space: 'bg-node-space/20 text-node-space border-node-space/30',
  element: 'bg-node-element/20 text-node-element border-node-element/30',
  property: 'bg-node-property/20 text-node-property border-node-property/30',
  relationship: 'bg-node-relationship/20 text-node-relationship border-node-relationship/30',
  geometry: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
  other: 'bg-gray-600/20 text-gray-600 border-gray-600/30',
};

interface GroupedNodes {
  [ifcType: string]: GraphNode[];
}

export function PropertyViewer({ nodes, onNodeSelect, selectedNodeId }: PropertyViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const query = searchQuery.toLowerCase();
    return nodes.filter(node => 
      node.label.toLowerCase().includes(query) ||
      node.ifcType.toLowerCase().includes(query) ||
      Object.entries(node.properties).some(([key, value]) => 
        key.toLowerCase().includes(query) || 
        String(value).toLowerCase().includes(query)
      )
    );
  }, [nodes, searchQuery]);

  const groupedNodes = useMemo(() => {
    const groups: GroupedNodes = {};
    filteredNodes.forEach(node => {
      if (!groups[node.ifcType]) {
        groups[node.ifcType] = [];
      }
      groups[node.ifcType].push(node);
    });
    return groups;
  }, [filteredNodes]);

  const toggleType = (ifcType: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(ifcType)) {
        next.delete(ifcType);
      } else {
        next.add(ifcType);
      }
      return next;
    });
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const formatPropertyValue = (value: any): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="flex flex-col h-full bg-card/95 backdrop-blur-md">
      {/* Search Header */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search entities, types, or properties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted/50 border-border"
          />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {filteredNodes.length} entities in {Object.keys(groupedNodes).length} types
        </div>
      </div>

      {/* Entity List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {Object.entries(groupedNodes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([ifcType, typeNodes]) => {
              const schemaDef = getEntityDef(ifcType);
              const displayName = schemaDef?.displayName || ifcType;
              const schemaColor = schemaDef?.color || '#888';
              
              return (
                <div key={ifcType} className="mb-1">
                {/* Type Header */}
                <button
                  onClick={() => toggleType(ifcType)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                >
                  {expandedTypes.has(ifcType) ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: schemaColor }}
                    title={schemaDef?.description}
                  />
                  <div className="flex-1">
                    <span className="font-mono text-sm text-foreground">{ifcType}</span>
                    {displayName !== ifcType && (
                      <span className="text-xs text-muted-foreground ml-2">({displayName})</span>
                    )}
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {typeNodes.length}
                  </span>
                </button>

                {/* Nodes in Type */}
                {expandedTypes.has(ifcType) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="ml-4 border-l border-border pl-2"
                  >
                    {typeNodes.map(node => (
                      <div key={node.id} className="mb-1">
                        {/* Node Header */}
                        <button
                          onClick={() => {
                            toggleNode(node.id);
                            onNodeSelect(node);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-left ${
                            selectedNodeId === node.id 
                              ? 'bg-primary/20 border border-primary/30' 
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          {expandedNodes.has(node.id) ? (
                            <ChevronDown className="w-3 h-3 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-muted-foreground" />
                          )}
                          <div className={`p-1 rounded border ${TYPE_COLORS[node.type]}`}>
                            <Box className="w-3 h-3" />
                          </div>
                          <span className="text-sm text-foreground truncate flex-1">
                            {node.label}
                          </span>
                          {node.expressId && (
                            <span className="text-xs text-muted-foreground font-mono">
                              #{node.expressId}
                            </span>
                          )}
                        </button>

                        {/* Node Properties */}
                        {expandedNodes.has(node.id) && Object.keys(node.properties).length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="ml-6 mt-1 mb-2 bg-muted/30 rounded-md p-2 space-y-1"
                          >
                            <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
                              <Tag className="w-3 h-3" />
                              <span>Properties</span>
                            </div>
                            {Object.entries(node.properties).map(([key, value]) => (
                              <div
                                key={key}
                                className="flex items-start justify-between gap-2 px-2 py-1 rounded bg-background/50 text-xs"
                              >
                                <span className="text-muted-foreground font-medium min-w-0 break-words">
                                  {key}
                                </span>
                                <span className="text-foreground font-mono text-right min-w-0 break-all">
                                  {formatPropertyValue(value)}
                                </span>
                              </div>
                            ))}
                            
                            {/* Express ID */}
                            {node.expressId && (
                              <div className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-background/50 text-xs mt-2 border-t border-border pt-2">
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Hash className="w-3 h-3" />
                                  Express ID
                                </span>
                                <span className="text-foreground font-mono">#{node.expressId}</span>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            );
            })}

          {Object.keys(groupedNodes).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No entities found</p>
              {searchQuery && (
                <p className="text-xs mt-1">Try adjusting your search</p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
