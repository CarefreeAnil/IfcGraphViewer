import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph2D, { ForceGraphMethods, NodeObject } from 'react-force-graph-2d';
import { toast } from 'sonner';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, Crosshair } from 'lucide-react';
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
  includeAuxiliaryLayer?: boolean; // Optional: show auxiliary/metadata layer
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
  onGraphCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  fullscreenTargetRef?: React.RefObject<HTMLElement>;
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

const MATERIAL_NODE_COLOR = '#8b5a2b'; // wood-tone brown, distinct from spatial blues/greens

function isMaterialIfcType(ifcType?: string): boolean {
  return (ifcType || '').toUpperCase().startsWith('IFCMATERIAL');
}

// Relationship explanations for hover tooltips
function getRelationshipExplanation(relType: string): string {
  if (!relType) return 'Relationship between IFC entities';
  const type = relType.toUpperCase();
  
  if (type.includes('AGGREGATES')) {
    return 'Whole-part decomposition (e.g., Building contains Storeys)';
  }
  if (type.includes('NESTS')) {
    return 'Nesting relationship between a host object and its nested components';
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
  onGraphCanvasReady,
  fullscreenTargetRef,
}: GraphVisualizationProps) {
  const graphRef = useRef<ForceGraphMethods>();
  const currentZoomRef = useRef<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphCanvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [connectedNodeIds, setConnectedNodeIds] = useState<Set<string>>(new Set());
  const [showPathToRoot, setShowPathToRoot] = useState(false);
  const [pathToRootIds, setPathToRootIds] = useState<Set<string>>(new Set());
  const lastNodeClickAt = useRef<number>(0);
  const [isolationMode, setIsolationMode] = useState(false);
  const [isolationHops, setIsolationHops] = useState<1 | 2>(2);
  const zoomToFitOnNextStop = useRef(false);

  // Hover tooltip
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipClientPos, setTooltipClientPos] = useState({ x: 0, y: 0 });
  const hoveredNodeIdRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean; x: number; y: number; node: GraphNode | null;
  }>({ visible: false, x: 0, y: 0, node: null });

  // Minimap
  const [minimapVisible, setMinimapVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const drawMinimapRef = useRef<() => void>(() => {});

  // Track selection state for animations
  const [selectionState, setSelectionState] = useState<SelectionState>({
    nodeId: null,
    timestamp: 0,
    source: 'graph'
  });
  const prevSelectedNodeIdRef = useRef<string | null>(null);

  const filteredData = useMemo(() => {
    const lodResult = applyLoD(data.nodes, data.edges, graphLoD as GraphLoD, { includeAuxiliary: includeAuxiliaryLayer });

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
      if (relationshipFilters.showAggregation && (type.includes('AGGREGATES') || type.includes('DECOMPOSES') || type.includes('NESTS'))) return true;
      if (relationshipFilters.showConnects && (type.includes('CONNECTS') || type.includes('CONNECTEDTO') || type.includes('CONNECTION') || type.includes('ASSIGNSTOGROUP'))) return true;
      if (relationshipFilters.showConnects && (type.includes('VOIDSELEMENT') || type.includes('FILLSELEMENT'))) return true; // ✅ Voids/Fills are structural connections
      if (relationshipFilters.showSpaceBoundary && type.includes('SPACEBOUNDARY')) return true;
      if (relationshipFilters.showProperties && (type.includes('DEFINESBYPROPERTIES') || type.includes('PROPERTYSET') || type.includes('DEFINESBYTYPE'))) return true;
      if (relationshipFilters.showAssociates && (type.includes('ASSOCIATES') || type.includes('CLASSIFICATION') || type.includes('MATERIAL'))) return true;
      if (relationshipFilters.showAuxiliary && (type.includes('GEOMETRY') || type.includes('REPRESENTATION'))) return true;

      return false;
    };

    const filteredNodes = lodResult.filteredData.nodes.filter(node => {
      // Always keep relationship nodes visible (they are structural elements in LPG model)
      // Their edges will be filtered separately
      if (isRelationshipNode(node)) return true;
      return true;
    });

    const nodeIdSet = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = lodResult.filteredData.edges.filter(edge => {
      // Must have both source and target in filtered nodes
      if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) return false;

      // Apply relationship type filters to edges involving relationship nodes
      const sourceNode = filteredNodes.find(n => n.id === edge.source);
      const targetNode = filteredNodes.find(n => n.id === edge.target);
      const isSourceRel = sourceNode && isRelationshipNode(sourceNode);
      const isTargetRel = targetNode && isRelationshipNode(targetNode);

      // If edge involves relationship node(s), check if relationship type is allowed
      if (isSourceRel || isTargetRel) {
        const relType = (edge.relationshipType || edge.type || '').toUpperCase();
        return isRelationshipAllowed(relType);
      }

      return true;
    });

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
      const hierarchyRelTypes = ['AGGREGATES', 'NESTS', 'CONTAINEDINSPATIALSTRUCTURE', 'VOIDSELEMENT', 'FILLSELEMENT'];
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

  // Stage 3: BFS neighborhood for isolation mode
  const isolatedNodeIds = useMemo(() => {
    if (!isolationMode || !selectedNodeId) return null;
    const normaliseId = (val: any): string =>
      typeof val === 'string' ? val : String((val as any)?.id ?? val);
    const nodeMap = new Map(finalFilteredData.nodes.map(n => [n.id, n]));
    const adj = new Map<string, Set<string>>();
    for (const edge of finalFilteredData.edges) {
      const src = normaliseId(edge.source);
      const tgt = normaliseId(edge.target);
      if (!adj.has(src)) adj.set(src, new Set());
      if (!adj.has(tgt)) adj.set(tgt, new Set());
      adj.get(src)!.add(tgt);
      adj.get(tgt)!.add(src);
    }
    // A node is a relationship hub if its type is 'relationship' or its ifcType starts with IfcRel
    const isRelNode = (id: string) => {
      const n = nodeMap.get(id);
      return n?.type === 'relationship' || (n?.ifcType ?? '').toUpperCase().startsWith('IFCREL');
    };
    // A node is a physical element instance (not a type object, not the selected node)
    // These are the "siblings" we want to exclude at hop 2 to prevent hub explosion
    const isPhysicalElement = (id: string) => {
      if (id === selectedNodeId) return false;
      const n = nodeMap.get(id);
      if (!n || n.type !== 'element') return false;
      const ifcType = (n.ifcType ?? '').toUpperCase();
      // Material/resource nodes should remain traversable via IfcRelAssociatesMaterial.
      if (ifcType.startsWith('IFCMATERIAL')) return false;
      return !ifcType.endsWith('TYPE'); // keep IfcWallType, IfcWindowType etc.; exclude instances
    };
    const result = new Set<string>([selectedNodeId]);
    // Hop 1: all direct neighbors (undirected)
    const hop1 = new Set<string>();
    for (const nb of adj.get(selectedNodeId) ?? []) {
      result.add(nb);
      hop1.add(nb);
    }
    // Hop 2: from hop1 nodes — skip physical element siblings when the hop1 node is a
    // relationship hub to avoid pulling in co-contained walls, columns, slabs, etc.
    if (isolationHops >= 2) {
      for (const id of hop1) {
        for (const nb of adj.get(id) ?? []) {
          if (result.has(nb)) continue;
          if (isRelNode(id) && isPhysicalElement(nb)) continue;
          result.add(nb);
        }
      }
    }
    return result;
  }, [isolationMode, selectedNodeId, isolationHops, finalFilteredData.edges, finalFilteredData.nodes]);

  // Stage 3: Display data — applies isolation filter on top of finalFilteredData
  const displayData = useMemo(() => {
    if (!isolationMode || !isolatedNodeIds) return finalFilteredData;
    const normaliseId = (val: any): string =>
      typeof val === 'string' ? val : String((val as any)?.id ?? val);
    const nodes = finalFilteredData.nodes.filter(n => isolatedNodeIds.has(n.id));
    // Guard: if the selected node is not in the current graph view (e.g. a geometry or
    // property stub was clicked in the IFC Browser while isolation was already active),
    // the subgraph would be empty and d3 would receive 0 nodes — causing a null crash.
    // Fall back to the full filtered graph; the cleanup effect below will exit isolation.
    if (nodes.length === 0) return finalFilteredData;
    const nodeSet = new Set(nodes.map(n => n.id));
    const edges = finalFilteredData.edges.filter(e =>
      nodeSet.has(normaliseId(e.source)) && nodeSet.has(normaliseId(e.target))
    );
    return { nodes, edges };
  }, [isolationMode, isolatedNodeIds, finalFilteredData]);

  // Exit isolation mode when the newly-selected node is not part of the graph view.
  // This happens when the user clicks a geometry/property stub in the IFC Browser
  // while isolation is already active — the subgraph would be empty otherwise.
  useEffect(() => {
    if (!isolationMode || !selectedNodeId) return;
    const nodeInGraph = finalFilteredData.nodes.some(n => n.id === selectedNodeId);
    if (!nodeInGraph) {
      setIsolationMode(false);
    }
  }, [isolationMode, selectedNodeId, finalFilteredData.nodes]);

  // Update stats when data changes
  useEffect(() => {
    if (onStatsUpdate) {
      onStatsUpdate({
        totalNodes: data.nodes.length,
        totalEdges: data.edges.length,
        filteredNodes: displayData.nodes.length,
        filteredEdges: displayData.edges.length,
      });
    }
  }, [data.nodes.length, data.edges.length, displayData.nodes.length, displayData.edges.length, onStatsUpdate]);

  // Auto-clear isolation when selection is removed
  useEffect(() => {
    if (!selectedNodeId) setIsolationMode(false);
  }, [selectedNodeId]);

  // Trigger zoom-to-fit after isolation layout settles
  useEffect(() => {
    if (isolationMode) {
      zoomToFitOnNextStop.current = true;
      graphRef.current?.resumeAnimation();
    }
  }, [isolationMode, selectedNodeId, isolationHops]);

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
    setIsolationMode(false);
    setIsolationHops(2);
    onNodeClick(null);

    // Reset graph forces
    if (graphRef.current) {
      graphRef.current.d3ReheatSimulation();
    }
  }, [onNodeClick]);

  const canIsolate = useMemo(() => {
    if (!selectedNodeId) return false;
    // Node must be in the current graph view (geometry/property stubs are in IFC Browser
    // but not in graphData.nodes, so isolation would produce an empty subgraph)
    if (!finalFilteredData.nodes.some(n => n.id === selectedNodeId)) return false;
    // Node must have at least one edge; an isolated node produces a 0-edge subgraph
    // that destabilises the d3 simulation and causes a null-reference crash
    const normalise = (v: any): string =>
      typeof v === 'string' ? v : String((v as any)?.id ?? v);
    return finalFilteredData.edges.some(
      e => normalise(e.source) === selectedNodeId || normalise(e.target) === selectedNodeId
    );
  }, [selectedNodeId, finalFilteredData.nodes, finalFilteredData.edges]);

  const handleIsolate = useCallback(() => {
    if (!canIsolate) {
      toast.info('This node has no connections in the graph — nothing to isolate');
      return;
    }
    setShowPathToRoot(false);
    setPathToRootIds(new Set());
    setFocusedNodeId(null);
    setConnectedNodeIds(new Set());
    setIsolationMode(true);
  }, [canIsolate]);

  const findNearestNode = useCallback((x: number, y: number, maxDist: number) => {
    let nearest: GraphNode | null = null;
    let bestDist = Infinity;
    let candidatesChecked = 0;
    let nodesWithCoords = 0;
    
    // Add tolerance buffer for edge cases
    const tolerance = 1.5;
    const effectiveMaxDist = maxDist + tolerance;

    for (const node of displayData.nodes) {
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
  }, [displayData.nodes]);

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
    const container = containerRef.current;
    const observer = typeof ResizeObserver !== 'undefined' && container
      ? new ResizeObserver(updateDimensions)
      : null;
    if (container && observer) observer.observe(container);
    window.addEventListener('resize', updateDimensions);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Keep a reliable reference to the main force-graph canvas (not minimap).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const syncMainCanvas = () => {
      const canvases = Array.from(container.querySelectorAll('canvas')) as HTMLCanvasElement[];
      if (canvases.length === 0) {
        graphCanvasElementRef.current = null;
        onGraphCanvasReady?.(null);
        return;
      }

      // Main graph canvas is the largest canvas in this component.
      const mainCanvas = canvases.reduce((largest, current) => {
        const largestArea = largest.width * largest.height;
        const currentArea = current.width * current.height;
        return currentArea > largestArea ? current : largest;
      }, canvases[0]);

      if (graphCanvasElementRef.current !== mainCanvas) {
        graphCanvasElementRef.current = mainCanvas;
        onGraphCanvasReady?.(mainCanvas);
      }
    };

    syncMainCanvas();
    const rafId = requestAnimationFrame(syncMainCanvas);
    const mutationObserver = new MutationObserver(syncMainCanvas);
    mutationObserver.observe(container, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(rafId);
      mutationObserver.disconnect();
      graphCanvasElementRef.current = null;
      onGraphCanvasReady?.(null);
    };
  }, [onGraphCanvasReady]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const fullscreenTarget = fullscreenTargetRef?.current ?? containerRef.current;
      setIsFullscreen(document.fullscreenElement === fullscreenTarget);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const fullscreenTarget = fullscreenTargetRef?.current ?? containerRef.current;
    if (!fullscreenTarget) return;

    try {
      if (document.fullscreenElement === fullscreenTarget) {
        await document.exitFullscreen();
      } else {
        await fullscreenTarget.requestFullscreen();
      }
    } catch {
      toast.error('Fullscreen is not available in this browser context');
    }
  }, [fullscreenTargetRef]);

  useEffect(() => {
    if (graphRef.current) {
      // Use a wider graph spread so nodes do not compress under the top control area.
      graphRef.current.d3Force('charge')?.strength(-185);
      graphRef.current.d3Force('link')?.distance(78);
    }
  }, [displayData]);

  // When node-type highlight or search filters change, ensure the render loop
  // is running so the updated nodeCanvasObject is drawn. Safe to call even if
  // the RAF is already active (resumeAnimation is idempotent).
  useEffect(() => {
    graphRef.current?.resumeAnimation();
  }, [highlightedTypes, searchQuery]);

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
      if (isExternalChange && selectedNodeId && graphRef.current && !isolationMode) {
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
  }, [selectedNodeId, finalFilteredData.nodes, isolationMode]);

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
      nodes: displayData.nodes.length,
      edges: displayData.edges.length,
      selectedNodeId
    });
    return {
      nodes: displayData.nodes,
      links: displayData.edges,
    };
  }, [displayData.nodes, displayData.edges, selectedNodeId]);

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
      const isMaterialNode = isMaterialIfcType(graphNode.ifcType);
      
      // Path to root highlight
      const isInPath = pathToRootIds.has(node.id);

      // Focus mode: dim nodes that aren't focused or connected
      // Suppressed in isolation mode (unrelated nodes are hidden, not dimmed)
      const isFocusMode = (focusedNodeId !== null || showPathToRoot) && !isolationMode;
      const isFocused = node.id === focusedNodeId;
      const isConnected = connectedNodeIds.has(node.id);
      const isDimmed = isFocusMode && !isFocused && !isConnected && !isInPath;

      // IMPORTANT: Don't skip rendering - just adjust opacity
      // This prevents the graph disappearance when filtering
      if (!isVisible && !isInPath) {
        return; // Don't draw invisible nodes (unless they're in a path)
      }
      
      let size = NODE_SIZES[graphNode.type] || 8;
      // Metadata nodes are smaller
      if (isMetadataNode) {
        size = size * 0.6;
      }
      if (isAuxiliary) {
        size = size * 0.7; // auxiliary nodes smaller to reduce clutter
      }
      if (isMaterialNode) {
        size = size * 1.15;
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
      if (isMaterialNode) {
        color = MATERIAL_NODE_COLOR;
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
      if (isInPath && showPathToRoot) {
        ctx.beginPath();
        ctx.arc(x, y, size + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = '#fb923c'; // Orange for spatial path nodes
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
    [isNodeVisible, selectedNodeId, nodePropertyCache, focusedNodeId, connectedNodeIds, selectionState, pathToRootIds, showPathToRoot, isolationMode]
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
      // Suppressed in isolation mode (all visible edges are already within the neighborhood)
      const isFocusMode = (focusedNodeId !== null || showPathToRoot) && !isolationMode;
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

      // Guard: d3 can transiently null source/target during graph data transitions
      if (!link.source || !link.target) return;
      const sourceX = (link.source as any).x ?? 0;
      const sourceY = (link.source as any).y ?? 0;
      const targetX = (link.target as any).x ?? 0;
      const targetY = (link.target as any).y ?? 0;

      // Check if edge involves metadata
      const isMetadataEdge = (sourceNode.isMetadata || targetNode.isMetadata) || false;
      
      // Get relationship-specific color for educational visualization
      const relTypeSource = (sourceIsRel ? sourceNode?.ifcType : '') || '';
      const relTypeTarget = (targetIsRel ? targetNode?.ifcType : '') || '';
      const relType = (relTypeSource || relTypeTarget || (link as any).relationshipType || (link as any).type || '').toUpperCase();
      const getRelationshipColor = (type: string): string => {
        if (type.includes('AGGREGATES') || type.includes('NESTS')) return '#22d3ee'; // cyan - hierarchy
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
        // Highlight spatial path edges with thick orange/amber line
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
        // Show labels when zoom is sufficient, or always show for path/focused edges
        const shouldRenderLabel = relationshipType && (globalScale > 1.2 || isPathEdge || isFocusMode);
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
              IFCRELNESTS: { relating: 'RelatingObject', related: 'RelatedObjects' },
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
              IFCRELNESTS: { relating: 'IsNestedBy', related: 'Nests' },
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
            'NESTS': 'HasNestedParts',
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
    [isNodeVisible, focusedNodeId, connectedNodeIds, showPathToRoot, pathToRootIds, selectionState.source, selectionState.timestamp, isolationMode]
  );
  // Auto-zoom to selected node when selection changes externally (from other panels)
  useEffect(() => {
    if (!selectedNodeId || !graphRef.current || isolationMode) {
      console.log('[GraphViz] Skip auto-zoom:', { selectedNodeId, hasGraphRef: !!graphRef.current, isolationMode });
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
  }, [selectedNodeId, finalFilteredData.nodes, isolationMode]);
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
    setIsolationMode(false);
  }, [onNodeClick]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current || !containerRef.current || !graphRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const coords = graphRef.current.screen2GraphCoords(
      e.clientX - rect.left,
      e.clientY - rect.top,
    );
    let closestNode: GraphNode | null = null;
    let closestDist = Infinity;
    const threshold = 20 / (currentZoomRef.current || 1);
    for (const n of displayData.nodes) {
      const gn = n as GraphNode;
      const dx = (gn.x ?? 0) - coords.x;
      const dy = (gn.y ?? 0) - coords.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < closestDist) { closestDist = d; closestNode = gn; }
    }
    const found = closestDist <= threshold ? closestNode : null;
    const foundId = found?.id ?? null;
    if (foundId !== hoveredNodeIdRef.current) {
      hoveredNodeIdRef.current = foundId;
      setHoveredNode(found);
    }
    if (found) setTooltipClientPos({ x: e.clientX, y: e.clientY });
  }, [displayData.nodes]);

  const handleMouseLeave = useCallback(() => {
    hoveredNodeIdRef.current = null;
    setHoveredNode(null);
  }, []);

  // Right-click context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(m => ({ ...m, visible: false }));
  }, []);

  const handleNodeRightClick = useCallback((node: NodeObject, event: MouseEvent) => {
    event.preventDefault();
    const graphNode = node as GraphNode;
    handleNodeClick(graphNode);
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY, node: graphNode });
  }, [handleNodeClick]);

  // Minimap: click-to-pan
  const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const graph = graphRef.current;
    if (!canvas || !graph) return;
    const bbox = graph.getGraphBbox();
    const [xMin, xMax] = bbox.x;
    const [yMin, yMax] = bbox.y;
    const rect = canvas.getBoundingClientRect();
    const pad = 8;
    const gx = xMin + ((e.clientX - rect.left - pad) / (canvas.width  - pad * 2)) * (xMax - xMin);
    const gy = yMin + ((e.clientY - rect.top  - pad) / (canvas.height - pad * 2)) * (yMax - yMin);
    graph.centerAt(gx, gy, 300);
    graph.resumeAnimation();
    setTimeout(() => drawMinimapRef.current(), 350);
  }, []);

  // Minimap: draw onto canvasRef
  const drawMinimap = useCallback(() => {
    const canvas = canvasRef.current;
    const graph = graphRef.current;
    if (!canvas || !graph || !minimapVisible) return;
    const bbox = graph.getGraphBbox();
    const [xMin, xMax] = bbox.x;
    const [yMin, yMax] = bbox.y;
    const gW = (xMax - xMin) || 1;
    const gH = (yMax - yMin) || 1;
    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pad = 8;
    const mW = W - pad * 2;
    const mH = H - pad * 2;
    const toMX = (gx: number) => pad + ((gx - xMin) / gW) * mW;
    const toMY = (gy: number) => pad + ((gy - yMin) / gH) * mH;
    ctx.clearRect(0, 0, W, H);
    // Background
    ctx.fillStyle = 'rgba(10, 12, 22, 0.90)';
    ctx.beginPath();
    (ctx as any).roundRect?.(0, 0, W, H, 6);
    ctx.fill();
    // Build node position map for edge rendering
    const nodePosMap = new Map<string, { x: number; y: number }>();
    for (const n of displayData.nodes) {
      const gn = n as GraphNode;
      nodePosMap.set(gn.id, { x: gn.x ?? 0, y: gn.y ?? 0 });
    }
    // Edges as thin dim lines (drawn before nodes so nodes appear on top)
    ctx.strokeStyle = 'rgba(120, 125, 160, 0.35)';
    ctx.lineWidth = 0.5;
    for (const edge of displayData.edges) {
      const srcId = typeof edge.source === 'string' ? edge.source : (edge.source as any)?.id ?? '';
      const tgtId = typeof edge.target === 'string' ? edge.target : (edge.target as any)?.id ?? '';
      const src = nodePosMap.get(srcId);
      const tgt = nodePosMap.get(tgtId);
      if (!src || !tgt) continue;
      ctx.beginPath();
      ctx.moveTo(toMX(src.x), toMY(src.y));
      ctx.lineTo(toMX(tgt.x), toMY(tgt.y));
      ctx.stroke();
    }
    // Nodes as 2px dots (drawn on top of edges)
    for (const n of displayData.nodes) {
      const gn = n as GraphNode;
      ctx.beginPath();
      ctx.arc(toMX(gn.x ?? 0), toMY(gn.y ?? 0), 2, 0, Math.PI * 2);
      ctx.fillStyle = isMaterialIfcType(gn.ifcType)
        ? MATERIAL_NODE_COLOR
        : (NODE_COLORS[gn.type] ?? NODE_COLORS.other);
      ctx.fill();
    }
    // Viewport rectangle
    const { x: lx, y: ly } = graph.screen2GraphCoords(0, 0);
    const { x: rx, y: ry } = graph.screen2GraphCoords(dimensions.width, dimensions.height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(toMX(lx), toMY(ly), toMX(rx) - toMX(lx), toMY(ry) - toMY(ly));
    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    (ctx as any).roundRect?.(0, 0, W, H, 6);
    ctx.stroke();
  }, [minimapVisible, displayData.nodes, displayData.edges, dimensions.width, dimensions.height]);

  // CRITICAL: Setup manual canvas click detection for nodes force-graph's onNodeClick misses
  // This is necessary because force-graph-2d has unreliable hit detection for dense graphs
  useEffect(() => {
    if (isFullscreen) {
      return;
    }

    const handleCanvasPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return; // Only left click
      
      const canvas = graphCanvasElementRef.current;
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
      
      for (const node of displayData.nodes) {
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
  }, [displayData.nodes, handleNodeClick, isFullscreen]);

  // Hover disabled to prevent animation instability

  // Manually handle clicks via transparent overlay div
  // This bypasses force-graph's event system entirely
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!graphRef.current || !containerRef.current) return;
      
      const canvas = graphCanvasElementRef.current;
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
      
      for (const node of displayData.nodes) {
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
        setIsolationMode(false);
      }
    },
    [displayData.nodes, handleNodeClick, onNodeClick]
  );


  // Sync drawMinimapRef so ForceGraph2D callbacks always call the latest version
  useEffect(() => { drawMinimapRef.current = drawMinimap; }, [drawMinimap]);

  // Redraw minimap when data or dimensions change (the onRenderFramePost/onZoom cover animation/pan)
  useEffect(() => { drawMinimapRef.current(); }, [displayData, dimensions, minimapVisible]);

  // Close context menu on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeContextMenu(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeContextMenu]);

  // Graph rendering without artificial size limitations


  return (
    <div
      ref={containerRef}
      className="w-full h-full grid-pattern gradient-radial"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Minimap — right of zoom controls (zoom controls: bottom-20 left-4, w-8 = 48px right edge) */}
      <div className="absolute z-20" style={{ bottom: '80px', left: '56px' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-medium select-none">
            Minimap
          </span>
          <button
            onClick={() => setMinimapVisible(v => !v)}
            className="text-[9px] text-muted-foreground hover:text-foreground transition-colors ml-2"
            title={minimapVisible ? 'Hide minimap' : 'Show minimap'}
          >
            {minimapVisible ? '▲' : '▼'}
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={200}
          height={130}
          className="rounded-md cursor-crosshair shadow-lg border border-border/30 block"
          style={{ display: minimapVisible ? 'block' : 'none' }}
          onClick={handleMinimapClick}
          title="Click to navigate to this area of the graph"
        />
      </div>

      {/* Control Buttons — consolidated single absolute div */}
      <div className="absolute top-4 right-4 z-20 flex flex-wrap justify-end gap-2 items-center max-w-[calc(100%-1rem)]">
        {/* Reset Graph — always visible */}
        <button
          onClick={handleResetGraph}
          className="px-3 py-2 text-xs font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors shadow-lg"
          title="Reset graph view and clear selections"
        >
          Reset Graph
        </button>

        <button
          onClick={toggleFullscreen}
          className="px-3 py-2 text-xs font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors shadow-lg"
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          <span className="inline-flex items-center gap-1.5">
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </span>
        </button>

        {/* Isolation controls */}
        {isolationMode && (
          <>
            <div className="flex rounded-lg overflow-hidden border border-border text-xs font-medium shadow-lg">
              <button
                onClick={() => setIsolationHops(1)}
                className={isolationHops === 1
                  ? 'px-3 py-2 bg-primary text-primary-foreground'
                  : 'px-3 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/90'}
              >1 hop</button>
              <button
                onClick={() => setIsolationHops(2)}
                className={isolationHops === 2
                  ? 'px-3 py-2 bg-primary text-primary-foreground'
                  : 'px-3 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/90'}
              >2 hops</button>
            </div>
            <button
              onClick={() => setIsolationMode(false)}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors shadow-lg"
            >
              Exit Isolation
            </button>
          </>
        )}

        {/* Isolate + Show Path — when node selected, not in isolation, not in path mode */}
        {!isolationMode && !showPathToRoot && selectedNodeId && (
          <>
            <button
              onClick={handleIsolate}
              disabled={!canIsolate}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors shadow-lg ${
                canIsolate
                  ? 'bg-violet-600 text-white hover:bg-violet-700'
                  : 'bg-violet-600/40 text-white/50 cursor-not-allowed'
              }`}
              title={canIsolate
                ? "Show only this node's neighborhood"
                : "Node has no connections in this graph view"}
            >
              Isolate
            </button>
            <button
              onClick={handleShowPathToRoot}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg"
            >
              Show Path to Project
            </button>
          </>
        )}

        {/* Clear Path */}
        {!isolationMode && showPathToRoot && (
          <button
            onClick={handleClearPathToRoot}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors shadow-lg"
          >
            Clear Path to Project
          </button>
        )}

      </div>

      {/* Isolation info banner */}
      {isolationMode && displayData.nodes.length > 0 && (
        <div className="absolute top-16 right-4 z-20 text-xs text-muted-foreground bg-card/80 backdrop-blur-sm border border-border rounded-md px-3 py-1.5 shadow-sm">
          {isolationHops}-hop neighborhood · {displayData.nodes.length} nodes · {displayData.edges.length} edges
        </div>
      )}

      {/* Zoom Controls — bottom-left stack, above stats counter */}
      <div className="absolute bottom-20 left-4 z-20 flex flex-col gap-1">
        <button
          onClick={() => graphRef.current?.zoom(currentZoomRef.current * 1.4, 200)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-card/95 backdrop-blur-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shadow-sm"
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => graphRef.current?.zoom(Math.max(0.1, currentZoomRef.current * 0.7), 200)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-card/95 backdrop-blur-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shadow-sm"
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => graphRef.current?.zoomToFit(400, 40)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-card/95 backdrop-blur-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shadow-sm"
          title="Fit all nodes in view"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        {selectedNodeId && (
          <button
            onClick={() => {
              const node = displayData.nodes.find(n => n.id === selectedNodeId);
              if (!node || node.x === undefined || node.y === undefined) return;
              graphRef.current?.centerAt(node.x, node.y, 300);
              graphRef.current?.zoom(2, 300);
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors shadow-sm"
            title="Center on selected node"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

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
          const canvas = graphCanvasElementRef.current;
          if (canvas && graphRef.current) {
            const rect = canvas.getBoundingClientRect();
            const screenX = (event?.clientX ?? 0) - rect.left;
            const screenY = (event?.clientY ?? 0) - rect.top;
            const coords = (graphRef.current as any).screen2GraphCoords?.(screenX, screenY);
            
            if (coords) {
              let closestNode: GraphNode | null = null;
              let closestDist = Infinity;
              const HIT_RADIUS = 30;
              
              for (const node of displayData.nodes) {
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
          setIsolationMode(false);
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
        onNodeRightClick={handleNodeRightClick}
        onBackgroundRightClick={closeContextMenu}
        enableNodeDrag={true}
        onNodeDrag={() => { isDraggingRef.current = true; setHoveredNode(null); }}
        onNodeDragEnd={() => { isDraggingRef.current = false; }}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        warmupTicks={0}
        onZoom={({ k }: { k: number }) => { currentZoomRef.current = k; drawMinimapRef.current(); }}
        onEngineStop={() => {
          // Pause the render loop once layout stabilises
          if (graphRef.current) {
            if (zoomToFitOnNextStop.current) {
              zoomToFitOnNextStop.current = false;
              graphRef.current.zoomToFit(400, 40);
            }
            graphRef.current.pauseAnimation();
          }
          drawMinimapRef.current();
        }}
        onRenderFramePost={() => {
          drawMinimapRef.current();
        }}
      />

      {/* Hover tooltip — fixed position, pointer-events-none */}
      {hoveredNode && hoveredNode.id !== selectedNodeId && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltipClientPos.x + 14, top: tooltipClientPos.y - 70 }}
        >
          <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-xl text-xs max-w-[240px]">
            <div className="font-semibold text-foreground truncate leading-snug">
              {nodePropertyCache.get(hoveredNode.id)?.label ?? hoveredNode.label}
            </div>
            {hoveredNode.ifcType && (
              <div className="text-muted-foreground font-mono mt-0.5 truncate">
                {hoveredNode.ifcType}
              </div>
            )}
            {hoveredNode.expressId != null && (
              <div className="text-muted-foreground mt-0.5">#{hoveredNode.expressId}</div>
            )}
          </div>
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu.visible && contextMenu.node && (
        <>
          {/* Backdrop — closes menu on outside click */}
          <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
          {/* Menu panel */}
          <div
            className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[190px] text-xs"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {/* Header */}
            <div className="px-3 py-1.5 border-b border-border/60 mb-1">
              <div className="font-semibold text-foreground truncate max-w-[200px]">
                {contextMenu.node.label}
              </div>
              <div className="text-muted-foreground font-mono text-[10px] mt-0.5 truncate">
                {contextMenu.node.ifcType}
                {contextMenu.node.expressId != null && ` · #${contextMenu.node.expressId}`}
              </div>
            </div>

            <button
              className={`w-full text-left px-3 py-1.5 transition-colors ${
                canIsolate
                  ? 'hover:bg-violet-600/10 text-violet-400 hover:text-violet-300'
                  : 'text-muted-foreground/40 cursor-not-allowed'
              }`}
              onClick={() => { handleIsolate(); closeContextMenu(); }}
            >
              Isolate Neighborhood
            </button>
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-muted/50 transition-colors"
              onClick={() => { handleShowPathToRoot(); closeContextMenu(); }}
            >
              Show Path to Root
            </button>

            <div className="border-t border-border/60 my-1" />

            {contextMenu.node.expressId != null && (
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-muted/50 transition-colors font-mono text-muted-foreground hover:text-foreground"
                onClick={() => { navigator.clipboard.writeText(String(contextMenu.node?.expressId ?? '')); closeContextMenu(); }}
              >
                Copy Express ID
              </button>
            )}
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-muted/50 transition-colors"
              onClick={() => { navigator.clipboard.writeText(contextMenu.node?.label ?? ''); closeContextMenu(); }}
            >
              Copy Label
            </button>
          </div>
        </>
      )}
    </div>
  );
}
