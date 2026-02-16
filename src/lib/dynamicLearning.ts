/**
 * Dynamic Learning Path - Model-Specific Learning System
 * Analyzes IFC model content and generates customized learning steps
 */

import { GraphNode } from '@/types/graph';

export type LearningLayerType = 'project' | 'spatial' | 'element' | 'relationship' | 'property';

export interface LearningLayer {
  id: LearningLayerType;
  name: string;
  description: string;
  color: string;
  icon: string;
  unlocked: boolean;
  exampleCompleted: boolean;
  practiceCompleted: boolean;
  entities: string[]; // Entity types found in this layer for this specific model
}

export interface LearningProgress {
  totalProgress: number; // 0-100
  currentLayer: LearningLayerType;
  layers: Record<LearningLayerType, {
    unlocked: boolean;
    exampleCompleted: boolean;
    practiceCompleted: boolean;
  }>;
}

// Layer definitions (generic structure)
export const LAYER_CONFIG: Record<LearningLayerType, Omit<LearningLayer, 'unlocked' | 'exampleCompleted' | 'practiceCompleted' | 'entities'>> = {
  project: {
    id: 'project',
    name: 'Project Layer',
    description: 'The root container that holds all building information',
    color: '#3B82F6', // blue
    icon: '🏗️',
  },
  spatial: {
    id: 'spatial',
    name: 'Spatial Layer',
    description: 'Geographic and building structure: Site → Building → Storey → Space',
    color: '#8B5CF6', // violet
    icon: '🏛️',
  },
  element: {
    id: 'element',
    name: 'Element Layer',
    description: 'Physical building components: walls, doors, windows, slabs',
    color: '#10B981', // emerald
    icon: '🧱',
  },
  relationship: {
    id: 'relationship',
    name: 'Relationship Layer',
    description: 'Connections between entities: aggregates, contains, defines',
    color: '#F59E0B', // amber
    icon: '🔗',
  },
  property: {
    id: 'property',
    name: 'Property Layer',
    description: 'Data attached to elements: property sets, quantities, materials',
    color: '#EC4899', // pink
    icon: '📋',
  },
};

// Classify entity types into layers
export function classifyEntityLayer(entityType: string): LearningLayerType {
  const type = entityType.toLowerCase();

  // Project layer
  if (type.includes('project') ||
      type.includes('site') ||
      type.includes('unitassignment') ||
      type.includes('representationcontext')) {
    return 'project';
  }

  // Spatial layer
  if (type.includes('building') && !type.includes('element') ||
      type.includes('storey') ||
      type.includes('space')) {
    return 'spatial';
  }

  // Element layer
  if (type.includes('wall') ||
      type.includes('door') ||
      type.includes('window') ||
      type.includes('slab') ||
      type.includes('beam') ||
      type.includes('column') ||
      type.includes('stair') ||
      type.includes('roof') ||
      type.includes('opening')) {
    return 'element';
  }

  // Relationship layer
  if (type.startsWith('ifcrel')) {
    return 'relationship';
  }

  // Property layer
  if (type.includes('property') ||
      type.includes('quantity') ||
      type.includes('material') ||
      type.includes('pset') ||
      type.includes('qto')) {
    return 'property';
  }

  // Default to element layer
  return 'element';
}

/**
 * Analyze model content and generate dynamic learning layers
 */
export function generateDynamicLearningPath(nodes: GraphNode[]): LearningLayer[] {
  // Group entities by layer
  const layerEntities: Record<LearningLayerType, Set<string>> = {
    project: new Set(),
    spatial: new Set(),
    element: new Set(),
    relationship: new Set(),
    property: new Set(),
  };

  // Classify each node using ifcType (the actual IFC entity type, not the generic visualization type)
  nodes.forEach((node) => {
    const entityType = node.ifcType || node.type; // Use ifcType if available, fallback to type
    const layer = classifyEntityLayer(entityType);
    layerEntities[layer].add(entityType);
  });

  // Build learning layers - ALWAYS show all 5 layers
  const layers: LearningLayer[] = [];
  const layerOrder: LearningLayerType[] = ['project', 'spatial', 'element', 'relationship', 'property'];

  layerOrder.forEach((layerId, index) => {
    const config = LAYER_CONFIG[layerId];

    layers.push({
      ...config,
      unlocked: index === 0, // Only first layer (Project) unlocked by default
      exampleCompleted: false,
      practiceCompleted: false,
      entities: Array.from(layerEntities[layerId]), // Even if empty, show the layer
    });
  });

  return layers;
}

/**
 * Get initial learning progress
 */
export function getInitialProgress(): LearningProgress {
  return {
    totalProgress: 0,
    currentLayer: 'project',
    layers: {
      project: { unlocked: true, exampleCompleted: false, practiceCompleted: false },
      spatial: { unlocked: false, exampleCompleted: false, practiceCompleted: false },
      element: { unlocked: false, exampleCompleted: false, practiceCompleted: false },
      relationship: { unlocked: false, exampleCompleted: false, practiceCompleted: false },
      property: { unlocked: false, exampleCompleted: false, practiceCompleted: false },
    },
  };
}

/**
 * Calculate total progress percentage
 */
export function calculateProgress(progress: LearningProgress): number {
  const layers = Object.values(progress.layers);
  const completedCount = layers.filter(l => l.exampleCompleted && l.practiceCompleted).length;
  return Math.round((completedCount / layers.length) * 100);
}

/**
 * Get progressive graph data filtered by learning layer
 * Shows only nodes and edges relevant to the current layer and all previous layers
 */
export function getProgressiveGraphData(
  nodes: GraphNode[],
  edges: any[],
  currentLayer: LearningLayerType
) {
  const layerOrder: LearningLayerType[] = ['project', 'spatial', 'element', 'relationship', 'property'];
  const currentLayerIndex = layerOrder.indexOf(currentLayer);

  // Define which entity types belong to each layer
  const layerEntityTypes: Record<LearningLayerType, string[]> = {
    project: ['IfcProject', 'IfcSite', 'IfcUnitAssignment', 'IfcGeometricRepresentationContext'],
    spatial: ['IfcBuilding', 'IfcBuildingStorey', 'IfcSpace', 'IfcRelAggregates'],
    element: [
      'IfcWall', 'IfcSlab', 'IfcDoor', 'IfcWindow', 'IfcBeam', 'IfcColumn',
      'IfcStair', 'IfcRoof', 'IfcOpeningElement', 'IfcRelContainedInSpatialStructure',
      'IfcRelVoidsElement', 'IfcRelFillsElement'
    ],
    relationship: ['IfcRel'],
    property: ['IfcPropertySet', 'IfcElementQuantity', 'IfcMaterial', 'IfcMaterialLayerSet', 'IfcMaterialLayer'],
  };

  // Collect all entity types up to and including current layer
  const visibleEntityTypes: Set<string> = new Set();
  for (let i = 0; i <= currentLayerIndex; i++) {
    layerEntityTypes[layerOrder[i]].forEach(type => visibleEntityTypes.add(type));
  }

  // Filter nodes: keep only nodes matching visible entity types
  const filteredNodes = nodes.filter(node => {
    const entityType = node.ifcType || node.type || '';
    return Array.from(visibleEntityTypes).some(type =>
      entityType.toLowerCase().includes(type.toLowerCase())
    );
  });

  const visibleNodeIds = new Set(filteredNodes.map(n => n.id));

  // Filter edges: keep only edges where BOTH source and target nodes are visible
  const filteredEdges = edges.filter(edge =>
    visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  );

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
  };
}
