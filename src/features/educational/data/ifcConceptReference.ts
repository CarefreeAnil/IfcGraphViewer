/**
 * IFC Concept Reference Library
 */

export interface ConceptExplanation {
  concept: string;
  category: 'fundamental' | 'schema' | 'relationship' | 'spatial' | 'property' | 'geometry' | 'advanced';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  shortDescription: string;
  detailedExplanation: string;
  keyPoints: string[];
  relatedConcepts: string[];
  examples?: string[];
  technicalDetails?: string;
}

/**
 * Comprehensive IFC concept explanations organized by category and difficulty
 */
export const IFC_CONCEPT_LIBRARY: ConceptExplanation[] = [
  // ============================================================================
  // FUNDAMENTALS - Beginner Level
  // ============================================================================
  {
    concept: 'BIM (Building Information Modeling)',
    category: 'fundamental',
    difficulty: 'beginner',
    shortDescription: 'Parametric 3D modeling approach combining geometry with information',
    detailedExplanation: 'Building Information Modeling (BIM) goes beyond traditional 3D CAD by embedding rich information into building models. A BIM model contains both the form (3D geometry) and appearance of building elements, as well as their properties, materials, structural characteristics, and relationships. This enables interoperability, analysis, and coordination throughout the building lifecycle.',
    keyPoints: [
      'Combines 3D geometry (form and appearance) with detailed information (properties)',
      'Uses parametric object-based modeling rather than lines and surfaces',
      'Enables multiple disciplines to work on coordinated models',
      'Supports lifecycle management from design through construction to operation',
      'Facilitates automated clash detection, quantity takeoff, and analysis',
    ],
    relatedConcepts: ['IFC', 'openBIM', 'Parametric Modeling', 'Interoperability'],
    examples: [
      'A wall in BIM includes: dimensions, materials, thermal properties, fire rating, cost',
      'Models can be architectural (spaces, aesthetics), structural (loads), or MEP (systems)',
    ],
  },
  {
    concept: 'IFC (Industry Foundation Classes)',
    category: 'fundamental',
    difficulty: 'beginner',
    shortDescription: 'Open, neutral data format for exchanging BIM information',
    detailedExplanation: 'IFC is an ISO standard (ISO 16739-1:2024) for representing building and construction data. Unlike proprietary formats that lock users into specific software, IFC enables open exchange of BIM data between different applications. It serves as a "publication format" where models are exported from native tools for sharing, review, and coordination.',
    keyPoints: [
      'International standard maintained by buildingSMART',
      'Vendor-neutral format supporting multiple software platforms',
      'Current versions: IFC2x3 (most widely used), IFC4.0.2.1 (latest ISO), IFC4.3 (infrastructure)',
      'Stored in STEP Physical File format (.ifc) or XML format (.ifcXML)',
      'Supports partial model exchange through Model View Definitions (MVDs)',
    ],
    relatedConcepts: ['openBIM', 'STEP Format', 'EXPRESS Schema', 'buildingSMART'],
    examples: [
      'Export architectural model from Revit to IFC for structural engineer using Tekla',
      'Coordinate MEP systems across different software platforms',
    ],
  },
  {
    concept: 'openBIM',
    category: 'fundamental',
    difficulty: 'beginner',
    shortDescription: 'Collaborative workflow based on open standards for interoperability',
    detailedExplanation: 'openBIM is an approach to project collaboration emphasizing transparent, vendor-neutral standards. It uses IFC for model exchange, BCF for issue management, IDS for information requirements, and bSDD for classifications. This enables teams using different software to work together effectively without losing data or requiring constant conversions.',
    keyPoints: [
      'Core standards: IFC (models), BCF (issues), IDS (specs), IDM (processes), MVD (views)',
      'Promotes transparent, accessible project data throughout lifecycle',
      'Enables multi-vendor collaboration without software lock-in',
      'Supported by buildingSMART International',
      'Reduces risks of proprietary format obsolescence',
    ],
    relatedConcepts: ['IFC', 'BCF', 'IDS', 'buildingSMART', 'MVD'],
    examples: [
      'Architect, engineer, and contractor using different software on same project',
      'Long-term facility management requiring software-independent data',
    ],
  },
  {
    concept: 'STEP Identifiers (#)',
    category: 'fundamental',
    difficulty: 'beginner',
    shortDescription: 'Local line-number references in IFC STEP files (e.g., #123)',
    detailedExplanation: 'In IFC\'s STEP Physical File format, each entity instance is assigned a unique line number starting with # (e.g., #123, #456). These identifiers are local to the file and change when the file is modified or re-exported. They enable entities to reference each other within the same file but are not globally unique or persistent.',
    keyPoints: [
      'Format: # followed by a number (e.g., #123)',
      'Assigned sequentially during file export',
      'Local to single file - not globally unique',
      'Change when file is re-exported or modified',
      'Used for within-file entity references',
    ],
    relatedConcepts: ['GlobalId (GUID)', 'STEP Format', 'Entity References'],
    examples: [
      'IfcWall #123 references IfcPropertySet #456 for its properties',
      'After re-export, same wall might become #789',
    ],
    technicalDetails: 'Defined by ISO 10303-21 (STEP Physical File). Numbers must be unique within file but have no semantic meaning.',
  },
  {
    concept: 'GlobalId (GUID)',
    category: 'fundamental',
    difficulty: 'beginner',
    shortDescription: '22-character globally unique identifier for persistent entity tracking',
    detailedExplanation: 'Every IfcRoot-derived entity has a GlobalId - a 22-character Base64-encoded identifier that uniquely identifies that exact entity across files, versions, and systems. Unlike STEP IDs which change on export, GlobalIds remain constant throughout the entity\'s lifecycle, enabling version tracking, change detection, and coordination across multiple files.',
    keyPoints: [
      'Format: 22-character Base64 string (e.g., "2O2Fr$t4X7Zf8NOew3FNr2")',
      'Globally unique across all IFC files and systems',
      'Persistent - remains same across file versions',
      'Required for all IfcRoot-derived entities',
      'Enables entity tracking, coordination, and change management',
    ],
    relatedConcepts: ['IfcRoot', 'STEP Identifiers', 'Entity Identity', 'Version Control'],
    examples: [
      'Wall with GUID "2O2Fr$t4X7Zf8NOew3FNr2" can be tracked across design revisions',
      'Coordination tool uses GUIDs to match entities across architectural and structural models',
    ],
    technicalDetails: 'Base64 encoding of 128-bit UUID using IFC-specific character set. Defined in IFC specification.',
  },

  // ============================================================================
  // SCHEMA ARCHITECTURE - Intermediate Level
  // ============================================================================
  {
    concept: 'IFC Schema Layers',
    category: 'schema',
    difficulty: 'intermediate',
    shortDescription: 'Four-layer conceptual architecture from generic to domain-specific',
    detailedExplanation: 'IFC schema is organized in four conceptual layers: (1) Resource Layer - fundamental types and units, (2) Core Layer - abstract concepts and kernel relationships, (3) Interoperability Layer - common elements across domains, (4) Domain Layer - discipline-specific extensions. This architecture enables reuse, extension, and maintains consistency across building and infrastructure domains.',
    keyPoints: [
      'Resource Layer: Basic types (geometry, measures, materials) - no GlobalId',
      'Core Layer: Abstract root classes (IfcRoot, IfcObjectDefinition) and relationships',
      'Interoperability Layer: Shared concepts (IfcProduct, IfcElement, spatial structure)',
      'Domain Layer: Specific elements (IfcWall, IfcBeam, IfcDoor) for each discipline',
      'Higher layers depend on lower layers but not vice versa',
    ],
    relatedConcepts: ['IfcRoot', 'IfcObjectDefinition', 'EXPRESS Schema', 'Entity Hierarchy'],
    examples: [
      'Resource: IfcLengthMeasure, IfcCartesianPoint',
      'Core: IfcRelationship, IfcPropertyDefinition',
      'Interoperability: IfcProduct, IfcSpatialElement',
      'Domain: IfcWall, IfcColumn, IfcDoor',
    ],
    technicalDetails: 'Defined using EXPRESS language (ISO 10303-11). Layers prevent circular dependencies.',
  },
  {
    concept: 'IfcRoot',
    category: 'schema',
    difficulty: 'intermediate',
    shortDescription: 'Abstract base class for all IFC entities requiring unique identification',
    detailedExplanation: 'IfcRoot is the ultimate superclass in the IFC type hierarchy. It provides three essential attributes inherited by all derived types: GlobalId (unique identifier), OwnerHistory (creation/modification tracking), and optional Name and Description. Every identifiable entity in IFC inherits from IfcRoot, enabling consistent identity, versioning, and metadata.',
    keyPoints: [
      'Abstract class - cannot be instantiated directly',
      'Attributes: GlobalId (required), OwnerHistory, Name, Description',
      'Root of entire IfcObjectDefinition and IfcPropertyDefinition hierarchies',
      'Children: IfcObjectDefinition, IfcPropertyDefinition, IfcRelationship',
      'Ensures all major entities have persistent identity',
    ],
    relatedConcepts: ['GlobalId', 'IfcObjectDefinition', 'IfcRelationship', 'Entity Inheritance'],
    examples: [
      'IfcRoot → IfcObjectDefinition → IfcObject → IfcProduct → IfcElement → IfcWall',
      'IfcRoot → IfcRelationship → IfcRelContainedInSpatialStructure',
    ],
    technicalDetails: 'Defined in IfcKernel schema at Core Layer. All subclasses inherit identity attributes.',
  },
  {
    concept: 'Entity Inheritance',
    category: 'schema',
    difficulty: 'intermediate',
    shortDescription: 'Hierarchical class structure where subtypes inherit all attributes from parents',
    detailedExplanation: 'IFC uses single inheritance where each entity type derives from exactly one parent class, inheriting all its attributes and relationships. For example, IfcWall inherits from IfcElement, which inherits from IfcProduct, etc., all the way up to IfcRoot. This creates a taxonomy where specific types (like IfcWallStandardCase) have all attributes of their ancestors plus their own specialized features.',
    keyPoints: [
      'Single inheritance - each type has one parent (SUPERTYPE)',
      'Attributes accumulate down the hierarchy',
      'Enables polymorphism - treat specific types as generic parents',
      'Common attributes defined at appropriate abstraction level',
      'Subtypes can add new attributes but cannot override inherited ones',
    ],
    relatedConcepts: ['IfcRoot', 'SUPERTYPE/SUBTYPE', 'Entity Hierarchy', 'Polymorphism'],
    examples: [
      'IfcWall inherits: GlobalId (from IfcRoot), ObjectPlacement (from IfcProduct), Tag (from IfcElement)',
      'IfcWindow inherits all IfcBuildingElement attributes plus window-specific ones',
    ],
    technicalDetails: 'Defined by EXPRESS SUPERTYPE OF / SUBTYPE OF constraints. Enables type checking and validation.',
  },
  {
    concept: 'Inverse Attributes',
    category: 'schema',
    difficulty: 'intermediate',
    shortDescription: 'Automatic bidirectional navigation through relationships without storing redundant data',
    detailedExplanation: 'In IFC, relationships are typically stored in one direction (e.g., IfcRelContainedInSpatialStructure points from elements to their containing space). Inverse attributes provide automatic backward navigation without duplicating data. For example, IfcBuildingStorey has an inverse attribute "ContainsElements" that automatically shows which relationship instances reference it, enabling traversal in both directions.',
    keyPoints: [
      'Defined using INVERSE keyword in EXPRESS schema',
      'Not stored in file - computed dynamically when file is read',
      'Enable bidirectional navigation through relationships',
      'Reduce data redundancy and improve consistency',
      'Essential for spatial structure navigation and property lookups',
    ],
    relatedConcepts: ['IfcRelationship', 'Spatial Navigation', 'Object Composition', 'EXPRESS Schema'],
    examples: [
      'IfcBuildingStorey.ContainsElements shows all elements on that storey',
      'IfcWall.IsDefinedBy shows all property sets attached to the wall',
      'IfcProduct.ReferencedBy shows all relationship instances referencing this product',
    ],
    technicalDetails: 'INVERSE attribute_name: relationship_type FOR target_attribute. Automatically populated by IFC readers.',
  },

  // ============================================================================
  // RELATIONSHIPS - Intermediate Level
  // ============================================================================
  {
    concept: 'Objectified Relationships',
    category: 'relationship',
    difficulty: 'intermediate',
    shortDescription: 'Relationships as explicit entities (IfcRel*) rather than simple references',
    detailedExplanation: 'IFC models relationships as first-class entities inheriting from IfcRelationship rather than direct object references. Each relationship type (containment, aggregation, property assignment, etc.) is an instantiated object with its own GlobalId and attributes. This enables relationships to carry additional metadata, participate in version control, and be referenced by other entities.',
    keyPoints: [
      'All relationships inherit from IfcRelationship (subclass of IfcRoot)',
      'Relationships have GlobalIds enabling tracking across versions',
      'Can carry attributes beyond simple references (descriptions, ordering)',
      'Support n-ary relationships (one-to-many, many-to-many)',
      'Main categories: Assignment, Association, Connectivity, Declaration, Definition, Decomposition',
    ],
    relatedConcepts: ['IfcRelationship', 'IfcRoot', 'Spatial Structure', 'Property Definition'],
    examples: [
      'IfcRelContainedInSpatialStructure links multiple walls to a storey',
      'IfcRelDefinesByProperties attaches property sets to objects',
      'IfcRelAggregates decomposes a building into storeys',
    ],
    technicalDetails: 'Defined in IfcKernel at Core Layer. Enables rich relationship semantics beyond simple pointers.',
  },
  {
    concept: 'IfcRelContainedInSpatialStructure',
    category: 'relationship',
    difficulty: 'intermediate',
    shortDescription: 'Links building elements to their containing spatial structure (storey/building)',
    detailedExplanation: 'This is the most common relationship in IFC files. It connects building elements (walls, doors, furniture, etc.) to the spatial container they reside in, typically an IfcBuildingStorey or IfcBuilding. This creates the fundamental organizational hierarchy enabling elements to be grouped by location and queried by space.',
    keyPoints: [
      'RelatingStructure: The spatial container (IfcBuildingStorey, IfcBuilding)',
      'RelatedElements: Set of elements contained in that space',
      'One-to-many relationship (one space, many elements)',
      'Elements can only be contained in one spatial structure at a time',
      'Essential for spatial queries: "show all elements on Level 2"',
    ],
    relatedConcepts: ['Spatial Structure', 'IfcBuildingStorey', 'IfcElement', 'Containment Hierarchy'],
    examples: [
      'All walls, columns, and slabs on "Level 1" connected via this relationship',
      'Furniture elements contained in specific rooms',
    ],
    technicalDetails: 'Subtype of IfcRelConnects. Defined in IfcProductExtension at Interoperability Layer.',
  },
  {
    concept: 'IfcRelAggregates',
    category: 'relationship',
    difficulty: 'intermediate',
    shortDescription: 'Decomposes objects into component parts (building → storeys → spaces)',
    detailedExplanation: 'IfcRelAggregates establishes part-whole hierarchies where a whole object is decomposed into constituent parts. The classic example is spatial decomposition: Project contains Sites, Sites contain Buildings, Buildings contain Storeys, Storeys contain Spaces. This creates the navigational hierarchy distinct from the containment of building elements.',
    keyPoints: [
      'RelatingObject: The whole (e.g., Building)',
      'RelatedObjects: The parts (e.g., multiple Building Storeys)',
      'Creates hierarchical decomposition (one-to-many)',
      'Used for spatial structure: Project → Site → Building → Storey → Space',
      'Also used for element assembly: Complex equipment decomposed into components',
    ],
    relatedConcepts: ['Spatial Structure', 'IfcProject', 'IfcBuilding', 'Object Decomposition'],
    examples: [
      'IfcBuilding aggregates IfcBuildingStorey instances (entire building → individual floors)',
      'IfcProject aggregates IfcSite instances (entire project → multiple sites)',
      'IfcCurtainWall aggregates IfcPlate and IfcMember components',
    ],
    technicalDetails: 'Subtype of IfcRelDecomposes. Creates acyclic directed graph structure.',
  },
  {
    concept: 'IfcRelVoidsElement',
    category: 'relationship',
    difficulty: 'intermediate',
    shortDescription: 'Creates voids/openings in building elements (wall openings for doors/windows)',
    detailedExplanation: 'IfcRelVoidsElement subtracts geometry from a building element by creating a void. It links an IfcOpeningElement (defining the void shape) to the host element (typically IfcWall, IfcSlab, or IfcRoof). This is the first step in the two-step process of creating filled openings: (1) void the element, (2) fill the opening.',
    keyPoints: [
      'RelatingBuildingElement: The host being voided (e.g., IfcWall)',
      'RelatedOpeningElement: The IfcOpeningElement defining void geometry',
      'Voids are Boolean subtractions from host geometry',
      'Precedes IfcRelFillsElement for door/window placement',
      'One element can have multiple voids',
    ],
    relatedConcepts: ['IfcOpeningElement', 'IfcRelFillsElement', 'IfcWall', 'Boolean Operations'],
    examples: [
      'Wall with opening for door: Wall → IfcRelVoidsElement → IfcOpeningElement',
      'Slab with opening for stairwell penetration',
    ],
    technicalDetails: 'Subtype of IfcRelConnects. Void geometry is subtracted during geometric processing.',
  },
  {
    concept: 'IfcRelFillsElement',
    category: 'relationship',
    difficulty: 'intermediate',
    shortDescription: 'Fills an opening with a door, window, or other building element',
    detailedExplanation: 'IfcRelFillsElement is the second step after voiding, linking a filling element (IfcDoor, IfcWindow, etc.) to an IfcOpeningElement. This completes the semantic chain: host element is voided, creating an opening, which is then filled with a functional element. The filling element\'s geometry occupies the opening space.',
    keyPoints: [
      'RelatingOpeningElement: The IfcOpeningElement being filled',
      'RelatedBuildingElement: The element filling the opening (IfcDoor, IfcWindow)',
      'One opening can only be filled by one element',
      'Completes the void→fill semantic chain',
      'Enables querying: "which window fills this opening?"',
    ],
    relatedConcepts: ['IfcOpeningElement', 'IfcRelVoidsElement', 'IfcWindow', 'IfcDoor'],
    examples: [
      'IfcWindow fills IfcOpeningElement which voids IfcWall',
      'IfcDoor placed in wall opening',
    ],
    technicalDetails: 'Subtype of IfcRelConnects. Filling element\'s geometry should match opening\'s bounding box.',
  },
  {
    concept: 'IfcRelDefinesByProperties',
    category: 'relationship',
    difficulty: 'intermediate',
    shortDescription: 'Attaches property sets to objects for additional attributes',
    detailedExplanation: 'IfcRelDefinesByProperties links IfcPropertySet instances to objects (IfcObject or IfcTypeObject), extending them with additional named properties beyond their standard attributes. Property sets can be predefined (e.g., Pset_WallCommon) or custom, enabling flexible extension without modifying the core schema.',
    keyPoints: [
      'RelatedObjects: Objects receiving properties (can be multiple)',
      'RelatingPropertyDefinition: The IfcPropertySet being attached',
      'Enables schema extension without modifying entity definitions',
      '760 predefined property sets in IFC4.3',
      'Properties are name-value pairs with units and descriptions',
    ],
    relatedConcepts: ['IfcPropertySet', 'Property Definition', 'Pset_* Conventions', 'Custom Properties'],
    examples: [
      'Pset_WallCommon attached to IfcWall adds: IsExternal, FireRating, ThermalTransmittance',
      'Custom property set for company-specific data: "FacMan_AssetInfo"',
    ],
    technicalDetails: 'Subtype of IfcRelDefines. Property sets are reusable across multiple objects.',
  },
  {
    concept: 'IfcRelDefinesByType',
    category: 'relationship',
    difficulty: 'intermediate',
    shortDescription: 'Links object instances to their type definition for shared characteristics',
    detailedExplanation: 'IfcRelDefinesByType connects specific instances (IfcWall, IfcDoor) to their type definitions (IfcWallType, IfcDoorType) that define shared characteristics, geometry, and properties. This reduces file size and ensures consistency: 100 identical doors reference one IfcDoorType rather than duplicating properties 100 times.',
    keyPoints: [
      'RelatedObjects: Instances sharing the same type',
      'RelatingType: The IfcTypeObject defining shared characteristics',
      'Type objects hold: default geometry, material assignments, property sets',
      'Instances can override type properties with instance-specific values',
      'Fundamental for parametric object libraries and standardization',
    ],
    relatedConcepts: ['IfcTypeObject', 'IfcWallType', 'IfcDoorType', 'Type Definitions', 'Object Libraries'],
    examples: [
      '50 identical office doors reference one IfcDoorType "Office_Door_900x2100"',
      'IfcColumnType defines standard steel column profile used throughout building',
    ],
    technicalDetails: 'Subtype of IfcRelDefines. Type properties are inherited unless overridden at instance level.',
  },

  // ============================================================================
  // SPATIAL STRUCTURE - Intermediate Level
  // ============================================================================
  {
    concept: 'Spatial Hierarchy',
    category: 'spatial',
    difficulty: 'intermediate',
    shortDescription: 'Nested organizational structure: Project → Site → Building → Storey → Space',
    detailedExplanation: 'IFC organizes buildings using a hierarchical spatial structure that mirrors physical decomposition. At the top is IfcProject (root container), which aggregates IfcSite instances (geographic location), which contain IfcBuilding instances (individual buildings), which decompose into IfcBuildingStorey (floors), which can further decompose into IfcSpace (rooms). Building elements are then contained within appropriate levels via IfcRelContainedInSpatialStructure.',
    keyPoints: [
      'Typical hierarchy: Project → Site → Building → Storey → Space',
      'Established via IfcRelAggregates relationships',
      'Building elements attached via IfcRelContainedInSpatialStructure',
      'Enables spatial queries and location-based filtering',
      'Infrastructure uses similar pattern: IfcRoad, IfcBridge replace IfcBuilding',
    ],
    relatedConcepts: ['IfcProject', 'IfcSite', 'IfcBuilding', 'IfcBuildingStorey', 'IfcSpace', 'IfcRelAggregates'],
    examples: [
      'Office Building: Project → Site → Building → [Ground Floor, Level 1, Level 2] → [Offices, Corridors]',
      'Campus: Project → Site → [Building A, Building B, Building C]',
    ],
    technicalDetails: 'Spatial elements inherit from IfcSpatialStructureElement or IfcSpatialElement.',
  },
  {
    concept: 'IfcProject',
    category: 'spatial',
    difficulty: 'beginner',
    shortDescription: 'Root container for all IFC data with project-level metadata',
    detailedExplanation: 'IfcProject is the mandatory root container that must exist exactly once in every IFC file. It holds project-level settings including: units of measurement, coordinate systems, geographic reference, project phase, and organizational context. All other spatial and building elements are directly or indirectly aggregated under the project.',
    keyPoints: [
      'Exactly one IfcProject per IFC file (mandatory)',
      'Contains: UnitsInContext (length, area, volume units), RepresentationContexts (3D coordinate systems)',
      'Aggregates IfcSite or directly IfcBuilding (via IfcRelAggregates)',
      'Defines global project settings (phase, description, long name)',
      'Root of spatial hierarchy tree',
    ],
    relatedConcepts: ['Spatial Hierarchy', 'IfcSite', 'Units', 'Coordinate Systems', 'IfcRelAggregates'],
    examples: [
      'Project "New Office Building" with metric units and WGS84 geographic reference',
      'Infrastructure project with multiple sites across different locations',
    ],
    technicalDetails: 'Inherits from IfcContext. Must have GlobalId like all IfcRoot entities.',
  },
  {
    concept: 'IfcBuildingStorey',
    category: 'spatial',
    difficulty: 'beginner',
    shortDescription: 'Represents a floor or level in a building with elevation',
    detailedExplanation: 'IfcBuildingStorey represents a single horizontal level or floor within a building. Each storey has an elevation attribute defining its height above a reference point (typically ground level or project origin). Building elements like walls, slabs, and columns are spatially contained within storeys via IfcRelContainedInSpatialStructure, providing location-based organization.',
    keyPoints: [
      'Elevation attribute defines height above reference (typically in meters)',
      'Aggregated by IfcBuilding via IfcRelAggregates',
      'Contains building elements via IfcRelContainedInSpatialStructure',
      'Can further decompose into IfcSpace instances (rooms)',
      'Typical naming: "Ground Floor", "Level 1", "Level 2", "Basement -1"',
    ],
    relatedConcepts: ['Spatial Hierarchy', 'IfcBuilding', 'IfcSpace', 'IfcRelContainedInSpatialStructure', 'Elevation'],
    examples: [
      'Level 1 at elevation 0.0m containing 15 walls, 3 columns, 1 slab',
      'Underground parking at elevation -3.5m',
    ],
    technicalDetails: 'Inherits from IfcSpatialStructureElement. Referenced via inverse attribute ContainsElements.',
  },
  {
    concept: 'IfcSpace',
    category: 'spatial',
    difficulty: 'intermediate',
    shortDescription: 'Represents an enclosed room or zone within a building',
    detailedExplanation: 'IfcSpace represents bounded volumes like rooms, corridors, or functional zones. Spaces have geometric boundaries that can be explicit (via space geometry) or inferred from surrounding elements via IfcRelSpaceBoundary. Spaces carry semantic information (room number, room type, occupancy) and can have property sets for area, volume, fire rating, acoustic properties, etc.',
    keyPoints: [
      'Represents rooms, corridors, zones, or other enclosed volumes',
      'Attributes: LongName (room number), CompositionType, ElevationWithFlooring',
      'Boundaries defined via IfcRelSpaceBoundary linking to surrounding walls/floors',
      'Can aggregate smaller spaces (zones composed of subzones)',
      'Critical for facility management, space planning, energy analysis',
    ],
    relatedConcepts: ['IfcBuildingStorey', 'IfcRelSpaceBoundary', 'IfcZone', 'Space Boundaries', 'Room Data'],
    examples: [
      'Office room "2.15" (floor 2, room 15) with 25 m² area and "Office" room type',
      'Conference room with acoustic treatment and occupancy limit properties',
    ],
    technicalDetails: 'Inherits from IfcSpatialStructureElement. Can contain furniture and equipment.',
  },

  // ============================================================================
  // PROPERTIES & QUANTITIES - Intermediate Level
  // ============================================================================
  {
    concept: 'Property Sets (Pset_*)',
    category: 'property',
    difficulty: 'intermediate',
    shortDescription: 'Predefined or custom collections of properties attached to objects',
    detailedExplanation: 'Property sets are named collections of related properties that extend IFC entities beyond their standard attributes. IFC defines 760 predefined property sets (prefixed "Pset_") covering common use cases across all building elements. Custom property sets enable company-specific or project-specific extensions. Properties are attached via IfcRelDefinesByProperties and contain name-value pairs with optional units and descriptions.',
    keyPoints: [
      'Predefined sets: Pset_WallCommon, Pset_DoorCommon, Pset_SpaceCommon, etc.',
      'Custom sets: Any name not starting with "Pset_" or "Qto_"',
      'Contain IfcPropertySingleValue, IfcPropertyEnumeratedValue, or other property types',
      'Enable schema extension without modifying core EXPRESS definitions',
      'Reusable across multiple object instances',
    ],
    relatedConcepts: ['IfcPropertySet', 'IfcRelDefinesByProperties', 'Quantity Sets', 'Custom Properties'],
    examples: [
      'Pset_WallCommon: IsExternal, LoadBearing, FireRating, ThermalTransmittance',
      'Pset_DoorCommon: FireRating, SelfClosing, SmokeStop, HandicapAccessible',
      'Custom: "CompanyAssetData" with AssetTag, PurchaseDate, WarrantyExpiration',
    ],
    technicalDetails: 'Defined in IfcPropertyResource at Resource Layer. Properties have nominal values and optional units.',
  },
  {
    concept: 'Quantity Sets (Qto_*)',
    category: 'property',
    difficulty: 'intermediate',
    shortDescription: 'Standardized quantity takeoff information (area, volume, length, count)',
    detailedExplanation: 'Quantity sets (prefixed "Qto_") are specialized property sets specifically for quantity takeoff and cost estimation. They contain measured or calculated quantities like gross area, net area, volume, length, count, etc. IFC defines standard quantity sets for each element type to ensure consistent quantity reporting across software applications.',
    keyPoints: [
      'Prefix "Qto_" identifies quantity sets (e.g., Qto_WallBaseQuantities)',
      'Contains IfcQuantityLength, IfcQuantityArea, IfcQuantityVolume, IfcQuantityCount',
      'Used for cost estimation, material takeoff, construction planning',
      'Can include multiple measurement methods (gross, net, effective)',
      'Standardized across IFC to ensure consistent quantity reporting',
    ],
    relatedConcepts: ['Property Sets', 'IfcElementQuantity', 'Quantity Takeoff', 'Cost Estimation'],
    examples: [
      'Qto_WallBaseQuantities: Length, NetVolume, GrossVolume, NetSideArea, GrossSideArea',
      'Qto_SlabBaseQuantities: GrossArea, NetArea, GrossVolume, NetVolume, Perimeter',
    ],
    technicalDetails: 'Attached via IfcRelDefinesByProperties like regular property sets. Quantities have methods and formulas.',
  },

  // ============================================================================
  // GEOMETRY & REPRESENTATION - Advanced Level
  // ============================================================================
  {
    concept: 'Geometric Representation',
    category: 'geometry',
    difficulty: 'advanced',
    shortDescription: '11 different approaches for representing object geometry in IFC',
    detailedExplanation: 'IFC supports multiple geometric representation paradigms to accommodate different modeling approaches and levels of detail. These include: swept solids (extruded profiles), boundary representations (B-Rep with faces/edges), constructive solid geometry (CSG), tessellated geometry (triangulated meshes), mapped representations (instanced geometry), and more. Objects can have multiple representations (e.g., Box for collision detection, SweptSolid for construction, Tessellation for visualization).',
    keyPoints: [
      'Representation types: SweptSolid, Brep, CSG, Tessellation, MappedRepresentation, Clipping',
      'Multiple representations per object (LoD, different purposes)',
      'RepresentationContext defines coordinate system and accuracy',
      'Geometric vs. Topological representations',
      'Placement via IfcLocalPlacement (relative or absolute positioning)',
    ],
    relatedConcepts: ['IfcShapeRepresentation', 'IfcProductDefinitionShape', 'Coordinate Systems', 'Level of Detail'],
    examples: [
      'Wall as SweptAreaSolid: vertical extrusion of rectangular profile',
      'Complex facade as Brep: explicit faces, edges, and vertices',
      'Furniture as MappedRepresentation: reusable geometry from type',
    ],
    technicalDetails: 'Defined in IfcGeometricModelResource at Resource Layer. Geometry references IfcRepresentationContext.',
  },
  {
    concept: 'Object Placement',
    category: 'geometry',
    difficulty: 'intermediate',
    shortDescription: 'Positioning objects in 3D space via absolute or relative placement',
    detailedExplanation: 'IfcLocalPlacement defines how objects are positioned in 3D space through coordinate transformations. Placement can be absolute (relative to world origin) or relative to another object\'s placement (enabling hierarchical transformations). Each placement has a location (point) and optional orientation axes (X, Y, Z directions), defining a local coordinate system for the object\'s geometry.',
    keyPoints: [
      'Absolute placement: Relative to global coordinate system',
      'Relative placement: Relative to parent object (e.g., window relative to wall)',
      'Placement transformation: location point + orientation axes',
      'Hierarchical: Child placements transform through parent placements',
      'Enables parametric updates: move wall, windows move with it',
    ],
    relatedConcepts: ['IfcLocalPlacement', 'Coordinate Systems', 'IfcAxis2Placement3D', 'Geometric Representation'],
    examples: [
      'Wall placed absolutely at (0, 0, 0) with default orientation',
      'Window placed relatively to wall at (2.5m along wall, 1.0m height)',
      'Furniture placed relative to room origin',
    ],
    technicalDetails: 'Uses IfcAxis2Placement3D with location and optional axis/RefDirection. Transformations are matrix multiplications.',
  },

  // ============================================================================
  // IFC5 & FUTURE - Advanced Level
  // ============================================================================
  {
    concept: 'IFC5 Evolution',
    category: 'advanced',
    difficulty: 'advanced',
    shortDescription: 'Paradigm shift from file-based STEP to API-first JSON architecture',
    detailedExplanation: 'IFC5 represents a fundamental reimagining of IFC, moving from monolithic STEP files to an API-first, transactional architecture. Instead of exchanging entire files, IFC5 enables partial model queries, real-time updates, and distributed collaboration. It adopts modern patterns: JSON instead of STEP, path-based references instead of STEP IDs, Entity Component System (ECS) from game development, and integration with USD (Universal Scene Description) from Pixar.',
    keyPoints: [
      'API-first architecture: Query and update partial models via web APIs',
      'JSON format instead of STEP Physical File',
      'Entity Component System (ECS): Modular, data-oriented design',
      'USD integration: Leverages Pixar\'s Universal Scene Description',
      'Path-based entity references: "Building/Level1/Wall_123"',
      'Transactional updates: Track changes, enable collaborative workflows',
    ],
    relatedConcepts: ['Entity Component System', 'USD', 'Alliance for OpenUSD', 'JSON Format', 'API Design'],
    examples: [
      'Mobile app queries only walls on Level 2 without downloading entire building model',
      'Real-time coordination: architect and engineer update same model simultaneously',
      'Version control: granular change tracking at entity level',
    ],
    technicalDetails: 'buildingSMART-AOUSD collaboration agreement (Oct 2024). IFC5 still in development, no release date set.',
  },
  {
    concept: 'Entity Component System (ECS)',
    category: 'advanced',
    difficulty: 'advanced',
    shortDescription: 'Game development pattern: entities as composition of reusable components',
    detailedExplanation: 'ECS is a design pattern from game development where entities are lightweight identifiers composed of reusable components (data buckets) processed by systems (logic). Unlike OOP inheritance (Wall IS-A Element IS-A Product), ECS uses composition (Wall HAS position, HAS geometry, HAS material). This provides flexibility: add fire suppression component only to sprinklers and fire doors, not to entire building element hierarchy.',
    keyPoints: [
      'Entities: Unique IDs with no inherent behavior',
      'Components: Pure data (geometry, material, properties) attached to entities',
      'Systems: Logic processing entities with specific component combinations',
      'Composition over inheritance: Flexible feature assignment',
      'Performance: Data-oriented design, cache-friendly, parallel processing',
    ],
    relatedConcepts: ['IFC5', 'Composition vs Inheritance', 'Data-Oriented Design', 'Component-Based Architecture'],
    examples: [
      'Traditional OOP: IfcWall inherits 30 attributes from parent classes',
      'ECS: Wall entity + GeometryComponent + MaterialComponent + PropertyComponent',
      'Specialized features: Add FireRatingComponent only where needed',
    ],
    technicalDetails: 'Widely used in game engines (Unity, Unreal). Inspired IFC5 restructuring for flexibility and performance.',
  },
  {
    concept: 'Universal Scene Description (USD)',
    category: 'advanced',
    difficulty: 'advanced',
    shortDescription: 'Pixar\'s framework for 3D scene composition influencing IFC5 design',
    detailedExplanation: 'USD is Pixar\'s open-source framework for composing, editing, and rendering large-scale 3D scenes used in film and visual effects. The Alliance for OpenUSD (AOUSD) brings together buildingSMART, Pixar, Adobe, Apple, Autodesk, and NVIDIA to adapt USD for AEC. IFC5 is being designed with USD integration in mind, leveraging USD\'s layered composition, hierarchical organization, extensible schemas, and real-time rendering capabilities.',
    keyPoints: [
      'Developed by Pixar for film production, now widely adopted',
      'Layered composition: Non-destructive overrides and variations',
      'Hierarchical scene graph with references and instancing',
      'Extensible schema system similar to IFC inheritance',
      'High-performance rendering and real-time collaboration',
      'Alliance for OpenUSD (AOUSD) formed Oct 2024 with buildingSMART participation',
    ],
    relatedConcepts: ['IFC5', 'Alliance for OpenUSD', 'Scene Graphs', '3D Rendering', 'Layered Data'],
    examples: [
      'Layer system: Base building model + Variant A (material option 1) + Variant B (material option 2)',
      'Reference reuse: Place same desk asset in 100 rooms without duplicating geometry',
      'Real-time visualization: Walk through building with physics and lighting',
    ],
    technicalDetails: 'USD uses ASCII/binary format with .usda/.usdc extensions. Composition engine resolves layer overrides.',
  },
  {
    concept: 'Alliance for OpenUSD (AOUSD)',
    category: 'advanced',
    difficulty: 'advanced',
    shortDescription: 'Industry collaboration between buildingSMART and major tech companies',
    detailedExplanation: 'The Alliance for OpenUSD is a collaborative effort formed October 1, 2024, bringing together buildingSMART (IFC steward) with Pixar, Adobe, Apple, Autodesk, NVIDIA, and other industry leaders. The goal is to develop standards for using USD in AEC, manufacturing, and other industries, with specific focus on IFC-USD interoperability. This enables leveraging USD\'s rendering and collaboration capabilities while maintaining IFC\'s rich semantic building information.',
    keyPoints: [
      'Formed Oct 1, 2024 with buildingSMART as founding member',
      'Members: Pixar, Adobe, Apple, Autodesk, NVIDIA, buildingSMART, others',
      'Goal: USD standards for AEC, manufacturing, robotics, simulation',
      'Focus: IFC-USD interoperability and round-trip workflows',
      'IFC5 being designed with USD integration in mind',
    ],
    relatedConcepts: ['IFC5', 'USD', 'buildingSMART', 'Industry Standards', 'Interoperability'],
    examples: [
      'Export IFC model to USD for high-quality visualization and client presentations',
      'Real-time collaboration: Multiple stakeholders editing model in USD, sync back to IFC',
      'Construction simulation: USD physics for crane operations + IFC building data',
    ],
    technicalDetails: 'AOUSD governs USD development. buildingSMART ensures AEC needs are represented in USD evolution.',
  },
];

/**
 * Get concept explanation by name
 */
export function getConceptExplanation(conceptName: string): ConceptExplanation | undefined {
  return IFC_CONCEPT_LIBRARY.find(
    concept => concept.concept.toLowerCase() === conceptName.toLowerCase()
  );
}

/**
 * Get concepts filtered by category
 */
export function getConceptsByCategory(category: ConceptExplanation['category']): ConceptExplanation[] {
  return IFC_CONCEPT_LIBRARY.filter(concept => concept.category === category);
}

/**
 * Get concepts filtered by difficulty
 */
export function getConceptsByDifficulty(difficulty: ConceptExplanation['difficulty']): ConceptExplanation[] {
  return IFC_CONCEPT_LIBRARY.filter(concept => concept.difficulty === difficulty);
}

/**
 * Search concepts by keyword
 */
export function searchConcepts(query: string): ConceptExplanation[] {
  const lowerQuery = query.toLowerCase();
  return IFC_CONCEPT_LIBRARY.filter(concept =>
    concept.concept.toLowerCase().includes(lowerQuery) ||
    concept.shortDescription.toLowerCase().includes(lowerQuery) ||
    concept.keyPoints.some(point => point.toLowerCase().includes(lowerQuery)) ||
    concept.relatedConcepts.some(related => related.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get related concepts for a given concept
 */
export function getRelatedConcepts(conceptName: string): ConceptExplanation[] {
  const concept = getConceptExplanation(conceptName);
  if (!concept) return [];

  return concept.relatedConcepts
    .map(relatedName => getConceptExplanation(relatedName))
    .filter(Boolean) as ConceptExplanation[];
}

/**
 * Get learning path (progressive concept sequence)
 */
export function getLearningPath(): { beginner: string[]; intermediate: string[]; advanced: string[] } {
  return {
    beginner: IFC_CONCEPT_LIBRARY
      .filter(c => c.difficulty === 'beginner')
      .map(c => c.concept),
    intermediate: IFC_CONCEPT_LIBRARY
      .filter(c => c.difficulty === 'intermediate')
      .map(c => c.concept),
    advanced: IFC_CONCEPT_LIBRARY
      .filter(c => c.difficulty === 'advanced')
      .map(c => c.concept),
  };
}
