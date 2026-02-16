/**
 * Centralized Color Scheme
 * 
 * Single source of truth for entity type colors across the application.
 * Used by: graphBuilder, treeBuilder, validation UI
 */

import { NodeType } from '@/types/graph';

/**
 * Color mapping for entity types in graph visualization
 */
export const NODE_COLORS: Record<NodeType, string> = {
  building: '#1e40af',    // blue (for IFCPROJECT, IFCSITE, IFCBUILDING)
  space: '#a78bfa',       // purple (for IFCSPACE)
  element: '#fbbf24',     // amber (for walls, doors, etc.)
  property: '#4ade80',    // green (for properties)
  relationship: '#f472b6', // pink (for relationships)
  geometry: '#9ca3af',    // gray (for geometry - not visible in graph but in tree)
  other: '#6b7280',       // dark gray (for other types)
  Mesh: '#60a5fa',        // blue (IFC5)
  Curve: '#fb923c',       // orange (IFC5)
  Points: '#c084fc',      // violet (IFC5)
  Group: '#34d399',       // emerald (IFC5)
};

/**
 * Get color for a node type with fallback
 */
export function getColorForNodeType(nodeType: NodeType | string): string {
  return NODE_COLORS[nodeType as NodeType] || '#6b7280';
}
