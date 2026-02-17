/**
 * IFC Schema Definitions for Educational Display
 * Based on BuildingSMART IFC specifications (IFC2x3, IFC4, IFC4.3, IFC5)
 * 
 * This provides human-readable explanations, property definitions,
 * inheritance hierarchies, and links to official documentation.
 */

import { generateDocsUrl } from '@/lib/docsLinkGenerator';

export interface IFCPropertyDefinition {
  name: string;
  description: string;
  dataType: string;
  isRequired: boolean;
  example?: string;
}

export interface IFCPropertySetDefinition {
  name: string;
  description: string;
  applicableEntities: string[];
  properties: IFCPropertyDefinition[];
}

export interface IFCEntityDefinition {
  type: string;
  displayName: string;
  description: string;
  category: 'spatial' | 'element' | 'relationship' | 'property' | 'resource' | 'context';
  inheritance: string[];
  introducedIn: string;
  deprecatedIn?: string;
  icon: string;
  properties: IFCPropertyDefinition[];
  relatedPropertySets: string[];
  usageNotes?: string;
  examples?: string[];
}

// Standard IFC entity definitions
export const IFC_ENTITY_DEFINITIONS: Record<string, IFCEntityDefinition> = {
  // ===== CONTEXT ENTITIES =====
  IFCPROJECT: {
    type: 'IFCPROJECT',
    displayName: 'Project',
    description: 'The root element of the IFC hierarchy. Represents the overall context for all building information, including units, coordinate systems, and global project metadata.',
    category: 'context',
    inheritance: ['IfcContext', 'IfcObjectDefinition', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'FolderKanban',
    properties: [
      { name: 'GlobalId', description: 'Unique 22-character identifier (GUID)', dataType: 'IfcGloballyUniqueId', isRequired: true, example: '0YvctVUKr0kugbFTf53O9L' },
      { name: 'Name', description: 'Human-readable project name', dataType: 'IfcLabel', isRequired: false, example: 'Office Building Project' },
      { name: 'Description', description: 'Detailed project description', dataType: 'IfcText', isRequired: false },
      { name: 'LongName', description: 'Extended name for the project', dataType: 'IfcLabel', isRequired: false },
      { name: 'Phase', description: 'Current project phase', dataType: 'IfcLabel', isRequired: false, example: 'Design Development' },
    ],
    relatedPropertySets: ['Pset_ProjectCommon'],
    usageNotes: 'Every IFC file must have exactly one IfcProject. It serves as the container for all spatial and element hierarchies.',
    examples: ['New construction project', 'Renovation project', 'Infrastructure project'],
  },

  // ===== SPATIAL STRUCTURE =====
  IFCSITE: {
    type: 'IFCSITE',
    displayName: 'Site',
    description: 'Represents the land on which the building is located. Contains geographic coordinates, address, and terrain information.',
    category: 'spatial',
    inheritance: ['IfcSpatialStructureElement', 'IfcSpatialElement', 'IfcProduct', 'IfcObject', 'IfcObjectDefinition', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'MapPin',
    properties: [
      { name: 'Name', description: 'Site name or identifier', dataType: 'IfcLabel', isRequired: false },
      { name: 'RefLatitude', description: 'WGS84 latitude in degrees, minutes, seconds', dataType: 'IfcCompoundPlaneAngleMeasure', isRequired: false, example: '(51, 30, 0)' },
      { name: 'RefLongitude', description: 'WGS84 longitude in degrees, minutes, seconds', dataType: 'IfcCompoundPlaneAngleMeasure', isRequired: false },
      { name: 'RefElevation', description: 'Height above sea level at reference point', dataType: 'IfcLengthMeasure', isRequired: false },
      { name: 'SiteAddress', description: 'Postal address of the site', dataType: 'IfcPostalAddress', isRequired: false },
    ],
    relatedPropertySets: ['Pset_SiteCommon', 'Pset_Address'],
    usageNotes: 'The site aggregates buildings and can contain site-specific elements like roads, landscaping, and utilities.',
    examples: ['Urban construction site', 'Suburban residential lot', 'Industrial campus', 'Infrastructure corridor'],
  },

  IFCBUILDING: {
    type: 'IFCBUILDING',
    displayName: 'Building',
    description: 'A structure with a roof and walls, permanently constructed for habitation or use. Contains storeys and building-wide systems.',
    category: 'spatial',
    inheritance: ['IfcSpatialStructureElement', 'IfcSpatialElement', 'IfcProduct', 'IfcObject', 'IfcObjectDefinition', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'Building2',
    properties: [
      { name: 'Name', description: 'Building name or number', dataType: 'IfcLabel', isRequired: false, example: 'Building A' },
      { name: 'ElevationOfRefHeight', description: 'Elevation above sea level at reference height', dataType: 'IfcLengthMeasure', isRequired: false },
      { name: 'ElevationOfTerrain', description: 'Elevation of terrain at building location', dataType: 'IfcLengthMeasure', isRequired: false },
      { name: 'BuildingAddress', description: 'Postal address of the building', dataType: 'IfcPostalAddress', isRequired: false },
    ],
    relatedPropertySets: ['Pset_BuildingCommon', 'Pset_BuildingUse'],
    usageNotes: 'Buildings are decomposed into storeys via IFCRELAGGREGATES. Building services may span multiple storeys.',
    examples: ['Office building', 'Apartment complex', 'Warehouse', 'Mixed-use development', 'School building'],
  },

  IFCBUILDINGSTOREY: {
    type: 'IFCBUILDINGSTOREY',
    displayName: 'Building Storey',
    description: 'A horizontal level within a building, typically containing rooms and building elements at a common elevation.',
    category: 'spatial',
    inheritance: ['IfcSpatialStructureElement', 'IfcSpatialElement', 'IfcProduct', 'IfcObject', 'IfcObjectDefinition', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'Layers',
    properties: [
      { name: 'Name', description: 'Storey name or level designation', dataType: 'IfcLabel', isRequired: false, example: 'Level 1', },
      { name: 'Elevation', description: 'Height of storey relative to building origin', dataType: 'IfcLengthMeasure', isRequired: false, example: '3000 (mm)' },
    ],
    relatedPropertySets: ['Pset_BuildingStoreyCommon'],
    usageNotes: 'Elements are assigned to storeys via IFCRELCONTAINEDINSPATIALSTRUCTURE. Elevation is typically measured from ground level.',
    examples: ['Ground floor', 'First floor', 'Basement level', 'Mezzanine', 'Roof level'],
  },

  IFCSPACE: {
    type: 'IFCSPACE',
    displayName: 'Space',
    description: 'An area or volume bounded by building elements. Represents rooms, corridors, and other functional areas within a building.',
    category: 'spatial',
    inheritance: ['IfcSpatialStructureElement', 'IfcSpatialElement', 'IfcProduct', 'IfcObject', 'IfcObjectDefinition', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'Square',
    properties: [
      { name: 'Name', description: 'Space name or room number', dataType: 'IfcLabel', isRequired: false, example: 'Room 101' },
      { name: 'LongName', description: 'Full descriptive name', dataType: 'IfcLabel', isRequired: false, example: 'Conference Room A' },
      { name: 'PredefinedType', description: 'Space type classification', dataType: 'IfcSpaceTypeEnum', isRequired: false, example: 'INTERNAL' },
    ],
    relatedPropertySets: ['Pset_SpaceCommon', 'Pset_SpaceOccupancyRequirements', 'Pset_SpaceThermalRequirements'],
    usageNotes: 'Spaces are used for area calculations, thermal analysis, and facility management. They can contain furniture and equipment.',
    examples: ['Office room', 'Meeting room', 'Corridor', 'Bathroom', 'Lobby', 'Storage room'],
  },

  // ===== BUILDING ELEMENTS =====
  IFCWALL: {
    type: 'IFCWALL',
    displayName: 'Wall',
    description: 'A vertical building element that encloses or divides spaces. Can be load-bearing or non-load-bearing, interior or exterior.',
    category: 'element',
    inheritance: ['IfcBuildingElement', 'IfcElement', 'IfcProduct', 'IfcObject', 'IfcObjectDefinition', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'Square',
    properties: [
      { name: 'Name', description: 'Wall identifier or name', dataType: 'IfcLabel', isRequired: false },
      { name: 'PredefinedType', description: 'Wall type classification', dataType: 'IfcWallTypeEnum', isRequired: false, example: 'STANDARD, PARTITIONING, SHEAR' },
    ],
    relatedPropertySets: ['Pset_WallCommon', 'Qto_WallBaseQuantities'],
    usageNotes: 'Walls can have openings (voids) for doors and windows via IFCRELVOIDSELEMENT. Material layers are defined through IFCRELASSOCIATESMATERIAL.',
    examples: ['Exterior wall', 'Interior partition', 'Curtain wall'],
  },

  IFCWALLSTANDARDCASE: {
    type: 'IFCWALLSTANDARDCASE',
    displayName: 'Standard Wall',
    description: 'A wall with constant thickness and vertical extrusion. Simplified representation for common wall types.',
    category: 'element',
    inheritance: ['IfcWall', 'IfcBuildingElement', 'IfcElement', 'IfcProduct', 'IfcObject', 'IfcObjectDefinition', 'IfcRoot'],
    introducedIn: 'IFC2x',
    deprecatedIn: 'IFC4',
    icon: 'Square',
    properties: [
      { name: 'Name', description: 'Wall identifier', dataType: 'IfcLabel', isRequired: false },
    ],
    relatedPropertySets: ['Pset_WallCommon'],
    usageNotes: 'Deprecated in IFC4. Use IfcWall with PredefinedType=STANDARD instead.',
    examples: ['Straight vertical wall', 'Simple partition wall'],
  },

  IFCDOOR: {
    type: 'IFCDOOR',
    displayName: 'Door',
    description: 'A building element that provides access through an opening in a wall. Includes the door panel, frame, and hardware.',
    category: 'element',
    inheritance: ['IfcBuildingElement', 'IfcElement', 'IfcProduct', 'IfcObject', 'IfcObjectDefinition', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'DoorOpen',
    properties: [
      { name: 'Name', description: 'Door identifier', dataType: 'IfcLabel', isRequired: false },
      { name: 'OverallHeight', description: 'Total height including frame', dataType: 'IfcPositiveLengthMeasure', isRequired: false, example: '2100 mm' },
      { name: 'OverallWidth', description: 'Total width including frame', dataType: 'IfcPositiveLengthMeasure', isRequired: false, example: '900 mm' },
      { name: 'PredefinedType', description: 'Door operation type', dataType: 'IfcDoorTypeEnum', isRequired: false, example: 'DOOR, GATE, TRAPDOOR' },
      { name: 'OperationType', description: 'How the door operates', dataType: 'IfcDoorTypeOperationEnum', isRequired: false, example: 'SINGLE_SWING_LEFT' },
    ],
    relatedPropertySets: ['Pset_DoorCommon', 'Pset_DoorWindowGlazingType'],
    usageNotes: 'Doors fill openings in walls created by IFCOPENINGELEMENT. Connected via IFCRELFILLSELEMENT.',
    examples: ['Single swing door', 'Double door', 'Sliding door', 'Revolving door'],
  },

  IFCWINDOW: {
    type: 'IFCWINDOW',
    displayName: 'Window',
    description: 'A building element that provides light and/or ventilation through an opening in a wall. Includes glazing, frame, and sash.',
    category: 'element',
    inheritance: ['IfcBuildingElement', 'IfcElement', 'IfcProduct', 'IfcObject', 'IfcObjectDefinition', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'Square',
    properties: [
      { name: 'Name', description: 'Window identifier', dataType: 'IfcLabel', isRequired: false },
      { name: 'OverallHeight', description: 'Total height including frame', dataType: 'IfcPositiveLengthMeasure', isRequired: false, example: '1500 mm' },
      { name: 'OverallWidth', description: 'Total width including frame', dataType: 'IfcPositiveLengthMeasure', isRequired: false, example: '1200 mm' },
      { name: 'PredefinedType', description: 'Window type classification', dataType: 'IfcWindowTypeEnum', isRequired: false, example: 'WINDOW, SKYLIGHT' },
      { name: 'PartitioningType', description: 'Window panel arrangement', dataType: 'IfcWindowTypePartitioningEnum', isRequired: false, example: 'SINGLE_PANEL, DOUBLE_PANEL' },
    ],
    relatedPropertySets: ['Pset_WindowCommon', 'Pset_DoorWindowGlazingType'],
    usageNotes: 'Windows fill openings in walls. Thermal properties like U-value are defined in Pset_WindowCommon.',
    examples: ['Fixed window', 'Casement window', 'Sliding window', 'Skylight'],
  },

  IFCSLAB: {
    type: 'IFCSLAB',
    displayName: 'Slab',
    description: 'A horizontal building element that forms floors, roofs, or landings. Can be structural or non-structural.',
    category: 'element',
    inheritance: ['IfcBuildingElement', 'IfcElement', 'IfcProduct', 'IfcObject', 'IfcObjectDefinition', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'Minus',
    properties: [
      { name: 'Name', description: 'Slab identifier', dataType: 'IfcLabel', isRequired: false },
      { name: 'PredefinedType', description: 'Slab type classification', dataType: 'IfcSlabTypeEnum', isRequired: false, example: 'FLOOR, ROOF, LANDING, BASESLAB' },
    ],
    relatedPropertySets: ['Pset_SlabCommon', 'Qto_SlabBaseQuantities'],
    usageNotes: 'Slabs often contain openings for stairs and shafts. Floor slabs typically span between beams or walls.',
    examples: ['Ground floor slab', 'Suspended floor', 'Roof slab', 'Stair landing'],
  },

  IFCCOLUMN: {
    type: 'IFCCOLUMN',
    displayName: 'Column',
    description: 'A vertical structural member that transfers loads from the structure above. Typically has a uniform cross-section.',
    category: 'element',
    inheritance: ['IfcBuildingElement', 'IfcElement', 'IfcProduct', 'IfcObject', 'IfcObjectDefinition', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'Pilcrow',
    properties: [
      { name: 'Name', description: 'Column identifier', dataType: 'IfcLabel', isRequired: false },
      { name: 'PredefinedType', description: 'Column type', dataType: 'IfcColumnTypeEnum', isRequired: false, example: 'COLUMN, PILASTER' },
    ],
    relatedPropertySets: ['Pset_ColumnCommon', 'Pset_ConcreteElementGeneral'],
    usageNotes: 'Columns are typically part of the structural frame. Cross-section is defined by the profile.',
    examples: ['Reinforced concrete column', 'Steel I-section column', 'Square concrete pillar', 'Circular column'],
  },

  IFCBEAM: {
    type: 'IFCBEAM',
    displayName: 'Beam',
    description: 'A horizontal or inclined structural member that spans between supports. Transfers loads to columns or walls.',
    category: 'element',
    inheritance: ['IfcBuildingElement', 'IfcElement', 'IfcProduct', 'IfcObject', 'IfcObjectDefinition', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'Minus',
    properties: [
      { name: 'Name', description: 'Beam identifier', dataType: 'IfcLabel', isRequired: false },
      { name: 'PredefinedType', description: 'Beam type', dataType: 'IfcBeamTypeEnum', isRequired: false, example: 'BEAM, JOIST, LINTEL, T_BEAM' },
    ],
    relatedPropertySets: ['Pset_BeamCommon', 'Pset_ConcreteElementGeneral'],
    usageNotes: 'Beams support slabs and transfer loads to columns. Profile defines the cross-sectional shape.',
    examples: ['Steel I-beam', 'Reinforced concrete beam', 'Timber joist', 'Lintel above window', 'T-beam'],
  },

  IFCROOF: {
    type: 'IFCROOF',
    displayName: 'Roof',
    description: 'The covering element at the top of a building. Can be composed of multiple slabs and roof structures.',
    category: 'element',
    inheritance: ['IfcBuildingElement', 'IfcElement', 'IfcProduct', 'IfcObject', 'IfcObjectDefinition', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'Home',
    properties: [
      { name: 'Name', description: 'Roof identifier', dataType: 'IfcLabel', isRequired: false },
      { name: 'PredefinedType', description: 'Roof shape type', dataType: 'IfcRoofTypeEnum', isRequired: false, example: 'FLAT_ROOF, GABLE_ROOF, HIP_ROOF' },
    ],
    relatedPropertySets: ['Pset_RoofCommon'],
    usageNotes: 'A roof may aggregate multiple slabs representing different roof surfaces.',
    examples: ['Pitched gable roof', 'Flat roof', 'Hip roof', 'Mansard roof', 'Green roof'],
  },

  IFCOPENINGELEMENT: {
    type: 'IFCOPENINGELEMENT',
    displayName: 'Opening',
    description: 'A void in a building element, typically for doors or windows. The opening is filled by another element.',
    category: 'element',
    inheritance: ['IfcFeatureElementSubtraction', 'IfcFeatureElement', 'IfcElement', 'IfcProduct', 'IfcObject', 'IfcObjectDefinition', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'SquareDashed',
    properties: [
      { name: 'Name', description: 'Opening identifier', dataType: 'IfcLabel', isRequired: false },
      { name: 'PredefinedType', description: 'Opening type', dataType: 'IfcOpeningElementTypeEnum', isRequired: false, example: 'OPENING, RECESS' },
    ],
    relatedPropertySets: [],
    usageNotes: 'Connected to walls via IFCRELVOIDSELEMENT. Doors/windows fill openings via IFCRELFILLSELEMENT.',
    examples: ['Door opening in wall', 'Window opening', 'Service penetration', 'Shaft opening in slab'],
  },

  IFCSTAIR: {
    type: 'IFCSTAIR',
    displayName: 'Stair',
    description: 'A vertical circulation element consisting of flights and landings for moving between floor levels.',
    category: 'element',
    inheritance: ['IfcBuildingElement', 'IfcElement', 'IfcProduct', 'IfcObject', 'IfcObjectDefinition', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'ArrowUpFromLine',
    properties: [
      { name: 'Name', description: 'Stair identifier', dataType: 'IfcLabel', isRequired: false },
      { name: 'PredefinedType', description: 'Stair configuration type', dataType: 'IfcStairTypeEnum', isRequired: false, example: 'STRAIGHT_RUN, SPIRAL, CURVED' },
    ],
    relatedPropertySets: ['Pset_StairCommon'],
    usageNotes: 'A stair aggregates stair flights and landings via IFCRELAGGREGATES.',
    examples: ['Straight run stair', 'L-shaped stair with landing', 'Spiral staircase', 'U-shaped stair', 'Curved stair'],
  },

  // ===== RELATIONSHIP ENTITIES =====
  IFCRELAGGREGATES: {
    type: 'IFCRELAGGREGATES',
    displayName: 'Aggregates Relationship',
    description: 'Defines a decomposition relationship where one object is composed of several parts. Used for spatial hierarchy (Project→Site→Building→Storey).',
    category: 'relationship',
    inheritance: ['IfcRelDecomposes', 'IfcRelationship', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'GitBranch',
    properties: [
      { name: 'RelatingObject', description: 'The parent/container object', dataType: 'IfcObjectDefinition', isRequired: true },
      { name: 'RelatedObjects', description: 'The child/component objects', dataType: 'SET OF IfcObjectDefinition', isRequired: true },
    ],
    relatedPropertySets: [],
    usageNotes: 'Creates the primary spatial hierarchy. A building aggregates storeys; a storey aggregates spaces.',
    examples: ['Building contains Storeys', 'Storey contains Spaces', 'Stair contains Flights and Landings'],
  },

  IFCRELCONTAINEDINSPATIALSTRUCTURE: {
    type: 'IFCRELCONTAINEDINSPATIALSTRUCTURE',
    displayName: 'Contained In Spatial Structure',
    description: 'Assigns building elements to a spatial container (storey or space). Elements are "contained in" their spatial context.',
    category: 'relationship',
    inheritance: ['IfcRelConnects', 'IfcRelationship', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'FolderInput',
    properties: [
      { name: 'RelatingStructure', description: 'The spatial container (storey, space)', dataType: 'IfcSpatialStructureElement', isRequired: true },
      { name: 'RelatedElements', description: 'Elements contained in the spatial structure', dataType: 'SET OF IfcProduct', isRequired: true },
    ],
    relatedPropertySets: [],
    usageNotes: 'Different from aggregation - elements are placed IN a space, not decomposed FROM it.',
    examples: ['Walls contained in Storey', 'Furniture contained in Space'],
  },

  IFCRELDEFINESBYPROPERTIES: {
    type: 'IFCRELDEFINESBYPROPERTIES',
    displayName: 'Defines By Properties',
    description: 'Links objects to their property sets. This is how custom properties and quantities are attached to elements.',
    category: 'relationship',
    inheritance: ['IfcRelDefines', 'IfcRelationship', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'FileText',
    properties: [
      { name: 'RelatingPropertyDefinition', description: 'The property set or quantity set', dataType: 'IfcPropertySetDefinitionSelect', isRequired: true },
      { name: 'RelatedObjects', description: 'Objects that have these properties', dataType: 'SET OF IfcObjectDefinition', isRequired: true },
    ],
    relatedPropertySets: [],
    usageNotes: 'Multiple property sets can be attached to one element. Standard Psets follow BuildingSMART naming conventions.',
    examples: ['Wall has Pset_WallCommon', 'Door has Pset_DoorCommon'],
  },

  IFCRELASSOCIATESMATERIAL: {
    type: 'IFCRELASSOCIATESMATERIAL',
    displayName: 'Associates Material',
    description: 'Assigns material information to building elements. Links elements to single materials, material layers, or material constituents.',
    category: 'relationship',
    inheritance: ['IfcRelAssociates', 'IfcRelationship', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'Layers',
    properties: [
      { name: 'RelatingMaterial', description: 'The material or material set', dataType: 'IfcMaterialSelect', isRequired: true },
      { name: 'RelatedObjects', description: 'Objects that use this material', dataType: 'SET OF IfcDefinitionSelect', isRequired: true },
    ],
    relatedPropertySets: [],
    usageNotes: 'Walls typically use IfcMaterialLayerSet; profiles use IfcMaterialProfileSet.',
    examples: ['Wall has concrete material layer', 'Column has steel material'],
  },

  IFCRELVOIDSELEMENT: {
    type: 'IFCRELVOIDSELEMENT',
    displayName: 'Voids Element',
    description: 'Creates an opening (void) in a building element. The opening subtracts geometry from the host element.',
    category: 'relationship',
    inheritance: ['IfcRelDecomposes', 'IfcRelationship', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'SquareDashed',
    properties: [
      { name: 'RelatingBuildingElement', description: 'Element with the void (wall)', dataType: 'IfcElement', isRequired: true },
      { name: 'RelatedOpeningElement', description: 'The opening element', dataType: 'IfcFeatureElementSubtraction', isRequired: true },
    ],
    relatedPropertySets: [],
    usageNotes: 'The opening is then filled by a door/window via IFCRELFILLSELEMENT.',
    examples: ['Wall voids for door opening', 'Slab void for shaft'],
  },

  IFCRELFILLSELEMENT: {
    type: 'IFCRELFILLSELEMENT',
    displayName: 'Fills Element',
    description: 'Places a building element (door, window) into an opening. Completes the void/fill cycle for insertions.',
    category: 'relationship',
    inheritance: ['IfcRelConnects', 'IfcRelationship', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'SquareCheck',
    properties: [
      { name: 'RelatingOpeningElement', description: 'The opening to be filled', dataType: 'IfcOpeningElement', isRequired: true },
      { name: 'RelatedBuildingElement', description: 'Element that fills the opening (door/window)', dataType: 'IfcElement', isRequired: true },
    ],
    relatedPropertySets: [],
    usageNotes: 'Used in combination with IFCRELVOIDSELEMENT to insert doors and windows.',
    examples: ['Door fills wall opening', 'Window fills wall opening'],
  },

  IFCRELDEFINESBYTYPE: {
    type: 'IFCRELDEFINESBYTYPE',
    displayName: 'Defines By Type',
    description: 'Links element occurrences to their type definition. Types provide shared properties and geometry for multiple instances.',
    category: 'relationship',
    inheritance: ['IfcRelDefines', 'IfcRelationship', 'IfcRoot'],
    introducedIn: 'IFC2x3',
    icon: 'Copy',
    properties: [
      { name: 'RelatingType', description: 'The type object', dataType: 'IfcTypeObject', isRequired: true },
      { name: 'RelatedObjects', description: 'Objects of this type', dataType: 'SET OF IfcObject', isRequired: true },
    ],
    relatedPropertySets: [],
    usageNotes: 'Type definitions allow reuse - change the type and all instances update.',
    examples: ['Multiple doors of DoorType_A', 'Windows sharing WindowType_Standard'],
  },

  // ===== PROPERTY ENTITIES =====
  IFCPROPERTYSET: {
    type: 'IFCPROPERTYSET',
    displayName: 'Property Set',
    description: 'A container for related properties. Groups properties that describe aspects of an element (e.g., Pset_WallCommon).',
    category: 'property',
    inheritance: ['IfcPropertySetDefinition', 'IfcPropertyDefinition', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'List',
    properties: [
      { name: 'Name', description: 'Property set name (e.g., Pset_WallCommon)', dataType: 'IfcLabel', isRequired: true },
      { name: 'HasProperties', description: 'The properties in this set', dataType: 'SET OF IfcProperty', isRequired: true },
    ],
    relatedPropertySets: [],
    usageNotes: 'Standard property sets start with "Pset_". Custom sets should use project-specific prefixes.',
    examples: ['Pset_WallCommon', 'Pset_DoorCommon', 'CPset_CustomProperty'],
  },

  IFCPROPERTYSINGLEVALUE: {
    type: 'IFCPROPERTYSINGLEVALUE',
    displayName: 'Single Value Property',
    description: 'A property with a single value. The most common property type in IFC for simple attributes.',
    category: 'property',
    inheritance: ['IfcSimpleProperty', 'IfcProperty'],
    introducedIn: 'IFC2x',
    icon: 'Hash',
    properties: [
      { name: 'Name', description: 'Property name', dataType: 'IfcIdentifier', isRequired: true, example: 'IsExternal' },
      { name: 'NominalValue', description: 'The property value', dataType: 'IfcValue', isRequired: false, example: 'TRUE' },
      { name: 'Unit', description: 'Unit of measurement (if applicable)', dataType: 'IfcUnit', isRequired: false },
    ],
    relatedPropertySets: [],
    usageNotes: 'NominalValue can be any IFC value type: IfcBoolean, IfcReal, IfcText, IfcInteger, etc.',
    examples: ['IsExternal = TRUE', 'FireRating = "2 Hours"', 'ThermalTransmittance = 0.35'],
  },

  IFCELEMENTQUANTITY: {
    type: 'IFCELEMENTQUANTITY',
    displayName: 'Element Quantity',
    description: 'A set of quantity values for an element. Used for quantity take-off and cost estimation.',
    category: 'property',
    inheritance: ['IfcQuantitySet', 'IfcPropertySetDefinition', 'IfcPropertyDefinition', 'IfcRoot'],
    introducedIn: 'IFC2x',
    icon: 'Calculator',
    properties: [
      { name: 'Name', description: 'Quantity set name', dataType: 'IfcLabel', isRequired: true, example: 'Qto_WallBaseQuantities' },
      { name: 'MethodOfMeasurement', description: 'Measurement method reference', dataType: 'IfcLabel', isRequired: false },
      { name: 'Quantities', description: 'Individual quantity values', dataType: 'SET OF IfcPhysicalQuantity', isRequired: true },
    ],
    relatedPropertySets: [],
    usageNotes: 'Standard quantity sets start with "Qto_". Contains length, area, volume, count, weight, or time.',
    examples: ['Qto_WallBaseQuantities (Length, Height, GrossArea)', 'Qto_SlabBaseQuantities (GrossArea, GrossVolume)'],
  },

  // ===== RESOURCE ENTITIES =====
  IFCMATERIAL: {
    type: 'IFCMATERIAL',
    displayName: 'Material',
    description: 'A homogeneous substance that can be applied to building elements. Base material without layer structure.',
    category: 'resource',
    inheritance: ['IfcMaterialDefinition'],
    introducedIn: 'IFC2x',
    icon: 'Circle',
    properties: [
      { name: 'Name', description: 'Material name', dataType: 'IfcLabel', isRequired: true, example: 'Concrete' },
      { name: 'Description', description: 'Material description', dataType: 'IfcText', isRequired: false },
      { name: 'Category', description: 'Material category', dataType: 'IfcLabel', isRequired: false, example: 'concrete, steel, wood' },
    ],
    relatedPropertySets: ['Pset_MaterialCommon', 'Pset_MaterialConcrete', 'Pset_MaterialSteel'],
    usageNotes: 'Materials can have properties for thermal, structural, and appearance characteristics.',
    examples: ['Concrete C30/37', 'Steel S355', 'Oak Wood'],
  },

  IFCMATERIALLAYER: {
    type: 'IFCMATERIALLAYER',
    displayName: 'Material Layer',
    description: 'A single layer within a layered material composition. Defines material and thickness.',
    category: 'resource',
    inheritance: ['IfcMaterialDefinition'],
    introducedIn: 'IFC2x',
    icon: 'Layers',
    properties: [
      { name: 'Material', description: 'The layer material', dataType: 'IfcMaterial', isRequired: false },
      { name: 'LayerThickness', description: 'Thickness of the layer', dataType: 'IfcNonNegativeLengthMeasure', isRequired: true, example: '200 mm' },
      { name: 'IsVentilated', description: 'Whether the layer is ventilated', dataType: 'IfcLogical', isRequired: false },
      { name: 'Name', description: 'Layer name', dataType: 'IfcLabel', isRequired: false },
    ],
    relatedPropertySets: [],
    usageNotes: 'Used in IfcMaterialLayerSet for walls, slabs with multiple layers.',
    examples: ['200mm Concrete core', '50mm Insulation', '12.5mm Gypsum board'],
  },

  IFCMATERIALLAYERSET: {
    type: 'IFCMATERIALLAYERSET',
    displayName: 'Material Layer Set',
    description: 'An ordered collection of material layers. Defines the full material composition of walls and slabs.',
    category: 'resource',
    inheritance: ['IfcMaterialDefinition'],
    introducedIn: 'IFC2x',
    icon: 'Layers',
    properties: [
      { name: 'MaterialLayers', description: 'Ordered list of layers', dataType: 'LIST OF IfcMaterialLayer', isRequired: true },
      { name: 'LayerSetName', description: 'Name of the layer set', dataType: 'IfcLabel', isRequired: false, example: 'Ext Wall Construction' },
    ],
    relatedPropertySets: [],
    usageNotes: 'Layers are ordered from exterior to interior (or bottom to top for slabs).',
    examples: ['External wall: Brick + Cavity + Insulation + Block + Plaster'],
  },

  // ===== OWNER/HISTORY =====
  IFCOWNERHISTORY: {
    type: 'IFCOWNERHISTORY',
    displayName: 'Owner History',
    description: 'Tracks ownership, creation, and modification of IFC objects. Provides audit trail information.',
    category: 'context',
    inheritance: [],
    introducedIn: 'IFC2x',
    icon: 'History',
    properties: [
      { name: 'OwningUser', description: 'Person and organization', dataType: 'IfcPersonAndOrganization', isRequired: true },
      { name: 'OwningApplication', description: 'Creating application', dataType: 'IfcApplication', isRequired: true },
      { name: 'State', description: 'Current state (READWRITE, READONLY, etc.)', dataType: 'IfcStateEnum', isRequired: false },
      { name: 'ChangeAction', description: 'Type of change (ADDED, MODIFIED, DELETED)', dataType: 'IfcChangeActionEnum', isRequired: true },
      { name: 'CreationDate', description: 'Unix timestamp of creation', dataType: 'IfcTimeStamp', isRequired: true },
    ],
    relatedPropertySets: [],
    usageNotes: 'Attached to all IfcRoot objects. Enables tracking who created/modified elements and when.',
    examples: ['Wall created by Architect on 2024-01-15', 'Door modified by Engineer on 2024-02-10', 'Slab added by BIM Coordinator'],
  },
};

// Standard Property Set definitions from BuildingSMART
export const IFC_PROPERTY_SET_DEFINITIONS: Record<string, IFCPropertySetDefinition> = {
  Pset_WallCommon: {
    name: 'Pset_WallCommon',
    description: 'Common properties for walls as defined in the IFC specification.',
    applicableEntities: ['IFCWALL', 'IFCWALLSTANDARDCASE', 'IFCWALLTYPE'],
    properties: [
      { name: 'Reference', description: 'Reference ID for the wall', dataType: 'IfcIdentifier', isRequired: false },
      { name: 'Status', description: 'Status of the element (NEW, EXISTING, DEMOLISH, TEMPORARY)', dataType: 'IfcLabel', isRequired: false },
      { name: 'AcousticRating', description: 'Sound transmission class rating', dataType: 'IfcLabel', isRequired: false, example: 'STC 50' },
      { name: 'FireRating', description: 'Fire resistance rating', dataType: 'IfcLabel', isRequired: false, example: '2 Hours' },
      { name: 'Combustible', description: 'Whether the material is combustible', dataType: 'IfcBoolean', isRequired: false },
      { name: 'SurfaceSpreadOfFlame', description: 'Surface spread of flame classification', dataType: 'IfcLabel', isRequired: false },
      { name: 'ThermalTransmittance', description: 'U-value (W/m²K)', dataType: 'IfcThermalTransmittanceMeasure', isRequired: false, example: '0.35' },
      { name: 'IsExternal', description: 'Whether the wall is external', dataType: 'IfcBoolean', isRequired: false },
      { name: 'ExtendToStructure', description: 'Whether wall extends to structure above', dataType: 'IfcBoolean', isRequired: false },
      { name: 'LoadBearing', description: 'Whether the wall is load-bearing', dataType: 'IfcBoolean', isRequired: false },
    ],
  },
  Pset_DoorCommon: {
    name: 'Pset_DoorCommon',
    description: 'Common properties for doors as defined in the IFC specification.',
    applicableEntities: ['IFCDOOR', 'IFCDOORTYPE'],
    properties: [
      { name: 'Reference', description: 'Reference ID for the door', dataType: 'IfcIdentifier', isRequired: false },
      { name: 'Status', description: 'Status of the element', dataType: 'IfcLabel', isRequired: false },
      { name: 'AcousticRating', description: 'Sound transmission class rating', dataType: 'IfcLabel', isRequired: false },
      { name: 'FireRating', description: 'Fire resistance rating', dataType: 'IfcLabel', isRequired: false, example: '1 Hour' },
      { name: 'SecurityRating', description: 'Security level classification', dataType: 'IfcLabel', isRequired: false },
      { name: 'IsExternal', description: 'Whether the door is external', dataType: 'IfcBoolean', isRequired: false },
      { name: 'Infiltration', description: 'Air infiltration rate', dataType: 'IfcVolumetricFlowRateMeasure', isRequired: false },
      { name: 'ThermalTransmittance', description: 'U-value (W/m²K)', dataType: 'IfcThermalTransmittanceMeasure', isRequired: false },
      { name: 'GlazingAreaFraction', description: 'Fraction of door that is glazed', dataType: 'IfcPositiveRatioMeasure', isRequired: false },
      { name: 'HandicapAccessible', description: 'Whether accessible for mobility impaired', dataType: 'IfcBoolean', isRequired: false },
      { name: 'FireExit', description: 'Whether door is a fire exit', dataType: 'IfcBoolean', isRequired: false },
      { name: 'SelfClosing', description: 'Whether door is self-closing', dataType: 'IfcBoolean', isRequired: false },
      { name: 'SmokeStop', description: 'Whether door is a smoke barrier', dataType: 'IfcBoolean', isRequired: false },
    ],
  },
  Pset_WindowCommon: {
    name: 'Pset_WindowCommon',
    description: 'Common properties for windows as defined in the IFC specification.',
    applicableEntities: ['IFCWINDOW', 'IFCWINDOWTYPE'],
    properties: [
      { name: 'Reference', description: 'Reference ID for the window', dataType: 'IfcIdentifier', isRequired: false },
      { name: 'Status', description: 'Status of the element', dataType: 'IfcLabel', isRequired: false },
      { name: 'AcousticRating', description: 'Sound transmission class rating', dataType: 'IfcLabel', isRequired: false },
      { name: 'FireRating', description: 'Fire resistance rating', dataType: 'IfcLabel', isRequired: false },
      { name: 'SecurityRating', description: 'Security level classification', dataType: 'IfcLabel', isRequired: false },
      { name: 'IsExternal', description: 'Whether the window is external', dataType: 'IfcBoolean', isRequired: false },
      { name: 'Infiltration', description: 'Air infiltration rate', dataType: 'IfcVolumetricFlowRateMeasure', isRequired: false },
      { name: 'ThermalTransmittance', description: 'U-value (W/m²K)', dataType: 'IfcThermalTransmittanceMeasure', isRequired: false, example: '1.4' },
      { name: 'GlazingAreaFraction', description: 'Fraction of window that is glazed', dataType: 'IfcPositiveRatioMeasure', isRequired: false },
      { name: 'SmokeStop', description: 'Whether window is a smoke barrier', dataType: 'IfcBoolean', isRequired: false },
    ],
  },
  Pset_SlabCommon: {
    name: 'Pset_SlabCommon',
    description: 'Common properties for slabs as defined in the IFC specification.',
    applicableEntities: ['IFCSLAB', 'IFCSLABTYPE'],
    properties: [
      { name: 'Reference', description: 'Reference ID', dataType: 'IfcIdentifier', isRequired: false },
      { name: 'Status', description: 'Status of the element', dataType: 'IfcLabel', isRequired: false },
      { name: 'AcousticRating', description: 'Impact sound rating', dataType: 'IfcLabel', isRequired: false },
      { name: 'FireRating', description: 'Fire resistance rating', dataType: 'IfcLabel', isRequired: false },
      { name: 'Combustible', description: 'Whether the material is combustible', dataType: 'IfcBoolean', isRequired: false },
      { name: 'SurfaceSpreadOfFlame', description: 'Surface spread of flame', dataType: 'IfcLabel', isRequired: false },
      { name: 'ThermalTransmittance', description: 'U-value (W/m²K)', dataType: 'IfcThermalTransmittanceMeasure', isRequired: false },
      { name: 'IsExternal', description: 'Whether the slab is external (roof, ground)', dataType: 'IfcBoolean', isRequired: false },
      { name: 'LoadBearing', description: 'Whether slab is structural', dataType: 'IfcBoolean', isRequired: false },
    ],
  },
  Pset_SpaceCommon: {
    name: 'Pset_SpaceCommon',
    description: 'Common properties for spaces (rooms) as defined in the IFC specification.',
    applicableEntities: ['IFCSPACE', 'IFCSPACETYPE'],
    properties: [
      { name: 'Reference', description: 'Reference ID or room number', dataType: 'IfcIdentifier', isRequired: false },
      { name: 'IsExternal', description: 'Whether the space is external (balcony)', dataType: 'IfcBoolean', isRequired: false },
      { name: 'GrossPlannedArea', description: 'Planned gross floor area', dataType: 'IfcAreaMeasure', isRequired: false },
      { name: 'NetPlannedArea', description: 'Planned net floor area', dataType: 'IfcAreaMeasure', isRequired: false },
      { name: 'PubliclyAccessible', description: 'Whether space is publicly accessible', dataType: 'IfcBoolean', isRequired: false },
      { name: 'HandicapAccessible', description: 'Whether accessible for mobility impaired', dataType: 'IfcBoolean', isRequired: false },
    ],
  },
  Pset_BuildingCommon: {
    name: 'Pset_BuildingCommon',
    description: 'Common properties for buildings as defined in the IFC specification.',
    applicableEntities: ['IFCBUILDING'],
    properties: [
      { name: 'Reference', description: 'Reference ID', dataType: 'IfcIdentifier', isRequired: false },
      { name: 'BuildingID', description: 'Building identifier', dataType: 'IfcIdentifier', isRequired: false },
      { name: 'IsPermanentID', description: 'Whether BuildingID is permanent', dataType: 'IfcBoolean', isRequired: false },
      { name: 'ConstructionMethod', description: 'Method of construction', dataType: 'IfcLabel', isRequired: false },
      { name: 'FireProtectionClass', description: 'Fire protection classification', dataType: 'IfcLabel', isRequired: false },
      { name: 'SprinklerProtection', description: 'Whether sprinkler protected', dataType: 'IfcBoolean', isRequired: false },
      { name: 'SprinklerProtectionAutomatic', description: 'Whether automatic sprinkler', dataType: 'IfcBoolean', isRequired: false },
      { name: 'OccupancyType', description: 'Type of building use', dataType: 'IfcLabel', isRequired: false, example: 'Office, Residential, Industrial' },
      { name: 'GrossPlannedArea', description: 'Total planned floor area', dataType: 'IfcAreaMeasure', isRequired: false },
      { name: 'NetPlannedArea', description: 'Net planned floor area', dataType: 'IfcAreaMeasure', isRequired: false },
      { name: 'NumberOfStoreys', description: 'Total number of storeys', dataType: 'IfcInteger', isRequired: false },
      { name: 'YearOfConstruction', description: 'Year the building was constructed', dataType: 'IfcLabel', isRequired: false },
      { name: 'YearOfLastRefurbishment', description: 'Year of last major renovation', dataType: 'IfcLabel', isRequired: false },
      { name: 'IsLandmarked', description: 'Whether building is historically protected', dataType: 'IfcBoolean', isRequired: false },
    ],
  },
};

// Helper function to get entity definition
export function getEntityDefinition(type: string): IFCEntityDefinition | undefined {
  const upperType = type.toUpperCase();
  return IFC_ENTITY_DEFINITIONS[upperType];
}

// Helper function to get property set definition
export function getPropertySetDefinition(name: string): IFCPropertySetDefinition | undefined {
  return IFC_PROPERTY_SET_DEFINITIONS[name];
}

// Get related property sets for an entity type
export function getRelatedPropertySets(type: string): IFCPropertySetDefinition[] {
  const entityDef = getEntityDefinition(type);
  if (!entityDef) return [];
  
  return entityDef.relatedPropertySets
    .map(name => IFC_PROPERTY_SET_DEFINITIONS[name])
    .filter((pset): pset is IFCPropertySetDefinition => pset !== undefined);
}

// Format inheritance chain for display
export function formatInheritanceChain(inheritance: string[]): string {
  return inheritance.join(' → ');
}

// Get docs URL for an entity type
// Automatically generates the URL based on entity name and schema version
export function getDocsUrl(type: string, schemaVersion: string = 'IFC4'): string {
  return generateDocsUrl(type, schemaVersion);
}
