/**
 * IFC Schema Layer Mapping
 * Maps IFC entities to their architectural layer in the IFC specification
 *
 * The IFC schema is organized in 4 conceptual layers:
 * 1. Domain Layer - Industry-specific schemas (HVAC, Structural, etc.)
 * 2. Interoperability Layer - Shared building elements (Wall, Door, Window)
 * 3. Core Layer - Abstract base classes and fundamental concepts
 * 4. Resource Layer - Foundational primitives (geometry, materials, properties)
 */

export interface SchemaLayer {
  id: 'domain' | 'interoperability' | 'core' | 'resource';
  name: string;
  shortName: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const SCHEMA_LAYERS: Record<string, SchemaLayer> = {
  domain: {
    id: 'domain',
    name: 'Domain Layer',
    shortName: 'Domain',
    description: 'Industry-specific entities for specialized disciplines (HVAC, Structural, Electrical, etc.)',
    color: 'text-violet-700 dark:text-violet-300',
    bgColor: 'bg-violet-100 dark:bg-violet-950/40',
    borderColor: 'border-violet-300 dark:border-violet-700',
  },
  interoperability: {
    id: 'interoperability',
    name: 'Interoperability Layer',
    shortName: 'Interop',
    description: 'Shared building elements understood across all disciplines',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-950/40',
    borderColor: 'border-blue-300 dark:border-blue-700',
  },
  core: {
    id: 'core',
    name: 'Core Layer',
    shortName: 'Core',
    description: 'Abstract base classes defining fundamental BIM structures',
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-100 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-300 dark:border-emerald-700',
  },
  resource: {
    id: 'resource',
    name: 'Resource Layer',
    shortName: 'Resource',
    description: 'Foundational primitives without independent identity (geometry, materials, units)',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-100 dark:bg-amber-950/40',
    borderColor: 'border-amber-300 dark:border-amber-700',
  },
};

/**
 * Maps IFC entity types to their schema layer
 * Based on BuildingSMART IFC4.3 specification
 */
const ENTITY_TO_LAYER_MAP: Record<string, 'domain' | 'interoperability' | 'core' | 'resource'> = {
  // DOMAIN LAYER - Structural Domain
  'IfcBeam': 'domain',
  'IfcBeamType': 'domain',
  'IfcColumn': 'domain',
  'IfcColumnType': 'domain',
  'IfcFooting': 'domain',
  'IfcFootingType': 'domain',
  'IfcPile': 'domain',
  'IfcPileType': 'domain',
  'IfcReinforcingBar': 'domain',
  'IfcReinforcingBarType': 'domain',
  'IfcReinforcingMesh': 'domain',
  'IfcReinforcingMeshType': 'domain',
  'IfcTendon': 'domain',
  'IfcTendonType': 'domain',
  'IfcTendonAnchor': 'domain',
  'IfcTendonAnchorType': 'domain',

  // DOMAIN LAYER - HVAC Domain
  'IfcAirTerminal': 'domain',
  'IfcAirTerminalType': 'domain',
  'IfcAirTerminalBox': 'domain',
  'IfcAirTerminalBoxType': 'domain',
  'IfcDuctSegment': 'domain',
  'IfcDuctSegmentType': 'domain',
  'IfcDuctFitting': 'domain',
  'IfcDuctFittingType': 'domain',
  'IfcDuctSilencer': 'domain',
  'IfcDuctSilencerType': 'domain',
  'IfcBoiler': 'domain',
  'IfcBoilerType': 'domain',
  'IfcChiller': 'domain',
  'IfcChillerType': 'domain',
  'IfcCoil': 'domain',
  'IfcCoilType': 'domain',
  'IfcFan': 'domain',
  'IfcFanType': 'domain',

  // DOMAIN LAYER - Plumbing Domain
  'IfcPipeSegment': 'domain',
  'IfcPipeSegmentType': 'domain',
  'IfcPipeFitting': 'domain',
  'IfcPipeFittingType': 'domain',
  'IfcSanitaryTerminal': 'domain',
  'IfcSanitaryTerminalType': 'domain',
  'IfcValve': 'domain',
  'IfcValveType': 'domain',
  'IfcPump': 'domain',
  'IfcPumpType': 'domain',
  'IfcFlowMeter': 'domain',
  'IfcFlowMeterType': 'domain',

  // DOMAIN LAYER - Electrical Domain
  'IfcCableSegment': 'domain',
  'IfcCableSegmentType': 'domain',
  'IfcCableFitting': 'domain',
  'IfcCableFittingType': 'domain',
  'IfcCableCarrierSegment': 'domain',
  'IfcCableCarrierSegmentType': 'domain',
  'IfcCableCarrierFitting': 'domain',
  'IfcCableCarrierFittingType': 'domain',
  'IfcElectricDistributionBoard': 'domain',
  'IfcElectricDistributionBoardType': 'domain',
  'IfcElectricFlowStorageDevice': 'domain',
  'IfcElectricFlowStorageDeviceType': 'domain',
  'IfcLightFixture': 'domain',
  'IfcLightFixtureType': 'domain',
  'IfcOutlet': 'domain',
  'IfcOutletType': 'domain',
  'IfcSwitchingDevice': 'domain',
  'IfcSwitchingDeviceType': 'domain',

  // INTEROPERABILITY LAYER - Shared Building Elements
  'IfcWall': 'interoperability',
  'IfcWallType': 'interoperability',
  'IfcWallStandardCase': 'interoperability',
  'IfcDoor': 'interoperability',
  'IfcDoorType': 'interoperability',
  'IfcWindow': 'interoperability',
  'IfcWindowType': 'interoperability',
  'IfcSlab': 'interoperability',
  'IfcSlabType': 'interoperability',
  'IfcRoof': 'interoperability',
  'IfcRoofType': 'interoperability',
  'IfcStair': 'interoperability',
  'IfcStairType': 'interoperability',
  'IfcStairFlight': 'interoperability',
  'IfcStairFlightType': 'interoperability',
  'IfcRamp': 'interoperability',
  'IfcRampType': 'interoperability',
  'IfcRampFlight': 'interoperability',
  'IfcRampFlightType': 'interoperability',
  'IfcCovering': 'interoperability',
  'IfcCoveringType': 'interoperability',
  'IfcCurtainWall': 'interoperability',
  'IfcCurtainWallType': 'interoperability',
  'IfcMember': 'interoperability',
  'IfcMemberType': 'interoperability',
  'IfcPlate': 'interoperability',
  'IfcPlateType': 'interoperability',
  'IfcRailing': 'interoperability',
  'IfcRailingType': 'interoperability',
  'IfcSpace': 'interoperability',
  'IfcSpaceType': 'interoperability',
  'IfcBuildingElementProxy': 'interoperability',
  'IfcBuildingElementProxyType': 'interoperability',
  'IfcOpeningElement': 'interoperability',
  'IfcFurnishingElement': 'interoperability',
  'IfcFurniture': 'interoperability',
  'IfcFurnitureType': 'interoperability',

  // CORE LAYER - Abstract Base Classes and Fundamental Concepts
  'IfcProject': 'core',
  'IfcSite': 'core',
  'IfcBuilding': 'core',
  'IfcBuildingStorey': 'core',
  'IfcRoot': 'core',
  'IfcObjectDefinition': 'core',
  'IfcObject': 'core',
  'IfcProduct': 'core',
  'IfcElement': 'core',
  'IfcSpatialElement': 'core',
  'IfcSpatialStructureElement': 'core',
  'IfcBuildingElement': 'core',
  'IfcDistributionElement': 'core',
  'IfcDistributionFlowElement': 'core',
  'IfcDistributionControlElement': 'core',
  'IfcElementType': 'core',
  'IfcTypeObject': 'core',
  'IfcTypeProduct': 'core',
  'IfcTypeProcess': 'core',
  'IfcTypeResource': 'core',
  'IfcProcess': 'core',
  'IfcResource': 'core',
  'IfcGroup': 'core',
  'IfcSystem': 'core',
  'IfcDistributionSystem': 'core',
  'IfcZone': 'core',
  'IfcContext': 'core',
  'IfcProjectLibrary': 'core',

  // CORE LAYER - Relationships (all IfcRel* entities)
  'IfcRelationship': 'core',
  'IfcRelAssigns': 'core',
  'IfcRelAssignsToActor': 'core',
  'IfcRelAssignsToControl': 'core',
  'IfcRelAssignsToGroup': 'core',
  'IfcRelAssignsToProcess': 'core',
  'IfcRelAssignsToProduct': 'core',
  'IfcRelAssignsToResource': 'core',
  'IfcRelAssociates': 'core',
  'IfcRelAssociatesApproval': 'core',
  'IfcRelAssociatesClassification': 'core',
  'IfcRelAssociatesConstraint': 'core',
  'IfcRelAssociatesDocument': 'core',
  'IfcRelAssociatesLibrary': 'core',
  'IfcRelAssociatesMaterial': 'core',
  'IfcRelConnects': 'core',
  'IfcRelConnectsElements': 'core',
  'IfcRelConnectsPathElements': 'core',
  'IfcRelConnectsPortToElement': 'core',
  'IfcRelConnectsPorts': 'core',
  'IfcRelConnectsStructuralActivity': 'core',
  'IfcRelConnectsStructuralMember': 'core',
  'IfcRelConnectsWithEccentricity': 'core',
  'IfcRelConnectsWithRealizingElements': 'core',
  'IfcRelContainedInSpatialStructure': 'core',
  'IfcRelCoversBldgElements': 'core',
  'IfcRelCoversSpaces': 'core',
  'IfcRelDeclares': 'core',
  'IfcRelDecomposes': 'core',
  'IfcRelAggregates': 'core',
  'IfcRelNests': 'core',
  'IfcRelProjectsElement': 'core',
  'IfcRelVoidsElement': 'core',
  'IfcRelFillsElement': 'core',
  'IfcRelDefines': 'core',
  'IfcRelDefinesByType': 'core',
  'IfcRelDefinesByProperties': 'core',
  'IfcRelDefinesByTemplate': 'core',
  'IfcRelInterferesElements': 'core',
  'IfcRelReferencedInSpatialStructure': 'core',
  'IfcRelSequence': 'core',
  'IfcRelServicesBuildings': 'core',
  'IfcRelSpaceBoundary': 'core',
  'IfcRelSpaceBoundary1stLevel': 'core',
  'IfcRelSpaceBoundary2ndLevel': 'core',

  // RESOURCE LAYER - Geometry
  'IfcGeometricRepresentationContext': 'resource',
  'IfcGeometricRepresentationSubContext': 'resource',
  'IfcShapeRepresentation': 'resource',
  'IfcProductDefinitionShape': 'resource',
  'IfcRepresentation': 'resource',
  'IfcRepresentationContext': 'resource',
  'IfcRepresentationItem': 'resource',
  'IfcRepresentationMap': 'resource',
  'IfcCartesianPoint': 'resource',
  'IfcDirection': 'resource',
  'IfcAxis2Placement2D': 'resource',
  'IfcAxis2Placement3D': 'resource',
  'IfcLocalPlacement': 'resource',
  'IfcExtrudedAreaSolid': 'resource',
  'IfcRectangleProfileDef': 'resource',
  'IfcCircleProfileDef': 'resource',
  'IfcIShapeProfileDef': 'resource',
  'IfcArbitraryClosedProfileDef': 'resource',
  'IfcPolyline': 'resource',
  'IfcLine': 'resource',
  'IfcTrimmedCurve': 'resource',
  'IfcCompositeCurve': 'resource',
  'IfcBooleanResult': 'resource',
  'IfcBooleanClippingResult': 'resource',
  'IfcFacetedBrep': 'resource',
  'IfcClosedShell': 'resource',
  'IfcFace': 'resource',
  'IfcFaceBound': 'resource',
  'IfcPolyLoop': 'resource',

  // RESOURCE LAYER - Materials
  'IfcMaterial': 'resource',
  'IfcMaterialDefinition': 'resource',
  'IfcMaterialLayer': 'resource',
  'IfcMaterialLayerSet': 'resource',
  'IfcMaterialLayerSetUsage': 'resource',
  'IfcMaterialProfile': 'resource',
  'IfcMaterialProfileSet': 'resource',
  'IfcMaterialProfileSetUsage': 'resource',
  'IfcMaterialConstituent': 'resource',
  'IfcMaterialConstituentSet': 'resource',
  'IfcMaterialList': 'resource',
  'IfcMaterialProperties': 'resource',
  'IfcMaterialClassificationRelationship': 'resource',

  // RESOURCE LAYER - Properties
  'IfcProperty': 'resource',
  'IfcPropertySet': 'resource',
  'IfcPropertySetDefinition': 'resource',
  'IfcPropertyDefinition': 'resource',
  'IfcPropertySingleValue': 'resource',
  'IfcPropertyEnumeratedValue': 'resource',
  'IfcPropertyBoundedValue': 'resource',
  'IfcPropertyListValue': 'resource',
  'IfcPropertyTableValue': 'resource',
  'IfcPropertyReferenceValue': 'resource',
  'IfcComplexProperty': 'resource',
  'IfcElementQuantity': 'resource',
  'IfcQuantityLength': 'resource',
  'IfcQuantityArea': 'resource',
  'IfcQuantityVolume': 'resource',
  'IfcQuantityCount': 'resource',
  'IfcQuantityWeight': 'resource',
  'IfcQuantityTime': 'resource',
  'IfcPhysicalQuantity': 'resource',
  'IfcPhysicalSimpleQuantity': 'resource',
  'IfcPhysicalComplexQuantity': 'resource',

  // RESOURCE LAYER - Units and Measures
  'IfcUnit': 'resource',
  'IfcSIUnit': 'resource',
  'IfcConversionBasedUnit': 'resource',
  'IfcDerivedUnit': 'resource',
  'IfcMonetaryUnit': 'resource',
  'IfcUnitAssignment': 'resource',
  'IfcMeasureWithUnit': 'resource',
  'IfcDimensionalExponents': 'resource',

  // RESOURCE LAYER - Other Primitives
  'IfcOwnerHistory': 'resource',
  'IfcPersonAndOrganization': 'resource',
  'IfcPerson': 'resource',
  'IfcOrganization': 'resource',
  'IfcApplication': 'resource',
  'IfcPostalAddress': 'resource',
  'IfcTelecomAddress': 'resource',
  'IfcAddress': 'resource',
  'IfcGloballyUniqueId': 'resource',
  'IfcLabel': 'resource',
  'IfcText': 'resource',
  'IfcIdentifier': 'resource',
  'IfcInteger': 'resource',
  'IfcReal': 'resource',
  'IfcBoolean': 'resource',
  'IfcLogical': 'resource',
  'IfcDateTime': 'resource',
  'IfcDate': 'resource',
  'IfcTime': 'resource',
  'IfcDuration': 'resource',
  'IfcTimeStamp': 'resource',
};

/**
 * Get the schema layer for a given IFC entity type
 * @param entityType - The IFC entity type (e.g., "IfcWall", "IfcBeam")
 * @returns The schema layer or null if not found
 */
export function getSchemaLayerForEntity(entityType: string): SchemaLayer | null {
  const layerId = ENTITY_TO_LAYER_MAP[entityType];

  if (!layerId) {
    // Try to infer layer from entity patterns
    if (entityType.includes('Type')) {
      // Type objects are in Core layer
      return SCHEMA_LAYERS.core;
    }
    if (entityType.startsWith('IfcRel')) {
      // Relationships are in Core layer
      return SCHEMA_LAYERS.core;
    }
    if (entityType.startsWith('IfcProperty') || entityType.startsWith('IfcQuantity')) {
      // Properties and quantities are in Resource layer
      return SCHEMA_LAYERS.resource;
    }
    if (entityType.startsWith('IfcMaterial') || entityType.startsWith('IfcSI') || entityType.includes('Unit')) {
      // Materials and units are in Resource layer
      return SCHEMA_LAYERS.resource;
    }

    return null;
  }

  return SCHEMA_LAYERS[layerId];
}

/**
 * Get all entities in a specific layer
 * @param layerId - The layer ID
 * @returns Array of entity type names in that layer
 */
export function getEntitiesInLayer(layerId: 'domain' | 'interoperability' | 'core' | 'resource'): string[] {
  return Object.entries(ENTITY_TO_LAYER_MAP)
    .filter(([_, layer]) => layer === layerId)
    .map(([entity, _]) => entity);
}

/**
 * Check if an entity belongs to a specific layer
 * @param entityType - The IFC entity type
 * @param layerId - The layer ID to check
 * @returns True if the entity belongs to the specified layer
 */
export function isEntityInLayer(
  entityType: string,
  layerId: 'domain' | 'interoperability' | 'core' | 'resource'
): boolean {
  return ENTITY_TO_LAYER_MAP[entityType] === layerId;
}
