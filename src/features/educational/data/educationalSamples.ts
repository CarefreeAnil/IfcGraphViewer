/**
 * Educational sample IFC file interface
 * Defines structure for sample files used in learning module
 */

import { Type } from "lucide-react";

export interface EducationalSample {
  id: string;
  name: string;
  description: string;
  path: string;
  fileSize: number; // in bytes
  entityCount: number;
  learningObjectives: string[];
  concepts: string[]; // IFC concepts demonstrated (e.g., 'IfcWall', 'IfcSpace', 'Relationships')
  estimatedLoadTime: number; // in milliseconds
  thumbnail?: string; // Optional thumbnail image path
  hasGuidedLearning?: boolean; // Indicates if dynamic guided learning is available
}

/**
 * Sample catalog - configure samples by adding entries here
 * Place your sample IFC files in: public/samples/educational/
 */
export const EDUCATIONAL_SAMPLES: EducationalSample[] = [
  // Beginner Level: Fundamental IFC Concepts
  {
    id: 'simple-wall-opening-window',
    name: 'Wall with Opening and Window',
    description: 'Minimal 352-line file demonstrating core IFC concepts. Perfect starting point for learning spatial hierarchy, basic building elements, and element relationships.',
    path: '/testFiles/wall-with-opening-and-window.ifc',
    fileSize: 12500,
    entityCount: 71,
    learningObjectives: [
      'Navigate the IFC spatial hierarchy: Project → Site → Building → Storey',
      'Understand basic containment using IfcRelContainedInSpatialStructure',
      'Learn void/fill relationships with IfcRelVoidsElement and IfcRelFillsElement',
      'Inspect wall properties via property sets (Pset_WallCommon)',
      'Analyze material composition and layer definitions',
    ],
    concepts: [
      'Spatial Hierarchy',
      'IfcWall',
      'IfcWindow',
      'IfcOpeningElement',
      'Void/Fill Relationships',
    ],
    estimatedLoadTime: 55,
    hasGuidedLearning: true,
    thumbnail: '/testFiles/thumbnails/simple-wall-opening-window.png',
    },

  // Beginner Level: IFC5 Introduction
  {
    id: 'hello-wall-ifc5',
    name: 'Hello Wall (IFC5)',
    description: 'Modern IFC5 JSON format example showing a wall with windows and spaces. Demonstrates the new composition model and how IFC5 differs from STEP-based IFC4.',
    path: '/testFiles/hello-wall.ifcx',
    fileSize: 42931,
    entityCount: 30,
    learningObjectives: [
      'Understand IFC5 JSON format vs. traditional STEP format',
      'Explore the IFC5 composition model with path-based references',
      'Identify UUID identifiers and child-parent inheritance patterns',
      'Analyze space boundaries and spatial relationships',
      'Compare property organization between IFC versions',
    ],
    concepts: [
      'JSON Format',
      'UUID Identifiers',
      'Path-based References',
    ],
    estimatedLoadTime: 24,
    thumbnail: '/testFiles/thumbnails/hello-wall-ifc5.png',
  },

  // More beginner samples can be added here
  // {
  //   id: 'simple-room',
  //   name: 'Simple Room',
  //   description: 'Basic room with walls, floor, and ceiling - perfect for understanding spaces and boundaries',
  //   path: '/samples/educational/simple-room.ifc',
  //   fileSize: 20480, // 20 KB
  //   entityCount: 60,
  //   learningObjectives: [
  //     'Understand IfcSpace and spatial boundaries',
  //     'Learn about building element relationships',
  //     'Explore property sets for spaces',
  //     'Identify floor, wall, and ceiling connections',
  //   ],
  //   concepts: ['IfcSpace', 'IfcWall', 'IfcSlab', 'IfcRelSpaceBoundary'],
  //   estimatedLoadTime: 600,
  // },

  // Intermediate Level: Complex Relationships and Properties
  {
    id: 'solibri-structural',
    name: 'Solibri Building Structural',
    description: 'Complex 2,486-line structural model with beams, columns, slabs. Demonstrates type definitions, material properties, and quantity takeoff information.',
    path: '/testFiles/Solibri Building Structural.ifc',
    fileSize: 143200,
    entityCount: 772,
    learningObjectives: [
      'Understand type definitions and instance relationships via IfcRelDefinesByType',
      'Navigate structural element hierarchies (columns, beams, slabs)',
      'Analyze material layer composition and structural properties',
      'Explore quantity information using IfcElementQuantity',
      'Study geometric representations and coordinate systems',
    ],
    concepts: [
      'IfcColumn',
      'IfcSlab',
      'IfcRelDefinesByType',
      'IfcMaterialLayerSet',
      'IfcElementQuantity',
    ],
    estimatedLoadTime: 75,
  },

  // Intermediate Level: Complex Relationships and Properties (templates below)
  // {
  //   id: 'multi-storey-building',
  //   name: 'Multi-Storey Building',
  //   description: 'Explore a building with multiple floors, stairs, and vertical circulation elements',
  //   difficulty: 'intermediate',
  //   path: '/samples/educational/multi-storey.ifc',
  //   fileSize: 102400, // 100 KB
  //   entityCount: 250,
  //   learningObjectives: [
  //     'Navigate complex spatial hierarchies with multiple storeys',
  //     'Understand vertical circulation elements (stairs, elevators)',
  //     'Explore aggregation relationships (IfcRelAggregates)',
  //     'Learn about element type definitions (IfcTypeObject)',
  //     'Inspect material layer sets and composites',
  //   ],
  //   concepts: [
  //     'IfcBuildingStorey',
  //     'IfcStair',
  //     'IfcRelAggregates',
  //     'IfcTypeObject',
  //     'IfcMaterialLayerSet',
  //   ],
  //   estimatedLoadTime: 1500,
  // },

  // Advanced Level: Full Building Models
  {
    id: 'fzk-haus',
    name: 'FZK Haus - Complete Building',
    description: 'Large-scale (44K+ lines) residential building with complete architectural, structural, and MEP systems. Includes advanced properties, quantities, and extensive geometric data.',
    path: '/testFiles/FZK Haus.ifc',
    fileSize: 2500000, // 2.5 MB
    entityCount: 9504,
    learningObjectives: [
      'Analyze complex multi-disciplinary building models with 2800+ entities',
      'Navigate multi-storey spatial hierarchies with diverse element types',
      'Understand derived units and custom property definitions (thermal units)',
      'Explore comprehensive quantity takeoff and geometric information',
      'Study boundary representations and faceted geometry at scale',
      'Work with real-world model complexity and performance optimization',
    ],
    concepts: [
      'Multi-storey Buildings',
      'Quantity Takeoff View',
      'Space Boundaries',
      'Derived Units',
      'Faceted Geometry',
      'Material Definitions',
      'Envelope Boundaries',
      'BIM Coordination',
      'Large-scale Performance',
    ],
    estimatedLoadTime: 297,
  },

  {
    id: 'infra-bridge',
    name: 'Infrastructure Bridge',
    description: 'Infrastructure domain example (892 lines) with bridge structure using IfcBridge instead of IfcBuilding. Shows geographic CRS, alignment-based modeling, and civil engineering perspective.',
    path: '/testFiles/Infra-Bridge.ifc',
    fileSize: 1883289,
    entityCount: 221,
    learningObjectives: [
      'Understand IFC application beyond buildings (infrastructure domain)',
      'Explore IfcBridge and IfcBridgePart entities for bridge structure modeling',
      'Learn geographic information systems (CRS/EPSG coordinates)',
      'Analyze triangulated mesh geometry for infrastructure elements',
      'Study type definitions for beam and slab in infrastructure context',
      'Compare infrastructure vs. building domain IFC usage',
    ],
    concepts: [
      'IfcBridge',
      'IfcBridgePart',
      'Infrastructure Domain',
      'Geographic CRS (EPSG)',
      'IfcBeam',
      'IfcSlab',
    ],
    estimatedLoadTime: 89,
  },

  // Advanced Level: Full Building Models (templates below)
  // {
  //   id: 'complete-building-model',
  //   name: 'Complete Building Model',
  //   description: 'Comprehensive BIM model with structural, architectural, and MEP elements',
  //   difficulty: 'advanced',
  //   path: '/samples/educational/complete-building.ifc',
  //   fileSize: 512000, // 500 KB
  //   entityCount: 1200,
  //   learningObjectives: [
  //     'Analyze complex multi-discipline models',
  //     'Understand coordination between architectural, structural, and MEP systems',
  //     'Explore advanced property sets (Pset_WallCommon, Pset_DoorCommon)',
  //     'Learn about quantity take-off information (IfcElementQuantity)',
  //     'Validate model compliance with IFC schema',
  //     'Study performance characteristics of large models',
  //   ],
  //   concepts: [
  //     'IfcBeam',
  //     'IfcColumn',
  //     'IfcRoof',
  //     'IfcFlowSegment',
  //     'IfcDistributionElement',
  //     'IfcElementQuantity',
  //     'IfcRelConnectsElements',
  //     'IfcSystem',
  //   ],
  //   estimatedLoadTime: 3000,
  // },
];

/**
 * Get samples filtered by difficulty
 */

/**
 * Get sample by ID
 */
export function getSampleById(id: string): EducationalSample | undefined {
  return EDUCATIONAL_SAMPLES.find(sample => sample.id === id);
}
