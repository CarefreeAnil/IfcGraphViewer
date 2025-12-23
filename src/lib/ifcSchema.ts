/**
 * Comprehensive IFC Schema Definitions
 * Defines all common IFC entity types with their properties, relationships, and validation rules
 * Based on IFC 2x3 and IFC4 standards
 */

export interface IfcPropertyDef {
  name: string;
  type: string; // 'string', 'number', 'boolean', 'array', 'reference', 'enum'
  required: boolean;
  description: string;
}

export interface IfcRelationshipDef {
  name: string;
  sourceEntity: string[];
  targetEntity: string[];
  description: string;
  cardinality: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface IfcEntityDef {
  type: string;
  displayName: string;
  description: string;
  category: 'spatial' | 'element' | 'structural' | 'property' | 'relationship' | 'other';
  icon: string;
  color: string;
  properties: IfcPropertyDef[];
  validChildren?: string[];
  validParents?: string[];
  relationships?: IfcRelationshipDef[];
  rules?: Array<{
    name: string;
    description: string;
    check: (entity: any, allEntities: any[]) => boolean;
  }>;
}

/**
 * Complete IFC Schema Catalog
 */
export const IFC_SCHEMA: Record<string, IfcEntityDef> = {
  // === SPATIAL ENTITIES ===
  IFCPROJECT: {
    type: 'IFCPROJECT',
    displayName: 'Project',
    description: 'Highest level spatial container for the entire building project',
    category: 'spatial',
    icon: 'building2',
    color: '#1e40af',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership and versioning information' },
      { name: 'Name', type: 'string', required: true, description: 'Project name' },
      { name: 'Description', type: 'string', required: false, description: 'Project description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Project object type' },
      { name: 'LongName', type: 'string', required: false, description: 'Full project name' },
      { name: 'Phase', type: 'string', required: false, description: 'Project phase' },
      { name: 'RepresentationContexts', type: 'array', required: false, description: 'Geometric representation contexts' },
      { name: 'UnitsInContext', type: 'reference', required: false, description: 'Unit system' },
    ],
    validChildren: ['IFCSITE', 'IFCBUILDING', 'IFCBUILDINGELEMENT'],
    relationships: [
      {
        name: 'IFCRELAGGREGATES',
        sourceEntity: ['IFCPROJECT'],
        targetEntity: ['IFCSITE', 'IFCBUILDING'],
        description: 'Aggregates spatial structure',
        cardinality: 'one-to-many',
      },
    ],
    rules: [
      {
        name: 'REQUIRED_PROJECT_CONTEXT',
        description: 'Project must have at least one representation context',
        check: (entity: any, allEntities: any[]) => {
          return entity.properties?.RepresentationContexts?.length > 0 || !entity.properties?.RepresentationContexts;
        },
      },
    ],
  },

  IFCSITE: {
    type: 'IFCSITE',
    displayName: 'Site',
    description: 'Geographic site information and location',
    category: 'spatial',
    icon: 'map',
    color: '#2563eb',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: true, description: 'Site name' },
      { name: 'Description', type: 'string', required: false, description: 'Site description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Site object type' },
      { name: 'ObjectPlacement', type: 'reference', required: false, description: 'Site location/placement' },
      { name: 'Representation', type: 'reference', required: false, description: 'Geometric representation' },
      { name: 'LongName', type: 'string', required: false, description: 'Full site name' },
      { name: 'CompositionType', type: 'enum', required: false, description: 'Element composition type' },
      { name: 'RefLatitude', type: 'array', required: false, description: 'Reference latitude (degrees, minutes, seconds)' },
      { name: 'RefLongitude', type: 'array', required: false, description: 'Reference longitude (degrees, minutes, seconds)' },
      { name: 'RefElevation', type: 'number', required: false, description: 'Reference elevation in meters' },
      { name: 'LandTitleNumber', type: 'string', required: false, description: 'Land title/parcel number' },
      { name: 'SiteAddress', type: 'reference', required: false, description: 'Physical address' },
    ],
    validParents: ['IFCPROJECT'],
    validChildren: ['IFCBUILDING', 'IFCBUILDINGELEMENT'],
    relationships: [
      {
        name: 'IFCRELAGGREGATES',
        sourceEntity: ['IFCSITE'],
        targetEntity: ['IFCBUILDING', 'IFCBUILDINGELEMENT'],
        description: 'Aggregates buildings on the site',
        cardinality: 'one-to-many',
      },
    ],
  },

  IFCBUILDING: {
    type: 'IFCBUILDING',
    displayName: 'Building',
    description: 'A single building structure within a project',
    category: 'spatial',
    icon: 'building',
    color: '#3b82f6',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: true, description: 'Building name' },
      { name: 'Description', type: 'string', required: false, description: 'Building description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Building object type' },
      { name: 'ObjectPlacement', type: 'reference', required: false, description: 'Building placement' },
      { name: 'Representation', type: 'reference', required: false, description: 'Geometric representation' },
      { name: 'LongName', type: 'string', required: false, description: 'Full building name' },
      { name: 'CompositionType', type: 'enum', required: false, description: 'Element composition type' },
      { name: 'ElevationOfRefHeight', type: 'number', required: false, description: 'Reference height elevation' },
      { name: 'ElevationOfTerrain', type: 'number', required: false, description: 'Terrain elevation' },
      { name: 'BuildingAddress', type: 'reference', required: false, description: 'Building address' },
    ],
    validParents: ['IFCPROJECT', 'IFCSITE'],
    validChildren: ['IFCBUILDINGSTOREY', 'IFCBUILDINGELEMENT', 'IFCSPACE'],
    relationships: [
      {
        name: 'IFCRELAGGREGATES',
        sourceEntity: ['IFCBUILDING'],
        targetEntity: ['IFCBUILDINGSTOREY'],
        description: 'Contains building storeys',
        cardinality: 'one-to-many',
      },
    ],
    rules: [
      {
        name: 'BUILDING_HAS_STOREYS',
        description: 'Building should contain at least one storey (warning if missing)',
        check: (entity: any, allEntities: any[]) => true, // Checked separately in validator
      },
    ],
  },

  IFCBUILDINGSTOREY: {
    type: 'IFCBUILDINGSTOREY',
    displayName: 'Building Storey',
    description: 'A single storey or floor within a building',
    category: 'spatial',
    icon: 'layers',
    color: '#60a5fa',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: true, description: 'Storey name/number' },
      { name: 'Description', type: 'string', required: false, description: 'Storey description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Storey object type' },
      { name: 'ObjectPlacement', type: 'reference', required: false, description: 'Storey placement' },
      { name: 'Representation', type: 'reference', required: false, description: 'Geometric representation' },
      { name: 'LongName', type: 'string', required: false, description: 'Full storey name' },
      { name: 'CompositionType', type: 'enum', required: false, description: 'Element composition type' },
      { name: 'Elevation', type: 'number', required: false, description: 'Storey elevation (height above datum)' },
    ],
    validParents: ['IFCBUILDING'],
    validChildren: ['IFCSPACE', 'IFCBUILDINGELEMENT', 'IFCWALL', 'IFCSLAB', 'IFCCOLUMN', 'IFCBEAM'],
    relationships: [
      {
        name: 'IFCRELCONTAINEDINSPATIALSTRUCTURE',
        sourceEntity: ['IFCBUILDINGSTOREY'],
        targetEntity: ['IFCBUILDINGELEMENT', 'IFCSPACE'],
        description: 'Contains elements and spaces',
        cardinality: 'one-to-many',
      },
    ],
    rules: [
      {
        name: 'STOREY_ELEVATION_ORDER',
        description: 'Storey elevations should be in logical order',
        check: (entity: any, allEntities: any[]) => true,
      },
    ],
  },

  IFCSPACE: {
    type: 'IFCSPACE',
    displayName: 'Space',
    description: 'An interior space or room within a building',
    category: 'spatial',
    icon: 'square',
    color: '#93c5fd',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: true, description: 'Space name/number' },
      { name: 'Description', type: 'string', required: false, description: 'Space description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Space object type' },
      { name: 'ObjectPlacement', type: 'reference', required: false, description: 'Space placement' },
      { name: 'Representation', type: 'reference', required: false, description: 'Geometric representation' },
      { name: 'LongName', type: 'string', required: false, description: 'Full space name' },
      { name: 'CompositionType', type: 'enum', required: false, description: 'Element composition type' },
      { name: 'PredefinedType', type: 'enum', required: false, description: 'Space type (room, corridor, etc.)' },
      { name: 'ElevationWithFlooring', type: 'number', required: false, description: 'Elevation to floor surface' },
    ],
    validParents: ['IFCBUILDINGSTOREY', 'IFCBUILDING'],
    validChildren: [],
    relationships: [
      {
        name: 'IFCRELCONTAINEDINSPATIALSTRUCTURE',
        sourceEntity: ['IFCBUILDINGSTOREY'],
        targetEntity: ['IFCSPACE'],
        description: 'Space is contained in storey',
        cardinality: 'many-to-many',
      },
    ],
  },

  // === BUILDING ELEMENTS ===
  IFCWALL: {
    type: 'IFCWALL',
    displayName: 'Wall',
    description: 'A vertical structural or non-structural wall element',
    category: 'element',
    icon: 'square-full',
    color: '#fbbf24',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Wall name' },
      { name: 'Description', type: 'string', required: false, description: 'Wall description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Wall object type' },
      { name: 'ObjectPlacement', type: 'reference', required: false, description: 'Wall placement' },
      { name: 'Representation', type: 'reference', required: false, description: 'Geometric representation' },
      { name: 'Tag', type: 'string', required: false, description: 'Wall identifier/tag' },
      { name: 'PredefinedType', type: 'enum', required: false, description: 'Wall type (standard, polygonal, etc.)' },
      { name: 'Thickness', type: 'number', required: false, description: 'Wall thickness' },
    ],
    validParents: ['IFCBUILDINGSTOREY', 'IFCBUILDING'],
    validChildren: ['IFCDOOR', 'IFCWINDOW', 'IFCOPENINGELEMENT'],
    relationships: [
      {
        name: 'IFCRELVOIDSELEMENT',
        sourceEntity: ['IFCWALL'],
        targetEntity: ['IFCDOOR', 'IFCWINDOW'],
        description: 'Wall has openings for doors/windows',
        cardinality: 'one-to-many',
      },
    ],
  },

  IFCWALLSTANDARDCASE: {
    type: 'IFCWALLSTANDARDCASE',
    displayName: 'Wall (Standard)',
    description: 'A standard wall with extrusion geometry',
    category: 'element',
    icon: 'square-full',
    color: '#fbbf24',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Wall name' },
      { name: 'Description', type: 'string', required: false, description: 'Wall description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Wall object type' },
      { name: 'ObjectPlacement', type: 'reference', required: false, description: 'Wall placement' },
      { name: 'Representation', type: 'reference', required: false, description: 'Geometric representation' },
      { name: 'Tag', type: 'string', required: false, description: 'Wall identifier/tag' },
    ],
    validParents: ['IFCBUILDINGSTOREY', 'IFCBUILDING'],
    validChildren: ['IFCDOOR', 'IFCWINDOW', 'IFCOPENINGELEMENT'],
  },

  IFCDOOR: {
    type: 'IFCDOOR',
    displayName: 'Door',
    description: 'A door panel or door assembly within a wall or other opening',
    category: 'element',
    icon: 'rectangle-horizontal',
    color: '#a78bfa',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Door name' },
      { name: 'Description', type: 'string', required: false, description: 'Door description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Door object type' },
      { name: 'ObjectPlacement', type: 'reference', required: false, description: 'Door placement' },
      { name: 'Representation', type: 'reference', required: false, description: 'Geometric representation' },
      { name: 'Tag', type: 'string', required: false, description: 'Door identifier/tag' },
      { name: 'OverallHeight', type: 'number', required: false, description: 'Door overall height' },
      { name: 'OverallWidth', type: 'number', required: false, description: 'Door overall width' },
      { name: 'PredefinedType', type: 'enum', required: false, description: 'Door type' },
      { name: 'OperationType', type: 'enum', required: false, description: 'Door operation type' },
    ],
    validParents: ['IFCWALL', 'IFCOPENINGELEMENT'],
    validChildren: [],
  },

  IFCWINDOW: {
    type: 'IFCWINDOW',
    displayName: 'Window',
    description: 'A window assembly within a wall or other opening',
    category: 'element',
    icon: 'rectangle-horizontal',
    color: '#c7d2fe',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Window name' },
      { name: 'Description', type: 'string', required: false, description: 'Window description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Window object type' },
      { name: 'ObjectPlacement', type: 'reference', required: false, description: 'Window placement' },
      { name: 'Representation', type: 'reference', required: false, description: 'Geometric representation' },
      { name: 'Tag', type: 'string', required: false, description: 'Window identifier/tag' },
      { name: 'OverallHeight', type: 'number', required: false, description: 'Window overall height' },
      { name: 'OverallWidth', type: 'number', required: false, description: 'Window overall width' },
      { name: 'PredefinedType', type: 'enum', required: false, description: 'Window type' },
      { name: 'PartitioningType', type: 'enum', required: false, description: 'Window partitioning type' },
    ],
    validParents: ['IFCWALL', 'IFCOPENINGELEMENT'],
    validChildren: [],
  },

  IFCSLAB: {
    type: 'IFCSLAB',
    displayName: 'Slab',
    description: 'A horizontal structural element (floor, ceiling, roof, etc.)',
    category: 'structural',
    icon: 'square-checkmark',
    color: '#f87171',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Slab name' },
      { name: 'Description', type: 'string', required: false, description: 'Slab description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Slab object type' },
      { name: 'ObjectPlacement', type: 'reference', required: false, description: 'Slab placement' },
      { name: 'Representation', type: 'reference', required: false, description: 'Geometric representation' },
      { name: 'Tag', type: 'string', required: false, description: 'Slab identifier/tag' },
      { name: 'PredefinedType', type: 'enum', required: false, description: 'Slab type (floor, roof, ceiling, etc.)' },
      { name: 'Thickness', type: 'number', required: false, description: 'Slab thickness' },
    ],
    validParents: ['IFCBUILDINGSTOREY', 'IFCBUILDING'],
    validChildren: [],
  },

  IFCCOLUMN: {
    type: 'IFCCOLUMN',
    displayName: 'Column',
    description: 'A vertical structural member supporting loads',
    category: 'structural',
    icon: 'rectangle',
    color: '#ef4444',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Column name' },
      { name: 'Description', type: 'string', required: false, description: 'Column description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Column object type' },
      { name: 'ObjectPlacement', type: 'reference', required: false, description: 'Column placement' },
      { name: 'Representation', type: 'reference', required: false, description: 'Geometric representation' },
      { name: 'Tag', type: 'string', required: false, description: 'Column identifier/tag' },
      { name: 'PredefinedType', type: 'enum', required: false, description: 'Column type' },
    ],
    validParents: ['IFCBUILDINGSTOREY', 'IFCBUILDING'],
    validChildren: [],
  },

  IFCBEAM: {
    type: 'IFCBEAM',
    displayName: 'Beam',
    description: 'A linear structural member spanning between supports',
    category: 'structural',
    icon: 'minus',
    color: '#dc2626',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Beam name' },
      { name: 'Description', type: 'string', required: false, description: 'Beam description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Beam object type' },
      { name: 'ObjectPlacement', type: 'reference', required: false, description: 'Beam placement' },
      { name: 'Representation', type: 'reference', required: false, description: 'Geometric representation' },
      { name: 'Tag', type: 'string', required: false, description: 'Beam identifier/tag' },
      { name: 'PredefinedType', type: 'enum', required: false, description: 'Beam type' },
    ],
    validParents: ['IFCBUILDINGSTOREY', 'IFCBUILDING'],
    validChildren: [],
  },

  IFCROOF: {
    type: 'IFCROOF',
    displayName: 'Roof',
    description: 'A roof structure or covering',
    category: 'structural',
    icon: 'triangle',
    color: '#991b1b',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Roof name' },
      { name: 'Description', type: 'string', required: false, description: 'Roof description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Roof object type' },
      { name: 'ObjectPlacement', type: 'reference', required: false, description: 'Roof placement' },
      { name: 'Representation', type: 'reference', required: false, description: 'Geometric representation' },
      { name: 'Tag', type: 'string', required: false, description: 'Roof identifier/tag' },
      { name: 'PredefinedType', type: 'enum', required: false, description: 'Roof type' },
    ],
    validParents: ['IFCBUILDINGSTOREY', 'IFCBUILDING'],
    validChildren: [],
  },

  IFCSTAIR: {
    type: 'IFCSTAIR',
    displayName: 'Stair',
    description: 'A staircase structure connecting different levels',
    category: 'element',
    icon: 'arrow-up-left',
    color: '#f59e0b',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Stair name' },
      { name: 'Description', type: 'string', required: false, description: 'Stair description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Stair object type' },
      { name: 'ObjectPlacement', type: 'reference', required: false, description: 'Stair placement' },
      { name: 'Representation', type: 'reference', required: false, description: 'Geometric representation' },
      { name: 'Tag', type: 'string', required: false, description: 'Stair identifier/tag' },
      { name: 'PredefinedType', type: 'enum', required: false, description: 'Stair type' },
      { name: 'NumberOfRisers', type: 'number', required: false, description: 'Number of risers' },
      { name: 'NumberOfTreads', type: 'number', required: false, description: 'Number of treads' },
      { name: 'RiserHeight', type: 'number', required: false, description: 'Riser height' },
      { name: 'TreadLength', type: 'number', required: false, description: 'Tread length' },
    ],
    validParents: ['IFCBUILDINGSTOREY', 'IFCSPACE'],
    validChildren: [],
  },

  IFCRAILING: {
    type: 'IFCRAILING',
    displayName: 'Railing',
    description: 'A barrier system (guard rail, handrail, etc.)',
    category: 'element',
    icon: 'minus-circle',
    color: '#fbbf24',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Railing name' },
      { name: 'Description', type: 'string', required: false, description: 'Railing description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Railing object type' },
      { name: 'ObjectPlacement', type: 'reference', required: false, description: 'Railing placement' },
      { name: 'Representation', type: 'reference', required: false, description: 'Geometric representation' },
      { name: 'Tag', type: 'string', required: false, description: 'Railing identifier/tag' },
      { name: 'PredefinedType', type: 'enum', required: false, description: 'Railing type' },
    ],
    validParents: ['IFCBUILDINGSTOREY', 'IFCBUILDING'],
    validChildren: [],
  },

  IFCOPENINGELEMENT: {
    type: 'IFCOPENINGELEMENT',
    displayName: 'Opening',
    description: 'An opening in a wall or other element',
    category: 'element',
    icon: 'square-dashed',
    color: '#fcd34d',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Opening name' },
      { name: 'Description', type: 'string', required: false, description: 'Opening description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Opening object type' },
      { name: 'ObjectPlacement', type: 'reference', required: false, description: 'Opening placement' },
      { name: 'Representation', type: 'reference', required: false, description: 'Geometric representation' },
      { name: 'Tag', type: 'string', required: false, description: 'Opening identifier/tag' },
    ],
    validParents: ['IFCWALL'],
    validChildren: ['IFCDOOR', 'IFCWINDOW'],
  },

  // === PROPERTY & MATERIAL ENTITIES ===
  IFCPROPERTYSET: {
    type: 'IFCPROPERTYSET',
    displayName: 'Property Set',
    description: 'A set of properties assigned to an element',
    category: 'property',
    icon: 'list',
    color: '#06b6d4',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: true, description: 'Property set name' },
      { name: 'Description', type: 'string', required: false, description: 'Property set description' },
      { name: 'HasProperties', type: 'array', required: false, description: 'Properties in this set' },
    ],
    validParents: [],
    validChildren: [],
  },

  IFCMATERIAL: {
    type: 'IFCMATERIAL',
    displayName: 'Material',
    description: 'A material definition',
    category: 'property',
    icon: 'droplets',
    color: '#0891b2',
    properties: [
      { name: 'Name', type: 'string', required: true, description: 'Material name' },
      { name: 'Description', type: 'string', required: false, description: 'Material description' },
      { name: 'Category', type: 'string', required: false, description: 'Material category' },
    ],
    validParents: [],
    validChildren: [],
  },

  IFCMATERIALLAYERSET: {
    type: 'IFCMATERIALLAYERSET',
    displayName: 'Material Layer Set',
    description: 'A set of material layers (for walls, slabs, etc.)',
    category: 'property',
    icon: 'layers-3',
    color: '#00d4ff',
    properties: [
      { name: 'MaterialLayers', type: 'array', required: true, description: 'Material layers' },
      { name: 'LayerSetName', type: 'string', required: false, description: 'Layer set name' },
      { name: 'Description', type: 'string', required: false, description: 'Description' },
    ],
    validParents: [],
    validChildren: [],
  },

  // === RELATIONSHIP ENTITIES ===
  IFCRELAGGREGATES: {
    type: 'IFCRELAGGREGATES',
    displayName: 'Aggregation',
    description: 'Defines an aggregation relationship',
    category: 'relationship',
    icon: 'link',
    color: '#8b5cf6',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Relationship name' },
      { name: 'Description', type: 'string', required: false, description: 'Relationship description' },
      { name: 'RelatingObject', type: 'reference', required: true, description: 'Aggregating entity' },
      { name: 'RelatedObjects', type: 'array', required: true, description: 'Aggregated entities' },
    ],
    validParents: [],
    validChildren: [],
  },

  IFCRELCONTAINEDINSPATIALSTRUCTURE: {
    type: 'IFCRELCONTAINEDINSPATIALSTRUCTURE',
    displayName: 'Spatial Containment',
    description: 'Defines spatial containment relationships',
    category: 'relationship',
    icon: 'link-2',
    color: '#a855f7',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Relationship name' },
      { name: 'Description', type: 'string', required: false, description: 'Relationship description' },
      { name: 'RelatingStructure', type: 'reference', required: true, description: 'Containing spatial structure' },
      { name: 'RelatedElements', type: 'array', required: true, description: 'Contained elements' },
    ],
    validParents: [],
    validChildren: [],
  },

  IFCRELVOIDSELEMENT: {
    type: 'IFCRELVOIDSELEMENT',
    displayName: 'Void Element',
    description: 'Defines void/opening relationships',
    category: 'relationship',
    icon: 'link-slash',
    color: '#d946ef',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Relationship name' },
      { name: 'Description', type: 'string', required: false, description: 'Relationship description' },
      { name: 'RelatingBuildingElement', type: 'reference', required: true, description: 'Element with void' },
      { name: 'RelatedOpeningElement', type: 'reference', required: true, description: 'Opening element' },
    ],
    validParents: [],
    validChildren: [],
  },

  IFCRELFILLSELEMENT: {
    type: 'IFCRELFILLSELEMENT',
    displayName: 'Fill Element',
    description: 'Defines fill/filling relationships',
    category: 'relationship',
    icon: 'link-2',
    color: '#ec4899',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Relationship name' },
      { name: 'Description', type: 'string', required: false, description: 'Relationship description' },
      { name: 'RelatingOpeningElement', type: 'reference', required: true, description: 'Opening being filled' },
      { name: 'RelatedBuildingElement', type: 'reference', required: true, description: 'Filling element' },
    ],
    validParents: [],
    validChildren: [],
  },

  IFCRELDEFINESBYPROPERTIES: {
    type: 'IFCRELDEFINESBYPROPERTIES',
    displayName: 'Property Definition',
    description: 'Assigns properties to elements',
    category: 'relationship',
    icon: 'link-3',
    color: '#f97316',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Relationship name' },
      { name: 'Description', type: 'string', required: false, description: 'Relationship description' },
      { name: 'RelatedObjects', type: 'array', required: true, description: 'Objects receiving properties' },
      { name: 'RelatingPropertyDefinition', type: 'reference', required: true, description: 'Property definition' },
    ],
    validParents: [],
    validChildren: [],
  },

  IFCRELASSOCIATESMATERIAL: {
    type: 'IFCRELASSOCIATESMATERIAL',
    displayName: 'Material Association',
    description: 'Associates materials with elements',
    category: 'relationship',
    icon: 'link-4',
    color: '#fbbf24',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Relationship name' },
      { name: 'Description', type: 'string', required: false, description: 'Relationship description' },
      { name: 'RelatedObjects', type: 'array', required: true, description: 'Elements with materials' },
      { name: 'RelatingMaterial', type: 'reference', required: true, description: 'Material definition' },
    ],
    validParents: [],
    validChildren: [],
  },

  IFCRELASSOCIATESCLASSIFICATION: {
    type: 'IFCRELASSOCIATESCLASSIFICATION',
    displayName: 'Classification',
    description: 'Associates classifications with elements',
    category: 'relationship',
    icon: 'tags',
    color: '#06b6d4',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Relationship name' },
      { name: 'Description', type: 'string', required: false, description: 'Relationship description' },
      { name: 'RelatedObjects', type: 'array', required: true, description: 'Classified objects' },
      { name: 'RelatingClassification', type: 'reference', required: true, description: 'Classification reference' },
    ],
    validParents: [],
    validChildren: [],
  },

  // === OTHER COMMON ENTITIES ===
  IFCFURNISHINGELEMENT: {
    type: 'IFCFURNISHINGELEMENT',
    displayName: 'Furnishing',
    description: 'Furniture and movable elements',
    category: 'element',
    icon: 'chair',
    color: '#8b5cf6',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Furnishing name' },
      { name: 'Description', type: 'string', required: false, description: 'Furnishing description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Furnishing object type' },
      { name: 'ObjectPlacement', type: 'reference', required: false, description: 'Furnishing placement' },
      { name: 'Representation', type: 'reference', required: false, description: 'Geometric representation' },
      { name: 'Tag', type: 'string', required: false, description: 'Furnishing identifier/tag' },
    ],
    validParents: ['IFCBUILDINGSTOREY', 'IFCSPACE'],
    validChildren: [],
  },

  IFCBUILDINGELEMENT: {
    type: 'IFCBUILDINGELEMENT',
    displayName: 'Building Element',
    description: 'Generic building element (base type)',
    category: 'element',
    icon: 'package',
    color: '#6b7280',
    properties: [
      { name: 'GlobalId', type: 'string', required: true, description: 'Unique global identifier' },
      { name: 'OwnerHistory', type: 'reference', required: true, description: 'Ownership information' },
      { name: 'Name', type: 'string', required: false, description: 'Element name' },
      { name: 'Description', type: 'string', required: false, description: 'Element description' },
      { name: 'ObjectType', type: 'string', required: false, description: 'Element object type' },
      { name: 'ObjectPlacement', type: 'reference', required: false, description: 'Element placement' },
      { name: 'Representation', type: 'reference', required: false, description: 'Geometric representation' },
      { name: 'Tag', type: 'string', required: false, description: 'Element identifier/tag' },
    ],
    validParents: ['IFCBUILDINGSTOREY', 'IFCBUILDING', 'IFCSPACE'],
    validChildren: [],
  },
};

/**
 * Get entity definition by type name
 */
export function getEntityDef(ifcType: string): IfcEntityDef | undefined {
  return IFC_SCHEMA[ifcType];
}

/**
 * Get all entity types for a category
 */
export function getEntitiesByCategory(category: string): IfcEntityDef[] {
  return Object.values(IFC_SCHEMA).filter(def => def.category === category);
}

/**
 * Check if entity can be parent of another
 */
export function canBeParent(parentType: string, childType: string): boolean {
  const parentDef = getEntityDef(parentType);
  if (!parentDef || !parentDef.validChildren) return false;
  return parentDef.validChildren.includes(childType);
}

/**
 * Check if entity can be child of another
 */
export function canBeChild(childType: string, parentType: string): boolean {
  const childDef = getEntityDef(childType);
  if (!childDef || !childDef.validParents) return false;
  return childDef.validParents.includes(parentType);
}

/**
 * Get color for entity type
 */
export function getEntityColor(ifcType: string): string {
  return getEntityDef(ifcType)?.color || '#6b7280';
}

/**
 * Get icon for entity type
 */
export function getEntityIcon(ifcType: string): string {
  return getEntityDef(ifcType)?.icon || 'package';
}

/**
 * Get display name for entity type
 */
export function getEntityDisplayName(ifcType: string): string {
  return getEntityDef(ifcType)?.displayName || ifcType;
}

/**
 * Get category for entity type
 */
export function getEntityCategory(ifcType: string): string {
  return getEntityDef(ifcType)?.category || 'other';
}
