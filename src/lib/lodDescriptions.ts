/**
 * LoD (Level of Detail) Descriptions and Information
 * Explains what each LoD level shows
 */

import { GraphLoD, LoDLevel } from '@/lib/graphLoD';

export interface LoDDescription {
  name: string;
  shortName: string;
  description: string;
  useCase: string;
  includes: string[];
  excludes: string[];
  bestFor: string[];
  nodeReductionEstimate: string;
}

export const LOD_DESCRIPTIONS: Record<LoDLevel, LoDDescription> = {
  1: {
    name: 'LoD1: Utility Graph',
    shortName: 'Utility',
    description: 'Minimal spatial structure only. Shows only the building hierarchy: Project → Site → Building → Storey → Space.',
    useCase: 'Quick pathfinding, navigation, spatial analysis',
    includes: [
      'Spatial structure (Project, Site, Building, Storey, Space)',
    ],
    excludes: [
      'All elements (walls, doors, windows, MEP systems)',
      'Properties and property sets',
      'Type definitions',
      'Resource layer (units, colors, ports)',
      'All relationships except spatial containment',
    ],
    bestFor: [
      'Building navigation',
      'Quick overview of structure',
      'Pathfinding through spaces',
      'Large files (10,000+ entities)',
    ],
    nodeReductionEstimate: '95-99%',
  },
  2: {
    name: 'LoD2: Least Graph',
    shortName: 'Least',
    description: 'Core structural and system entities. Excludes type definitions, MEP ports, and resource layer. Focuses on actual objects, not their definitions.',
    useCase: 'System overview, building elements, MEP systems visualization',
    includes: [
      'Spatial structure (Project, Site, Building, Storey, Space)',
      'Building elements (walls, slabs, columns, doors, windows, etc.)',
      'MEP systems (HVAC, electrical, plumbing)',
      'Systems and zones',
      'Relationships between elements',
    ],
    excludes: [
      'Type definitions (IfcWallType, IfcDoorType, etc.)',
      'Distribution ports (too granular)',
      'Property sets',
      'Resource layer (units, colors, measurements)',
      'Geometry shapes',
    ],
    bestFor: [
      'Building systems overview',
      'Element-level visualization',
      'MEP system analysis',
      'Medium-large files (5,000-10,000 entities)',
    ],
    nodeReductionEstimate: '60-80%',
  },
  3: {
    name: 'LoD3: Essential Graph',
    shortName: 'Essential',
    description: 'All actual objects plus essential relationships. Includes property sets and system relationships while being more compact than full graph.',
    useCase: 'Comprehensive analysis, property visualization, relationship analysis',
    includes: [
      'Spatial structure and all building elements',
      'MEP systems, zones, and equipment',
      'Property sets and quantities',
      'All IFCREL* relationships (containment, connects, assigns)',
      'System assignments and grouping',
    ],
    excludes: [
      'Type definitions (IfcWallType, IfcDoorType, etc.)',
      'Distribution ports (IfcDistributionPort)',
      'Resource layer (units, colors, points)',
      'Geometry representations',
    ],
    bestFor: [
      'Detailed building analysis',
      'Property-based queries',
      'Relationship analysis',
      'Medium files (1,000-5,000 entities)',
    ],
    nodeReductionEstimate: '30-50%',
  },
  4: {
    name: 'LoD4: Core Graph',
    shortName: 'Core',
    description: 'Complete semantic graph without geometry. Includes all entities, properties, and relationships. Best for detailed analysis and comprehensive visualization.',
    useCase: 'Detailed analysis, complete data exploration, property management',
    includes: [
      'All IFC entities (spatial, elements, systems, properties)',
      'Type definitions',
      'All relationships and assignments',
      'Property sets and quantities',
      'Resource layer (units, materials, etc.)',
    ],
    excludes: [
      'Geometry shapes and representations (meshes, faces)',
      'Topology/geometry primitives',
    ],
    bestFor: [
      'Comprehensive building information',
      'BIM authoring and management',
      'Complete data analysis',
      'Smaller-medium files (500-5,000 entities)',
    ],
    nodeReductionEstimate: '5-15%',
  },
  5: {
    name: 'LoD5: Full Detail',
    shortName: 'Full',
    description: 'Complete graph including all geometry, shapes, and representations. Maximum detail but can be large and slow.',
    useCase: 'Complete data export, detailed visualization, research',
    includes: [
      'All entities from LoD4',
      'All geometry representations',
      'Topology primitives (vertices, edges, faces)',
      'Coordinate systems and mappings',
      'Visual styles and appearances',
    ],
    excludes: [
      'Nothing - includes everything',
    ],
    bestFor: [
      'Complete data analysis',
      '3D visualization with geometry',
      'Data export and archival',
      'Research and benchmarking',
      'Small files (<500 entities)',
    ],
    nodeReductionEstimate: '0%',
  },
};

/**
 * Get LoD description
 */
export function getLoDDescription(lod: LoDLevel): LoDDescription {
  return LOD_DESCRIPTIONS[lod];
}

/**
 * Get LoD comparison
 */
export function compareLoDLevels(lod1: LoDLevel, lod2: LoDLevel): {
  lod1: LoDDescription;
  lod2: LoDDescription;
  differences: string[];
} {
  const desc1 = LOD_DESCRIPTIONS[lod1];
  const desc2 = LOD_DESCRIPTIONS[lod2];
  
  const differences: string[] = [];
  
  if (desc1.includes.length !== desc2.includes.length) {
    differences.push(
      `${desc2.name} includes ${desc2.includes.length} types vs ${desc1.includes.length} in ${desc1.name}`
    );
  }
  
  // Find what's added/removed
  const added = desc2.includes.filter(i => !desc1.includes.includes(i));
  const removed = desc1.includes.filter(i => !desc2.includes.includes(i));
  
  if (added.length > 0) {
    differences.push(`${desc2.name} adds: ${added.join(', ')}`);
  }
  if (removed.length > 0) {
    differences.push(`${desc2.name} removes: ${removed.join(', ')}`);
  }
  
  return { lod1: desc1, lod2: desc2, differences };
}
