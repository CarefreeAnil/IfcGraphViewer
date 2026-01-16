import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { GraphData, GraphNode, NodeType } from '@/types/graph';
import { getEntityColor, getEntityDisplayName } from '@/lib/ifcSchema';
import { applyLoD, LoDLevel, GraphLoD, getLoDConfig, isAuxiliaryType } from '@/lib/graphLoD';

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
};

const NODE_SIZES: Record<NodeType, number> = {
  building: 12,
  space: 10,
  element: 8,
  property: 6,
  relationship: 5,
  geometry: 4,
  other: 4,
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
  relationshipFilters = { showContainment: true, showAggregation: true, showProperties: true, showAuxiliary: false },
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

  // Apply LoD filtering (LoD5 can optionally include auxiliary layer)
  const filteredData = useMemo(() => {
    const includeAux = graphLoD === GraphLoD.LoD5_Full && includeAuxiliaryLayer;
    const lodResult = applyLoD(data.nodes, data.edges, graphLoD as GraphLoD, { includeAuxiliary: includeAux });
    
    // Apply relationship type filters
    const filteredEdges = lodResult.filteredData.edges.filter(edge => {
      const relType = (edge.relationshipType || edge.type || '').toUpperCase();
      
      if (!relationshipFilters.showContainment && relType.includes('CONTAINEDINSPATIALSTRUCTURE')) {
        return false;
      }
      if (!relationshipFilters.showAggregation && relType.includes('AGGREGATES')) {
        return false;
      }
      if (!relationshipFilters.showProperties && (relType.includes('DEFINESBYPROPERTIES') || relType.includes('PROPERTYSET'))) {
        return false;
      }
      if (!relationshipFilters.showAuxiliary && (
        relType.includes('GEOMETRY') || relType.includes('MATERIAL') || relType.includes('REPRESENTATION')
      )) {
        return false;
      }
      
      return true;
    });
    
    return { nodes: lodResult.filteredData.nodes, edges: filteredEdges };
  }, [data, graphLoD, includeAuxiliaryLayer, relationshipFilters]);

  // Remove orphaned nodes (nodes with no edges) - especially important for auxiliary nodes
  const finalFilteredData = useMemo(() => {
    const connectedNodeIds = new Set<string>();
    filteredData.edges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });
    
    const connectedNodes = filteredData.nodes.filter(node => 
      connectedNodeIds.has(node.id) || 
      // Always keep spatial structure nodes even if orphaned
      node.type === 'building' || node.type === 'space'
    );
    
    return { nodes: connectedNodes, edges: filteredData.edges };
  }, [filteredData]);

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
  const computePathToRoot = useCallback((nodeId: string): Set<string> => {
    const pathIds = new Set<string>();
    const visited = new Set<string>();
    const queue: string[] = [nodeId];
    
    // BFS to find path upward through spatial hierarchy, stop only at Project
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      pathIds.add(currentId);
      
      const currentNode = data.nodes.find(n => n.id === currentId);
      if (!currentNode) continue;
      
      // Keep climbing until IFCProject; continue past Site/Building
      const type = (currentNode.ifcType || '').toUpperCase();
      if (type === 'IFCPROJECT') break;
      
      let parentFound = false;
      
      // For property/quantity entities (like IfcElementQuantity, IfcPropertySet),
      // we need to first traverse to the element they're attached to (reverse direction)
      const isPropertyEntity = type.includes('PROPERTYSET') || 
                              type.includes('ELEMENTQUANTITY') ||
                              type.includes('PROPERTY');
      
      finalFilteredData.edges.forEach(edge => {
        const relType = (edge.relationshipType || edge.type || '').toUpperCase();
        
        if (isPropertyEntity && relType.includes('DEFINESBYPROPERTIES')) {
          // For property entities, follow DefinesByProperties backwards (we are the target, go to source)
          if (edge.target === currentId) {
            parentFound = true;
            queue.push(edge.source);
          }
        } else {
          // For regular entities, follow spatial hierarchy upwards
          const isHierarchyRel = relType.includes('AGGREGATES') || 
                                 relType.includes('CONTAINEDINSPATIALSTRUCTURE') ||
                                 relType.includes('VOIDSELEMENT') ||
                                 relType.includes('FILLSELEMENT');
          
          if (edge.target === currentId && isHierarchyRel) {
            parentFound = true;
            queue.push(edge.source);
          }
        }
      });

      // Break if no parent to avoid infinite loop
      if (!parentFound) break;
    }
    
    return pathIds;
  }, [data.nodes, finalFilteredData.edges]);

  const handleShowPathToRoot = useCallback(() => {
    if (selectedNodeId) {
      const pathIds = computePathToRoot(selectedNodeId);
      setPathToRootIds(pathIds);
      setShowPathToRoot(true);
      setFocusedNodeId(selectedNodeId);
      setConnectedNodeIds(pathIds);
    }
  }, [selectedNodeId, computePathToRoot]);

  const handleClearPathToRoot = useCallback(() => {
    setShowPathToRoot(false);
    setPathToRootIds(new Set());
    setFocusedNodeId(null);
    setConnectedNodeIds(new Set());
  }, []);

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

  const graphData = {
    nodes: finalFilteredData.nodes.map((node) => ({ ...node })),
    links: finalFilteredData.edges.map((edge) => ({
      ...edge,
      source: edge.source,
      target: edge.target,
    })),
  };

  const isNodeVisible = useCallback(
    (node: GraphNode) => {
      const typeMatch = highlightedTypes.length === 0 || highlightedTypes.includes(node.type);
      const searchMatch =
        searchQuery === '' ||
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.ifcType.toLowerCase().includes(searchQuery.toLowerCase());
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
      
      // Focus mode: dim nodes that aren't focused or connected
      const isFocusMode = focusedNodeId !== null;
      const isFocused = node.id === focusedNodeId;
      const isConnected = connectedNodeIds.has(node.id);
      const isDimmed = isFocusMode && !isFocused && !isConnected;
      
      // IMPORTANT: Don't skip rendering - just adjust opacity
      // This prevents the graph disappearance when filtering
      if (!isVisible) {
        return; // Don't draw invisible nodes
      }
      
      let size = NODE_SIZES[graphNode.type] || 8;
      // Metadata nodes are smaller
      if (isMetadataNode) {
        size = size * 0.6;
      }
      if (isAuxiliary) {
        size = size * 0.7; // auxiliary nodes smaller to reduce clutter
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

      // Draw glow for selected node
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, size + 6, 0, 2 * Math.PI);
        const gradient = ctx.createRadialGradient(x, y, size, x, y, size + 10);
        gradient.addColorStop(0, color + '60');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fill();
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
       ctx.strokeStyle = isVisible ? (isSelected ? '#fff' : color) : color + '20';
       ctx.lineWidth = isSelected ? 2 : 1;
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
    [isNodeVisible, selectedNodeId, nodePropertyCache, focusedNodeId, connectedNodeIds]
  );

  const linkCanvasObject = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const sourceNode = link.source as GraphNode;
      const targetNode = link.target as GraphNode;
      const isAuxEdge = isAuxiliaryType(sourceNode?.ifcType || '') || isAuxiliaryType(targetNode?.ifcType || '');
      
      const sourceVisible = isNodeVisible(sourceNode);
      const targetVisible = isNodeVisible(targetNode);
      const isVisible = sourceVisible && targetVisible;
      
      // Focus mode: highlight only edges connected to focused node OR edges in the path to root
      const isFocusMode = focusedNodeId !== null;
      const sourceId = (link.source as any).id;
      const targetId = (link.target as any).id;
      
      // For path-to-root mode, highlight edges where BOTH nodes are in the path
      const isPathEdge = showPathToRoot && connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId);
      
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
      const relType = ((link as any).type || '').toUpperCase();
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

      // Draw main line
      ctx.beginPath();
      ctx.moveTo(sourceX, sourceY);
      ctx.lineTo(targetX, targetY);
      // Metadata or auxiliary edges are lighter/dashed appearance
      if ((isMetadataEdge || isAuxEdge) && isVisible) {
        ctx.strokeStyle = isAuxEdge ? 'rgba(148,163,184,0.7)' : '#888888';
        ctx.setLineDash([5, 5]); // Dashed line for metadata/aux relationships
      } else if (isDimmedEdge) {
        ctx.strokeStyle = edgeColor + '10'; // Heavy dimming
      } else {
        ctx.strokeStyle = isVisible ? edgeColor : edgeColor + '33';
      }
      ctx.lineWidth = isAuxEdge ? 1.2 : isVisible ? 2 : 0.5;
      if (isDimmedEdge) {
        ctx.lineWidth = 0.5;
      }
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // Draw arrow and label
      if (isVisible && !isDimmedEdge) {
        const arrowAngle = Math.atan2(targetY - sourceY, targetX - sourceX);
        const arrowLength = 8;
        const targetSize = NODE_SIZES[(targetNode as any).type] || 8;
        
        const arrowX = targetX - Math.cos(arrowAngle) * (targetSize + 4);
        const arrowY = targetY - Math.sin(arrowAngle) * (targetSize + 4);

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
         ctx.fillStyle = isMetadataEdge || isAuxEdge ? '#a3a3a3' : edgeColor;
        ctx.fill();
        
        // Draw relationship label on edge - only at higher zoom to improve performance
        const relationshipType = (link as any).relationshipType || (link as any).type || (link as any).label || '';
        if (relationshipType && globalScale > 1.5) {
          const midX = (sourceX + targetX) / 2;
          const midY = (sourceY + targetY) / 2;
          let labelAngle = Math.atan2(targetY - sourceY, targetX - sourceX);
          
          // Extract clean relationship name
          let labelText = relationshipType;
          
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
    [isNodeVisible, focusedNodeId, connectedNodeIds, showPathToRoot]
  );

  const handleNodeClick = useCallback(
    (node: any) => {
      onNodeClick(node as GraphNode);
      
      // Clear path-to-root mode when clicking a different node
      if (showPathToRoot) {
        setShowPathToRoot(false);
        setPathToRootIds(new Set());
      }
      
      // Track focused node and its connections
      if (node) {
        setFocusedNodeId(node.id);
        const connected = new Set<string>();
        finalFilteredData.edges.forEach(edge => {
          if (edge.source === node.id) connected.add(edge.target);
          if (edge.target === node.id) connected.add(edge.source);
        });
        setConnectedNodeIds(connected);
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
    onNodeClick(null);
    setFocusedNodeId(null);
    setConnectedNodeIds(new Set());
    setShowPathToRoot(false);
    setPathToRootIds(new Set());
  }, [onNodeClick]);

  // Hover disabled to prevent animation instability

  return (
    <div ref={containerRef} className="w-full h-full grid-pattern gradient-radial">
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* Path to Root Button */}
      {selectedNodeId && !showPathToRoot && (
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={handleShowPathToRoot}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg"
          >
            Show Path to Root
          </button>
        </div>
      )}
      
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
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        nodePointerAreaPaint={(node, color, ctx) => {
          const size = NODE_SIZES[(node as GraphNode).type] || 8;
          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, size + 4, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        cooldownTicks={100}
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
