import { useState, useMemo, useCallback, useEffect, useRef, useDeferredValue } from 'react';
import { Copy, ChevronDown, ChevronRight, Search, Hash, ArrowUpFromLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { toast } from 'sonner';
import { GraphNode, GraphEdge, ParsedIFCData } from '@/types/graph';
import { getEntityDef, getNormalizedPropertyName, findBestMatchingProperty } from '@/lib/ifcSchema';
import { cn } from '@/lib/utils';

interface IFCBrowserProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  onNodeSelect: (node: GraphNode | null) => void;
  metadata?: ParsedIFCData['metadata'];
}

// Color classes for syntax highlighting
const SYNTAX_COLORS = {
  stepId: 'text-amber-500 font-semibold',        // #123
  entityType: 'text-blue-500 font-semibold',     // IFCWALL
  string: 'text-green-600',                      // 'text'
  number: 'text-purple-500',                     // 123.45
  boolean: 'text-pink-500',                      // .T. or .F.
  null: 'text-gray-400',                         // $
  enum: 'text-cyan-500',                         // .ELEMENT.
  reference: 'text-amber-500 cursor-pointer hover:underline', // #123 (clickable)
  punctuation: 'text-gray-500',                  // (), =, ;
  propertyName: 'text-sky-400',                  // Property names
};

// Helper to copy text to clipboard
function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text);
  toast.success('Copied to clipboard');
}

// Format a property value for IFC-style display (plain text)
function formatPropertyValue(value: any): string {
  if (value === null || value === undefined) return '$';
  if (typeof value === 'string') {
    if (value.startsWith('#')) return value;
    if (value.startsWith('.') && value.endsWith('.')) return value;
    return `'${value}'`;
  }
  if (typeof value === 'boolean') return value ? '.T.' : '.F.';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return `(${value.map(formatPropertyValue).join(',')})`;
  }
  if (typeof value === 'object') {
    if (value.value !== undefined) return formatPropertyValue(value.value);
    return '$';
  }
  return String(value);
}

// Build proper IFC STEP line (plain text)
function buildPlainIFCLine(node: GraphNode): string {
  const stepId = node.expressId || 0;
  const entityDef = getEntityDef(node.ifcType);
  const propValues: string[] = [];
  const usedKeys = new Set<string>();

  if (entityDef && entityDef.properties) {
    for (const propDef of entityDef.properties) {
      let value: any = undefined;

      if (node.properties[propDef.name] !== undefined) {
        value = node.properties[propDef.name];
        usedKeys.add(propDef.name);
      } else {
        const normalizedName = getNormalizedPropertyName(node.ifcType, propDef.name);
        if (normalizedName !== propDef.name && node.properties[normalizedName] !== undefined) {
          value = node.properties[normalizedName];
          usedKeys.add(normalizedName);
        } else {
          const lowerPropName = propDef.name.toLowerCase();
          const dataKeys = Object.keys(node.properties);
          let bestMatch: string | undefined;
          for (const key of dataKeys) {
            if (key.toLowerCase() === lowerPropName) {
              bestMatch = key;
              break;
            }
          }
          if (!bestMatch) {
            bestMatch = findBestMatchingProperty(node.ifcType, propDef.name, dataKeys);
          }
          if (bestMatch && node.properties[bestMatch] !== undefined) {
            value = node.properties[bestMatch];
            usedKeys.add(bestMatch);
          }
        }
      }
      propValues.push(formatPropertyValue(value));
    }
  }

  const remainingKeys = Object.keys(node.properties).filter(k => !usedKeys.has(k));
  for (const key of remainingKeys) {
    const value = node.properties[key];
    if (!key.includes('_') && key !== 'id' && !key.startsWith('__')) {
      propValues.push(formatPropertyValue(value));
    }
  }

  const propsStr = propValues.length > 0 ? propValues.join(',') : '';
  return `#${stepId}= ${node.ifcType}(${propsStr});`;
}

// Component to display STEP line with syntax highlighting and expandable references
function StepLineViewer({ 
  node, 
  nodes,
  nodeByExpressId,
  onReferenceClick, 
  isSelected, 
  onClick,
  selectedRef 
}: {
  node: GraphNode;
  nodes: GraphNode[];
  nodeByExpressId: Map<number, GraphNode>;
  onReferenceClick: (stepId: number) => void;
  isSelected?: boolean;
  onClick?: () => void;
  selectedRef: React.RefObject<HTMLDivElement> | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get the raw STEP line from properties
  const rawStepLine = node.properties._ifcStep as string || '';
  
  // Extract reference IDs from the STEP line (find all #NUMBER patterns)
  const references = useMemo(() => {
    const refs: { stepId: number; position: number }[] = [];
    const refRegex = /#(\d+)/g;
    let match;
    
    while ((match = refRegex.exec(rawStepLine)) !== null) {
      const stepId = parseInt(match[1], 10);
      // Skip the entity's own ID at the start
      if (stepId !== node.expressId) {
        refs.push({ stepId, position: match.index });
      }
    }
    
    // Remove duplicates
    const unique = new Map<number, { stepId: number; position: number }>();
    refs.forEach(r => {
      if (!unique.has(r.stepId)) {
        unique.set(r.stepId, r);
      }
    });
    
    return Array.from(unique.values()).sort((a, b) => a.position - b.position);
  }, [rawStepLine, node.expressId]);
  
  // Color-code the STEP line for syntax highlighting
  const renderStepLine = () => {
    if (!rawStepLine) return null;
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const refRegex = /#(\d+)/g;
    let match;
    const matches: Array<{ index: number; length: number; stepId: number }> = [];
    
    while ((match = refRegex.exec(rawStepLine)) !== null) {
      const stepId = parseInt(match[1], 10);
      matches.push({ index: match.index, length: match[0].length, stepId });
    }
    
    // Add non-reference parts and reference parts
    for (const ref of matches) {
      if (ref.index > lastIndex) {
        const text = rawStepLine.substring(lastIndex, ref.index);
        // Color code the text
        if (text.includes('=')) {
          parts.push(<span key={`text-${lastIndex}`} className={SYNTAX_COLORS.punctuation}>{text}</span>);
        } else if (text.includes('(')) {
          parts.push(<span key={`text-${lastIndex}`} className={SYNTAX_COLORS.punctuation}>{text.substring(0, text.lastIndexOf('('))}</span>);
          parts.push(<span key={`paren-${lastIndex}`} className={SYNTAX_COLORS.punctuation}>{'('}</span>);
        } else {
          parts.push(<span key={`text-${lastIndex}`}>{text}</span>);
        }
      }
      
      parts.push(
        <span
          key={`ref-${ref.stepId}-${ref.index}`}
          className={SYNTAX_COLORS.reference}
          onClick={() => onReferenceClick(ref.stepId)}
        >
          #{ref.stepId}
        </span>
      );
      
      lastIndex = ref.index + ref.length;
    }
    
    if (lastIndex < rawStepLine.length) {
      parts.push(
        <span key="end">{rawStepLine.substring(lastIndex)}</span>
      );
    }
    
    return parts;
  };

  return (
    <div ref={selectedRef}>
      <div
        className={cn(
          'flex items-start gap-1 px-2 py-1.5 cursor-pointer transition-colors font-mono text-xs',
          'border-l-2 border-transparent hover:bg-muted/30',
          isSelected && 'bg-primary/15 border-l-primary'
        )}
        onClick={onClick}
      >
        {/* Expand/Collapse Toggle */}
        {references.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* STEP Line with syntax highlighting */}
        <div className="flex-1 min-w-0 break-words whitespace-pre-wrap">
          {renderStepLine()}
        </div>
      </div>

      {/* Expanded References */}
      {isExpanded && references.length > 0 && (
        <div className="ml-6 border-l-2 border-blue-500/30 bg-blue-500/5">
          {references.map((ref) => {
            const refNode = nodeByExpressId.get(ref.stepId);
            const rawRefStepLine = refNode?.properties?._ifcStep as string || '';
            return (
              <div
                key={`${ref.stepId}-expanded`}
                className="px-2 py-1.5 hover:bg-blue-500/10 cursor-pointer transition-colors text-xs border-b border-blue-500/10"
                onClick={() => onReferenceClick(ref.stepId)}
              >
                {refNode ? (
                  <div className="font-mono flex items-start gap-2">
                    <span className="shrink-0">
                      <span className={SYNTAX_COLORS.stepId}>#{ref.stepId}</span>
                    </span>
                    <span className="text-muted-foreground truncate break-words flex-1">
                      {rawRefStepLine}
                    </span>
                  </div>
                ) : (
                  <span className={SYNTAX_COLORS.stepId}>#{ref.stepId}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}



// Reference extraction helper
function extractReferencesFromValue(value: any, maxDepth: number = 2, propertyName?: string): number[] {
  if (maxDepth <= 0) return [];

  const refs: number[] = [];
  const seen = new Set<number>();

  const METADATA_PROPERTIES = new Set([
    'ownerhistory', 'lastmodifyinguser', 'lastmodifyingapplication',
    'creationdate', 'owninguser', 'owningapplication',
    '_schemacolor', '_entitytype', '_expressid',  // Internal properties added during parsing
  ]);

  if (propertyName && METADATA_PROPERTIES.has(propertyName.toLowerCase())) {
    return [];
  }

  function traverse(val: any, depth: number, propName?: string) {
    if (depth > maxDepth) return;
    if (propName && METADATA_PROPERTIES.has(propName.toLowerCase())) return;

    if (val === null || val === undefined) return;

    // Handle string references like "#1", "#123"
    if (typeof val === 'string') {
      if (val.startsWith('#')) {
        const refId = parseInt(val.substring(1), 10);
        if (!isNaN(refId) && !seen.has(refId)) {
          refs.push(refId);
          seen.add(refId);
        }
      }
      return;
    }

    // Handle numeric expressID properties
    if (typeof val === 'number') {
      // Skip numbers that don't look like valid express IDs (too large or negative)
      if (val > 0 && val < 100000 && !seen.has(val)) {
        // This could be an express ID, but we need context
        // We'll only add it if we're in an object that looks like a reference
      }
      return;
    }

    // Handle arrays
    if (Array.isArray(val)) {
      for (const item of val) {
        traverse(item, depth + 1, propName);
      }
      return;
    }

    // Handle objects
    if (typeof val === 'object') {
      // Direct object reference with expressID property
      if (val.expressID !== undefined && typeof val.expressID === 'number') {
        const refId = val.expressID;
        if (refId > 0 && !seen.has(refId)) {
          refs.push(refId);
          seen.add(refId);
        }
        return; // Don't traverse deeper if we found expressID
      }

      // Handle wrapped values
      if (val.value !== undefined) {
        traverse(val.value, depth + 1, propName);
        return;
      }

      // Recursively traverse object properties (up to maxDepth)
      if (depth < maxDepth) {
        for (const [key, objVal] of Object.entries(val)) {
          // Skip internal/metadata properties
          if (key.toLowerCase().includes('owner') || key.toLowerCase().includes('history')) {
            continue;
          }
          traverse(objVal, depth + 1, key);
        }
      }
    }
  }

  traverse(value, 0, propertyName);
  return refs;
}

// Reference with context - includes the property name that creates the relationship
interface ReferenceWithContext {
  node: GraphNode;
  viaProperty: string;  // The property that creates this reference
}

// Build reference index with property context
function buildReferenceIndexWithContext(nodes: GraphNode[]): Map<string, Map<number, string[]>> {
  // Map<nodeId, Map<targetExpressId, propertyNames[]>>
  const referenceIndex = new Map<string, Map<number, string[]>>();

  const METADATA_PROPERTIES = new Set([
    'ownerhistory', 'lastmodifyinguser', 'lastmodifyingapplication',
    'creationdate', 'owninguser', 'owningapplication',
    '_schemacolor', '_entitytype', '_expressid',  // Internal properties added during parsing
  ]);

  for (const node of nodes) {
    const refs = new Map<number, string[]>();
    
    for (const [propName, propValue] of Object.entries(node.properties)) {
      if (METADATA_PROPERTIES.has(propName.toLowerCase())) continue;
      
      const extracted = extractReferencesFromValue(propValue, 2, propName);
      for (const refId of extracted) {
        if (!refs.has(refId)) {
          refs.set(refId, []);
        }
        const props = refs.get(refId)!;
        if (!props.includes(propName)) {
          props.push(propName);
        }
      }
    }
    
    if (refs.size > 0) {
      referenceIndex.set(node.id, refs);
    }
  }

  return referenceIndex;
}

export const IFCBrowser = ({ nodes, edges, selectedNodeId, onNodeSelect, metadata }: IFCBrowserProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);
  const [goToId, setGoToId] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const isProgrammaticScroll = useRef(false);
  const selectedRef = useRef<HTMLDivElement>(null);
  const entityListRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Pre-compute reference index with property context
  const referenceIndexWithContext = useMemo(() => buildReferenceIndexWithContext(nodes), [nodes]);

  // Node lookup maps
  const nodeById = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const nodeByExpressId = useMemo(() => new Map(nodes.map(n => [n.expressId, n])), [nodes]);

  // Predecessors map (who references this entity) - based on STEP line content
  const predecessorsMap = useMemo(() => {
    const map = new Map<string, ReferenceWithContext[]>();

    if (!selectedNodeId) return map;
    
    const selectedNode = nodeById.get(selectedNodeId);
    if (!selectedNode) return map;

    // Get the expressId of the selected entity
    const selectedExpressId = selectedNode.expressId;
    if (!selectedExpressId) return map;

    // Look for all nodes whose STEP lines contain the selected entity's ID
    const searchPattern = `#${selectedExpressId}`;
    
    for (const node of nodes) {
      // Don't reference itself
      if (node.id === selectedNodeId) continue;

      // Get the raw STEP line
      const rawStepLine = node.properties._ifcStep as string || '';
      
      // Check if this node's STEP line contains a reference to the selected entity
      // Make sure it's an actual reference (preceded by #)
      if (rawStepLine.includes(searchPattern)) {
        // Extract all references from this line to determine "viaProperty"
        const refMatches = rawStepLine.matchAll(/#(\d+)/g);
        const referencedIds: string[] = [];
        for (const match of refMatches) {
          const id = match[1];
          if (id === String(selectedExpressId)) {
            referencedIds.push(id);
          }
        }

        if (referencedIds.length > 0) {
          const nodeId = node.id;
          if (!map.has(selectedNodeId)) {
            map.set(selectedNodeId, []);
          }
          const existing = map.get(selectedNodeId)!;
          if (!existing.find(r => r.node.id === nodeId)) {
            existing.push({
              node,
              viaProperty: 'STEP Content'
            });
          }
        }
      }
    }

    return map;
  }, [nodes, selectedNodeId, nodeById]);

  // Successors map (what this entity references) with context
  const successorsMap = useMemo(() => {
    const map = new Map<string, ReferenceWithContext[]>();

    // From edges
    edges.forEach((edge) => {
      if (!map.has(edge.source)) {
        map.set(edge.source, []);
      }
      const targetNode = nodeById.get(edge.target);
      if (targetNode) {
        const existing = map.get(edge.source)!;
        if (!existing.find(r => r.node.id === targetNode.id)) {
          existing.push({ node: targetNode, viaProperty: edge.label || 'relationship' });
        }
      }
    });

    // From property references
    for (const [sourceNodeId, refMap] of referenceIndexWithContext.entries()) {
      if (!map.has(sourceNodeId)) {
        map.set(sourceNodeId, []);
      }

      for (const [refId, propertyNames] of refMap.entries()) {
        const targetNode = nodeByExpressId.get(refId);
        if (targetNode && targetNode.id !== sourceNodeId) {
          const existing = map.get(sourceNodeId)!;
          if (!existing.find(r => r.node.id === targetNode.id)) {
            existing.push({ 
              node: targetNode, 
              viaProperty: propertyNames.join(', ') 
            });
          }
        }
      }
    }

    return map;
  }, [nodes, edges, referenceIndexWithContext, nodeById, nodeByExpressId]);

  // Sort nodes by stepId
  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => (a.expressId || 0) - (b.expressId || 0));
  }, [nodes]);

  // Filter nodes
  const filteredNodes = useMemo(() => {
    if (!deferredQuery.trim()) return sortedNodes;

    const query = deferredQuery.toLowerCase();
    return sortedNodes.filter(
      (n) =>
        n.label.toLowerCase().includes(query) ||
        n.ifcType.toLowerCase().includes(query) ||
        (n.expressId && n.expressId.toString().includes(query))
    );
  }, [sortedNodes, deferredQuery]);

  // CRITICAL: Virtual scrolling window - only render visible items
  const ITEM_HEIGHT = 24; // Height of each entity row in pixels
  const VISIBLE_ITEMS = 50; // Number of items to render (50 items = ~1200px)
  
  const visibleStartIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - VISIBLE_ITEMS);
  const visibleEndIndex = Math.min(filteredNodes.length, visibleStartIndex + VISIBLE_ITEMS * 3); // 3x buffer
  const visibleNodes = filteredNodes.slice(visibleStartIndex, visibleEndIndex);
  const offsetY = visibleStartIndex * ITEM_HEIGHT;
  const totalHeight = filteredNodes.length * ITEM_HEIGHT;

  // Selected node data
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) : null;
  const predecessors = useMemo(() => {
    if (!selectedNodeId) return [];
    return predecessorsMap.get(selectedNodeId) || [];
  }, [selectedNodeId, predecessorsMap]);

  const successors = useMemo(() => {
    if (!selectedNodeId) return [];
    return successorsMap.get(selectedNodeId) || [];
  }, [selectedNodeId, successorsMap]);

  // Handle reference click
  const handleRefClick = useCallback(
    (stepId: number) => {
      const targetNode = nodeByExpressId.get(stepId);
      if (targetNode) {
        onNodeSelect(targetNode);
      }
    },
    [nodeByExpressId, onNodeSelect]
  );

  // Reset scroll when search changes
  useEffect(() => {
    if (entityListRef.current) {
      entityListRef.current.scrollTop = 0;
    }
  }, [deferredQuery]);

  // Handle Go to ID
  const handleGoToId = useCallback(() => {
    const id = parseInt(goToId.replace('#', ''), 10);
    if (!isNaN(id)) {
      const targetNode = nodeByExpressId.get(id);
      if (targetNode) {
        onNodeSelect(targetNode);
        setGoToId('');
        
        // Scroll to item
        const nodeIndex = filteredNodes.findIndex(n => n.id === targetNode.id);
        if (nodeIndex >= 0 && entityListRef.current) {
          const targetScrollTop = nodeIndex * ITEM_HEIGHT;
          entityListRef.current.scrollTop = Math.max(0, targetScrollTop - 300);
        }
      } else {
        toast.error(`Entity #${id} not found`);
      }
    }
  }, [goToId, nodeByExpressId, onNodeSelect, filteredNodes]);

  // Auto-scroll to selected node
  useEffect(() => {
    if (!selectedNodeId || !entityListRef.current) return;
    
    // Find the selected node's index in the filtered list
    const nodeIndex = filteredNodes.findIndex(n => n.id === selectedNodeId);
    if (nodeIndex < 0) {
      console.warn('[IFCBrowser] Selected node not found in filtered list:', selectedNodeId);
      return;
    }
    
    // Calculate scroll position - position item at 150px from top (about 6-7 items)
    const OFFSET_FROM_TOP = 150;
    const targetScrollTop = nodeIndex * ITEM_HEIGHT;
    const scrollPosition = Math.max(0, targetScrollTop - OFFSET_FROM_TOP);
    
    // Only scroll if the item is not already visible in a good position
    const currentScroll = entityListRef.current.scrollTop;
    const containerHeight = entityListRef.current.clientHeight;
    const itemTopInViewport = targetScrollTop - currentScroll;
    const isInGoodPosition = itemTopInViewport >= 100 && itemTopInViewport <= (containerHeight - 200);
    
    if (isInGoodPosition) {
      return;
    }
    
    // Mark as programmatic scroll to prevent onScroll from interfering
    isProgrammaticScroll.current = true;
    
    // Update state immediately (synchronously) for virtual list calculations
    setScrollTop(scrollPosition);
    
    // Set DOM scroll position
    if (entityListRef.current) {
      entityListRef.current.scrollTop = scrollPosition;
    }
    
    // Reset flag after scroll completes
    setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 200);
  }, [selectedNodeId, filteredNodes, ITEM_HEIGHT]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">IFC Browser</h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const lines: string[] = [];
              lines.push('ISO-10303-21;');
              lines.push('HEADER;');
              
              // Use metadata header if available, otherwise use defaults
              const header = metadata?.ifcHeader;
              const fileDesc = header?.fileDescription || 'ViewDefinition [CoordinationView]';
              const fileName = header?.fileName || 'exported.ifc';
              const fileSchema = header?.fileSchema || 'IFC2X3';
              const timeStamp = header?.timeStamp || '';
              
              lines.push(`FILE_DESCRIPTION(('${fileDesc}'),'2;1');`);
              // Include timestamp in FILE_NAME if available
              if (timeStamp) {
                lines.push(`FILE_NAME('${fileName}','${timeStamp}','','','','','');`);
              } else {
                lines.push(`FILE_NAME('${fileName}','','','','','','');`);
              }
              lines.push(`FILE_SCHEMA(('${fileSchema}'));`);
              lines.push('ENDSEC;');
              lines.push('');
              lines.push('DATA;');
              for (const node of sortedNodes) {
                lines.push(buildPlainIFCLine(node));
              }
              lines.push('ENDSEC;');
              lines.push('END-ISO-10303-21;');
              copyToClipboard(lines.join('\n'));
            }}
            className="h-7"
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copy All
          </Button>
        </div>

        {/* Search and Go to ID */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by type, name, or #ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-sm pl-8 font-mono"
            />
          </div>
          <div className="flex gap-1">
            <Input
              placeholder="#ID"
              value={goToId}
              onChange={(e) => setGoToId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGoToId()}
              className="h-8 w-20 text-sm font-mono"
            />
            <Button size="sm" variant="outline" onClick={handleGoToId} className="h-8 px-2">
              <Hash className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {filteredNodes.length} of {nodes.length} entities
        </div>
      </div>

      {/* Main Split View */}
      <ResizablePanelGroup direction="vertical" className="flex-1">
        {/* Upper Panel: IFC File View with Header, Data, and Footer */}
        <ResizablePanel defaultSize={65} minSize={40}>
          <div className="h-full flex flex-col">
            {/* Header Section - Collapsible */}
            <div ref={headerRef} className="border-b border-border/30 bg-muted/20 relative">
              <button
                onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
                className="absolute right-1 top-1 z-10 px-2 py-0.5 text-[10px] rounded bg-muted/50 hover:bg-muted transition-colors"
              >
                {isHeaderExpanded ? 'Collapse' : 'Expand'}
              </button>
              <div className="p-1 font-mono text-xs text-muted-foreground">
                <div>ISO-10303-21;</div>
                {isHeaderExpanded ? (
                  <>
                    <div>HEADER;</div>
                    {metadata?.ifcHeader?.fullHeader ? (
                      <>
                        {metadata.ifcHeader.fullHeader.split('\n').map((line, idx) => (
                          <div key={idx}>{line}</div>
                        ))}
                      </>
                    ) : (
                      <>
                        <div>FILE_DESCRIPTION((<span className={SYNTAX_COLORS.string}>'{metadata?.ifcHeader?.fileDescription || 'ViewDefinition [CoordinationView]'}'</span>),'2;1');</div>
                        <div>FILE_NAME(<span className={SYNTAX_COLORS.string}>'{metadata?.ifcHeader?.fileName || ''}'</span>,'','','','','','');</div>
                        <div>FILE_SCHEMA((<span className={SYNTAX_COLORS.string}>'{metadata?.ifcHeader?.fileSchema || 'IFC2X3'}'</span>));</div>
                      </>
                    )}
                    <div>ENDSEC;</div>
                    <div className="my-1"></div>
                  </>
                ) : null}
                <div>DATA;</div>
              </div>
            </div>

            {/* Virtualized Entity List */}
            <div 
              ref={entityListRef}
              className="flex-1 overflow-y-auto font-mono text-xs"
              onScroll={(e) => {
                // Ignore scroll events during programmatic scrolls
                if (!isProgrammaticScroll.current) {
                  setScrollTop((e.target as HTMLDivElement).scrollTop);
                }
              }}
            >
              <div style={{ height: totalHeight, position: 'relative' }}>
                {/* Top spacer */}
                {visibleStartIndex > 0 && (
                  <div style={{ height: offsetY }} />
                )}
                
                {/* Visible items */}
                <div>
                  {visibleNodes.length > 0 ? (
                    visibleNodes.map((node) => (
                      <StepLineViewer
                        key={node.id}
                        node={node}
                        nodes={nodes}
                        nodeByExpressId={nodeByExpressId}
                        onReferenceClick={handleRefClick}
                        isSelected={selectedNodeId === node.id}
                        onClick={() => onNodeSelect(node)}
                        selectedRef={selectedNodeId === node.id ? selectedRef : null}
                      />
                    ))
                  ) : (
                    <div className="p-4 text-muted-foreground text-center text-xs">
                      No entities match search
                    </div>
                  )}
                </div>
                
                {/* Bottom spacer */}
                {visibleEndIndex < filteredNodes.length && (
                  <div style={{ height: (filteredNodes.length - visibleEndIndex) * ITEM_HEIGHT }} />
                )}
              </div>
            </div>

            {/* Footer Section - Not virtualized, always visible */}
            <div className="p-1 font-mono text-xs text-muted-foreground border-t border-border/30 bg-muted/20">
              <div>ENDSEC;</div>
              <div>END-ISO-10303-21;</div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Lower Panel: Referenced By (Inverse References) */}
        <ResizablePanel defaultSize={35} minSize={15}>
          <ScrollArea className="h-full">
            <div className="p-3">
              {selectedNode ? (
                <div className="space-y-2">
                  {/* Selected Entity Header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <span className={cn(SYNTAX_COLORS.stepId, 'text-sm')}>#{selectedNode.expressId}</span>
                    <span className={cn(SYNTAX_COLORS.entityType, 'text-sm')}>{selectedNode.ifcType}</span>
                    {selectedNode.label && selectedNode.label !== selectedNode.ifcType && (
                      <span className="text-muted-foreground text-xs">"{selectedNode.label}"</span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-6 px-2"
                      onClick={() => copyToClipboard(buildPlainIFCLine(selectedNode))}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Referenced By Section - Show STEP lines containing this entity */}
                  <div>
                    <h4 className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowUpFromLine className="h-3 w-3" />
                      Referenced By ({predecessors.length})
                    </h4>
                    {predecessors.length > 0 ? (
                      <div className="space-y-1">
                        {predecessors.map((ref) => {
                          const rawStepLine = ref.node.properties._ifcStep as string || '';
                          return (
                            <div
                              key={ref.node.id}
                              onClick={() => onNodeSelect(ref.node)}
                              className="p-1.5 rounded bg-orange-500/10 hover:bg-orange-500/20 cursor-pointer transition-colors border border-orange-500/20 hover:border-orange-500/40 font-mono text-xs overflow-x-auto"
                            >
                              <div className="flex items-start gap-2">
                                <span className="shrink-0">
                                  <span className={SYNTAX_COLORS.stepId}>#{ref.node.expressId}</span>
                                </span>
                                <span className="text-[10px] text-muted-foreground truncate break-words flex-1">
                                  {rawStepLine}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-[10px] p-2 bg-muted/10 rounded">
                        No entities reference this one
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-20 text-muted-foreground">
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
