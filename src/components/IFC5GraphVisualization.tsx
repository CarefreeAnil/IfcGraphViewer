/**
 * IFC5 Graph Visualization Component
 * Displays IFC5 JSON structure as an interactive force-directed graph
 */

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import ForceGraph2D, { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d';
import { ComposedObject, IFC5File } from '@/types/ifc5';
import { GraphNode } from '@/types/graph';
import { 
  convertIFC5ToGraph, 
  convertComposedObjectToGraph,
  IFC5GraphConfig,
  IFC5GraphData,
  RelationshipFilter 
} from '@/lib/ifc5GraphVisualization';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Network, 
  Box, 
  Layers, 
  Eye, 
  EyeOff,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Circle,
  Minus,
  Database
} from 'lucide-react';

interface IFC5GraphVisualizationProps {
  composedObject: ComposedObject;
  ifc5File?: IFC5File;
  onNodeSelect?: (path: string, node: ComposedObject) => void;
  selectedNodePath?: string | null;
}

export function IFC5GraphVisualization({
  composedObject,
  ifc5File,
  onNodeSelect,
  selectedNodePath,
}: IFC5GraphVisualizationProps) {
  const graphRef = useRef<ForceGraphMethods>();
  const [config, setConfig] = useState<Partial<IFC5GraphConfig>>({
    showGeometryNodes: false,
    showAttributeNodes: false,
    showInheritance: false, // Disabled by default for clarity
    clusterByNamespace: false,
    maxDepth: undefined, // Show all depths
    relationshipFilter: 'all',
  });

  const [hoveredNode, setHoveredNode] = useState<NodeObject | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert to graph data first (moved up before nodePathMap)
  const graphData = useMemo<IFC5GraphData>(() => {
    // Always use composedObject for graph to ensure path consistency
    return convertComposedObjectToGraph(composedObject, config);
  }, [composedObject, config]);

  // Create a map for quick node lookup from composedObject
  const nodePathMap = useMemo(() => {
    const map = new Map<string, ComposedObject>();
    
    const traverse = (obj: ComposedObject) => {
      map.set(obj.name, obj);
      if (obj.children) {
        obj.children.forEach(child => traverse(child));
      }
    };
    
    traverse(composedObject);
    return map;
  }, [composedObject]);

  // Update dimensions on mount and resize
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

  // Prepare data for force graph with filtering
  const forceGraphData = useMemo(() => {
    // Filter edges based on relationship filter
    const filteredEdges = config.relationshipFilter === 'all' 
      ? graphData.edges
      : graphData.edges.filter(edge => {
          if (!edge.category) return true; // Keep edges without category
          
          switch (config.relationshipFilter) {
            case 'spatial':
              return edge.category === 'spatial';
            case 'material':
              return edge.category === 'material';
            case 'geometry':
              return edge.category === 'geometry';
            case 'property':
              return edge.category === 'property';
            default:
              return true;
          }
        });

    // Get connected node IDs
    const connectedNodeIds = new Set<string>();
    filteredEdges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    // Filter nodes to only show connected ones (unless showing all)
    const nodesToShow = config.relationshipFilter === 'all'
      ? graphData.nodes
      : graphData.nodes.filter(node => connectedNodeIds.has(node.id));

    return {
      nodes: nodesToShow.map(node => {
        // Extract IFC class from attributes
        let ifcClass = '';
        let materialInfo = '';
        
        if (node.properties && typeof node.properties === 'object') {
          // Check for bsi::ifc::class
          const classAttr = node.properties['ifc::class'] || node.properties['bsi::ifc::class'];
          if (classAttr) {
            ifcClass = typeof classAttr === 'object' && 'code' in classAttr ? classAttr.code : classAttr;
          }
          
          // Extract material info for tooltip
          const materialAttr = node.properties['bsi::ifc::material'];
          if (materialAttr) {
            materialInfo = materialAttr.name || materialAttr.code || '';
          }
        }
        
        // Create display label with IFC class if available
        const displayLabel = ifcClass ? `${node.label}\n[${ifcClass}]` : node.label;
        
        return {
          id: node.id,
          name: displayLabel,
          shortName: node.label,
          ifcClass: ifcClass,
          type: node.type,
          category: node.properties._nodeCategory || 'data',
          path: node.properties.path || node.id,
          materialInfo,
          ...node.properties,
        };
      }),
      links: filteredEdges.map(edge => ({
        source: edge.source,
        target: edge.target,
        type: edge.type,
        label: edge.label,
        category: edge.category,
      })),
    };
  }, [graphData, config.relationshipFilter]);

  // Node color based on category (matching IFC5 Model Tree)
  const getNodeColor = useCallback((node: any) => {
    // Check both node.id and node.path for selection - use brighter color
    const isSelected = node.id === selectedNodePath || node.path === selectedNodePath;
    
    if (node.category === 'data') {
      if (isSelected) return '#60a5fa'; // bright blue for selected data node
      if (node.type === 'Mesh') return '#3b82f6'; // blue for meshes (matching tree)
      if (node.type === 'Curve') return '#22c55e'; // green for curves (matching tree)
      if (node.type === 'Points') return '#a855f7'; // purple for points (matching tree)
      return '#6b7280'; // gray for groups (matching tree)
    }
    
    // Other categories
    if (isSelected) return '#60a5fa';
    
    switch (node.category) {
      case 'attribute':
        return '#64748b'; // slate for attributes
      case 'geometry':
        return '#22d3ee'; // cyan for geometry
      default:
        return '#94a3b8'; // gray default
    }
  }, [selectedNodePath]);

  // Node size based on category
  const getNodeSize = useCallback((node: any) => {
    switch (node.category) {
      case 'data':
        return 8;
      case 'attribute':
        return 4;
      case 'geometry':
        return 6;
      default:
        return 5;
    }
  }, []);

  // Link color based on type
  const getLinkColor = useCallback((link: any) => {
    switch (link.type) {
      case 'child':
        return '#64748b'; // slate
      case 'inherit':
        return '#f59e0b'; // amber
      case 'reference':
        return '#8b5cf6'; // purple
      case 'attribute':
        return '#475569'; // darker slate
      default:
        return '#94a3b8';
    }
  }, []);

  // Handle node click
  const handleNodeClick = useCallback((node: NodeObject) => {
    console.log('[IFC5Graph] Node clicked:', { id: node.id, path: (node as any).path });
    console.log('[IFC5Graph] selectedNodePath prop:', selectedNodePath);
    if (onNodeSelect) {
      // Use node.path which stores the full path, not node.id which might be a GUID
      const nodePath = (node as any).path;
      console.log('[IFC5Graph] Looking for path:', nodePath);
      if (nodePath) {
        // Find the composed object for this path
        const composedNode = nodePathMap.get(nodePath);
        console.log('[IFC5Graph] Found composed node:', composedNode?.name);
        if (composedNode) {
          console.log('[IFC5Graph] Calling onNodeSelect with:', { path: nodePath, nodeName: composedNode.name });
          onNodeSelect(nodePath, composedNode);
        } else {
          console.warn('[IFC5Graph] No composed node found for path:', nodePath);
          console.log('[IFC5Graph] Available paths sample:', Array.from(nodePathMap.keys()).slice(0, 5));
        }
      }
    } else {
      console.warn('[IFC5Graph] No onNodeSelect handler provided');
    }
  }, [onNodeSelect, nodePathMap, selectedNodePath]);

  // Zoom controls
  const handleZoomIn = () => graphRef.current?.zoom(1.5, 300);
  const handleZoomOut = () => graphRef.current?.zoom(0.75, 300);
  const handleZoomFit = () => graphRef.current?.zoomToFit(300, 50);

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col bg-background">
      {/* Compact Header with collapsible controls */}
      <div className="border-b border-border bg-card">
        <div className="p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">IFC5 Graph</h3>
            <Badge variant="secondary" className="text-xs">
              {forceGraphData.nodes.length}
            </Badge>
            {config.relationshipFilter !== 'all' && (
              <Badge variant="default" className="text-xs capitalize">
                {config.relationshipFilter}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowControls(!showControls)}
              className="h-7 px-2"
              title="Toggle Filters"
            >
              <Filter className={`w-3 h-3 ${showControls ? 'text-primary' : ''}`} />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleZoomIn} className="h-7 px-2" title="Zoom In">
              <ZoomIn className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleZoomOut} className="h-7 px-2" title="Zoom Out">
              <ZoomOut className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleZoomFit} className="h-7 px-2" title="Fit View">
              <Maximize2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Collapsible Filters */}
        {showControls && (
          <div className="p-2 pt-0 space-y-2 border-t border-border/50">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-muted-foreground">Filter:</span>
              {(['all', 'spatial', 'material', 'geometry', 'property'] as const).map((filter) => (
                <Button
                  key={filter}
                  size="sm"
                  variant={config.relationshipFilter === filter ? 'default' : 'outline'}
                  onClick={() => setConfig(prev => ({ ...prev, relationshipFilter: filter }))}
                  className="h-6 text-xs px-2 capitalize"
                >
                  {filter}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Switch
                  checked={config.showAttributeNodes}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, showAttributeNodes: checked }))}
                  className="scale-75"
                />
                <span>Attributes</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Switch
                  checked={config.showGeometryNodes}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, showGeometryNodes: checked }))}
                  className="scale-75"
                />
                <span>Geometry</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Switch
                  checked={config.showInheritance}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, showInheritance: checked }))}
                  className="scale-75"
                />
                <span>Inheritance</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Graph Canvas */}
      <div className="flex-1 relative bg-background">
        <ForceGraph2D
          ref={graphRef}
          graphData={forceGraphData}
          width={dimensions.width}
          height={dimensions.height}
          nodeLabel={(node: any) => {
            // Single consolidated tooltip
            let tooltip = node.shortName || node.name;
            if (node.ifcClass) tooltip += `\nType: ${node.ifcClass}`;
            if (node.materialInfo) tooltip += `\nMaterial: ${node.materialInfo}`;
            if (node.depth !== undefined) tooltip += `\nDepth: ${node.depth}`;
            if (node._hasChildren) tooltip += '\n✓ Has Children';
            return tooltip;
          }}
          nodeColor={getNodeColor}
          nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
            // Define clickable area for the node
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, getNodeSize(node), 0, 2 * Math.PI);
            ctx.fill();
          }}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const shortName = node.shortName || node.name;
            const ifcClass = node.ifcClass;
            const fontSize = 12 / globalScale;
            const smallFontSize = 10 / globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;
            
            // Draw node circle
            ctx.fillStyle = getNodeColor(node);
            ctx.beginPath();
            ctx.arc(node.x, node.y, getNodeSize(node), 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw selection ring if selected
            if (node.id === selectedNodePath || node.path === selectedNodePath) {
              ctx.strokeStyle = '#60a5fa'; // Bright blue to match selected color
              ctx.lineWidth = 3 / globalScale;
              ctx.beginPath();
              ctx.arc(node.x, node.y, getNodeSize(node) + 2, 0, 2 * Math.PI);
              ctx.stroke();
            }
            
            // Draw label if zoomed in enough or if selected/hovered
            if (globalScale > 1.5 || node.id === selectedNodePath || node.path === selectedNodePath || node === hoveredNode) {
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillStyle = '#fff';
              
              // Draw short name
              ctx.font = `${fontSize}px Sans-Serif`;
              ctx.fillText(shortName, node.x, node.y + getNodeSize(node) + 3);
              
              // Draw IFC class below if available
              if (ifcClass && node.category === 'data') {
                ctx.font = `${smallFontSize}px Sans-Serif`;
                ctx.fillStyle = '#a1a1aa';
                ctx.fillText(`[${ifcClass}]`, node.x, node.y + getNodeSize(node) + fontSize + 5);
              }
            }
          }}
          linkColor={getLinkColor}
          linkWidth={1}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleSpeed={0.003}
          onNodeClick={handleNodeClick}
          onNodeHover={setHoveredNode}
          enableNodeDrag={true}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          cooldownTicks={100}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />

        {/* Legend */}
        <Card className="absolute bottom-4 left-4 p-3">
          <div className="space-y-2 text-xs">
            <div className="font-semibold mb-2">Legend</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Box className="w-3 h-3 text-blue-500" />
                <span>Mesh</span>
              </div>
              <div className="flex items-center gap-2">
                <Minus className="w-3 h-3 text-green-500" />
                <span>Curve</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="w-3 h-3 text-purple-500" />
                <span>Points</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="w-3 h-3 text-gray-500" />
                <span>Group</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
