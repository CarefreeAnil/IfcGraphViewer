import { useCallback, useRef, useEffect, useState } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { GraphData, GraphNode, NodeType } from '@/types/graph';
import { getEntityColor, getEntityDisplayName } from '@/lib/ifcSchema';

interface GraphVisualizationProps {
  data: GraphData;
  onNodeClick: (node: GraphNode | null) => void;
  selectedNodeId: string | null;
  highlightedTypes: NodeType[];
  searchQuery: string;
  showAttributes: boolean;
  showRelatedMetadata?: boolean;
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
  showAttributes,
  showRelatedMetadata = false,
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
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('charge')?.strength(-150);
      graphRef.current.d3Force('link')?.distance(60);
    }
  }, [data]);

  // Find all metadata nodes related to selected node
  const getRelatedMetadataNodeIds = useCallback((nodeId: string): Set<string> => {
    if (!selectedNodeId || !showRelatedMetadata) return new Set();
    
    const relatedIds = new Set<string>();
    // Get all edges connected to selected node
    data.edges.forEach(edge => {
      if (edge.source === selectedNodeId) {
        const targetNode = data.nodes.find(n => n.id === edge.target);
        if (targetNode?.isMetadata) {
          relatedIds.add(edge.target);
        }
      }
      if (edge.target === selectedNodeId) {
        const sourceNode = data.nodes.find(n => n.id === edge.source);
        if (sourceNode?.isMetadata) {
          relatedIds.add(edge.source);
        }
      }
    });
    return relatedIds;
  }, [selectedNodeId, showRelatedMetadata, data]);

  const relatedMetadataIds = getRelatedMetadataNodeIds(selectedNodeId || '');

  const graphData = {
    nodes: data.nodes
      .filter(node => {
        // Always show non-metadata nodes
        if (!node.isMetadata) return true;
        // Show metadata only if it's related to selected node and flag is true
        return showRelatedMetadata && selectedNodeId && relatedMetadataIds.has(node.id);
      })
      .map((node) => ({ ...node })),
    links: data.edges
      .filter(edge => {
        // Only include edges where both source and target nodes exist in filtered nodes
        const sourceNode = data.nodes.find(n => n.id === edge.source);
        const targetNode = data.nodes.find(n => n.id === edge.target);
        
        if (!sourceNode || !targetNode) return false;
        
        // Source must be visible
        if (sourceNode.isMetadata && (!showRelatedMetadata || !selectedNodeId || !relatedMetadataIds.has(sourceNode.id))) {
          return false;
        }
        
        // Target must be visible
        if (targetNode.isMetadata && (!showRelatedMetadata || !selectedNodeId || !relatedMetadataIds.has(targetNode.id))) {
          return false;
        }
        
        return true;
      })
      .map((edge) => ({
        ...edge,
        source: edge.source,
        target: edge.target,
      })),
  };

  const isNodeVisible = useCallback(
    (node: GraphNode) => {
      // Metadata nodes should match their visibility in graphData
      if (node.isMetadata) {
        return relatedMetadataIds.has(node.id);
      }
      
      const typeMatch = highlightedTypes.length === 0 || highlightedTypes.includes(node.type);
      const searchMatch =
        searchQuery === '' ||
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.ifcType.toLowerCase().includes(searchQuery.toLowerCase());
      return typeMatch && searchMatch;
    },
    [highlightedTypes, searchQuery, relatedMetadataIds]
  );

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const graphNode = node as GraphNode;
      const isVisible = isNodeVisible(graphNode);
      const isSelected = node.id === selectedNodeId;
      const isMetadataNode = graphNode.isMetadata;
      
      let size = NODE_SIZES[graphNode.type] || 8;
      // Metadata nodes are smaller
      if (isMetadataNode) {
        size = size * 0.6;
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
      } else {
        ctx.fillStyle = isVisible ? color : color + '30';
      }
      ctx.fill();

      // Draw border
      ctx.strokeStyle = isVisible ? (isSelected ? '#fff' : color) : color + '20';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Draw label and attributes - improved decluttering with clustering and toggle
      if (globalScale > 1.0 && isVisible) {
        const fontSize = Math.max(10 / globalScale, 4);
        ctx.font = `bold ${fontSize}px JetBrains Mono`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isMetadataNode ? 'rgba(200,200,200,0.8)' : '#ffffff'; // Lighter for metadata
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 3;
        
        // Main label (node name/ID)
        const label = graphNode.label;
        ctx.fillText(label, x, y + size + 4);
        
        // Show additional properties based on zoom level and toggle
        const shouldShowDetailedAttrs = (globalScale > 1.8 && showAttributes) || (globalScale > 2.5);
        
        if (shouldShowDetailedAttrs && !isMetadataNode) {
          const properties = graphNode.properties || {};
          const lines: string[] = [];
          
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
          
          // Draw properties
          const propFontSize = Math.max(7 / globalScale, 3);
          ctx.font = `${propFontSize}px JetBrains Mono`;
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          
          lines.forEach((line, idx) => {
            ctx.fillText(line, x, y + size + 13 + idx * (propFontSize + 2));
          });
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

      const sourceX = (link.source as any).x || 0;
      const sourceY = (link.source as any).y || 0;
      const targetX = (link.target as any).x || 0;
      const targetY = (link.target as any).y || 0;

      // Check if edge involves metadata
      const isMetadataEdge = (sourceNode.isMetadata || targetNode.isMetadata);

      // Draw main line
      ctx.beginPath();
      ctx.moveTo(sourceX, sourceY);
      ctx.lineTo(targetX, targetY);
      // Metadata edges are lighter/dashed appearance
      if (isMetadataEdge && isVisible) {
        ctx.strokeStyle = '#888888'; // Lighter for metadata
        ctx.setLineDash([5, 5]); // Dashed line for metadata relationships
      } else {
        ctx.strokeStyle = isVisible ? '#444' : '#3333';
      }
      ctx.lineWidth = isVisible ? 1.5 : 0.5;
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // Draw arrow and label
      if (isVisible) {
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
        ctx.fillStyle = '#444';
        ctx.fill();
        
        // Draw relationship label on edge (integrated, no background)
        const relationshipType = (link as any).relationshipType || (link as any).type || (link as any).label || '';
        if (relationshipType && globalScale > 0.9) {
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
          ctx.shadowColor = 'rgba(0,0,0,0.7)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          // Draw text with shadow only (no background box or stroke)
          ctx.fillText(labelText, 0, 0);
          
          ctx.restore();
        }
      }
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
    <div ref={containerRef} className="w-full h-full grid-pattern gradient-radial">
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
