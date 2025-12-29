/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useRef, useEffect, useState } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { GraphData, GraphNode, NodeType } from "@/types/graph";
import { getEntityColor, getEntityDisplayName } from "@/lib/ifcSchema";

interface GraphVisualizationProps {
  data: GraphData;
  onNodeClick: (node: GraphNode | null) => void;
  selectedNodeId: string | null;
  highlightedTypes: NodeType[];
  searchQuery: string;
}

const NODE_COLORS: Record<NodeType, string> = {
  building: "#22d3ee", // cyan
  space: "#a78bfa", // purple
  element: "#fbbf24", // amber
  property: "#4ade80", // green
  relationship: "#f472b6", // pink
  geometry: "#9ca3af", // gray
  other: "#6b7280", // dark gray
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

export function GraphVisualization({
  data,
  onNodeClick,
  selectedNodeId,
  highlightedTypes,
  searchQuery,
}: GraphVisualizationProps) {
  const graphRef = useRef<ForceGraphMethods>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

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
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force("charge")?.strength(-150);
      graphRef.current.d3Force("link")?.distance(60);
    }
  }, [data]);

  const graphData = {
    nodes: data.nodes.map((node) => ({ ...node })),
    links: data.edges.map((edge) => ({
      ...edge,
      source: edge.source,
      target: edge.target,
    })),
  };

  const isNodeVisible = useCallback(
    (node: GraphNode) => {
      const typeMatch =
        highlightedTypes.length === 0 || highlightedTypes.includes(node.type);
      const searchMatch =
        searchQuery === "" ||
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.ifcType.toLowerCase().includes(searchQuery.toLowerCase());
      return typeMatch && searchMatch;
    },
    [highlightedTypes, searchQuery]
  );

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const graphNode = node as GraphNode;
      const isVisible = isNodeVisible(graphNode);
      const isSelected = node.id === selectedNodeId;
      const size = NODE_SIZES[graphNode.type] || 8;

      // Use schema-based color if available, otherwise fallback to type color
      let color = graphNode.properties?._schemaColor as string;
      if (!color || color === "" || color === "#888" || color === "#6b7280") {
        color = NODE_COLORS[graphNode.type] || "#3b82f6";
      }

      const x = node.x || 0;
      const y = node.y || 0;

      // Draw glow for selected node
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, size + 6, 0, 2 * Math.PI);
        const gradient = ctx.createRadialGradient(x, y, size, x, y, size + 10);
        gradient.addColorStop(0, color + "60");
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Draw node
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = isVisible ? color : color + "30";
      ctx.fill();

      // Draw border
      ctx.strokeStyle = isVisible
        ? isSelected
          ? "#fff"
          : color
        : color + "20";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Draw label and attributes - improved formatting
      if (globalScale > 0.8 && isVisible) {
        const fontSize = Math.max(10 / globalScale, 3);
        ctx.font = `${fontSize}px JetBrains Mono`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(255,255,255,0.9)";

        // Main label (node name)
        const label = graphNode.label;
        ctx.fillText(label, x, y + size + 3);

        // Try to extract and show additional attributes if zoomed in enough
        if (globalScale > 1.2) {
          const nameAttr =
            graphNode.properties?.Name || graphNode.properties?.name;
          const descAttr =
            graphNode.properties?.Description ||
            graphNode.properties?.description;
          const categoryStr = graphNode.type ? `[${graphNode.type}]` : "";

          // Show name attribute if different from label
          if (nameAttr && nameAttr !== label && nameAttr.length > 0) {
            ctx.font = `${Math.max(7 / globalScale, 2)}px JetBrains Mono`;
            ctx.fillStyle = "rgba(255,255,255,0.6)";
            const nameStr = String(nameAttr).substring(0, 20);
            ctx.fillText(nameStr, x, y + size + 12);
          }
        }
      }
    },
    [isNodeVisible, selectedNodeId]
  );

  const linkCanvasObject = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const sourceNode = link.source as GraphNode;
      const targetNode = link.target as GraphNode;

      const sourceVisible = isNodeVisible(sourceNode);
      const targetVisible = isNodeVisible(targetNode);
      const isVisible = sourceVisible && targetVisible;

      if (!isVisible) {
        // Draw faint line only
        const sourceX = (link.source as any).x || 0;
        const sourceY = (link.source as any).y || 0;
        const targetX = (link.target as any).x || 0;
        const targetY = (link.target as any).y || 0;

        ctx.beginPath();
        ctx.moveTo(sourceX, sourceY);
        ctx.lineTo(targetX, targetY);
        ctx.strokeStyle = "#33330";
        ctx.lineWidth = 0.5;
        ctx.stroke();
        return;
      }

      const sourceX = (link.source as any).x || 0;
      const sourceY = (link.source as any).y || 0;
      const targetX = (link.target as any).x || 0;
      const targetY = (link.target as any).y || 0;

      // Draw main line
      ctx.beginPath();
      ctx.moveTo(sourceX, sourceY);
      ctx.lineTo(targetX, targetY);
      ctx.strokeStyle = "#444";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw arrowhead
      const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
      const arrowLength = 8;
      const targetSize = NODE_SIZES[targetNode.type] || 8;
      const arrowX = targetX - Math.cos(angle) * (targetSize + 6);
      const arrowY = targetY - Math.sin(angle) * (targetSize + 6);

      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - arrowLength * Math.cos(angle - Math.PI / 6),
        arrowY - arrowLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        arrowX - arrowLength * Math.cos(angle + Math.PI / 6),
        arrowY - arrowLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = "#444";
      ctx.fill();

      // === Relationship Label ===
      const relationshipType =
        (link as any).relationshipType ||
        (link as any).type ||
        (link as any).label ||
        "";

      if (!relationshipType) return;

      // Clean up label text (same mapping as before)
      let labelText = relationshipType;
      if (labelText.startsWith("IFCREL")) {
        labelText = labelText.substring(6);
      }

      const relationshipMap: Record<string, string> = {
        AGGREGATES: "Has Parts",
        CONTAINEDINSPATIALSTRUCTURE: "Contains",
        VOIDSELEMENT: "Has Opening",
        FILLSELEMENT: "Fills Opening",
        DEFINESBYPROPERTIES: "Has Properties",
        ASSOCIATESMATERIAL: "Material",
        ASSOCIATESCLASSIFICATION: "Classification",
        CONNECTEDTO: "Connected",
      };

      for (const [key, value] of Object.entries(relationshipMap)) {
        if (labelText.includes(key)) {
          labelText = value;
          break;
        }
      }

      // Truncate if too long
      if (labelText.length > 18) {
        labelText = labelText.substring(0, 15) + "...";
      }

      // Only show label when sufficiently zoomed in
      if (globalScale < 0.8) return;

      const midX = (sourceX + targetX) / 2;
      const midY = (sourceY + targetY) / 2;
      let labelAngle = Math.atan2(targetY - sourceY, targetX - sourceX);

      // Smart rotation: make text readable from left-to-right when possible
      if (labelAngle > Math.PI / 2) labelAngle -= Math.PI;
      if (labelAngle < -Math.PI / 2) labelAngle += Math.PI;

      // Dynamic font size based on zoom
      const fontSize = Math.max(8 / globalScale, 5);
      ctx.font = `bold ${fontSize}px JetBrains Mono`;

      const textMetrics = ctx.measureText(labelText);
      const padding = 6;

      ctx.save();
      ctx.translate(midX, midY);
      ctx.rotate(labelAngle);

      // Background box
      ctx.fillStyle = "rgba(0, 0, 0, 0)";
      ctx.roundRect(
        -textMetrics.width / 2 - padding,
        -fontSize / 2 - padding,
        textMetrics.width + padding * 2,
        fontSize + padding * 2,
        6
      );
      ctx.fill();

      // Text
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, 0, 0);

      ctx.restore();
    },
    [isNodeVisible]
  );

  const handleNodeClick = useCallback(
    (node: any) => {
      onNodeClick(node as GraphNode);

      if (graphRef.current) {
        graphRef.current.centerAt(node.x, node.y, 500);
        graphRef.current.zoom(2, 500);
      }
    },
    [onNodeClick]
  );

  const handleBackgroundClick = useCallback(() => {
    onNodeClick(null);
  }, [onNodeClick]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full grid-pattern gradient-radial"
    >
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
      />
    </div>
  );
}
