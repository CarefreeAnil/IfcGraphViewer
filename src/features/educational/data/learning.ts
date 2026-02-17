/**
 * IFC Learning Content - Comprehensive 5-Layer System
 * Contains all text, steps, and exercise data for guided learning path
 *
 * Structure:
 * - LAYER_DEFINITIONS: Metadata for each of the 5 layers
 * - WORKED_EXAMPLES: Step-by-step guided walkthroughs
 * - PRACTICE_EXERCISES: Interactive exercises for skill building
 */

import { LearningLayerType } from '@/lib/dynamicLearning';

/**
 * LAYER 1-5 DEFINITIONS
 * Name, description, color, and primary entities for each layer
 */
export interface LayerDefinition {
  id: LearningLayerType;
  name: string;
  description: string;
  color: string;
  icon: string;
  longDescription: string;
  keyEntities: string[];
  architecture: string; // Which IFC schema layer
}

export const LAYER_DEFINITIONS: LayerDefinition[] = [
  {
    id: 'project',
    name: 'Project Layer',
    description: 'The root container that holds all building information',
    color: '#3B82F6', // blue
    icon: '🏗️',
    longDescription:
      'The Project layer represents the top-level container in every IFC model. It defines the project context, units, coordinate systems, and references to all spatial structures (Site→Building→Storey→Space). This is the entry point for understanding any BIM model.',
    keyEntities: ['IfcProject', 'IfcSite', 'IfcUnitAssignment', 'IfcRepresentationContext'],
    architecture: 'Core Layer / Entity Schemas',
  },

  {
    id: 'spatial',
    name: 'Spatial Structure Layer',
    description: 'Geographic and building structure: Site → Building → Storey → Space',
    color: '#8B5CF6', // violet
    icon: '🏛️',
    longDescription:
      'The Spatial Structure layer defines the geometric and organizational hierarchy of the building. It progresses from Site (geographic context) → Building (main structure) → BuildingStory (floor levels) → Space (rooms/zones). This layer answers "What is the building made of structurally?"',
    keyEntities: ['IfcBuilding', 'IfcBuildingStorey', 'IfcSpace', 'IfcSite'],
    architecture: 'Product Extension / Building',
  },

  {
    id: 'element',
    name: 'Element Layer',
    description: 'Physical building components: walls, doors, windows, slabs',
    color: '#10B981', // emerald
    icon: '🧱',
    longDescription:
      'The Element layer represents physical building components that occupy space and have measurable properties. This includes structural elements (walls, slabs, beams, columns), architectural elements (doors, windows), and filling elements. These are the "what" - the tangible parts of the building.',
    keyEntities: [
      'IfcWall',
      'IfcWindow',
      'IfcDoor',
      'IfcSlab',
      'IfcBeam',
      'IfcColumn',
      'IfcStair',
      'IfcOpeningElement',
    ],
    architecture: 'Product Extension / Building Elements',
  },

  {
    id: 'relationship',
    name: 'Relationship Layer',
    description: 'Connections between entities: aggregates, contains, defines',
    color: '#F59E0B', // amber
    icon: '🔗',
    longDescription:
      'The Relationship layer describes how entities connect to each other. This includes spatial containment (which storey contains which walls), element voids (where windows/doors fill openings), type definitions (linking instances to types), and property associations. These connections give structure meaning.',
    keyEntities: [
      'IfcRelContainedInSpatialStructure',
      'IfcRelAggregates',
      'IfcRelVoidsElement',
      'IfcRelFillsElement',
      'IfcRelDefinesByType',
      'IfcRelDefinesByProperties',
    ],
    architecture: 'Core Layer / Relationships',
  },

  {
    id: 'property',
    name: 'Property Layer',
    description: 'Data attached to elements: property sets, quantities, materials',
    color: '#EC4899', // pink
    icon: '📋',
    longDescription:
      'The Property layer contains non-geometric information attached to entities - materials, dimensions, finishes, performance ratings, cost data. This includes property sets (Pset_WallCommon), quantity information (Qto_), and material layer compositions. These are the "how" - details about what the element is made of and how it performs.',
    keyEntities: [
      'IfcPropertySet',
      'IfcElementQuantity',
      'IfcMaterial',
      'IfcMaterialLayer',
      'IfcMaterialLayerSet',
      'IfcProperty',
    ],
    architecture: 'Kernel / Property Set Schema',
  },
];

/**
 * WORKED EXAMPLES
 * Step-by-step guided walkthroughs with instructions, explanations, code snippets
 */
export interface WorkedExampleStep {
  title: string;
  explanation: string;
  action: string; // What the user should do
  lookFor: string; // What to look for in the UI
  hint: string;
  ifcCode?: {
    ifc4?: string;
    ifc5?: string;
  };
  verifyQuestion?: string; // Question to check understanding
}

export interface WorkedExample {
  id: LearningLayerType;
  title: string;
  objective: string;
  steps: WorkedExampleStep[];
}

export const WORKED_EXAMPLES: WorkedExample[] = [
  {
    id: 'project',
    title: 'Understanding the Project Root',
    objective:
      'Learn how every IFC model starts with IfcProject - in this case "Default Project" - and how it sets up units and contexts',
    steps: [
      {
        title: 'Find the Project Entity',
        explanation:
          'IfcProject is the absolute root of every IFC model. In our guided sample, there\'s one project named "Default Project" with description "Description of Default Project". It holds all metadata: name, description, coordinate systems, and units. There is always exactly one IfcProject per file.',
        action: 'Click on "Default Project" at the top of the tree on the right to select it',
        lookFor: 'Name field shows "Default Project"',
        hint: '',
        ifcCode: {
          ifc4: '#1 = IFCPROJECT(\'28hypXUBvBefc20SI8kfA$\', #2, \'Default Project\', \'Description of Default Project\', $, $, $, (#20), #7);',
          ifc5: '{\n  "type": "IfcProject",\n  "Name": "Default Project",\n  "Description": "Description of Default Project"\n}',
        },
      },
      {
        title: 'Explore Project Properties',
        explanation:
          'When you select "Default Project", the properties panel shows metadata: Name, Description, UnitsInContext (units for measurement), and HasContext (coordinate system reference).',
        action: 'Click on "Default Project" in the tree and look at the properties panel on the left',
        lookFor:
          'Properties including: Name="Default Project", Description="Description of Default Project", UnitsInContext, HasContext',
        hint: '',
      },
      {
        title: 'Understand Project Context',
        explanation:
          'HasContext links to IfcGeometricRepresentationContext, which establishes that this model uses 3D Euclidean coordinates in model space. Every spatial element and building component references this context for positioning.',
        action:
          'In the properties panel, expand the HasContext property to see the geometric representation context',
        lookFor:
          'An IfcGeometricRepresentationContext showing CoordinateSpaceDimension=3 and ContextType="Model"',
        hint: '',
      },
    ],
  },

  {
    id: 'spatial',
    title: 'Building Spatial Hierarchy',
    objective: 'Master how buildings are organized from Site down to individual Spaces',
    steps: [
      {
        title: 'Navigate Site → Building → Storey',
        explanation:
          'The spatial hierarchy is like nested Russian dolls: Site ("Default Site") contains the geographic location → Building ("Default Building") contains the main structure → BuildingStorey ("Default Building Storey" at elevation 0.0m) represents floor levels. Each level is connected via IfcRelAggregates relationships.',
        action:
          'Expand "Default Site" in the tree, then expand "Default Building", then look for "Default Building Storey"',
        lookFor:
          'A tree structure showing: Default Site > Default Building > Default Building Storey (with elevation 0.0)',
        hint: '',
        ifcCode: {
          ifc4: '#38 = IFCBUILDINGSTOREY(\'2GNgSHJ5j9BRUjqT$7tE8w\', #2, \'Default Building Storey\', \'Description of Default Building Storey\', $, #39, $, $, .ELEMENT., 0.);',
        },
      },
      {
        title: 'Understand Containment Relationships',
        explanation:
          'IfcRelContainedInSpatialStructure is the relationship that links building elements to their parent spatial structure. For example, "Wall for Test Example" is "contained in" "Default Building Storey". This defines which elements belong to which spatial zones.',
        action:
          'Click on "Wall for Test Example" in the tree, then look in the properties for containment relationships',
        lookFor:
          'A relationship property showing "Wall for Test Example" belongs to "Default Building Storey"',
        hint:
          '',
      },
      {
        title: 'Understand Aggregation Relationships',
        explanation:
          'IfcRelAggregates connects the hierarchy: "Default Site" aggregates "Default Building", and "Default Building" aggregates "Default Building Storey". These relationships define the composition of the spatial structure.',
        action:
          'In the properties panel, look for aggregation relationships showing how Site contains Building, and Building contains Storey',
        lookFor:
          'Aggregation relationships showing the part-whole structure of the spatial hierarchy',
        hint: '',
      },
    ],
  },

  {
    id: 'element',
    title: 'Building Elements - Walls, Windows, Doors',
    objective:
      'Learn how physical building components are defined and how windows/doors relate to walls',
    steps: [
      {
        title: 'Find Building Elements',
        explanation:
          'Building elements are the physical components: walls (vertical), slabs (horizontal), beams, columns, roofs, windows, doors, etc. In the guided sample, we have "Wall for Test Example" and "Window for Test Example" contained in "Default Building Storey".',
        action:
          'Expand "Default Building Storey" in the tree and look for "Wall for Test Example"',
        lookFor:
          'Element entities like "Wall for Test Example" nested under "Default Building Storey"',
        hint: '',
        ifcCode: {
          ifc4: '#45 = IFCWALL(\'3ZYW59sxj8lei475l7EhLU\', #2, \'Wall for Test Example\', \'Description of Wall\', $, #46, #48, $, $);',
        },
      },
      {
        title: 'Explore Wall and Window Relationship',
        explanation:
          'The "Wall for Test Example" has an opening (void) created by IfcRelVoidsElement. The "Opening Element for Test Example" is created in that void. The "Window for Test Example" fills that opening via IfcRelFillsElement. This creates a chain: Wall → Opening → Window.',
        action:
          'Click on "Wall for Test Example" and see the relationships that show its opening',
        lookFor:
          'Relationships showing the void/fill chain: Wall voids Opening, Opening filled by Window',
        hint: '',
      },
      {
        title: 'Understand Element Containment',
        explanation:
          'All elements ("Wall for Test Example", "Window for Test Example") are contained in "Default Building Storey" via IfcRelContainedInSpatialStructure. This tells you which storey these elements belong to. Without this relationship, an element exists but isn\'t positioned spatially.',
        action: 'Select an element and look for the property showing it\'s "contained in" "Default Building Storey"',
        lookFor: 'Containment relationships showing which storey owns these elements',
        hint: '',
      },
    ],
  },

  {
    id: 'relationship',
    title: 'Relationships - How Elements Connect',
    objective:
      'Understand how IFC uses relationships to define voids, fills, types, and properties',
    steps: [
      {
        title: 'Understand Void/Fill Relationships',
        explanation:
          'In the guided sample: "Wall for Test Example" has an opening created by IfcRelVoidsElement. The "Opening Element for Test Example" is the void. The "Window for Test Example" fills that void via IfcRelFillsElement. This 3-entity chain (Wall → Opening → Window) allows flexibility - an opening can be empty or filled with different elements.',
        action:
          'Click on "Wall for Test Example", then look for relationships showing its void/opening',
        lookFor:
          'Relationships labeled "VoidsElement" from wall to opening, then "FillsElement" from window to opening',
        hint:
          '',
        ifcCode: {
          ifc4: '#41 = IFCRELAGGREGATES(\'1Lm3qeFdPFmvCQm$QtrkO_\', #2, \'BuildingContainer\', \'BuildingContainer for BuildigStories\', #34, (#38));',
          ifc5: '{\n  "RelVoidsElement": {\n    "RelatingBuildingElement": "Wall#1",\n    "RelatedOpeningElement": "Opening#2"\n  }\n}',
        },
      },
      {
        title: 'Understand Spatial Containment',
        explanation:
          'IfcRelContainedInSpatialStructure links all elements to their containing spatial structure. Both "Wall for Test Example" and "Window for Test Example" are contained in "Default Building Storey". This relationship establishes which spatial zone (storey, building, space) owns each element.',
        action:
          'Select any element and look for the property showing it\'s contained in "Default Building Storey"',
        lookFor:
          'Containment relationships showing which spatial structure (storey/building) owns the element',
        hint: '',
      },
      {
        title: 'Property and Material Relationships',
        explanation:
          '"Wall for Test Example" has properties attached via IfcRelDefinesByProperties, including Pset_WallCommon with properties like IsExternal, FireRating, and AcousticRating. These properties add semantic information about the wall\'s characteristics.',
        action:
          'Select "Wall for Test Example" and look for property set relationships in the properties panel',
        lookFor:
          'Property relationships showing Pset_WallCommon and other property sets with values like IsExternal=true, FireRating',
        hint:
          '',
      },
    ],
  },

  {
    id: 'property',
    title: 'Properties - Material, Quantity, Performance Data',
    objective:
      'Learn how IFC stores material composition, dimensional data, and performance properties',
    steps: [
      {
        title: 'Explore Property Sets on Elements',
        explanation:
          '"Wall for Test Example" has Pset_WallCommon containing standard wall properties: IsExternal (true/false - is this an external wall?), FireRating (fire safety rating), AcousticRating (sound transmission properties), and Combustible (fire behavior). These properties follow IFC/ISI standards.',
        action: 'Select "Wall for Test Example" and look in the properties panel for "Pset_WallCommon"',
        lookFor:
          'A property set named Pset_WallCommon with properties: IsExternal, FireRating, AcousticRating, Combustible',
        hint: '',
        ifcCode: {
          ifc4: '#49 = IFCPROPERTYSET(\'3nMqHLyZHAegWs5Yyxh1ry\', #2, \'Pset_WallCommon\', $, (#50, #51, #52, #53, #54, #55, #56, #57, #58, #59));',
        },
      },
      {
        title: 'Understand Material Composition',
        explanation:
          '"Window for Test Example" has materials defined via IfcMaterialLayerSet or direct material references (Glass for transparency, Wood for frame structure). Each material specifies what the element or its layer is made of. This is how IFC captures the composition of complex elements.',
        action:
          'Select "Window for Test Example" and look for material information in the properties panel',
        lookFor:
          'Material references or layer sets showing materials like Glass and Wood with their properties',
        hint: '',
      },
      {
        title: 'Work with Quantity Information',
        explanation:
          'Elements often have IfcElementQuantity (Qto_*) sets containing measured quantities. For example, Qto_WindowBaseQuantities might show Area, FrameArea; Qto_WallBaseQuantities would show Height, Length, Area. These are used for cost estimation, material takeoff, and validation.',
        action: 'Look for quantity sets (Qto_*) in element properties and examine the quantity values',
        lookFor:
          'Quantity sets like Qto_WindowBaseQuantities or Qto_WallBaseQuantities showing Area, Length, Height, Volume',
        hint:
          '',
      },
    ],
  },
];

/**
 * PRACTICE EXERCISES
 * Interactive exercises for each layer - predict, arrange, match, identify
 */
export interface PracticeExercise {
  id: string;
  type: 'predict' | 'arrange' | 'match' | 'identify';
  title: string;
  description: string;
  question: string;
  options?: string[] | Record<string, string[]>;
  answer: string | string[];
  explanation: string;
  ifcCode?: {
    ifc4: string;
    ifc5: string;
  };
}

export const PRACTICE_EXERCISES: PracticeExercise[] = [
  // Project Layer Exercises
  {
    id: 'project-1',
    type: 'predict',
    title: 'How Many Projects?',
    description: 'Test your understanding of project structure',
    question: 'How many IfcProject entities should a valid IFC file contain?',
    options: ['0 (not required)', '1 (exactly one)', '2 or more (flexible)', 'Any number'],
    answer: '1 (exactly one)',
    explanation:
      'IFC requires exactly one IfcProject per file. It\'s the root entity that contains references to all Site, Building, and other top-level entities. Multiple projects would violate the IFC schema.',
  },

  {
    id: 'project-2',
    type: 'identify',
    title: 'Identify Project Metadata',
    description: 'Identify what information is stored at the project level',
    question:
      'Which of the following is typically stored in the IfcProject entity? (Multiple answers)',
    options: [
      'Project Name and Description',
      'Units and Coordinate System (via UnitsInContext and HasContext)',
      'Individual wall dimensions',
      'Specific room door schedules',
    ],
    answer: ['Project Name and Description', 'Units and Coordinate System (via UnitsInContext and HasContext)'],
    explanation:
      'IfcProject stores project-level metadata like name, description, units, and coordinate systems. It does NOT store entity-specific details like individual wall dimensions - those are in the elements themselves.',
  },

  // Spatial Layer Exercises
  {
    id: 'spatial-1',
    type: 'arrange',
    title: 'Hierarchy Order',
    description: 'Arrange the spatial hierarchy in correct order',
    question: 'Arrange these in the correct hierarchical order (top to bottom):',
    options: ['IfcSpace', 'IfcProject', 'IfcBuilding', 'IfcBuildingStorey', 'IfcSite'],
    answer: ['IfcProject', 'IfcSite', 'IfcBuilding', 'IfcBuildingStorey', 'IfcSpace'],
    explanation:
      'The correct hierarchy is Project → Site → Building → BuildingStorey → Space. Each level is nested within the level above it. Project is the root, Space is the most specific.',
    ifcCode: {
      ifc4: 'IfcProject("Default Project")\n  ├─ IfcSite("Default Site")\n     └─ IfcBuilding("Default Building")\n        └─ IfcBuildingStorey("Default Building Storey", Elevation=0.0)\n           └─ IfcSpace("Room 101")',
      ifc5: '{\n  "Project": {\n    "Name": "Default Project",\n    "HasContext": [...],\n    "IsDecomposedBy": [\n      {\n        "Site": {\n          "Name": "Default Site",\n          "IsDecomposedBy": [\n            {\n              "Building": {\n                "Name": "Default Building",\n                "IsDecomposedBy": [\n                  {\n                    "BuildingStorey": {\n                      "Name": "Default Building Storey",\n                      "Elevation": 0.0,\n                      "ContainsElements": [...]\n                    }\n                  }\n                ]\n              }\n            }\n          ]\n        }\n      }\n    ]\n  }\n}',
    },
  },

  {
    id: 'spatial-2',
    type: 'predict',
    title: 'Building Floor Elevation',
    description: 'Understand floor levels',
    question: 'What does the Elevation property of IfcBuildingStorey represent?',
    options: [
      'The decorative finishes on that floor',
      'The height above ground (0m for ground floor, 3.5m for next floor, etc.)',
      'The number of windows on that floor',
      'The insulation level of the floor',
    ],
    answer: 'The height above ground (0m for ground floor, 3.5m for next floor, etc.)',
    explanation:
      'Elevation is the absolute Z-coordinate height of the storey. Ground floor is 0.0m, first floor might be 3.5m, second floor 7.0m, etc. This is crucial for geometric positioning.',
    ifcCode: {
      ifc4: '// Multiple storeys with different elevations\nIfcBuildingStorey("Ground Floor", Elevation=0.0)\nIfcBuildingStorey("First Floor", Elevation=3.5)\nIfcBuildingStorey("Second Floor", Elevation=7.0)\nIfcBuildingStorey("Roof Level", Elevation=10.5)',
      ifc5: '{\n  "Storeys": [\n    {"Name": "Ground Floor", "Elevation": 0.0},\n    {"Name": "First Floor", "Elevation": 3.5},\n    {"Name": "Second Floor", "Elevation": 7.0},\n    {"Name": "Roof Level", "Elevation": 10.5}\n  ]\n}',
    },
  },

  // Element Layer Exercises
  {
    id: 'element-1',
    type: 'predict',
    title: 'Element Functions',
    description: 'Understand element types and purposes',
    question: 'What is the primary function of an IfcWall?',
    options: [
      'Vertical enclosure and partition',
      'Horizontal structural support',
      'Light-transmitting opening',
      'Vertical structural support only',
    ],
    answer: 'Vertical enclosure and partition',
    explanation:
      'IfcWall represents vertical building elements used for enclosure and partitioning. Each element type in IFC is designed for a specific structural or functional purpose. Walls serve as both enclosures and partitions.',
    ifcCode: {
      ifc4: 'IfcWall("Wall for Test Example",\n  Description="External brick wall",\n  Representation=IfcProductDefinitionShape([...]),\n  ContainedInStructure=IfcRelContainedInSpatialStructure(\n    RelatingStructure=Default Building Storey\n  )\n)',
      ifc5: '{\n  "type": "IfcWall",\n  "Name": "Wall for Test Example",\n  "Description": "External brick wall",\n  "ObjectPlacement": {...},\n  "Representation": {...},\n  "ContainedIn": "Default Building Storey"\n}',
    },
  },

  {
    id: 'element-2',
    type: 'predict',
    title: 'Element vs Type',
    description: 'Understand the difference between instances and types',
    question:
      'A building has 20 identical brick walls. How many IfcWall entities and how many IfcWallType entities would you expect?',
    options: [
      '20 walls, 20 types',
      '20 walls, 1 type',
      '1 wall, 1 type',
      '1 wall, 20 types',
    ],
    answer: '20 walls, 1 type',
    explanation:
      'Each physical wall is an IfcWall instance, so 20 walls need 20 instances. But they all use the same IfcWallType (the specification). This is efficient - change the type once, all instances inherit the change.',
    ifcCode: {
      ifc4: '// Type Definition (defined once, shared)\nIfcWallType("Standard Brick Wall",\n  MaterialList=IfcMaterialLayerSet([...])\n)\n\n// Multiple Instances (each physical wall)\nIfcWall("Wall for Test Example #1", Type=Standard Brick Wall)\nIfcWall("Wall for Test Example #2", Type=Standard Brick Wall)\nIfcWall("Wall for Test Example #3", Type=Standard Brick Wall)',
      ifc5: '{\n  "WallType": {\n    "Name": "Standard Brick Wall",\n    "Material": {...}\n  },\n  "Instances": [\n    {"type": "IfcWall", "Name": "Wall for Test Example #1", "HasType": "Standard Brick Wall"},\n    {"type": "IfcWall", "Name": "Wall for Test Example #2", "HasType": "Standard Brick Wall"},\n    {"type": "IfcWall", "Name": "Wall for Test Example #3", "HasType": "Standard Brick Wall"}\n  ]\n}',
    },
  },

  // Relationship Layer Exercises
  {
    id: 'relationship-1',
    type: 'predict',
    title: 'Void and Fill Chain',
    description: 'Understand how openings work',
    question:
      'In IFC, how does a window relate to a wall? (Hint: requires intermediate entity)',
    options: [
      'Window is directly attached to Wall via IfcRelFillsElement',
      'Window → Opening → Wall via IfcRelVoidsElement and IfcRelFillsElement',
      'Window and Wall are directly connected via IfcRelConnects',
      'Window has no mathematical relationship to Wall in IFC',
    ],
    answer: 'Window → Opening → Wall via IfcRelVoidsElement and IfcRelFillsElement',
    explanation:
      'IFC uses a 3-entity chain: Wall (IfcRelVoidsElement) creates Opening, Opening is (IfcRelFillsElement) filled by Window. This allows flexibility - an opening can be empty or filled with different elements.',
    ifcCode: {
      ifc4: 'IfcRelVoidsElement(\n  RelatingBuildingElement=#123 (Wall for Test Example),\n  RelatedOpeningElement=#456 (Opening Element for Test Example)\n)\nIfcRelFillsElement(\n  RelatingOpeningElement=#456,\n  RelatedBuildingElement=#789 (Window for Test Example)\n)',
      ifc5: '{\n  "RelVoidsElement": {\n    "RelatingBuildingElement": "Wall for Test Example",\n    "RelatedOpeningElement": "Opening Element for Test Example"\n  },\n  "RelFillsElement": {\n    "RelatingOpeningElement": "Opening Element for Test Example",\n    "RelatedBuildingElement": "Window for Test Example"\n  }\n}',
    },
  },

  {
    id: 'relationship-2',
    type: 'identify',
    title: 'Types of Relationships',
    description: 'Identify relationship purposes',
    question: 'Which relationships are most important for spatial structure? (Multiple)',
    options: [
      'IfcRelContainedInSpatialStructure - which storey contains which elements',
      'IfcRelVoidsElement - walls with openings',
      'IfcRelAggregates - building contains storeys',
      'IfcRelDefinesByType - walls linked to their type specs',
    ],
    answer: [
      'IfcRelContainedInSpatialStructure - which storey contains which elements',
      'IfcRelAggregates - building contains storeys',
    ],
    explanation:
      'The two most critical for spatial structure are Containment (what\'s in what storey) and Aggregation (how buildings are composed of storeys). Type definitions are important but secondary to spatial structure.',
  },

  // Property Layer Exercises
  {
    id: 'property-1',
    type: 'predict',
    title: 'Property Set Information',
    description: 'Understand standard property set naming',
    question: 'What information does Pset_WallCommon typically contain?',
    options: [
      'Wall-specific properties like IsExternal, FireRating, SoundTransmission',
      'Wall quantities like Height, Length, Area, Volume',
      'Door-specific properties like IsExternal, HasControlPanelInside',
      'Window quantities like Area, FrameArea',
    ],
    answer: 'Wall-specific properties like IsExternal, FireRating, SoundTransmission',
    explanation:
      'Property sets (Pset_*) contain qualitative/descriptive properties specific to element types, while Quantity sets (Qto_*) contain measured quantities. Pset_WallCommon stores wall properties following IFC/ISI standards.',
    ifcCode: {
      ifc4: 'IfcPropertySet("Pset_WallCommon",\n  HasProperties=[\n    IfcPropertySingleValue("IsExternal", Value=TRUE),\n    IfcPropertySingleValue("FireRating", Value="REI 60"),\n    IfcPropertySingleValue("AcousticRating", Value="Rw 50dB"),\n    IfcPropertySingleValue("Combustible", Value=FALSE),\n    IfcPropertySingleValue("SurfaceSpread", Value="Class A")\n  ]\n)',
      ifc5: '{\n  "type": "IfcPropertySet",\n  "Name": "Pset_WallCommon",\n  "HasProperties": [\n    {"Name": "IsExternal", "Value": true},\n    {"Name": "FireRating", "Value": "REI 60"},\n    {"Name": "AcousticRating", "Value": "Rw 50dB"},\n    {"Name": "Combustible", "Value": false},\n    {"Name": "SurfaceSpread", "Value": "Class A"}\n  ]\n}',
    },
  },

  {
    id: 'property-2',
    type: 'predict',
    title: 'Material Layer Composition',
    description: 'Understand complex material definitions',
    question:
      'A wall is defined as: Brick (150mm) + Insulation (100mm) + Drywall (15mm). How would this be represented in IFC?',
    options: [
      'Three separate IfcWall entities, one for each material',
      'One IfcWall with an IfcMaterialLayerSet containing three IfcMaterialLayer entities',
      'One IfcWall with three separate IfcMaterial entities',
      'The thickness is handled at the element level, materials aren\'t stored',
    ],
    answer: 'One IfcWall with an IfcMaterialLayerSet containing three IfcMaterialLayer entities',
    explanation:
      'A single IfcWall entity can have complex material composition defined via IfcMaterialLayerSet. Each layer specifies a material and its thickness. This is the standard way to represent real-world wall composition.',
    ifcCode: {
      ifc4: 'IfcWall("Wall for Test Example",\n  HasAssociations=[\n    IfcRelAssociatesMaterial(\n      RelatingMaterial=IfcMaterialLayerSet(\n        MaterialLayers=[\n          IfcMaterialLayer(Material=IfcMaterial("Brick"), LayerThickness=0.15),\n          IfcMaterialLayer(Material=IfcMaterial("Insulation"), LayerThickness=0.10),\n          IfcMaterialLayer(Material=IfcMaterial("Drywall"), LayerThickness=0.015)\n        ]\n      )\n    )\n  ]\n)',
      ifc5: '{\n  "type": "IfcWall",\n  "Name": "Wall for Test Example",\n  "Material": {\n    "type": "IfcMaterialLayerSet",\n    "MaterialLayers": [\n      {"Material": "Brick", "Thickness": 0.15},\n      {"Material": "Insulation", "Thickness": 0.10},\n      {"Material": "Drywall", "Thickness": 0.015}\n    ]\n  }\n}',
    },
  },
];

/**
 * Export all content as a single object for easy access
 */
export const LEARNING_CONTENT = {
  layers: LAYER_DEFINITIONS,
  examples: WORKED_EXAMPLES,
  exercises: PRACTICE_EXERCISES,
};
