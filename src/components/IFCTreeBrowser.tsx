import { useState, useMemo, useCallback } from 'react';
import { Copy, ChevronDown, ChevronRight, FileText, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { toast } from 'sonner';
import { GraphNode, GraphEdge } from '@/types/graph';
import { getEntityDef, getNormalizedPropertyName, findBestMatchingProperty } from '@/lib/ifcSchema';
import { VirtualList } from '@/components/VirtualList';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/PaginationControls';

interface IFCTreeBrowserProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  onNodeSelect: (node: GraphNode | null) => void;
}

// Helper to copy text to clipboard
function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text);
  toast.success('Copied to clipboard');
}

// Format a property value for IFC-style display
function formatPropertyValue(value: any): string {
  if (value === null || value === undefined) return '$';
  if (typeof value === 'string') {
    // Don't quote if it looks like a reference or enum value
    if (value.startsWith('#')) return value;
    if (value.startsWith('.') && value.endsWith('.')) return value; // Enum
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

/**
 * Validate IFC property formatting
 * Returns validation results for debugging property mapping issues
 */
function validatePropertyFormat(node: GraphNode, ifcLine: string): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check entity name is uppercase
  if (!ifcLine.includes(node.ifcType.toUpperCase())) {
    errors.push(`Entity type not uppercase: ${node.ifcType}`);
  }
  
  // Check line format matches IFC standard
  const stepIdMatch = ifcLine.match(/^#(\d+)=/);
  if (!stepIdMatch || parseInt(stepIdMatch[1], 10) !== node.expressId) {
    errors.push(`Step ID mismatch: expected #${node.expressId}`);
  }
  
  // Check for unmatched property names (debug only)
  const entityDef = getEntityDef(node.ifcType);
  if (entityDef && entityDef.properties) {
    const expectedPropCount = entityDef.properties.length;
    const propCountInLine = (ifcLine.match(/,/g) || []).length + 1;
    
    // Allow ±2 properties for system keys or unexpected structures
    if (propCountInLine < expectedPropCount - 2 || propCountInLine > expectedPropCount + 5) {
      warnings.push(
        `Property count mismatch: expected ~${expectedPropCount}, got ${propCountInLine}`
      );
    }
  }
  
  // Check for common formatting issues
  if (ifcLine.includes('IfcQuantityArea')) {
    errors.push('Entity type not uppercase (should be IFCQUANTITYAREA)');
  }
  if (ifcLine.match(/\('.*',.*,.*,.*\)/)) {
    // Looks like it might have properties out of order
    warnings.push('Properties may be out of order');
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

// Debug function to log property mapping for quantity/property entities
function debugPropertyMapping(node: GraphNode): void {
  const entityDef = getEntityDef(node.ifcType);
  if (!entityDef || !node.ifcType.includes('QUANTITY') && !node.ifcType.includes('PROPERTY')) {
    return;
  }
  
  const mapping: Record<string, string> = {};
  if (entityDef.properties) {
    for (const propDef of entityDef.properties) {
      const dataKeys = Object.keys(node.properties);
      let foundKey: string | undefined = propDef.name;
      
      if (node.properties[propDef.name] !== undefined) {
        foundKey = propDef.name;
      } else {
        const lowerPropName = propDef.name.toLowerCase();
        for (const key of dataKeys) {
          if (key.toLowerCase() === lowerPropName) {
            foundKey = key;
            break;
          }
        }
      }
      
      mapping[propDef.name] = foundKey || 'NOT_FOUND';
    }
  }
  
  console.debug(`[${node.ifcType}#${node.expressId}] Property Mapping:`, mapping);
  console.debug(`[${node.ifcType}#${node.expressId}] Available Properties:`, Object.keys(node.properties));
}

// Build proper IFC STEP line based on schema definition
function buildProperIFCLine(node: GraphNode): string {
  const stepId = node.expressId || 0;
  const entityDef = getEntityDef(node.ifcType);
  
  // Debug property mapping for quantity entities
  if (node.ifcType.includes('QUANTITY') || node.ifcType.includes('PROPERTY')) {
    debugPropertyMapping(node);
  }
  
  // Get properties in schema order
  const propValues: string[] = [];
  const usedKeys = new Set<string>();
  
  if (entityDef && entityDef.properties) {
    // Add properties in the order defined in schema
    for (const propDef of entityDef.properties) {
      let value: any = undefined;
      
      // Try exact match first
      if (node.properties[propDef.name] !== undefined) {
        value = node.properties[propDef.name];
        usedKeys.add(propDef.name);
      } else {
        // Try normalized property name mapping
        const normalizedName = getNormalizedPropertyName(node.ifcType, propDef.name);
        if (normalizedName !== propDef.name && node.properties[normalizedName] !== undefined) {
          value = node.properties[normalizedName];
          usedKeys.add(normalizedName);
        } else {
          // Try case-insensitive fuzzy matching as last resort
          const lowerPropName = propDef.name.toLowerCase();
          const dataKeys = Object.keys(node.properties);
          let bestMatch: string | undefined;
          for (const key of dataKeys) {
            if (key.toLowerCase() === lowerPropName) {
              bestMatch = key;
              break;
            }
          }
          
          // If not found, use fuzzy matcher
          if (!bestMatch) {
            bestMatch = findBestMatchingProperty(
              node.ifcType,
              propDef.name,
              dataKeys
            );
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
  
  // Add any remaining properties that weren't in schema
  const remainingKeys = Object.keys(node.properties).filter(k => !usedKeys.has(k));
  for (const key of remainingKeys) {
    const value = node.properties[key];
    // Skip system keys added by parser
    if (!key.includes('_') && key !== 'id' && !key.startsWith('__')) {
      propValues.push(formatPropertyValue(value));
    }
  }
  
  const propsStr = propValues.length > 0 ? propValues.join(',') : '';
  
  const ifcLine = `#${stepId}= ${node.ifcType}(${propsStr});`;
  
  // Validate formatting for problematic entities
  if (node.ifcType.includes('QUANTITY') || node.ifcType.includes('PROPERTY')) {
    const validation = validatePropertyFormat(node, ifcLine);
    if (!validation.isValid) {
      console.error(`[Validation Error] ${node.ifcType}#${stepId}:`, validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.warn(`[Validation Warning] ${node.ifcType}#${stepId}:`, validation.warnings);
    }
  }
  
  return ifcLine;
}

// Helper function to extract reference IDs from property values
// CRITICAL: Only extracts from STRUCTURAL properties, not metadata properties
function extractReferencesFromValue(value: any, maxDepth: number = 2, allNodes?: GraphNode[], propertyName?: string): number[] {
  if (maxDepth <= 0) return []; // Prevent infinite recursion
  
  const refs: number[] = [];
  const seen = new Set<number>(); // Deduplication
  
  // Metadata properties - NEVER extract references from these
  // OwnerHistory is the critical one - it chains to Person/Organization
  const METADATA_PROPERTIES = new Set([
    'ownerhistory',           // Never extract references from this
    'lastmodifyinguser',
    'lastmodifyingapplication',
    'creationdate',
    'owninguser',
    'owningapplication',
  ]);
  
  // Only extract from known STRUCTURAL reference property types
  const STRUCTURAL_REFERENCE_PROPERTIES = new Set([
    'relatingobject', 'relatedobjects',              // IFCREL relationships
    'relatingbuildingelement', 'relatedbuildingelement',  // Building element rels
    'relatedobjectstoelements',                      // Element relationships
    'relatingelement',                               // Element relationships
    'relatingstructure', 'relatedstructure',         // Spatial structure
    'relatedelements',                               // Element relationships
    'relatingpropertydefinition',                    // Property assignment
    'representation',                                // Representation (geometric)
    'objectplacement',                               // Placement (spatial)
    'type',                                          // Type reference
    'material',                                      // Material reference
    'quantities',                                    // Quantities
    'hasproperties',                                 // Property sets
    'definestype',                                   // Type definition
  ]);
  
  // First check: if property name is metadata, don't extract at all
  if (propertyName && METADATA_PROPERTIES.has(propertyName.toLowerCase())) {
    return [];
  }
  
  function traverse(val: any, depth: number, propName?: string) {
    if (depth > maxDepth) return;
    
    // Don't traverse into metadata properties (case-insensitive)
    if (propName && METADATA_PROPERTIES.has(propName.toLowerCase())) {
      return;
    }
    
    if (typeof val === 'string' && val.startsWith('#')) {
      // Direct reference with # prefix
      const refId = parseInt(val.substring(1), 10);
      if (!isNaN(refId) && !seen.has(refId)) {
        refs.push(refId);
        seen.add(refId);
      }
    } else if (Array.isArray(val)) {
      // Recurse into arrays
      for (const item of val) {
        traverse(item, depth + 1, propName);
      }
    } else if (typeof val === 'object' && val !== null) {
      // Check for .value pattern (common in IFC parser output)
      if (val.value !== undefined && typeof val.value !== 'object') {
        traverse(val.value, depth + 1, propName);
      } else if (val.expressID !== undefined) {
        // Handle entities passed as objects
        const refId = val.expressID;
        if (typeof refId === 'number' && !seen.has(refId)) {
          refs.push(refId);
          seen.add(refId);
        }
      } else if (val.value !== undefined && typeof val.value === 'object') {
        // Only recurse into object.value if it's an object
        traverse(val.value, depth + 1, propName);
      } else if (!Array.isArray(val) && depth < maxDepth) {
        // Only recurse into object properties if it's a known structural reference property
        if (propName && STRUCTURAL_REFERENCE_PROPERTIES.has(propName.toLowerCase())) {
          for (const [k, v] of Object.entries(val)) {
            traverse(v, depth + 1, k);
          }
        }
      }
    }
  }
  
  traverse(value, 0, propertyName);
  return refs;
}

// Build reference index for all nodes (memoized)
function buildReferenceIndex(nodes: GraphNode[]): Map<string, Set<number>> {
  const referenceIndex = new Map<string, Set<number>>();
  
  // Pre-compute all references for each node
  for (const node of nodes) {
    const refs = new Set<number>();
    for (const [propName, propValue] of Object.entries(node.properties)) {
      const extracted = extractReferencesFromValue(propValue, 2, nodes, propName);
      for (const ref of extracted) {
        refs.add(ref);
      }
    }
    if (refs.size > 0) {
      referenceIndex.set(node.id, refs);
    }
  }
  
  return referenceIndex;
}

export const IFCTreeBrowser = ({ nodes, edges, selectedNodeId, onNodeSelect }: IFCTreeBrowserProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [useVirtualScrolling, setUseVirtualScrolling] = useState(nodes.length > 100);

  // Pre-compute reference index for performance
  const referenceIndex = useMemo(() => buildReferenceIndex(nodes), [nodes]);

  // Create inverse reference map - all edges pointing TO this node, including property-based references
  const inverseRefMap = useMemo(() => {
    const map = new Map<string, GraphNode[]>(); // nodeId -> array of source nodes
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const nodeByExpressId = new Map(nodes.map(n => [n.expressId, n]));
    
    // First, add references from edges
    edges.forEach((edge) => {
      if (!map.has(edge.target)) {
        map.set(edge.target, []);
      }
      const sourceNode = nodeById.get(edge.source);
      if (sourceNode) {
        map.get(edge.target)?.push(sourceNode);
      }
    });
    
    // Then, add references from property values using pre-computed index (for array-based and direct references)
    for (const [sourceNodeId, refIds] of referenceIndex.entries()) {
      const sourceNode = nodeById.get(sourceNodeId);
      if (!sourceNode) continue;
      
      for (const refId of refIds) {
        const targetNode = nodeByExpressId.get(refId);
        if (targetNode && targetNode.id !== sourceNode.id) {
          const targetNodeId = targetNode.id;
          if (!map.has(targetNodeId)) {
            map.set(targetNodeId, []);
          }
          // Avoid duplicates
          const existingRefs = map.get(targetNodeId) || [];
          if (!existingRefs.find(n => n.id === sourceNode.id)) {
            existingRefs.push(sourceNode);
          }
        }
      }
    }
    
    return map;
  }, [nodes, edges, referenceIndex]);

  // Create forward reference map - all edges coming FROM this node, including property-based references
  const forwardRefMap = useMemo(() => {
    const map = new Map<string, GraphNode[]>(); // nodeId -> array of target nodes
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const nodeByExpressId = new Map(nodes.map(n => [n.expressId, n]));
    
    // First, add references from edges
    edges.forEach((edge) => {
      if (!map.has(edge.source)) {
        map.set(edge.source, []);
      }
      const targetNode = nodeById.get(edge.target);
      if (targetNode) {
        map.get(edge.source)?.push(targetNode);
      }
    });
    
    // Then, add references from property values using pre-computed index
    for (const [sourceNodeId, refIds] of referenceIndex.entries()) {
      if (!map.has(sourceNodeId)) {
        map.set(sourceNodeId, []);
      }
      
      for (const refId of refIds) {
        const targetNode = nodeByExpressId.get(refId);
        if (targetNode && targetNode.id !== sourceNodeId) {
          // Avoid duplicates
          const existingRefs = map.get(sourceNodeId) || [];
          if (!existingRefs.find(n => n.id === targetNode.id)) {
            existingRefs.push(targetNode);
          }
        }
      }
    }
    
    return map;
  }, [nodes, edges, referenceIndex]);

  // Sort nodes by stepId for flat list display
  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => (a.expressId || 0) - (b.expressId || 0));
  }, [nodes]);

  // Filter nodes based on search query
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return sortedNodes;
    
    const query = searchQuery.toLowerCase();
    return sortedNodes.filter(
      (n) =>
        n.label.toLowerCase().includes(query) ||
        n.ifcType.toLowerCase().includes(query) ||
        (n.expressId && n.expressId.toString().includes(query))
    );
  }, [sortedNodes, searchQuery]);

  // Pagination for filtered nodes
  const pagination = usePagination(filteredNodes, {
    pageSize: 100,
    initialPage: 0,
  });

  // Find inverse references for selected node
  const inverseReferences = useMemo(() => {
    if (!selectedNodeId) return [];
    return inverseRefMap.get(selectedNodeId) || [];
  }, [selectedNodeId, inverseRefMap]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Get forward refs for the selected node
  const forwardReferences = useMemo(() => {
    if (!selectedNode) return [];
    return forwardRefMap.get(selectedNodeId || '') || [];
  }, [selectedNode, selectedNodeId, forwardRefMap]);

  const handleRefClick = useCallback(
    (stepId: number) => {
      const targetNode = nodes.find((n) => n.expressId === stepId);
      if (targetNode) {
        onNodeSelect(targetNode);
      }
    },
    [nodes, onNodeSelect]
  );

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2">
        <h2 className="text-sm font-semibold text-foreground">IFC STEP Browser (1:1 View)</h2>
        <Input
          placeholder="Search by StepID, type, or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-sm font-mono"
        />
      </div>

      {/* Main Split View */}
      <ResizablePanelGroup direction="vertical" className="flex-1">
        {/* Upper Panel: Raw STEP (1:1) + Nested View */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <ResizablePanelGroup direction="horizontal">
            {/* Raw STEP File (1:1 View) */}
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full flex flex-col p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider">
                    Raw STEP File ({nodes.length} entities)
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const lines: string[] = [];
                      lines.push('ISO-10303-21;');
                      lines.push('HEADER;');
                      lines.push(`FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');`);
                      lines.push(`FILE_NAME('','','','','','','');`);
                      lines.push(`FILE_SCHEMA(('IFC2X3'));`);
                      lines.push('ENDSEC;');
                      lines.push('');
                      lines.push('DATA;');
                      const sortedNodesLocal = [...nodes].sort((a, b) => (a.expressId || 0) - (b.expressId || 0));
                      for (const node of sortedNodesLocal) {
                        lines.push(buildProperIFCLine(node));
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

                <ScrollArea className="flex-1 border rounded-md">
                  <div className="p-3 font-mono text-[10px] leading-relaxed bg-muted/30">
                    <pre className="whitespace-pre-wrap break-all">
                      {'ISO-10303-21;\n'}
                      {'HEADER;\n'}
                      {`FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\n`}
                      {`FILE_NAME('','','','','','','');\n`}
                      {`FILE_SCHEMA(('IFC2X3'));\n`}
                      {'ENDSEC;\n\n'}
                      {'DATA;\n'}
                      {[...nodes]
                        .sort((a, b) => (a.expressId || 0) - (b.expressId || 0))
                        .map(node => buildProperIFCLine(node))
                        .join('\n')}
                      {'\nENDSEC;\n'}
                      {'END-ISO-10303-21;'}
                    </pre>
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Nested Tree View */}
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full flex flex-col p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider">
                    Entity Hierarchy ({filteredNodes.length})
                  </h3>
                </div>
                
                <div className="flex-1 border rounded-md flex flex-col">
                  {filteredNodes.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                      <p className="text-sm">No entities found</p>
                    </div>
                  ) : useVirtualScrolling ? (
                    <>
                      <VirtualList
                        items={pagination.currentItems}
                        itemHeight={32}
                        containerHeight={500}
                        bufferSize={5}
                        renderItem={(node, idx) => {
                          const ifcLine = buildProperIFCLine(node);
                          return (
                            <div
                              onClick={() => onNodeSelect(node)}
                              className={`
                                px-2 py-1.5 cursor-pointer transition-colors font-mono text-xs
                                border-l-2 border-transparent hover:bg-muted/20
                                ${
                                  selectedNodeId === node.id
                                    ? 'bg-primary/15 border-l-primary'
                                    : ''
                                }
                              `}
                            >
                              <div className="break-all leading-relaxed truncate">
                                {ifcLine}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <PaginationControls
                        currentPage={pagination.currentPage}
                        totalPages={pagination.totalPages}
                        totalItems={pagination.totalItems}
                        pageSize={pagination.pageSize}
                        onPageChange={pagination.goToPage}
                        onNext={pagination.nextPage}
                        onPrevious={pagination.previousPage}
                        onFirst={pagination.goToFirstPage}
                        onLast={pagination.goToLastPage}
                        hasNextPage={pagination.hasNextPage}
                        hasPreviousPage={pagination.hasPreviousPage}
                      />
                    </>
                  ) : (
                    <ScrollArea className="flex-1">
                      <div className="p-2 space-y-0">
                        {filteredNodes.map((node) => {
                          const ifcLine = buildProperIFCLine(node);

                          return (
                            <div
                              key={node.id}
                              onClick={() => onNodeSelect(node)}
                              className={`
                                px-2 py-1.5 cursor-pointer transition-colors font-mono text-xs
                                border-l-2 border-transparent hover:bg-muted/20
                                ${
                                  selectedNodeId === node.id
                                    ? 'bg-primary/15 border-l-primary'
                                    : ''
                                }
                              `}
                            >
                              <div className="break-all leading-relaxed">
                                {ifcLine}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Lower Panel: References Only */}
        <ResizablePanel defaultSize={40} minSize={20}>
          <ScrollArea className="h-full">
            <div className="p-3">
              {selectedNode ? (
                <div className="space-y-4 font-mono text-xs">
                  {/* Referenced By Section */}
                  <div>
                    <h4 className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                      Referenced By ({inverseReferences.length})
                    </h4>
                    {inverseReferences.length > 0 ? (
                      <div className="space-y-1">
                        {inverseReferences.map((refNode) => {
                          const refLine = buildProperIFCLine(refNode);
                          return (
                            <div
                              key={refNode.id}
                              onClick={() => onNodeSelect(refNode)}
                              className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 cursor-pointer transition-colors border border-red-500/20 hover:border-red-500/40"
                            >
                              <div className="break-all leading-relaxed font-mono text-[11px]">
                                {refLine}
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

                  {/* References Section */}
                  {forwardReferences.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                        References ({forwardReferences.length})
                      </h4>
                      <div className="space-y-1">
                        {forwardReferences.map((refNode) => {
                          const refLine = buildProperIFCLine(refNode);
                          return (
                            <div
                              key={refNode.id}
                              onClick={() => onNodeSelect(refNode)}
                              className="p-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 cursor-pointer transition-colors border border-blue-500/20 hover:border-blue-500/40"
                            >
                              <div className="break-all leading-relaxed font-mono text-[11px]">
                                {refLine}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <p className="text-sm">Select an entity to view references</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
