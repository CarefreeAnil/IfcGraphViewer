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
  Database,
  ChevronDown,
  ChevronUp,
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
  const [legendCollapsed, setLegendCollapsed] = useState(false);
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
          // After composition the class is at 'bsi::ifc::class::code' (string)
          const classAttr =
            node.properties['bsi::ifc::class::code'] ||
            node.properties['ifc::class'] ||
            node.properties['bsi::ifc::class'];
          if (classAttr) {
            ifcClass = typeof classAttr === 'object' && classAttr !== null && 'code' in classAttr
              ? (classAttr as any).code
              : String(classAttr);
          }

          // Extract material info for tooltip
          const materialAttr = node.properties['bsi::ifc::material::name'] || node.properties['bsi::ifc::material'];
          if (materialAttr) {
            materialInfo = typeof materialAttr === 'string' ? materialAttr : (materialAttr.name || materialAttr.code || '');
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

  // Node color based on category and IFC Class
  const getNodeColor = useCallback((node: any) => {
    const isSelected = node.id === selectedNodePath || node.path === selectedNodePath;

    if (node.category === 'data') {
      if (isSelected) return '#3b82f6'; // bright blue for selected

      // Geometry primitive nodes
      if (node.type === 'Mesh')   return '#60a5fa'; // blue
      if (node.type === 'Curve')  return '#4ade80'; // green
      if (node.type === 'Points') return '#c084fc'; // purple

      // Semantic nodes — color by IFC class
      const ifcClass = (node.ifcClass || '').toLowerCase();

      // Spatial structure hierarchy (sky blue)
      if (['ifcproject', 'ifcsite', 'ifcbuilding', 'ifcbuildingstorey',
           'ifcspace', 'ifcspatialelement', 'ifcspatialzone',
           'ifcexternalspatialelement'].some(c => ifcClass.includes(c))) {
        return '#0ea5e9';
      }

      // Openings, Windows, Doors (amber)
      if (['ifcwindow', 'ifcdoor', 'ifcopeningelement',
           'ifcvirtualelement'].some(c => ifcClass.includes(c))) {
        return '#f59e0b';
      }

      // Structural / physical elements (orange)
      if (['ifcwall', 'ifcslab', 'ifcbeam', 'ifccolumn', 'ifcroof',
           'ifcstair', 'ifcramp', 'ifccurtainwall', 'ifcmember',
           'ifcplate', 'ifcfooting', 'ifcpile', 'ifcfoundation',
           'ifcchimney', 'ifccover', 'ifcrailing',
           'ifcshadingdevice', 'ifcbuildingelement'].some(c => ifcClass.includes(c))) {
        return '#f97316';
      }

      // MEP / distribution elements (teal)
      if (['ifcpipe', 'ifcduct', 'ifccable', 'ifcflow', 'ifcdistribution',
           'ifcfittings', 'ifcunitaryequipment', 'ifccoil', 'ifcchiller',
           'ifcboiler', 'ifcpump', 'ifcvalve', 'ifcfan',
           'ifclightsource', 'ifclamp'].some(c => ifcClass.includes(c))) {
        return '#14b8a6';
      }

      // Furnishing / equipment (lime green)
      if (['ifcfurniture', 'ifcequipment', 'ifcsystemfurnitureelement',
           'ifcbuildingelementproxy', 'ifcgeographicelement'].some(c => ifcClass.includes(c))) {
        return '#84cc16';
      }

      // Infrastructure (road, bridge, railway, alignment) (rose)
      if (['ifcroad', 'ifcbridge', 'ifcrailway', 'ifctunnel',
           'ifcalignment', 'ifclinearelement', 'ifcfacility'].some(c => ifcClass.includes(c))) {
        return '#f43f5e';
      }

      // Materials (fuchsia)
      if (ifcClass.includes('material')) return '#d946ef';

      // Property sets (slate)
      if (ifcClass.includes('property') || ifcClass.includes('pset')) return '#94a3b8';

      return '#6b7280'; // generic group
    }

    // Non-data categories
    if (isSelected) return '#3b82f6';
    switch (node.category) {
      case 'attribute': return '#94a3b8';
      case 'geometry':  return '#2dd4bf';
      default:          return '#cbd5e1';
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

  // Link color based on category and type
  const getLinkColor = useCallback((link: any) => {
    switch (link.category) {
      case 'spatial':
        return '#38bdf8'; // sky blue
      case 'material':
        return '#e879f9'; // fuchsia
      case 'geometry':
        return '#4ade80'; // green
      case 'property':
      case 'attribute':
        return '#94a3b8'; // slate
      default:
        // Fallback to type logic
        switch (link.type) {
          case 'child': return '#94a3b8';
          case 'inherit': return '#fbbf24'; // amber
          case 'reference': return '#c084fc'; // purple
          default: return '#cbd5e1';
        }
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

  // Pan to selected node when selection changes from an external panel
  useEffect(() => {
    if (!selectedNodePath || !graphRef.current) return;

    // forceGraphData.nodes are the same objects the physics engine mutates —
    // they get x/y added once the simulation starts. We wait a beat so the
    // simulation has had a chance to assign coordinates.
    const timeoutId = setTimeout(() => {
      const node = forceGraphData.nodes.find(
        (n: any) => n.id === selectedNodePath || n.path === selectedNodePath
      );
      if (node && (node as any).x !== undefined && (node as any).y !== undefined) {
        graphRef.current?.centerAt((node as any).x, (node as any).y, 400);
        // Zoom in slightly so the selected node is clearly visible
        const currentZoom = graphRef.current?.zoom() ?? 1;
        if (currentZoom < 1.5) {
          graphRef.current?.zoom(1.5, 400);
        }
      }
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [selectedNodePath, forceGraphData.nodes]);

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

        {/* Legend — collapsed = pill button, expanded = full card */}
        {legendCollapsed ? (
          <button
            onClick={(e) => { e.stopPropagation(); setLegendCollapsed(false); }}
            className="absolute bottom-4 left-4 flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary text-primary-foreground shadow-lg text-xs font-semibold hover:opacity-90 transition-opacity"
            style={{ zIndex: 10, pointerEvents: 'all' }}
            title="Expand legend"
          >
            Legend <ChevronDown className="w-3 h-3" />
          </button>
        ) : (
          <Card
            className="absolute bottom-4 left-4 p-3 bg-card/95 backdrop-blur shadow-md border-border/50 min-w-[200px]"
            style={{ zIndex: 10, pointerEvents: 'all' }}
          >
            <div className="text-xs">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-semibold">Node Type Legend</div>
                <button
                  onClick={(e) => { e.stopPropagation(); setLegendCollapsed(true); }}
                  className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 p-1 rounded hover:bg-muted"
                  title="Collapse legend"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-3 max-h-[55vh] overflow-y-auto">
                <div className="space-y-1.5 border-b border-border/50 pb-2">
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Spatial Structure</div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#0ea5e9]" />
                    <span>Project / Site / Building / Storey / Space</span>
                  </div>
                </div>

                <div className="space-y-1.5 border-b border-border/50 pb-2">
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Building Elements</div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#f97316]" />
                    <span>Structural (Wall, Slab, Beam, Column…)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                    <span>Opening / Window / Door</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#14b8a6]" />
                    <span>MEP / Distribution</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#84cc16]" />
                    <span>Furniture / Equipment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#f43f5e]" />
                    <span>Infrastructure (Road, Bridge, Rail…)</span>
                  </div>
                </div>

                <div className="space-y-1.5 border-b border-border/50 pb-2">
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Other</div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#d946ef]" />
                    <span>Material</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#6b7280]" />
                    <span>Group / Other</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Geometry Layers</div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#60a5fa]" />
                    <span>Mesh</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#4ade80]" />
                    <span>Curve</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#c084fc]" />
                    <span>Points</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
