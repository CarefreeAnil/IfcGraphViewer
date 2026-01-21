import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { toast } from 'sonner';
import { GraphData, GraphNode, NodeType } from '@/types/graph';
import { getEntityColor, getEntityDisplayName } from '@/lib/ifcSchema';
import { applyLoD, LoDLevel, GraphLoD, getLoDConfig, isAuxiliaryType } from '@/lib/graphLoD';

// Track selection changes for animation
interface SelectionState {
  nodeId: string | null;
  timestamp: number;
  source: 'graph' | 'external'; // Track if selection came from external source
}

interface GraphVisualizationProps {
  data: GraphData;
  onNodeClick: (node: GraphNode | null) => void;
  selectedNodeId: string | null;
  highlightedTypes: NodeType[];
  searchQuery: string;
  graphLoD?: LoDLevel;
  includeAuxiliaryLayer?: boolean; // LoD5 only: show auxiliary/metadata layer
  relationshipFilters?: {
    showContainment: boolean;
    showAggregation: boolean;
    showProperties: boolean;
    showAuxiliary: boolean;
    showConnects: boolean;
    showAssociates: boolean;
    showSpaceBoundary: boolean;
  };
  onStatsUpdate?: (stats: {
    totalNodes: number;
    totalEdges: number;
    filteredNodes: number;
    filteredEdges: number;
  }) => void;
  onShowPathToRoot?: () => void;
  onClearPathToRoot?: () => void;
  showPathToRootButton?: boolean;
}

const NODE_COLORS: Record<NodeType, string> = {
  building: '#22d3ee',    // cyan
  space: '#a78bfa',       // purple
  element: '#fbbf24',     // amber
  property: '#4ade80',    // green
  relationship: '#f472b6', // pink
  geometry: '#9ca3af',    // gray
  other: '#6b7280',       // dark gray
  Mesh: '#60a5fa',        // blue (IFC5)
  Curve: '#fb923c',       // orange (IFC5)
  Points: '#c084fc',      // violet (IFC5)
  Group: '#34d399',       // emerald (IFC5)
};

const NODE_SIZES: Record<NodeType, number> = {
  building: 12,
  space: 10,
  element: 8,
  property: 6,
  relationship: 5,
  geometry: 4,
  other: 4,
  Mesh: 8,                // IFC5
  Curve: 6,               // IFC5
  Points: 5,              // IFC5
  Group: 10,              // IFC5
};

// Relationship explanations for hover tooltips
function getRelationshipExplanation(relType: string): string {
  if (!relType) return 'Relationship between IFC entities';
  const type = relType.toUpperCase();
  
  if (type.includes('AGGREGATES')) {
    return 'Whole-part decomposition (e.g., Building contains Storeys)';
  }
  if (type.includes('CONTAINEDINSPATIALSTRUCTURE')) {
    return 'Spatial containment (e.g., Storey contains Walls)';
  }
  if (type.includes('DEFINESBYPROPERTIES') || type.includes('PROPERTYSET')) {
    return 'Defines properties and attributes for an element';
  }
  if (type.includes('VOIDSELEMENT')) {
    return 'Creates an opening or void (e.g., Opening in Wall)';
  }
  if (type.includes('FILLSELEMENT')) {
    return 'Fills a void (e.g., Door fills Opening)';
  }
  if (type.includes('MATERIAL')) {
    return 'Associates material definition';
  }
  if (type.includes('CLASSIFICATION')) {
    return 'Associates classification reference (e.g., Uniclass)';
  }
  if (type.includes('CONNECTEDTO') || type.includes('CONNECTS')) {
    return 'Physical or logical connection between elements';
  }
  if (type.includes('BOUNDARY')) {
    return 'Space boundary relationship';
  }
  if (type.includes('GEOMETRY') || type.includes('REPRESENTATION')) {
    return 'Geometric representation data';
  }
  
  return 'Relationship between IFC entities';
}

// Clustering helper: Find nearby nodes to detect dense regions
function getNodeCluster(node: any, nodes: any[], radius: number = 80): any[] {
  const nearby = nodes.filter((n) => {
    if (n.id === node.id) return false;
    const dx = (n.x || 0) - (node.x || 0);
    const dy = (n.y || 0) - (node.y || 0);
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < radius;
  });
  return nearby;
}

export function GraphVisualization({
  data,
  onNodeClick,
  selectedNodeId,
  highlightedTypes,
  searchQuery,
  graphLoD = 4,
  includeAuxiliaryLayer = false,
  relationshipFilters = {
    showContainment: false,
    showAggregation: false,
    showProperties: false,
    showAuxiliary: false,
    showConnects: false,
    showAssociates: false,
    showSpaceBoundary: false,
  },
  onStatsUpdate,
  onShowPathToRoot,
  onClearPathToRoot,
  showPathToRootButton = false,
}: GraphVisualizationProps) {
  const graphRef = useRef<ForceGraphMethods>();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [connectedNodeIds, setConnectedNodeIds] = useState<Set<string>>(new Set());
  const [showPathToRoot, setShowPathToRoot] = useState(false);
  const [pathToRootIds, setPathToRootIds] = useState<Set<string>>(new Set());
  const lastNodeClickAt = useRef<number>(0);
  
  // Track selection state for animations
  const [selectionState, setSelectionState] = useState<SelectionState>({
    nodeId: null,
    timestamp: 0,
    source: 'graph'
  });
  const prevSelectedNodeIdRef = useRef<string | null>(null);

  // Apply LoD filtering (LoD5 can optionally include auxiliary layer)
  const filteredData = useMemo(() => {
    const includeAux = graphLoD === GraphLoD.LoD5_Full && includeAuxiliaryLayer;
    const lodResult = applyLoD(data.nodes, data.edges, graphLoD as GraphLoD, { includeAuxiliary: includeAux });

    // Filter relationship NODES (paper-accurate model) and keep edges consistent
    const isRelationshipNode = (node: GraphNode) =>
      node.type === 'relationship' || (node.ifcType || '').toUpperCase().startsWith('IFCREL');

    const isRelationshipAllowed = (ifcType: string) => {
      const type = ifcType.toUpperCase();

      // Check if any filter is active (inclusion/whitelist model)
      const anyFilterActive = 
        relationshipFilters.showContainment ||
        relationshipFilters.showAggregation ||
        relationshipFilters.showConnects ||
        relationshipFilters.showSpaceBoundary ||
        relationshipFilters.showProperties ||
        relationshipFilters.showAssociates ||
        relationshipFilters.showAuxiliary;

      // If no filters active, show everything
      if (!anyFilterActive) return true;

      // Otherwise, show only checked types (inclusion model)
      if (relationshipFilters.showContainment && type.includes('CONTAINEDINSPATIALSTRUCTURE')) return true;
      if (relationshipFilters.showAggregation && (type.includes('AGGREGATES') || type.includes('DECOMPOSES'))) return true;
      if (relationshipFilters.showConnects && (type.includes('CONNECTS') || type.includes('CONNECTEDTO') || type.includes('CONNECTION'))) return true;
      if (relationshipFilters.showSpaceBoundary && type.includes('SPACEBOUNDARY')) return true;
      if (relationshipFilters.showProperties && (type.includes('DEFINESBYPROPERTIES') || type.includes('PROPERTYSET') || type.includes('DEFINESBYTYPE'))) return true;
      if (relationshipFilters.showAssociates && (type.includes('ASSOCIATES') || type.includes('CLASSIFICATION') || type.includes('MATERIAL'))) return true;
      if (relationshipFilters.showAuxiliary && (type.includes('GEOMETRY') || type.includes('REPRESENTATION'))) return true;

      return false;
    };

    const filteredNodes = lodResult.filteredData.nodes.filter(node => {
      if (!isRelationshipNode(node)) return true;
      return isRelationshipAllowed(node.ifcType || '');
    });

    const nodeIdSet = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = lodResult.filteredData.edges.filter(edge =>
      nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target)
    );

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [data, graphLoD, includeAuxiliaryLayer, relationshipFilters]);

  // Keep all filtered nodes (don't drop orphans) to preserve selection and LoD coverage
  // When showing path to root, include all path nodes even if filtered by LoD
  const finalFilteredData = useMemo(() => {
    let nodes = filteredData.nodes;
    let edges = filteredData.edges;

    // If showing path to root, ensure all path nodes are included
    if (showPathToRoot && pathToRootIds.size > 1) {
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      
      // Add missing path nodes from full dataset
      for (const pathNodeId of pathToRootIds) {
        if (!nodeMap.has(pathNodeId)) {
          const fullNode = data.nodes.find(n => n.id === pathNodeId);
          if (fullNode) {
            nodes = [...nodes, fullNode];
            nodeMap.set(pathNodeId, fullNode);
          }
        }
      }

      // Only add HIERARCHY edges connecting path nodes
      // Do NOT add property, material, or other non-hierarchy edges
      const hierarchyRelTypes = ['AGGREGATES', 'CONTAINEDINSPATIALSTRUCTURE', 'VOIDSELEMENT', 'FILLSELEMENT'];
      const edgeSet = new Set(edges.map(e => e.id));
      
      data.edges.forEach(edge => {
        if (!edgeSet.has(edge.id) && pathToRootIds.has(edge.source) && pathToRootIds.has(edge.target)) {
          // Strictly check if it's a hierarchy relationship type
          const relType = (edge.relationshipType || edge.type || '').toUpperCase();
          const isHierarchy = hierarchyRelTypes.some(ht => relType.includes(ht));
          
          // Only add hierarchy edges - skip ALL other relationship types
          if (isHierarchy) {
            edges = [...edges, edge];
            edgeSet.add(edge.id);
          }
        }
      });
    }

    return { nodes, edges };
  }, [filteredData, showPathToRoot, pathToRootIds, data.nodes, data.edges]);

  // Update stats when data changes
  useEffect(() => {
    if (onStatsUpdate) {
      onStatsUpdate({
        totalNodes: data.nodes.length,
        totalEdges: data.edges.length,
        filteredNodes: finalFilteredData.nodes.length,
        filteredEdges: finalFilteredData.edges.length,
      });
    }
  }, [data.nodes.length, data.edges.length, finalFilteredData.nodes.length, finalFilteredData.edges.length, onStatsUpdate]);

  // Compute path to root (Site/Project) from selected node
  // NOTE: Uses FULL DATA, not filtered data, because spatial hierarchy should be traversable
  // regardless of LoD level. The path connects to nodes that may not be visible in current LoD.
  const computePathToRoot = useCallback((nodeId: string): Set<string> => {
    const pathIds = new Set<string>();
    const visited = new Set<string>();
    const queue: string[] = [nodeId];
    
    // Build parent map from all edges
    const parentMap = new Map<string, Set<string>>();
    
    data.edges.forEach((edge) => {
      if (edge.label === 'related') {
        const relNodeId = edge.source;
        // Look for relating edges: they can be OUTGOING (source=relNode) or INCOMING (target=relNode)
        const relatingEdges = data.edges.filter(e => 
          (e.source === relNodeId || e.target === relNodeId) && 
          e.label === 'relating'
        );
        relatingEdges.forEach(relEdge => {
          if (!parentMap.has(edge.target)) {
            parentMap.set(edge.target, new Set());
          }
          // If relating edge is outgoing (source=relNode), parent is target
          // If relating edge is incoming (target=relNode), parent is source
          const parentId = relEdge.source === relNodeId ? relEdge.target : relEdge.source;
          parentMap.get(edge.target)!.add(parentId);
        });
      } else {
        if (!parentMap.has(edge.target)) {
          parentMap.set(edge.target, new Set());
        }
        parentMap.get(edge.target)!.add(edge.source);
      }
    });
    
    // BFS to find path to Project
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      pathIds.add(currentId);
      
      const currentNode = data.nodes.find(n => n.id === currentId);
      if (!currentNode) {
        continue;
      }
      
      const type = (currentNode.ifcType || '').toUpperCase();
      if (type === 'IFCPROJECT') {
        break;
      }
      
      const parents = parentMap.get(currentId) || new Set();
      
      if (parents.size > 0) {
        // Add relationship nodes connecting to parents
        data.edges.forEach(edge => {
          if (edge.target === currentId && edge.label === 'related') {
            pathIds.add(edge.source);
          }
        });
        
        parents.forEach(parentId => {
          if (!visited.has(parentId)) {
            queue.push(parentId);
          }
        });
      }
    }
    
    return pathIds;
  }, [data.nodes, data.edges]);

  const handleShowPathToRoot = useCallback(() => {
    if (selectedNodeId) {
      // Clear any previous path before computing new one
      setShowPathToRoot(false);
      setPathToRootIds(new Set());
      setFocusedNodeId(null);
      setConnectedNodeIds(new Set());
      
      // Use setTimeout to ensure state clears before computing new path
      setTimeout(() => {
        const pathIds = computePathToRoot(selectedNodeId);
        
        if (pathIds.size <= 1) {
          toast.error('Could not find path to root. This node may not be connected to the spatial hierarchy.');
          // Don't set showPathToRoot - just show error
          return;
        }
        
        setPathToRootIds(pathIds);
        setShowPathToRoot(true);
        setFocusedNodeId(selectedNodeId);
        setConnectedNodeIds(pathIds);
        toast.success(`Found path with ${pathIds.size} nodes`);
      }, 0);
    }
  }, [selectedNodeId, computePathToRoot]);

  const handleClearPathToRoot = useCallback(() => {
    setShowPathToRoot(false);
    setPathToRootIds(new Set());
    setFocusedNodeId(null);
    setConnectedNodeIds(new Set());
  }, []);

  const handleResetGraph = useCallback(() => {
    setShowPathToRoot(false);
    setPathToRootIds(new Set());
    setFocusedNodeId(null);
    setConnectedNodeIds(new Set());
    onNodeClick(null);
    
    // Reset graph forces
    if (graphRef.current) {
      graphRef.current.d3ReheatSimulation();
    }
  }, [onNodeClick]);

  const findNearestNode = useCallback((x: number, y: number, maxDist: number) => {
    let nearest: GraphNode | null = null;
    let bestDist = Infinity;
    let candidatesChecked = 0;
    let nodesWithCoords = 0;
    
    // Add tolerance buffer for edge cases
    const tolerance = 1.5;
    const effectiveMaxDist = maxDist + tolerance;

    for (const node of finalFilteredData.nodes) {
      candidatesChecked++;
      const nx = node.x ?? 0;
      const ny = node.y ?? 0;
      
      // Skip nodes without coordinates
      if (nx === 0 && ny === 0) continue;
      nodesWithCoords++;
      
      const dx = nx - x;
      const dy = ny - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Find the closest node within the effective max distance
      if (dist <= effectiveMaxDist && dist < bestDist) {
        bestDist = dist;
        nearest = node;
      }
    }

    console.log(`[FindNearest] Checked ${candidatesChecked} nodes, ${nodesWithCoords} with coords, best dist: ${bestDist.toFixed(2)}, maxDist: ${maxDist.toFixed(2)}, effective: ${effectiveMaxDist.toFixed(2)}, found: ${nearest?.id || 'none'}`);
    return nearest;
  }, [finalFilteredData.nodes]);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('charge')?.strength(-150);
      graphRef.current.d3Force('link')?.distance(60);
    }
  }, [finalFilteredData]);

  // Track selection changes and detect if selection came from external source
  useEffect(() => {
    if (selectedNodeId !== prevSelectedNodeIdRef.current) {
      const isExternalChange = prevSelectedNodeIdRef.current !== null && selectedNodeId !== prevSelectedNodeIdRef.current;
      setSelectionState({
        nodeId: selectedNodeId,
        timestamp: Date.now(),
        source: isExternalChange ? 'external' : 'graph'
      });
      prevSelectedNodeIdRef.current = selectedNodeId;

      // Auto-center on selected node when selection comes from external source
      if (isExternalChange && selectedNodeId && graphRef.current) {
        const node = finalFilteredData.nodes.find(n => n.id === selectedNodeId);
        if (node && node.x !== undefined && node.y !== undefined) {
          // Center the graph on the selected node with animation
          graphRef.current.centerAt(node.x, node.y, 800);
          graphRef.current.zoom(2.5, 800);
          
          // Show toast notification to indicate cross-view selection
          toast.success(`Navigated to ${node.label} from external view`, {
            position: 'top-right',
            duration: 2000,
          });
        }
      }
    }
  }, [selectedNodeId, finalFilteredData.nodes]);

  useEffect(() => {
    return () => {
      // Destroy the graph instance to free WebGL/Canvas resources
      if (graphRef.current) {
        try {
          (graphRef.current as any)._destroy?.();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  // CRITICAL: Memoize graphData to avoid creating 51k+ new objects on every render
  const graphData = useMemo(() => {
    console.log('[GraphViz] Graph data updated:', {
      nodes: finalFilteredData.nodes.length,
      edges: finalFilteredData.edges.length,
      selectedNodeId
    });
    return {
      nodes: finalFilteredData.nodes,  // Don't shallow-copy - reuse references
      links: finalFilteredData.edges,  // Don't shallow-copy - reuse references
    };
  }, [finalFilteredData.nodes, finalFilteredData.edges, selectedNodeId]);

  const isNodeVisible = useCallback(
    (node: GraphNode) => {
      const typeMatch = highlightedTypes.length === 0 || highlightedTypes.includes(node.type as NodeType);
      const searchMatch =
        searchQuery === '' ||
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.ifcType && node.ifcType.toLowerCase().includes(searchQuery.toLowerCase()));
      return typeMatch && searchMatch;
    },
    [highlightedTypes, searchQuery]
  );

  // Memoize property extraction for better performance
  const nodePropertyCache = useMemo(() => {
    const cache = new Map<string, { label: string; properties: string[] }>();
    
    finalFilteredData.nodes.forEach(node => {
      const graphNode = node as GraphNode;
      const properties = graphNode.properties || {};
      const lines: string[] = [];
      
      // Get label - use LongName for space entities
      let label = graphNode.label;
      if (graphNode.type === 'space') {
        label = (properties.LongName as string) || graphNode.label;
      }
      
      // Extract key properties
      const nameAttr = properties.Name || properties.name;
      if (nameAttr && nameAttr !== label && String(nameAttr).length > 0) {
        lines.push(`Name: ${String(nameAttr).substring(0, 25)}`);
      }
      
      // Add important properties
      const props = ['Width', 'Height', 'Area', 'OverallWidth', 'Handing', 'GTIN'];
      for (const prop of props) {
        if (properties[prop]) {
          const val = String(properties[prop]).substring(0, 20);
          lines.push(`${prop}: ${val}`);
        }
      }
      
      cache.set(graphNode.id, { label, properties: lines });
    });
    
    return cache;
  }, [finalFilteredData.nodes]);

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const graphNode = node as GraphNode;
      const isVisible = isNodeVisible(graphNode);
      const isSelected = node.id === selectedNodeId;
      const isMetadataNode = graphNode.isMetadata || false;
      const isAuxiliary = isAuxiliaryType(graphNode.ifcType);
      
      // Path to root highlight
      const isInPath = pathToRootIds.has(node.id);
      
      // Focus mode: dim nodes that aren't focused or connected
      const isFocusMode = focusedNodeId !== null || showPathToRoot;
      const isFocused = node.id === focusedNodeId;
      const isConnected = connectedNodeIds.has(node.id);
      const isDimmed = isFocusMode && !isFocused && !isConnected && !isInPath;
      
      // IMPORTANT: Don't skip rendering - just adjust opacity
      // This prevents the graph disappearance when filtering
      if (!isVisible && !isInPath) {
        return; // Don't draw invisible nodes (unless they're in the path)
      }
      
      let size = NODE_SIZES[graphNode.type] || 8;
      // Metadata nodes are smaller
      if (isMetadataNode) {
        size = size * 0.6;
      }
      if (isAuxiliary) {
        size = size * 0.7; // auxiliary nodes smaller to reduce clutter
      }
      // Path nodes are slightly larger
      if (isInPath && !isSelected) {
        size = size * 1.3;
      }
      
      // Use schema-based color if available, otherwise fallback to type color
      let color = (graphNode.properties?._schemaColor as string);
      if (!color || color === '' || color === '#888' || color === '#6b7280') {
        color = NODE_COLORS[graphNode.type] || '#3b82f6';
      }
      
      // Metadata nodes use muted gray color
      if (isMetadataNode) {
        color = '#999999';
      }
      if (isAuxiliary) {
        color = 'rgba(148,163,184,0.8)'; // slate tone, semi-transparent
      }

      const x = node.x || 0;
      const y = node.y || 0;

      // Draw hit area in debug mode
      if (false) {
        const ifcType = (graphNode.ifcType || '').toUpperCase();
        let hitSize = size;
        if (graphNode.type === 'relationship' || ifcType.startsWith('IFCREL')) {
          hitSize = hitSize * 0.7;
        }
        if (graphNode.type === 'element') {
          hitSize = hitSize * 1.4;
        }
        if (ifcType === 'IFCWALL' || ifcType === 'IFCWALLSTANDARDCASE') {
          hitSize = hitSize * 1.6;
        }
        
        ctx.beginPath();
        ctx.arc(x, y, hitSize + 6, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Check if this node is externally selected for special animation
      const isExternallySelected = isSelected && selectionState.source === 'external';
      const timeSinceSelection = Date.now() - selectionState.timestamp;
      const pulsePhase = (timeSinceSelection % 1000) / 1000; // 0 to 1 over 1 second
      const isPulsing = isExternallySelected && timeSinceSelection < 2000; // Pulse for 2 seconds

      // Draw outer pulse ring for externally selected nodes
      if (isPulsing) {
        const maxPulseRadius = size + 16;
        const minPulseRadius = size + 6;
        const currentPulseRadius = minPulseRadius + (maxPulseRadius - minPulseRadius) * pulsePhase;
        const pulseOpacity = 1 - pulsePhase; // Fade out as it expands
        
        ctx.beginPath();
        ctx.arc(x, y, currentPulseRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(255, 215, 0, ${pulseOpacity * 0.8})`; // Gold pulse
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Draw path highlight ring (orange/amber)
      if (isInPath && showPathToRoot && !isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, size + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = '#fb923c'; // Orange for path nodes
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw enhanced glow for selected node
      if (isSelected) {
        // Bright glow for external selections
        const glowIntensity = isExternallySelected ? 2.5 : 1.5;
        const glowColor = isExternallySelected ? '#FFD700' : color; // Gold for external
        
        // Draw multiple layers for intense glow
        for (let i = 3; i >= 1; i--) {
          ctx.beginPath();
          ctx.arc(x, y, size + i * 2 * glowIntensity, 0, 2 * Math.PI);
          const gradient = ctx.createRadialGradient(x, y, size, x, y, size + i * 3 * glowIntensity);
          const alpha = (4 - i) * 0.15 / glowIntensity;
          gradient.addColorStop(0, glowColor.startsWith('#') 
            ? glowColor + Math.floor(alpha * 255).toString(16).padStart(2, '0')
            : glowColor
          );
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      }

      // Draw node with reduced opacity for metadata
       ctx.beginPath();
       ctx.arc(x, y, size, 0, 2 * Math.PI);
       if (isMetadataNode && isVisible) {
         ctx.fillStyle = color + '80'; // 50% opacity for metadata
       } else if (isDimmed) {
         ctx.fillStyle = color + '20'; // Heavy dimming for non-connected
       } else {
         ctx.fillStyle = isVisible ? color : color + '30';
       }
       ctx.fill();

       // Draw border (dashed for auxiliary)
       if (isAuxiliary) {
         ctx.setLineDash([4, 3]);
       }
       // Enhanced border for selected nodes
       const isExternalSelection = node.id === selectedNodeId && selectionState.source === 'external';
       ctx.strokeStyle = isVisible ? (isSelected ? '#fff' : color) : color + '20';
       ctx.lineWidth = isSelected ? (isExternalSelection ? 3.5 : 2.5) : 1;
       if (isDimmed) {
         ctx.strokeStyle = color + '15';
       }
       ctx.stroke();
       if (isAuxiliary) {
         ctx.setLineDash([]);
       }

      // Draw label and attributes - optimized for performance
      if (globalScale > 1.2 && isVisible) {
        const fontSize = Math.max(10 / globalScale, 4);
        ctx.font = `bold ${fontSize}px JetBrains Mono`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isMetadataNode ? 'rgba(200,200,200,0.8)' : '#ffffff'; // Lighter for metadata
        // Reduced shadow blur for better performance
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 2;
        
        // Get cached label
        const cached = nodePropertyCache.get(graphNode.id);
        const label = cached?.label || graphNode.label;
        ctx.fillText(label, x, y + size + 4);
        
        // Show additional properties based on zoom level
        const shouldShowDetailedAttrs = globalScale > 2.5;
        
        if (shouldShowDetailedAttrs && !isMetadataNode && cached) {
          const propFontSize = Math.max(7 / globalScale, 3);
          ctx.font = `${propFontSize}px JetBrains Mono`;
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          
          cached.properties.forEach((line, idx) => {
            ctx.fillText(line, x, y + size + 13 + idx * (propFontSize + 2));
          });
        }
      }
    },
    [isNodeVisible, selectedNodeId, nodePropertyCache, focusedNodeId, connectedNodeIds, selectionState]
  );

  const linkCanvasObject = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const sourceNode = link.source as GraphNode;
      const targetNode = link.target as GraphNode;
      const isAuxEdge = isAuxiliaryType(sourceNode?.ifcType || '') || isAuxiliaryType(targetNode?.ifcType || '');
      const isRelationshipNode = (node: GraphNode) =>
        node?.type === 'relationship' || (node?.ifcType || '').toUpperCase().startsWith('IFCREL');
      const sourceIsRel = isRelationshipNode(sourceNode);
      const targetIsRel = isRelationshipNode(targetNode);
      
      const sourceVisible = isNodeVisible(sourceNode);
      const targetVisible = isNodeVisible(targetNode);
      
      // Also check if nodes are in path (path nodes should be visible even if filtered)
      const sourceInPath = pathToRootIds.has((link.source as any).id);
      const targetInPath = pathToRootIds.has((link.target as any).id);
      const isVisible = (sourceVisible || sourceInPath) && (targetVisible || targetInPath);
      
      // Focus mode: highlight only edges connected to focused node OR edges in the path to root
      const isFocusMode = focusedNodeId !== null || showPathToRoot;
      const sourceId = (link.source as any).id;
      const targetId = (link.target as any).id;
      
      // For path-to-root mode, highlight edges where BOTH nodes are in the path
      const isPathEdge = showPathToRoot && pathToRootIds.has(sourceId) && pathToRootIds.has(targetId);
      
      const isConnectedEdge = isFocusMode && (
        sourceId === focusedNodeId ||
        targetId === focusedNodeId ||
        isPathEdge  // Include path edges
      );
      const isDimmedEdge = isFocusMode && !isConnectedEdge;

      const sourceX = (link.source as any).x || 0;
      const sourceY = (link.source as any).y || 0;
      const targetX = (link.target as any).x || 0;
      const targetY = (link.target as any).y || 0;

      // Check if edge involves metadata
      const isMetadataEdge = (sourceNode.isMetadata || targetNode.isMetadata) || false;
      
      // Get relationship-specific color for educational visualization
      const relTypeSource = (sourceIsRel ? sourceNode?.ifcType : '') || '';
      const relTypeTarget = (targetIsRel ? targetNode?.ifcType : '') || '';
      const relType = (relTypeSource || relTypeTarget || (link as any).relationshipType || (link as any).type || '').toUpperCase();
      const getRelationshipColor = (type: string): string => {
        if (type.includes('AGGREGATES')) return '#22d3ee'; // cyan - hierarchy
        if (type.includes('CONTAINEDINSPATIALSTRUCTURE')) return '#a78bfa'; // purple - containment
        if (type.includes('DEFINESBYPROPERTIES')) return '#4ade80'; // green - properties
        if (type.includes('VOIDSELEMENT')) return '#f472b6'; // pink - openings
        if (type.includes('FILLSELEMENT')) return '#fbbf24'; // amber - fills
        if (type.includes('MATERIAL')) return '#fb923c'; // orange - materials
        return '#666666'; // default gray
      };
      const edgeColor = getRelationshipColor(relType);

      const isInverseEdge = (link as any).__isInverse === true || (typeof (link as any).id === 'string' && (link as any).id.endsWith('__inv'));
      const dx = targetX - sourceX;
      const dy = targetY - sourceY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / dist;
      const ny = dx / dist;
      const curveOffset = isInverseEdge ? 8 : 0;

      const sx = sourceX + nx * curveOffset;
      const sy = sourceY + ny * curveOffset;
      const tx = targetX + nx * curveOffset;
      const ty = targetY + ny * curveOffset;

      // Draw main line (slightly curved for inverse edges)
      ctx.beginPath();
      if (curveOffset !== 0) {
        const midX = (sx + tx) / 2 + nx * curveOffset;
        const midY = (sy + ty) / 2 + ny * curveOffset;
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(midX, midY, tx, ty);
      } else {
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
      }
      // Metadata, auxiliary, or inverse edges are dashed for clarity
      if ((isMetadataEdge || isAuxEdge || isInverseEdge) && isVisible && !isPathEdge) {
        ctx.strokeStyle = isAuxEdge ? 'rgba(148,163,184,0.7)' : '#888888';
        if (isInverseEdge) {
          ctx.strokeStyle = edgeColor + '88';
        }
        ctx.setLineDash(isInverseEdge ? [3, 4] : [5, 5]);
      } else if (isPathEdge) {
        // Highlight path edges with thick orange/amber line
        ctx.strokeStyle = '#fb923c'; // Orange for path edges
        ctx.lineWidth = 3;
      } else if (isDimmedEdge) {
        ctx.strokeStyle = edgeColor + '10'; // Heavy dimming
      } else {
        ctx.strokeStyle = isVisible ? edgeColor : edgeColor + '33';
      }
      
      if (!isPathEdge) {
        ctx.lineWidth = isAuxEdge ? 1.2 : isVisible ? 2 : 0.5;
        if (isDimmedEdge) {
          ctx.lineWidth = 0.5;
        }
      }
      
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // Draw arrow and label
      if (isVisible && !isDimmedEdge) {
        const arrowAngle = Math.atan2(ty - sy, tx - sx);
        const arrowLength = 5;
        const targetSize = NODE_SIZES[(targetNode as any).type] || 8;
        
        const arrowX = tx - Math.cos(arrowAngle) * (targetSize + 3);
        const arrowY = ty - Math.sin(arrowAngle) * (targetSize + 3);

        // Draw arrow head
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowLength * Math.cos(arrowAngle - Math.PI / 6),
          arrowY - arrowLength * Math.sin(arrowAngle - Math.PI / 6)
        );
        ctx.lineTo(
          arrowX - arrowLength * Math.cos(arrowAngle + Math.PI / 6),
          arrowY - arrowLength * Math.sin(arrowAngle + Math.PI / 6)
        );
        ctx.closePath();
         ctx.fillStyle = isPathEdge ? '#fb923c' : (isMetadataEdge || isAuxEdge ? '#a3a3a3' : edgeColor);
        ctx.fill();
        
        // Draw relationship label on edge
        const relationshipType = (link as any).relationshipType || (link as any).type || (link as any).label || '';
        const showRelNodeLabels = sourceIsRel || targetIsRel;
        const shouldRenderLabel = showRelNodeLabels && (isFocusMode || isPathEdge || isInverseEdge) && globalScale > 1.5;
        if (shouldRenderLabel && relationshipType) {
          const midX = (sx + tx) / 2;
          const midY = (sy + ty) / 2;
          let labelAngle = Math.atan2(ty - sy, tx - sx);
          
          // Extract clean relationship name
          let labelText = relationshipType;

          // For relationship-node edges, label the role
          if (showRelNodeLabels) {
            const edgeRole = (link as any).label;
            const relType = relationshipType.toUpperCase();
            const isInverse = (link as any).__isInverse === true || (typeof (link as any).id === 'string' && (link as any).id.endsWith('__inv'));

            // Actual IFC property names for forward edges
            const ifcPropertyNameMap: Record<string, { relating: string; related: string }> = {
              IFCRELAGGREGATES: { relating: 'RelatingObject', related: 'RelatedObjects' },
              IFCRELDECOMPOSES: { relating: 'RelatingObject', related: 'RelatedObjects' },
              IFCRELCONTAINEDINSPATIALSTRUCTURE: { relating: 'RelatingStructure', related: 'RelatedElements' },
              IFCRELVOIDSELEMENT: { relating: 'RelatingBuildingElement', related: 'RelatedOpeningElement' },
              IFCRELFILLSELEMENT: { relating: 'RelatingOpeningElement', related: 'RelatedBuildingElement' },
              IFCRELDEFINESBYPROPERTIES: { relating: 'RelatingPropertyDefinition', related: 'RelatedObjects' },
              IFCRELDEFINESBYTYPE: { relating: 'RelatingType', related: 'RelatedObjects' },
              IFCRELASSOCIATESMATERIAL: { relating: 'RelatingMaterial', related: 'RelatedObjects' },
              IFCRELASSOCIATESCLASSIFICATION: { relating: 'RelatingClassification', related: 'RelatedObjects' },
            };

            // Human-readable labels for inverse edges
            const inverseRoleLabelMap: Record<string, { relating: string; related: string }> = {
              IFCRELAGGREGATES: { relating: 'IsDecomposedBy', related: 'Decomposes' },
              IFCRELDECOMPOSES: { relating: 'IsDecomposedBy', related: 'Decomposes' },
              IFCRELCONTAINEDINSPATIALSTRUCTURE: { relating: 'ContainsElements', related: 'ContainedInStructure' },
              IFCRELVOIDSELEMENT: { relating: 'HasOpenings', related: 'VoidsElement' },
              IFCRELFILLSELEMENT: { relating: 'HasFillings', related: 'FillsVoid' },
              IFCRELDEFINESBYPROPERTIES: { relating: 'Defines', related: 'HasProperties' },
              IFCRELDEFINESBYTYPE: { relating: 'Defines', related: 'HasType' },
              IFCRELASSOCIATESMATERIAL: { relating: 'AssociatedTo', related: 'HasAssociations' },
              IFCRELASSOCIATESCLASSIFICATION: { relating: 'ClassifiedAs', related: 'HasAssociations' },
            };

            const relKey = Object.keys(ifcPropertyNameMap).find(key => relType.includes(key));
            const ifcPropertyNames = relKey ? ifcPropertyNameMap[relKey] : null;
            const inverseLabels = relKey ? inverseRoleLabelMap[relKey] : null;

            if (!isInverse) {
              // Forward edges: show actual IFC property names
              if (ifcPropertyNames) {
                if (edgeRole === 'relating') labelText = ifcPropertyNames.relating;
                if (edgeRole === 'related') labelText = ifcPropertyNames.related;
              } else {
                if (edgeRole === 'relating') labelText = 'RelatingObject';
                if (edgeRole === 'related') labelText = 'RelatedObjects';
              }
            } else if (inverseLabels) {
              // Inverse edges: show human-readable labels
              if (edgeRole === 'relating') labelText = inverseLabels.relating;
              if (edgeRole === 'related') labelText = inverseLabels.related;
            }
          }
          
          // Remove IFCREL prefix for IFCREL* types
          if (labelText.startsWith('IFCREL')) {
            labelText = labelText.substring(6);
          }
          
          // Convert common IFC relationship type names to readable format
          const relationshipMap: Record<string, string> = {
            'AGGREGATES': 'HasAggregates',
            'CONTAINEDINSPATIALSTRUCTURE': 'Contains',
            'VOIDSELEMENT': 'HasOpening',
            'FILLSELEMENT': 'FillsVoids',
            'DEFINESBYPROPERTIES': 'HasProperties',
            'ASSOCIATESMATERIAL': 'Material',
            'ASSOCIATESCLASSIFICATION': 'Classification',
            'HASSPACEKEYRELATIONSHIPTOSPATIALELEMENT': 'HasBoundary',
            'RELATESTOSPATIALELEMENT': 'HasOpenings',
            'RELATESGEOMETRICDATA': 'Geometry',
            'CONNECTEDTO': 'Connected',
          };
          
          // Look for the mapped name
          for (const [key, value] of Object.entries(relationshipMap)) {
            if (labelText.includes(key)) {
              labelText = value;
              break;
            }
          }
          
          // Fallback: clean up and truncate
          if (!Object.values(relationshipMap).includes(labelText)) {
            labelText = labelText.substring(0, 18);
          }
          
          // Make text readable (rotate to left-to-right when possible)
          if (labelAngle > Math.PI / 2) labelAngle -= Math.PI;
          if (labelAngle < -Math.PI / 2) labelAngle += Math.PI;
          
          ctx.save();
          ctx.translate(midX, midY);
          ctx.rotate(labelAngle);
          
          // Dynamic font size based on zoom
          const fontSize = Math.max(9 / globalScale, 4);
          ctx.font = `bold ${fontSize}px JetBrains Mono`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // Reduced shadow for better performance
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 2;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          // Draw text with shadow only (no background box or stroke)
          ctx.fillText(labelText, 0, 0);
          
          ctx.restore();
        }
      }
    },
    [isNodeVisible, focusedNodeId, connectedNodeIds, showPathToRoot, pathToRootIds, selectionState.source, selectionState.timestamp]
  );
  // Auto-zoom to selected node when selection changes externally (from other panels)
  useEffect(() => {
    if (!selectedNodeId || !graphRef.current) {
      console.log('[GraphViz] Skip auto-zoom:', { selectedNodeId, hasGraphRef: !!graphRef.current });
      return;
    }
    
    // Find the selected node in the current data
    const selectedNode = finalFilteredData.nodes.find(n => n.id === selectedNodeId);
    console.log('[GraphViz] Auto-zoom attempt:', { 
      selectedNodeId, 
      found: !!selectedNode,
      hasCoords: selectedNode?.x !== undefined && selectedNode?.y !== undefined 
    });
    
    if (!selectedNode || !selectedNode.x || !selectedNode.y) {
      console.warn('[GraphViz] Cannot zoom: node not found or no coordinates');
      return;
    }
    
    // Only auto-zoom if coordinates are set (after layout)
    try {
      graphRef.current.pauseAnimation();
      graphRef.current.centerAt(selectedNode.x, selectedNode.y, 300);
      graphRef.current.zoom(2, 300);
      setTimeout(() => {
        if (graphRef.current) {
          graphRef.current.resumeAnimation();
        }
      }, 300);
    } catch (e) {
      // Ignore zoom errors during animation
    }
  }, [selectedNodeId, finalFilteredData.nodes]);
  const handleNodeClick = useCallback(
    (node: any) => {
      console.log('[GraphViz] ===== NODE CLICK EVENT =====');
      console.log('[GraphViz] Node ID:', node?.id);
      console.log('[GraphViz] Node Type:', node?.type);
      console.log('[GraphViz] IFC Type:', node?.ifcType);
      console.log('[GraphViz] Position:', node?.x, node?.y);
      console.log('[GraphViz] Event details:', node?.__event);
      lastNodeClickAt.current = performance.now();

      // CRITICAL: Select the node that was actually clicked
      // Do NOT auto-select related nodes - that causes selection mismatch
      onNodeClick(node as GraphNode);
      
      // Clear path-to-root mode when clicking a different node
      if (showPathToRoot) {
        setShowPathToRoot(false);
        setPathToRootIds(new Set());
      }
      
      // Track focused node and its connections
      const getEdgeEndpointId = (value: any): string => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'object' && 'id' in value) return String((value as any).id);
        return String(value);
      };

      if (node) {
        setFocusedNodeId(node.id);
        const connected = new Set<string>();
        finalFilteredData.edges.forEach(edge => {
          const sourceId = getEdgeEndpointId(edge.source);
          const targetId = getEdgeEndpointId(edge.target);
          if (sourceId === node.id) connected.add(targetId);
          if (targetId === node.id) connected.add(sourceId);
        });
        setConnectedNodeIds(connected);
        console.log('[GraphViz] Connected nodes:', connected.size);
      } else {
        setFocusedNodeId(null);
        setConnectedNodeIds(new Set());
      }
      
      if (graphRef.current) {
        // Disable physics during animation to prevent jittering
        graphRef.current.pauseAnimation();
        
        // Faster animation: 300ms instead of 500ms
        graphRef.current.centerAt(node.x, node.y, 300);
        graphRef.current.zoom(2, 300);
        
        // Resume physics after animation completes
        setTimeout(() => {
          if (graphRef.current) {
            graphRef.current.resumeAnimation();
          }
        }, 300);
      }
    },
    [onNodeClick, finalFilteredData.edges, showPathToRoot]
  );

  const handleBackgroundClick = useCallback(() => {
    const elapsed = performance.now() - lastNodeClickAt.current;
    if (elapsed < 200) {
      return; // Ignore background click immediately after node click
    }
    onNodeClick(null);
    setFocusedNodeId(null);
    setConnectedNodeIds(new Set());
    setShowPathToRoot(false);
    setPathToRootIds(new Set());
  }, [onNodeClick]);

  // CRITICAL: Setup manual canvas click detection for nodes force-graph's onNodeClick misses
  // This is necessary because force-graph-2d has unreliable hit detection for dense graphs
  useEffect(() => {
    const handleCanvasPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return; // Only left click
      
      const canvas = containerRef.current?.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas || !graphRef.current) return;
      
      // Get click in canvas coordinates
      const rect = canvas.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const coords = (graphRef.current as any).screen2GraphCoords?.(screenX, screenY);
      
      if (!coords) return;
      
      // Find closest node within hit radius
      let closestNode: GraphNode | null = null;
      let closestDist = Infinity;
      const HIT_RADIUS = 40; // Generous hit detection
      
      for (const node of finalFilteredData.nodes) {
        if (node.x === undefined || node.y === undefined) continue;
        const dx = node.x - coords.x;
        const dy = node.y - coords.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= HIT_RADIUS && dist < closestDist) {
          closestDist = dist;
          closestNode = node;
        }
      }
      
      // Only fire our handler if force-graph's onNodeClick didn't already handle it
      // We do this by checking if a node would have been selected
      // If closestNode is found and very close (< 20 units), it was probably already handled
      if (closestNode && closestDist > 20) {
        console.log('[CanvasPointerDown] Caught missed click on:', closestNode.id, closestNode.ifcType, 'dist:', closestDist.toFixed(1));
        handleNodeClick(closestNode);
      }
    };
    
    const canvas = containerRef.current?.querySelector('canvas');
    if (canvas) {
      // Use pointerdown to catch it before force-graph's handlers
      // Note: we don't prevent default or stop propagation to let force-graph handle pan/zoom
      canvas.addEventListener('pointerdown', handleCanvasPointerDown, true);
      return () => canvas.removeEventListener('pointerdown', handleCanvasPointerDown, true);
    }
  }, [finalFilteredData.nodes, handleNodeClick]);

  // Hover disabled to prevent animation instability

  // Manually handle clicks via transparent overlay div
  // This bypasses force-graph's event system entirely
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!graphRef.current || !containerRef.current) return;
      
      const canvas = containerRef.current.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) {
        console.log('[OverlayClick] No canvas found');
        return;
      }
      
      // Get click position relative to canvas
      const rect = canvas.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      
      // Convert to graph coordinates
      const coords = (graphRef.current as any).screen2GraphCoords?.(screenX, screenY);
      if (!coords) {
        console.log('[OverlayClick] Could not convert screen to graph coords');
        return;
      }
      
      console.log('[OverlayClick] Click at graph coords:', coords.x.toFixed(1), coords.y.toFixed(1));
      
      // Find closest node
      let closestNode: GraphNode | null = null;
      let closestDist = Infinity;
      const HIT_RADIUS = 30; // Fixed generous hit radius
      
      for (const node of finalFilteredData.nodes) {
        if (node.x === undefined || node.y === undefined) continue;
        
        const dx = node.x - coords.x;
        const dy = node.y - coords.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= HIT_RADIUS && dist < closestDist) {
          closestDist = dist;
          closestNode = node;
        }
      }
      
      if (closestNode) {
        console.log('[OverlayClick] Selected:', closestNode.id, closestNode.ifcType, 'dist:', closestDist.toFixed(1));
        handleNodeClick(closestNode);
      } else {
        console.log('[OverlayClick] No node in hit radius');
        onNodeClick(null);
        setFocusedNodeId(null);
        setConnectedNodeIds(new Set());
        setShowPathToRoot(false);
        setPathToRootIds(new Set());
      }
    },
    [finalFilteredData.nodes, handleNodeClick, onNodeClick]
  );

  return (
    <div ref={containerRef} className="w-full h-full grid-pattern gradient-radial">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Control Buttons */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        {/* Reset Graph Button */}
        <button
          onClick={handleResetGraph}
          className="px-3 py-2 text-xs font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors shadow-lg"
          title="Reset graph view and clear selections"
        >
          Reset Graph
        </button>
        
        {/* Path to Root Button */}
        {selectedNodeId && !showPathToRoot && (
          <button
            onClick={handleShowPathToRoot}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg"
          >
            Show Path to Root
          </button>
        )}
      </div>
      
      {/* Clear Path Button */}
      {showPathToRoot && (
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={handleClearPathToRoot}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors shadow-lg"
          >
            Clear Path
          </button>
        </div>
      )}
      
      
      <ForceGraph2D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeCanvasObject={nodeCanvasObject}
        linkCanvasObject={linkCanvasObject}
        onNodeClick={(node) => {
          // Use manual click logic to ensure we select the right node
          if (node) {
            handleNodeClick(node);
          }
        }}
        onBackgroundClick={(event) => {
          // Manual node detection for background clicks
          const canvas = containerRef.current?.querySelector('canvas');
          if (canvas && graphRef.current) {
            const rect = canvas.getBoundingClientRect();
            const screenX = (event?.clientX ?? 0) - rect.left;
            const screenY = (event?.clientY ?? 0) - rect.top;
            const coords = (graphRef.current as any).screen2GraphCoords?.(screenX, screenY);
            
            if (coords) {
              let closestNode: GraphNode | null = null;
              let closestDist = Infinity;
              const HIT_RADIUS = 30;
              
              for (const node of finalFilteredData.nodes) {
                if (node.x === undefined || node.y === undefined) continue;
                const dx = node.x - coords.x;
                const dy = node.y - coords.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist <= HIT_RADIUS && dist < closestDist) {
                  closestDist = dist;
                  closestNode = node;
                }
              }
              
              if (closestNode) {
                handleNodeClick(closestNode);
                return;
              }
            }
          }
          
          // No node found, clear selection
          onNodeClick(null);
          setFocusedNodeId(null);
          setConnectedNodeIds(new Set());
          setShowPathToRoot(false);
          setPathToRootIds(new Set());
        }}
        cooldownTicks={100}
        nodePointerAreaPaint={(node, color, ctx) => {
          // CRITICAL: Extremely generous hit areas for force-graph's unreliable picking
          // In dense graphs, many nodes never trigger onNodeClick without this
          const graphNode = node as GraphNode;
          const baseSize = NODE_SIZES[graphNode.type] || 8;
          
          // Make hit areas very large - 50 units minimum (much larger than visual node)
          // This compensates for force-graph's poor hit detection in relationship node patterns
          const hitAreaRadius = Math.max(baseSize * 4, 50);
          
          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, hitAreaRadius, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        backgroundColor="transparent"
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        warmupTicks={0}
        onEngineStop={() => {
          // Pause animation once layout stabilizes
          if (graphRef.current) {
            graphRef.current.pauseAnimation();
          }
        }}
      />
    </div>
  );
}
