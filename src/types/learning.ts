/**
 * Learning System Type Definitions
 * Defines the 5-layer IFC learning progression and related structures
 */

// Five conceptual layers of IFC learning
export type IFCLayer = 'project' | 'spatial' | 'element' | 'relationship' | 'property';

// Learning mode states
export type LearningMode = 'overview' | 'worked-example' | 'practice' | 'free-explore';

// Layer definition structure
export interface LayerDefinition {
  name: string;
  description: string;
  color: string;
  concepts: string[]; // Key IFC concepts in this layer
  exampleEntities: string[]; // Example IFC entity types
}

// Worked example step with graph highlighting
export interface WorkedExampleStep {
  id: string;
  title: string;
  explanation: string;
  hint: string;
  highlightEntityTypes: string[]; // Entity types to highlight in graph
  code?: {
    ifc4?: string;
    ifc5?: string;
  };
}

// Worked example structure
export interface WorkedExample {
  layer: IFCLayer;
  title: string;
  description: string;
  steps: WorkedExampleStep[];
}

// Practice exercise types
export type ExerciseType = 'predict-verify' | 'drag-connect' | 'multiple-choice';

// Practice exercise structure
export interface PracticeExercise {
  id: string;
  layer: IFCLayer;
  type: ExerciseType;
  question: string;
  hint?: string;

  // For predict-verify
  correctAnswer?: string;
  explanation?: string;

  // For drag-connect
  leftItems?: Array<{ id: string; label: string }>;
  rightItems?: Array<{ id: string; label: string }>;
  correctPairs?: Array<[string, string]>;

  // For multiple-choice
  options?: Array<{ id: string; label: string; isCorrect: boolean }>;
}

// Progress tracking for each layer
export interface LayerProgress {
  unlocked: boolean;
  workedExampleCompleted: boolean;
  practiceCompleted: boolean;
  score: number; // 0-100
}

// Overall learning progress
export interface LearningProgress {
  currentLayer: IFCLayer;
  layers: Record<IFCLayer, LayerProgress>;
  totalScore: number; // Average across all layers
}

// Layer definitions - the 5 conceptual layers of IFC
export const LAYER_DEFINITIONS: Record<IFCLayer, LayerDefinition> = {
  project: {
    name: 'Project & Context',
    description: 'The root container and contextual information for the entire model',
    color: '#8B5CF6', // violet
    concepts: ['IfcProject', 'IfcSite', 'Units', 'Coordinate Systems', 'OwnerHistory'],
    exampleEntities: ['IfcProject', 'IfcSite', 'IfcUnitAssignment', 'IfcGeometricRepresentationContext'],
  },
  spatial: {
    name: 'Spatial Hierarchy',
    description: 'The geographic and spatial breakdown: Building → Storey → Space',
    color: '#3B82F6', // blue
    concepts: ['Spatial Structure', 'Containment', 'Building Hierarchy'],
    exampleEntities: ['IfcBuilding', 'IfcBuildingStorey', 'IfcSpace', 'IfcSite'],
  },
  element: {
    name: 'Building Elements',
    description: 'Physical and logical components: walls, doors, windows, beams, etc.',
    color: '#10B981', // green
    concepts: ['Physical Elements', 'Element Types', 'Geometry', 'Materials'],
    exampleEntities: ['IfcWall', 'IfcDoor', 'IfcWindow', 'IfcBeam', 'IfcColumn', 'IfcSlab'],
  },
  relationship: {
    name: 'Relationships',
    description: 'Connections between entities: containment, aggregation, void/fill, type definitions',
    color: '#A855F7', // purple
    concepts: ['Objectified Relationships', 'Aggregation', 'Containment', 'Voids/Fills', 'Type Relations'],
    exampleEntities: [
      'IfcRelContainedInSpatialStructure',
      'IfcRelAggregates',
      'IfcRelVoidsElement',
      'IfcRelFillsElement',
      'IfcRelDefinesByType',
    ],
  },
  property: {
    name: 'Properties & Quantities',
    description: 'Metadata, property sets, quantities, and classification information',
    color: '#F59E0B', // amber
    concepts: ['Property Sets', 'Quantities', 'Materials', 'Classifications'],
    exampleEntities: ['IfcPropertySet', 'IfcProperty', 'IfcElementQuantity', 'IfcMaterial'],
  },
};

// Worked Examples - Step-by-step guided learning for each layer
export const WORKED_EXAMPLES: WorkedExample[] = [
  {
    layer: 'project',
    title: 'Understanding the IFC Project Root',
    description: 'Every IFC file starts with an IfcProject - the root container for all data',
    steps: [
      {
        id: 'project-1',
        title: 'Find the Project Entity',
        explanation:
          'IfcProject is the root of every IFC model. It holds units, coordinate systems, and references to all spatial structures.',
        hint: 'Look for "IfcProject" at the top level of the graph or tree',
        highlightEntityTypes: ['IfcProject'],
      },
      {
        id: 'project-2',
        title: 'Inspect Project Properties',
        explanation:
          'The Project contains metadata like the project name, phase, and links to units and context. Check the properties panel.',
        hint: 'Select the IfcProject node to see its attributes in the properties panel',
        highlightEntityTypes: ['IfcProject'],
      },
      {
        id: 'project-3',
        title: 'Units and Coordinate Systems',
        explanation:
          'IfcProject defines units (meters, feet) and coordinate reference systems used throughout the model.',
        hint: 'Look for IfcUnitAssignment and IfcGeometricRepresentationContext relationships',
        highlightEntityTypes: ['IfcUnitAssignment', 'IfcGeometricRepresentationContext'],
      },
    ],
  },
  {
    layer: 'spatial',
    title: 'Navigating the Spatial Hierarchy',
    description: 'Learn how buildings are organized from Site → Building → Storey → Space',
    steps: [
      {
        id: 'spatial-1',
        title: 'Find the Building',
        explanation:
          'IfcBuilding represents the entire building structure. It\'s typically a child of IfcSite and parent of IfcBuildingStorey.',
        hint: 'Look for "IfcBuilding" in the spatial structure tree',
        highlightEntityTypes: ['IfcBuilding'],
      },
      {
        id: 'spatial-2',
        title: 'Explore Building Storeys',
        explanation:
          'IfcBuildingStorey represents a floor level. Buildings can have multiple storeys (floors).',
        hint: 'Expand the Building to see IfcBuildingStorey child entities',
        highlightEntityTypes: ['IfcBuildingStorey'],
      },
      {
        id: 'spatial-3',
        title: 'Discover Spaces',
        explanation:
          'IfcSpace represents rooms or zones. Spaces are contained within storeys and define functional areas.',
        hint: 'Look for IfcSpace entities within a storey',
        highlightEntityTypes: ['IfcSpace'],
      },
      {
        id: 'spatial-4',
        title: 'Understand Containment',
        explanation:
          'Elements (walls, doors) are "contained in" spatial structures via IfcRelContainedInSpatialStructure relationships.',
        hint: 'Find containment relationships connecting elements to storeys',
        highlightEntityTypes: ['IfcRelContainedInSpatialStructure'],
      },
    ],
  },
  {
    layer: 'element',
    title: 'Understanding Building Elements',
    description: 'Physical components like walls, doors, windows, and structural elements',
    steps: [
      {
        id: 'element-1',
        title: 'Find a Wall',
        explanation: 'IfcWall represents vertical building elements. Walls are the most common building component.',
        hint: 'Look for "IfcWall" entities in the tree or graph',
        highlightEntityTypes: ['IfcWall'],
      },
      {
        id: 'element-2',
        title: 'Explore Doors and Windows',
        explanation:
          'IfcDoor and IfcWindow represent openings in walls. They typically fill IfcOpeningElement voids.',
        hint: 'Find IfcDoor or IfcWindow entities and see how they connect to walls',
        highlightEntityTypes: ['IfcDoor', 'IfcWindow'],
      },
      {
        id: 'element-3',
        title: 'Discover Element Types',
        explanation:
          'Elements often reference type definitions (IfcWallType, IfcDoorType) for shared properties.',
        hint: 'Look for IfcRelDefinesByType relationships connecting instances to types',
        highlightEntityTypes: ['IfcWallType', 'IfcDoorType', 'IfcWindowType', 'IfcRelDefinesByType'],
      },
    ],
  },
  {
    layer: 'relationship',
    title: 'Mastering IFC Relationships',
    description: 'How entities connect: containment, aggregation, voids, fills, and type definitions',
    steps: [
      {
        id: 'rel-1',
        title: 'Containment Relationships',
        explanation:
          'IfcRelContainedInSpatialStructure links elements to spatial containers (e.g., walls in a storey).',
        hint: 'Find relationships connecting walls/doors to building storeys',
        highlightEntityTypes: ['IfcRelContainedInSpatialStructure'],
      },
      {
        id: 'rel-2',
        title: 'Void and Fill Pattern',
        explanation:
          'Openings are created with IfcRelVoidsElement (cutting voids) and IfcRelFillsElement (filling with doors/windows).',
        hint: 'Look for Wall → Void → Opening → Fill → Window chain',
        highlightEntityTypes: ['IfcOpeningElement', 'IfcRelVoidsElement', 'IfcRelFillsElement'],
      },
      {
        id: 'rel-3',
        title: 'Aggregation Relationships',
        explanation:
          'IfcRelAggregates creates part-whole hierarchies (e.g., Building aggregates Storeys).',
        hint: 'Find aggregation relationships in the spatial hierarchy',
        highlightEntityTypes: ['IfcRelAggregates'],
      },
    ],
  },
  {
    layer: 'property',
    title: 'Exploring Properties and Quantities',
    description: 'Metadata, property sets, material information, and classification',
    steps: [
      {
        id: 'prop-1',
        title: 'Find Property Sets',
        explanation:
          'Property sets (Pset_) are standardized collections of properties attached to elements.',
        hint: 'Look for "Pset_WallCommon" or similar property sets in the properties panel',
        highlightEntityTypes: ['IfcPropertySet'],
      },
      {
        id: 'prop-2',
        title: 'Inspect Material Definitions',
        explanation: 'Materials define what elements are made of. Look for IfcMaterial and IfcMaterialLayer.',
        hint: 'Find material definitions attached to walls or slabs',
        highlightEntityTypes: ['IfcMaterial', 'IfcMaterialLayerSet'],
      },
      {
        id: 'prop-3',
        title: 'Quantity Take-Offs',
        explanation:
          'IfcElementQuantity provides measured quantities (area, volume, length) for cost estimation.',
        hint: 'Look for quantity sets (Qto_) attached to building elements',
        highlightEntityTypes: ['IfcElementQuantity', 'IfcQuantityArea', 'IfcQuantityVolume'],
      },
    ],
  },
];

// Practice Exercises - Interactive practice for each layer
export const PRACTICE_EXERCISES: PracticeExercise[] = [
  // Project Layer Exercises
  {
    id: 'project-ex-1',
    layer: 'project',
    type: 'multiple-choice',
    question: 'What is the root entity of every IFC file?',
    hint: 'Think about the top-level container that holds everything',
    options: [
      { id: 'a', label: 'IfcBuilding', isCorrect: false },
      { id: 'b', label: 'IfcProject', isCorrect: true },
      { id: 'c', label: 'IfcSite', isCorrect: false },
      { id: 'd', label: 'IfcWall', isCorrect: false },
    ],
  },
  {
    id: 'project-ex-2',
    layer: 'project',
    type: 'drag-connect',
    question: 'Match the project-level entities to their purposes:',
    leftItems: [
      { id: 'l1', label: 'IfcProject' },
      { id: 'l2', label: 'IfcUnitAssignment' },
      { id: 'l3', label: 'IfcSite' },
    ],
    rightItems: [
      { id: 'r1', label: 'Geographic location context' },
      { id: 'r2', label: 'Root container for all data' },
      { id: 'r3', label: 'Defines measurement units' },
    ],
    correctPairs: [
      ['l1', 'r2'],
      ['l2', 'r3'],
      ['l3', 'r1'],
    ],
  },

  // Spatial Layer Exercises
  {
    id: 'spatial-ex-1',
    layer: 'spatial',
    type: 'multiple-choice',
    question: 'What is the typical spatial hierarchy in IFC?',
    options: [
      { id: 'a', label: 'Project → Wall → Window → Door', isCorrect: false },
      { id: 'b', label: 'Site → Building → Storey → Space', isCorrect: true },
      { id: 'c', label: 'Building → Project → Storey → Site', isCorrect: false },
      { id: 'd', label: 'Storey → Space → Building → Site', isCorrect: false },
    ],
  },
  {
    id: 'spatial-ex-2',
    layer: 'spatial',
    type: 'predict-verify',
    question: 'How many IfcBuildingStorey entities would a typical 3-story building have?',
    correctAnswer: '3',
    explanation: 'Each floor level is represented by one IfcBuildingStorey entity.',
  },

  // Element Layer Exercises
  {
    id: 'element-ex-1',
    layer: 'element',
    type: 'drag-connect',
    question: 'Match IFC elements to their descriptions:',
    leftItems: [
      { id: 'l1', label: 'IfcWall' },
      { id: 'l2', label: 'IfcDoor' },
      { id: 'l3', label: 'IfcWindow' },
      { id: 'l4', label: 'IfcBeam' },
    ],
    rightItems: [
      { id: 'r1', label: 'Horizontal structural member' },
      { id: 'r2', label: 'Vertical building element' },
      { id: 'r3', label: 'Opening with glazing' },
      { id: 'r4', label: 'Opening with door panel' },
    ],
    correctPairs: [
      ['l1', 'r2'],
      ['l2', 'r4'],
      ['l3', 'r3'],
      ['l4', 'r1'],
    ],
  },

  // Relationship Layer Exercises
  {
    id: 'rel-ex-1',
    layer: 'relationship',
    type: 'multiple-choice',
    question: 'Which relationship creates a void (hole) in a wall for a window?',
    options: [
      { id: 'a', label: 'IfcRelContainedInSpatialStructure', isCorrect: false },
      { id: 'b', label: 'IfcRelAggregates', isCorrect: false },
      { id: 'c', label: 'IfcRelVoidsElement', isCorrect: true },
      { id: 'd', label: 'IfcRelDefinesByType', isCorrect: false },
    ],
  },
  {
    id: 'rel-ex-2',
    layer: 'relationship',
    type: 'drag-connect',
    question: 'Match relationship types to their purposes:',
    leftItems: [
      { id: 'l1', label: 'IfcRelContainedInSpatialStructure' },
      { id: 'l2', label: 'IfcRelVoidsElement' },
      { id: 'l3', label: 'IfcRelFillsElement' },
    ],
    rightItems: [
      { id: 'r1', label: 'Places door/window in opening' },
      { id: 'r2', label: 'Places element in spatial container' },
      { id: 'r3', label: 'Creates hole in building element' },
    ],
    correctPairs: [
      ['l1', 'r2'],
      ['l2', 'r3'],
      ['l3', 'r1'],
    ],
  },

  // Property Layer Exercises
  {
    id: 'prop-ex-1',
    layer: 'property',
    type: 'multiple-choice',
    question: 'What does "Pset_" prefix indicate in IFC?',
    options: [
      { id: 'a', label: 'Private property set', isCorrect: false },
      { id: 'b', label: 'Standard property set', isCorrect: true },
      { id: 'c', label: 'Project-specific property', isCorrect: false },
      { id: 'd', label: 'Physical property only', isCorrect: false },
    ],
  },
  {
    id: 'prop-ex-2',
    layer: 'property',
    type: 'predict-verify',
    question: 'What type of entity would contain "NetSideArea" and "GrossVolume"?',
    correctAnswer: 'IfcElementQuantity',
    explanation: 'Element quantities (Qto_) contain measured values like area, volume, and length.',
  },
];
