/**
 * TopologyPanel — TopologicPy-style topological analysis of the loaded model
 *
 * Renders the space-level topology graph (rooms, doors/portals, adjacency,
 * circulation) built by src/lib/topology/tgraph.ts, and runs the TopologicPy
 * algorithm ports from src/lib/topology/algorithms.ts — all client-side.
 *
 * Modes:
 * - Network:    the space graph colored by storey
 * - Centrality: rooms colored/ranked by Brandes betweenness (or closeness /
 *               degree) over the circulation network — "which rooms carry
 *               the most traffic"
 * - Path:       click two rooms → shortest route through doors/stairs,
 *               step-colored like a hop-depth legend
 * - Areas:      connected components of the circulation network — finds
 *               unreachable/isolated areas
 *
 * Selection is synced with the other panels through the shared
 * `node_${expressId}` identity: clicking a room or door here selects the same
 * entity in the Graph / IFC Browser / 3D / Properties panels and vice versa.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { ForceGraphMethods, NodeObject } from 'react-force-graph-2d';
import {
  Waypoints, Route, Activity, Boxes, Download, AlertTriangle, Crosshair, X,
} from 'lucide-react';
import { GraphData, GraphNode } from '@/types/graph';
import {
  buildTGraph, TGraphNode, TGraphEdge, TopologyPathStep, EXTERIOR_NODE_ID,
} from '@/lib/topology/tgraph';
import {
  buildGraphIndex, shortestPath, betweennessCentrality, closenessCentrality,
  degreeCentrality, connectedComponents, diameter, density,
} from '@/lib/topology/algorithms';
import { exportTopologyToJSON, exportTopologyEdgesToCSV } from '@/lib/exportUtils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface TopologyPanelProps {
  data: GraphData;                                // raw parsedData.graphData (unfiltered!)
  selectedNodeId: string | null;
  onNodeSelect: (node: GraphNode | null) => void; // same handler as the other panels
  /** Route steps for the 3D viewer (hop-colored); null clears the 3D route. */
  onPathHighlight?: (steps: TopologyPathStep[] | null) => void;
}

type AnalysisMode = 'network' | 'centrality' | 'path' | 'areas';
type CentralityMetric = 'betweenness' | 'closeness' | 'degree';

// Storey color cycle (network mode)
const STOREY_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#22d3ee', '#fb923c', '#a78bfa', '#4ade80'];

// Hop-depth palette for path steps: cool (start) → warm (end)
const HOP_COLORS = ['#2563eb', '#06b6d4', '#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7', '#ec4899'];

const PORTAL_COLORS: Record<string, string> = {
  door: '#fbbf24',
  'open passage': '#38bdf8',
  stair: '#f97316',
  elevator: '#a855f7',
  ramp: '#2dd4bf',
};

const EXTERIOR_COLOR = '#10b981';
const DIM_COLOR = 'rgba(100, 116, 139, 0.25)';

// Node radii in graph units — same scale family as GraphVisualization's
// NODE_SIZES (space: 10, element: 8) so both canvases read consistently.
const NODE_SIZES: Record<TGraphNode['kind'], number> = {
  space: 10,
  portal: 7,
  exterior: 12,
};

// Route color — GraphVisualization's path-to-root convention (#fb923c orange,
// 3px edges, size+3 rings) reused verbatim so "a path" looks the same everywhere.
const PATH_COLOR = '#fb923c';

const MODES: Array<{ id: AnalysisMode; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'network', label: 'Network', Icon: Waypoints },
  { id: 'centrality', label: 'Centrality', Icon: Activity },
  { id: 'path', label: 'Path', Icon: Route },
  { id: 'areas', label: 'Areas', Icon: Boxes },
];

/** Linear blue→red heat used for centrality values. */
function heatColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const from = { r: 37, g: 99, b: 235 };   // #2563eb
  const to = { r: 239, g: 68, b: 68 };     // #ef4444
  const r = Math.round(from.r + (to.r - from.r) * clamped);
  const g = Math.round(from.g + (to.g - from.g) * clamped);
  const b = Math.round(from.b + (to.b - from.b) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

function hopColor(step: number, totalHops: number): string {
  if (totalHops <= 0) return HOP_COLORS[0];
  const idx = Math.round((step / totalHops) * (HOP_COLORS.length - 1));
  return HOP_COLORS[Math.max(0, Math.min(HOP_COLORS.length - 1, idx))];
}

type FGNode = NodeObject & TGraphNode;

export function TopologyPanel({ data, selectedNodeId, onNodeSelect, onPathHighlight }: TopologyPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods>();
  const hasAutoFittedRef = useRef(false);
  const [dimensions, setDimensions] = useState({ width: 300, height: 300 });

  const [mode, setMode] = useState<AnalysisMode>('network');
  const [metric, setMetric] = useState<CentralityMetric>('betweenness');
  const [pathStart, setPathStart] = useState<string | null>(null);
  const [pathEnd, setPathEnd] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<number | null>(null);

  // ── Build the topology graph (memoized per file) ──────────────────────────
  const tgraph = useMemo(() => buildTGraph(data), [data]);

  // Loading a different file invalidates node ids — clear analysis state.
  useEffect(() => {
    setPathStart(null);
    setPathEnd(null);
    setSelectedArea(null);
  }, [tgraph]);

  // Circulation network = passable edges only (doors, stairs, open-plan links)
  const circulation = useMemo(
    () => buildGraphIndex(tgraph.nodes.map(n => n.id), tgraph.edges, e => (e as TGraphEdge).passable),
    [tgraph],
  );

  const areas = useMemo(() => {
    // Indoor areas only: exclude the synthetic Exterior node, otherwise two
    // disconnected wings that both have entrance doors would merge into one
    // "area" through the outdoors. Only components that contain at least one
    // space are interesting (a lone unbounded portal is data noise).
    const indoorIds = tgraph.nodes.filter(n => n.kind !== 'exterior').map(n => n.id);
    const indoor = buildGraphIndex(indoorIds, tgraph.edges, e => (e as TGraphEdge).passable);
    const spaceIds = new Set(tgraph.nodes.filter(n => n.kind === 'space').map(n => n.id));
    return connectedComponents(indoor).filter(c => c.some(id => spaceIds.has(id)));
  }, [tgraph]);

  const circulationStats = useMemo(() => ({
    density: density(circulation),
    // BFS from every vertex is O(V·(V+E)) — space graphs are small, but guard
    // against pathological inputs anyway.
    diameter: tgraph.nodes.length <= 2000 ? diameter(circulation) : null,
  }), [circulation, tgraph]);

  const centralityValues = useMemo(() => {
    if (tgraph.nodes.length > 5000) return new Map<string, number>();
    switch (metric) {
      case 'closeness': return closenessCentrality(circulation);
      case 'degree': return degreeCentrality(circulation);
      default: return betweennessCentrality(circulation);
    }
  }, [circulation, metric, tgraph]);

  const centralityRanking = useMemo(() => {
    return tgraph.nodes
      .filter(n => n.kind === 'space')
      .map(n => ({ node: n, value: centralityValues.get(n.id) ?? 0 }))
      .sort((a, b) => b.value - a.value);
  }, [tgraph, centralityValues]);

  const maxCentrality = centralityRanking.length > 0 ? centralityRanking[0].value : 0;

  const pathResult = useMemo(() => {
    if (!pathStart || !pathEnd) return null;
    return shortestPath(circulation, pathStart, pathEnd);
  }, [circulation, pathStart, pathEnd]);

  const pathUnreachable = Boolean(pathStart && pathEnd && !pathResult);

  // Node id → step index on the current path
  const pathSteps = useMemo(() => {
    const steps = new Map<string, number>();
    pathResult?.nodeIds.forEach((id, i) => steps.set(id, i));
    return steps;
  }, [pathResult]);

  const pathEdgeIds = useMemo(() => new Set(pathResult?.edgeIds ?? []), [pathResult]);

  // Node id → area index
  const areaOfNode = useMemo(() => {
    const map = new Map<string, number>();
    areas.forEach((component, i) => component.forEach(id => map.set(id, i)));
    return map;
  }, [areas]);

  const storeyIndex = useMemo(() => {
    const map = new Map<string, number>();
    tgraph.nodes.forEach(n => {
      if (n.storeyId && !map.has(n.storeyId)) map.set(n.storeyId, map.size);
    });
    return map;
  }, [tgraph]);

  // Stable object graph for react-force-graph (it mutates nodes/links in place)
  const forceGraphData = useMemo(() => ({
    nodes: tgraph.nodes.map(n => ({ ...n })) as FGNode[],
    links: tgraph.edges.map(e => ({ ...e })),
  }), [tgraph]);

  useEffect(() => {
    hasAutoFittedRef.current = false;
  }, [forceGraphData]);

  // ── Sizing ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => setDimensions({
      width: container.clientWidth,
      height: container.clientHeight,
    });
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(container);
    return () => observer?.disconnect();
  }, []);

  // ── Colors per mode ───────────────────────────────────────────────────────
  const nodeColor = useCallback((node: FGNode): string => {
    if (mode === 'path') {
      if (node.id === pathStart || node.id === pathEnd || pathSteps.has(node.id)) {
        const step = pathSteps.get(node.id);
        if (step !== undefined && pathResult) return hopColor(step, pathResult.hops);
        return HOP_COLORS[0];
      }
      return DIM_COLOR;
    }
    if (mode === 'areas') {
      const area = areaOfNode.get(node.id);
      if (area === undefined) return DIM_COLOR;
      if (selectedArea !== null && area !== selectedArea) return DIM_COLOR;
      return STOREY_COLORS[area % STOREY_COLORS.length];
    }
    if (mode === 'centrality') {
      if (node.kind !== 'space') return DIM_COLOR;
      const value = centralityValues.get(node.id) ?? 0;
      return heatColor(maxCentrality > 0 ? value / maxCentrality : 0);
    }
    // network mode
    if (node.kind === 'exterior') return EXTERIOR_COLOR;
    if (node.kind === 'portal') return PORTAL_COLORS[node.portalType ?? 'door'];
    const idx = node.storeyId ? storeyIndex.get(node.storeyId) ?? 0 : 0;
    return STOREY_COLORS[idx % STOREY_COLORS.length];
  }, [mode, pathStart, pathEnd, pathSteps, pathResult, areaOfNode, selectedArea, centralityValues, maxCentrality, storeyIndex]);

  // ── Link painting — GraphVisualization's line grammar ─────────────────────
  // Solid 2px primary edges, dashed [5,5] 1.2px secondary (adjacency), orange
  // 3px route edges, and rotated JetBrains Mono kind-labels at zoom.
  type FGLink = {
    kind?: string; passable?: boolean; vertical?: boolean; crossStorey?: boolean; id?: string;
    source?: { x?: number; y?: number }; target?: { x?: number; y?: number };
  };

  const paintLink = useCallback((link: FGLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
    // d3 can transiently keep string ids during graph data transitions
    if (typeof link.source !== 'object' || typeof link.target !== 'object' || !link.source || !link.target) return;
    const sx = link.source.x ?? 0;
    const sy = link.source.y ?? 0;
    const tx = link.target.x ?? 0;
    const ty = link.target.y ?? 0;

    const isPathEdge = mode === 'path' && !!link.id && pathEdgeIds.has(link.id);
    const isAdjacent = link.kind === 'adjacent';

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);

    if (isPathEdge) {
      ctx.strokeStyle = PATH_COLOR;
      ctx.lineWidth = 3;
    } else if (mode === 'path') {
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.12)';
      ctx.lineWidth = isAdjacent ? 1.2 : 2;
    } else {
      let color: string;
      if (link.crossStorey) color = '#ef4444';
      else if (link.vertical) color = '#a855f7';
      else if (isAdjacent) color = link.passable ? 'rgba(34, 197, 94, 0.55)' : 'rgba(100, 116, 139, 0.35)';
      else color = 'rgba(148, 163, 184, 0.65)';
      ctx.strokeStyle = color;
      ctx.lineWidth = isAdjacent ? 1.2 : 2;
    }
    if (isAdjacent && !isPathEdge) ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Edge kind label at zoom — same rotated, haloed treatment as the graph's
    // relationship labels (readable left-to-right).
    if (globalScale > 2 && mode !== 'path') {
      const label = link.vertical ? 'vertical'
        : link.crossStorey ? 'cross-storey'
        : isAdjacent ? (link.passable ? 'open-plan' : 'adjacent')
        : 'through';
      const midX = (sx + tx) / 2;
      const midY = (sy + ty) / 2;
      let labelAngle = Math.atan2(ty - sy, tx - sx);
      if (labelAngle > Math.PI / 2) labelAngle -= Math.PI;
      if (labelAngle < -Math.PI / 2) labelAngle += Math.PI;

      ctx.save();
      ctx.translate(midX, midY);
      ctx.rotate(labelAngle);
      const fontSize = Math.max(9 / globalScale, 4);
      ctx.font = `bold ${fontSize}px JetBrains Mono`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 2;
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  }, [mode, pathEdgeIds]);

  // ── Node painting: circles for spaces, diamonds for portals ──────────────
  // Same visual grammar as GraphVisualization's nodeCanvasObject: solid fill +
  // same-color 1px border, white 2.5px ring + layered radial glow when selected,
  // orange path rings, JetBrains Mono labels with a dark text shadow.
  const paintNode = useCallback((node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const isSelected = node.id === selectedNodeId;
    const isEndpoint = node.id === pathStart || node.id === pathEnd;
    const onPath = pathSteps.has(node.id) || isEndpoint;
    let radius = NODE_SIZES[node.kind];
    if (mode === 'path' && onPath && !isSelected) radius *= 1.3; // path nodes read larger, like the graph
    const color = nodeColor(node);

    // Layered radial glow for the selected node (GraphVisualization recipe,
    // glowIntensity 1.5; heatColor() returns rgb() strings, which skip the
    // hex-alpha suffix exactly like the original).
    if (isSelected) {
      for (let i = 3; i >= 1; i--) {
        ctx.beginPath();
        ctx.arc(x, y, radius + i * 3, 0, 2 * Math.PI);
        const gradient = ctx.createRadialGradient(x, y, radius, x, y, radius + i * 4.5);
        const alpha = (4 - i) * 0.1;
        gradient.addColorStop(0, color.startsWith('#')
          ? color + Math.floor(alpha * 255).toString(16).padStart(2, '0')
          : color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }

    // Orange route ring (graph's path-to-root convention)
    if (mode === 'path' && onPath && !isSelected) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 3, 0, 2 * Math.PI);
      ctx.strokeStyle = PATH_COLOR;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    if (node.kind === 'portal') {
      // diamond
      ctx.moveTo(x, y - radius);
      ctx.lineTo(x + radius, y);
      ctx.lineTo(x, y + radius);
      ctx.lineTo(x - radius, y);
      ctx.closePath();
    } else if (node.kind === 'exterior') {
      ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
    } else {
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
    }
    ctx.fillStyle = color;
    ctx.fill();

    // Border: white when selected, self-colored hairline otherwise
    ctx.strokeStyle = isSelected ? '#fff' : color;
    ctx.lineWidth = isSelected ? 2.5 : 1;
    ctx.stroke();

    // Labels: spaces when zoomed in; always for selected/path/exterior nodes
    const showLabel =
      node.kind === 'exterior' ||
      isSelected || onPath ||
      (node.kind === 'space' && globalScale > 1.2);
    if (showLabel) {
      const fontSize = Math.max(10 / globalScale, 4);
      ctx.font = `bold ${fontSize}px JetBrains Mono`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(node.label, x, y + radius + 4);

      // Storey subline at deep zoom — parity with the graph's property lines
      if (globalScale > 2.5 && node.storeyName) {
        const propFontSize = Math.max(7 / globalScale, 3);
        ctx.font = `${propFontSize}px JetBrains Mono`;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(node.storeyName, x, y + radius + 4 + fontSize + 3);
      }
      ctx.shadowBlur = 0;
    }
  }, [nodeColor, selectedNodeId, pathStart, pathEnd, pathSteps, mode]);

  const paintPointerArea = useCallback((node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
    // Generous hit area, same rationale as the graph's nodePointerAreaPaint
    // (force-graph picking is unreliable on small nodes), scaled down for the
    // panel's smaller, sparser layouts.
    const radius = Math.max(NODE_SIZES[node.kind] * 2.5, 20);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  // ── Interactions ──────────────────────────────────────────────────────────
  const handleNodeClick = useCallback((node: FGNode) => {
    if (mode === 'path') {
      if (node.id === EXTERIOR_NODE_ID || node.kind !== 'portal') {
        // Rooms (or Exterior) are valid endpoints; pick start first, then end.
        if (!pathStart || (pathStart && pathEnd)) {
          setPathStart(node.id);
          setPathEnd(null);
        } else if (node.id !== pathStart) {
          setPathEnd(node.id);
        }
      }
      return;
    }
    if (node.id === EXTERIOR_NODE_ID) return;
    const appNode = data.nodes.find(n => n.id === node.id);
    onNodeSelect(appNode ?? null);
  }, [mode, pathStart, pathEnd, data.nodes, onNodeSelect]);

  const handleBackgroundClick = useCallback(() => {
    if (mode === 'path') {
      setPathStart(null);
      setPathEnd(null);
    } else {
      onNodeSelect(null);
    }
  }, [mode, onNodeSelect]);

  const fitView = useCallback(() => {
    graphRef.current?.zoomToFit(400, 30);
  }, []);

  const nodeById = useMemo(() => {
    const map = new Map<string, TGraphNode>();
    tgraph.nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [tgraph]);

  const selectFromList = useCallback((id: string) => {
    const appNode = data.nodes.find(n => n.id === id);
    if (appNode) onNodeSelect(appNode);
  }, [data.nodes, onNodeSelect]);

  // ── 3D route sync ─────────────────────────────────────────────────────────
  // Publish the computed route (hop colors matching the 2D fills) so the 3D
  // viewer can render it; cleared when the path is dropped, the mode changes,
  // or the panel unmounts. Ref-wrapped so a new callback identity from the
  // parent doesn't re-emit.
  const onPathHighlightRef = useRef(onPathHighlight);
  useEffect(() => { onPathHighlightRef.current = onPathHighlight; });

  useEffect(() => {
    const publish = onPathHighlightRef.current;
    if (!publish) return;
    if (mode !== 'path' || !pathResult) {
      publish(null);
      return;
    }
    const steps: TopologyPathStep[] = [];
    pathResult.nodeIds.forEach((id, i) => {
      const step = nodeById.get(id);
      if (step && step.kind !== 'exterior' && step.expressId !== undefined) {
        steps.push({
          expressId: step.expressId,
          color: hopColor(i, pathResult.hops),
          kind: step.kind === 'space' ? 'space' : 'portal',
        });
      }
    });
    publish(steps.length > 0 ? steps : null);
  }, [mode, pathResult, nodeById]);

  useEffect(() => () => { onPathHighlightRef.current?.(null); }, []);

  // Match the main graph's force tuning so layout density feels the same
  useEffect(() => {
    graphRef.current?.d3Force('charge')?.strength(-185);
    graphRef.current?.d3Force('link')?.distance(78);
  }, [forceGraphData]);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (tgraph.stats.spaceCount === 0) {
    return (
      <div className="h-full w-full bg-card/50 backdrop-blur-sm flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-sm">
          <Waypoints className="w-8 h-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm font-medium">No spatial topology available</p>
          {tgraph.warnings.map((warning, i) => (
            <p key={i} className="text-xs text-muted-foreground">{warning}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-card/50 backdrop-blur-sm flex flex-col overflow-hidden">
      {/* Header: title + mode switch + export */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-1.5 border-b border-border">
        <Waypoints className="w-4 h-4 text-primary flex-shrink-0" />
        <div className="min-w-0">
          <h3 className="text-xs font-semibold leading-tight">Topology</h3>
          <p className="text-[9px] text-muted-foreground leading-tight truncate">
            TopologicPy-style space graph
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={fitView}
            title="Fit graph to view"
            className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                title="Export topology graph"
                className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportTopologyToJSON(tgraph)}>
                Topology graph (JSON)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportTopologyEdgesToCSV(tgraph)}>
                Edge list (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mode switch */}
      <div className="flex gap-1 px-3 py-1.5 border-b border-border">
        {MODES.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors',
              mode === id
                ? 'bg-primary/15 text-primary border border-primary/25'
                : 'text-muted-foreground hover:bg-muted border border-transparent',
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Stats strip */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-3 py-1.5 border-b border-border text-[9px] text-muted-foreground font-mono">
        <span>{tgraph.stats.spaceCount} spaces</span>
        <span>{tgraph.stats.portalCount} portals</span>
        <span>{tgraph.stats.adjacentEdgeCount} adjacencies</span>
        <span>{areas.length} area{areas.length === 1 ? '' : 's'}</span>
        <span>density {circulationStats.density.toFixed(3)}</span>
        {circulationStats.diameter !== null && <span>diameter {circulationStats.diameter}</span>}
      </div>

      {/* Warnings */}
      {tgraph.warnings.length > 0 && (
        <div className="px-3 py-1.5 border-b border-border bg-amber-500/10">
          {tgraph.warnings.map((warning, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[9px] text-amber-500">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-px" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Force graph — same backdrop (grid + radial glow) as the Graph panel */}
      <div ref={containerRef} className="flex-1 min-h-0 relative grid-pattern gradient-radial">
        <ForceGraph2D
          ref={graphRef}
          graphData={forceGraphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="transparent"
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={paintPointerArea}
          nodeLabel={(node: FGNode) =>
            node.kind === 'portal'
              ? `${node.label} — ${node.portalType} (${node.ifcType})`
              : `${node.label}${node.storeyName ? ` — ${node.storeyName}` : ''} (${node.ifcType})`
          }
          linkCanvasObject={paintLink}
          onNodeClick={handleNodeClick}
          onBackgroundClick={handleBackgroundClick}
          cooldownTicks={100}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          onEngineStop={() => {
            if (!hasAutoFittedRef.current) {
              hasAutoFittedRef.current = true;
              fitView();
            }
          }}
        />

        {/* Legend overlay */}
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-x-2.5 gap-y-0.5 px-2 py-1 rounded bg-card/90 backdrop-blur-md border border-border text-[8px] text-muted-foreground max-w-[95%]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#60a5fa] inline-block" /> space
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rotate-45 bg-[#fbbf24] inline-block" /> portal
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[#10b981] inline-block" /> exterior
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 border-t border-[#94a3b8] inline-block" /> through
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 border-t border-dashed border-[#64748b] inline-block" /> adjacent
          </span>
          {mode === 'network' && (
            <span className="flex items-center gap-1">
              <span className="w-3 border-t border-[#a855f7] inline-block" /> vertical
            </span>
          )}
        </div>
      </div>

      {/* Mode detail footer */}
      <div className="border-t border-border max-h-[38%] overflow-y-auto">
        {mode === 'network' && (
          <p className="px-3 py-2 text-[10px] text-muted-foreground leading-relaxed">
            Rooms (colored by storey) linked through doors, stairs and openings.
            Dashed links are boundary adjacencies (shared wall); green dashed links
            are open-plan connections. Click any node to inspect it in the other panels.
          </p>
        )}

        {mode === 'centrality' && (
          <div className="px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-1">
              {(['betweenness', 'closeness', 'degree'] as CentralityMetric[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[9px] capitalize transition-colors',
                    metric === m ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {m}
                </button>
              ))}
              <span className="ml-auto text-[9px] text-muted-foreground">circulation network</span>
            </div>
            {centralityRanking.slice(0, 8).map(({ node, value }) => (
              <button
                key={node.id}
                onClick={() => selectFromList(node.id)}
                className="w-full flex items-center gap-2 text-left group"
              >
                <span className="text-[10px] truncate flex-1 group-hover:text-primary transition-colors">
                  {node.label}
                </span>
                <span className="h-1.5 rounded bg-primary/60" style={{ width: `${Math.max(2, maxCentrality > 0 ? (value / maxCentrality) * 72 : 0)}px` }} />
                <span className="text-[9px] font-mono text-muted-foreground w-12 text-right">
                  {value.toFixed(3)}
                </span>
              </button>
            ))}
          </div>
        )}

        {mode === 'path' && (
          <div className="px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-muted-foreground">
                {!pathStart
                  ? 'Click a room to set the start.'
                  : !pathEnd
                    ? `From ${nodeById.get(pathStart)?.label ?? '?'} — click a destination room.`
                    : `${nodeById.get(pathStart)?.label ?? '?'} → ${nodeById.get(pathEnd)?.label ?? '?'}`}
              </span>
              {(pathStart || pathEnd) && (
                <button
                  onClick={() => { setPathStart(null); setPathEnd(null); }}
                  className="ml-auto p-0.5 rounded hover:bg-muted text-muted-foreground"
                  title="Clear path"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            {pathUnreachable && (
              <p className="text-[10px] text-destructive">
                No route found through the circulation network — the rooms are in
                disconnected areas (see the Areas mode).
              </p>
            )}
            {pathResult && (
              <div className="space-y-0.5">
                <p className="text-[9px] text-muted-foreground">
                  {pathResult.hops} hop{pathResult.hops === 1 ? '' : 's'} via doors/portals:
                </p>
                {pathResult.nodeIds.map((id, i) => {
                  const step = nodeById.get(id);
                  if (!step) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => selectFromList(id)}
                      className="w-full flex items-center gap-1.5 text-left group"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: hopColor(i, pathResult.hops) }}
                      />
                      <span className="text-[10px] truncate group-hover:text-primary transition-colors">
                        {step.label}
                        {step.kind === 'portal' && (
                          <span className="text-muted-foreground"> ({step.portalType})</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {mode === 'areas' && (
          <div className="px-3 py-2 space-y-1">
            <p className="text-[9px] text-muted-foreground">
              Connected areas of the circulation network. More than one area means
              some rooms cannot be reached through doors/openings.
            </p>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedArea(null)}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[9px] transition-colors',
                  selectedArea === null ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                All
              </button>
              {areas.map((component, i) => {
                const spaceCount = component.filter(id => nodeById.get(id)?.kind === 'space').length;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedArea(selectedArea === i ? null : i)}
                    className={cn(
                      'flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-colors border',
                      selectedArea === i
                        ? 'border-primary/40 text-primary bg-primary/10'
                        : 'border-transparent text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: STOREY_COLORS[i % STOREY_COLORS.length] }}
                    />
                    Area {i + 1} · {spaceCount} space{spaceCount === 1 ? '' : 's'}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
