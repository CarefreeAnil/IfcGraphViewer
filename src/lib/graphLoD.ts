/**
 * IFC Graph Level of Detail (LoD) Framework
 * Based on research: "IfcGraphLoD: A framework for graph-based IFC data visualization"
 *
 * Implements 4 levels of detail:
 * LoD4 (Core Graph): Full semantics, no geometry
 * LoD3 (Essential Graph): Objects + bidirectional relationship-node links
 * LoD2 (Least Graph): Unidirectional relationship-node → object links
 * LoD1 (Utility Graph): Application-specific minimal subset
 */

import { GraphNode, GraphEdge, GraphData } from '@/types/graph';
import { logger } from '@/utils/logger';

export type LoDLevel = 1 | 2 | 3 | 4 | 5;

export enum GraphLoD {
  LoD1_Utility = 1,     // Minimal, app-specific
  LoD2_Least = 2,       // One-way edges only
  LoD3_Essential = 3,   // Two-way relationships
  LoD4_Core = 4,        // Full semantics, no geometry
}

// Auxiliary/support types that are not meaningful for primary visualization
// These are geometric primitives, style definitions, and schema metadata
export const AUXILIARY_EXCLUDE_TYPES = new Set<string>([
  // Geometric primitives - mathematical helpers, not real entities
  'IFCDIRECTION', 'IFCPLANE', 'IFCCARTESIANPOINT', 'IFCLINE', 'IFCCIRCLE', 'IFCCIRCULARARCPOINTANDRADIUS',
  'IFCELLIPSE', 'IFCPOLYLINE', 'IFCCOMPOSITECURVE', 'IFCPOLYCURVE', 'IFCBOUNDEDCURVE', 'IFCBSPLINECURVE',
  'IFCBSPLINESURFACE', 'IFCCURVEBOUNDEDPLANE', 'IFCRECTANGULARTRIMMEDSURFACE', 'IFCSURFACEOFLINEAREXTRUSION',
  'IFCSURFACEOFREVOLUTION', 'IFCSWEPTSURFACE',

  // Profile definitions - geometric templates
  'IFCRECTANGLEPROFILEDEF', 'IFCRECTANGLEHOLLOWPROFILEDEF', 'IFCCIRCLEPROFILEDEF', 'IFCCIRCLEHOWTOPROFILEDEF',
  'IFCIBEAMPROFILEDEF', 'IFCLSHAPEPROFILEDEF', 'IFCTSHAPEPROFILEDEF', 'IFCUPROFILEDEF', 'IFCCPROFILEDEF',
  'IFCZPROFILEDEF', 'IFCTRAPEZOIDAL PROFILEDEF', 'IFCASYMETRICISHAPEPROFILEDEF', 'IFCCOMPLEXPROFILEDEF',
  'IFCARBITRARYCLOSEDPROFILESEGMENT', 'IFCPOLYLINEPROFILEDEF', 'IFCCENTRELINEPROFILEDEF', 'IFCPARAMETERIZEDPROFILEDEF',

  // Solid/representation primitives
  'IFCBLOCK', 'IFCRECTANGULARBOX', 'IFCWEDGE', 'IFCHALFSPACESOLID', 'IFCPOLYGONALBOUNDEDHALFSPACE', 'IFCBOXEDHALFSPACE',
  'IFCPRIMITIVESHAPE3D', 'IFCEXTRUDEDAREASOLID', 'IFCREVOLVEDAREASOLID', 'IFCSWEPTSURFACESOLID',
  'IFCEXTRUDEDAREASSIMPLIFIED', 'IFCMAPPEDITEM',

  // Style and appearance definitions
  'IFCSURFACESTYLE', 'IFCCURVESTYLE', 'IFCTEXTUREMAP', 'IFCFILLAREASTYLE', 'IFCFILLAREASTYLEHATCHING',
  'IFCFILLAREASTYLETILES', 'IFCHATCHLINESTYLE', 'IFCSTYLEMODEL',

  // Window/Door property details
  'IFCWINDOWLININGPROPERTIES', 'IFCWINDOWPANELPROPERTIES', 'IFCDOORCLOSINGPROPERTIES', 'IFCDOORSTYLEPANELPROPERTIES',
  'IFCDOORSTYLEARRANGEMENT', 'IFCDOORPANELPROPERTIES', 'IFCDOORSTYLELININGPROPERTIES', 'IFCSHAPEASPECT',
  'IFCSHELLBASEDSURFACEMODEL', 'IFCTESSELLATEDFACESET', 'IFCSHAPEMODEL',

  // Material-related metadata
  'IFCMATERIALLAYER', 'IFCMATERIAL', 'IFCMATERIALLAYERSET', 'IFCMATERIALLAYERUSAGEPUTATIVE', 'IFCMATERIALLAYERWITHOFFFSETS',
  'IFCMATERIALCOMPONENT', 'IFCMATERIALDEFINITIONREPRESENTATION', 'IFCMATERIALPROPERTIES', 'IFCMECHANICALCONCRETEMATERIALPROPERTIES',
  'IFCMECHANICALMATERIALPROPERTIES', 'IFCTHERMALMAATERIALPROPERTIES', 'IFCWOODFINISHINGPROPERTIES',

  // Unit and measure definitions
  'IFCSIUNIT', 'IFCUNITASSIGNMENT', 'IFCCONVERSIONBASEDUNIT', 'IFCDERIVEDUNIT', 'IFCDERIVEDUNITELEMENT', 'IFCDIMENSIONALEXPONENTS',
  'IFCNAMEDUNIT', 'IFCUNIT', 'IFCMEASUREWITHUNIT', 'IFCMONETARYMEASURE', 'IFCDIMENSIONCOUNT',

  // Measurement and quantity primitives
  'IFCQUANTITY', 'IFCQUANTITYAREA', 'IFCQUANTITYCOUNT', 'IFCQUANTITYLENGTH', 'IFCQUANTITYTIME', 'IFCQUANTITYVOLUME', 'IFCQUANTITYWEIGHT',
  'IFCABSORBEDDOSEEQUIVALENTMEASURE', 'IFCACCELERATIONMEASURE', 'IFCANGULARVELOCITYMEASURE', 'IFCAREATEMEASURE', 'IFCAREAMEASURE',
  'IFCHEATINGVALUEMEASURE', 'IFCHEATTRANSFERCOEFFICIENTMEASURE', 'IFCILLUMINANCEMEASURE', 'IFCINDUCTANCEMEASURE',
  'IFCINTENSITYDISTRIBUTIONMEASURE', 'IFCKINEMATICVISCOSITYMEASURE', 'IFCLENGTHKMEASURE', 'IFCLENGTHME ASURE',
  'IFCLINEARFORCEMEASURE', 'IFCLINEARMOMENTMEASURE', 'IFCLINEARSTIFFNESSMEASURE', 'IFCLINEARVELOCITYMEASURE', 'IFCLOSSMEASURE',
  'IFCLUMINOUSINTENSITYDISTRIBUTIONMEASURE', 'IFCLUMINOUSMEASURE', 'IFCMAGENTOMOVENTUMEASURE', 'IFCMASSDENSITYMEASURE', 'IFCMASSMEASURE',
  'IFCMASSPERLENGTHMEASURE', 'IFCMASSFLOWMEASURE', 'IFCMODULOFSLIPPAGE', 'IFCMOISTUREDIFFUSIVITYMEASURE', 'IFCMOLECULARWEIGHTMEASURE',
  'IFCMOLENTALVOLUMEMEASURE', 'IFCMOMENTOFINERTIAMEASURE', 'IFCMONITORINGDEVICEEPRESENTATIONSELECT', 'IFCNORMALISEDRATIOMEASURE',
  'IFCNUMERICMEASURE', 'IFCPARAMETERVALUE', 'IFCPHASEANGLMEASURE', 'IFCPLANARMEASURE', 'IFCPLANARSTIFFNESSMEASURE', 'IFCPLANARFORCEMEASURE',
  'IFCPLANARMOMENTMEASURE', 'IFCPOWERMEEASURE', 'IFCPRESSUREMSURE', 'IFCRADIOACTIVITYMEASURE', 'IFCROTATIONALFREQUENCYMEASURE',
  'IFCROTATIONALSTIFFNESSMEASURE', 'IFCROTATIONALMASSM EASURE', 'IFCROTATIONALVELOCITYMEASURE', 'IFCROTATIONALMASS MEASURE',
  'IFCSECTIONALAREAINTEGRALMEASURE', 'IFCSECTIONMODULUSMEASURE', 'IFCSEISMICBASEISOLATEDDISPLACEMENTMEASURE', 'IFCSHEARMEASURE', 'IFCSILUNIT',
  'IFCSIMPLYLIFTEDSPACEKEYRELATIONSHIPTOSPATIALELEMENT', 'IFCSIZESELECT', 'IFCSOUNDPOWERMEASURE', 'IFCSOUNDPRESSUREMEASURE', 'IFCSPCDEFINE',
  'IFCSPECIFICHEATCAPACITYMEASURE', 'IFCTAXIWAYTYPEENUM', 'IFCTEMPERATUREGRADIENTMEASURE', 'IFCTHERMALCONDUCTIVITYMEASURE',
  'IFCTHERMALEXPANSIONCOEFFICIENTMEASURE', 'IFCTHERMALRE SISTANCEMEASURE', 'IFCTHERMALRESIST ANCEMEASURE', 'IFCTHERMALTRASMITTANCEMEASURE',
  'IFCTHERMALTRANSMITTANCEMEASURE', 'IFCTIME MEASURE', 'IFCTIMESERIOS', 'IFCTIMESERIES', 'IFCTIMESTEP', 'IFCTORQUEMEASURE',
  'IFCTORSIONALST IFFNESSMEASURE', 'IFCTORSIONALSTRAININMEASURE', 'IFCTORSIONALSTRAIN MEASURE', 'IFCTOXICITYMEASURE', 'IFCTRANSMITTANCEMEASURE',
  'IFCVAPOURPERMEABILITYMEASURE', 'IFCVOLUMETR ICFLOWRATE', 'IFCVOLUMETRICFLOWRATE', 'IFCVOLUMEMEASURE', 'IFCWARPINGCONSTANTMEASURE',
  'IFCWARPINGTORSIONALCONSTANTMEASURE', 'IFCWASTEATERVOLUME', 'IFCWASTERSVOLUME', 'IFCWASTVOLUMETEMPERATURE', 'IFCWARPINGCONSTANTMEASURE',
]);

export const isAuxiliaryType = (ifcType: string): boolean => {
  if (!ifcType) return false;
  return AUXILIARY_EXCLUDE_TYPES.has(ifcType.toUpperCase());
};

export interface LoDResult {
  filteredData: GraphData;
  stats: {
    originalNodes: number;
    filteredNodes: number;
    originalEdges: number;
    filteredEdges: number;
    nodeReduction: number;
    edgeReduction: number;
  };
}

export interface LoDConfig {
  includeGeometry: boolean;
  includePropertySets: boolean;
  includeResourceLayer: boolean;
  bidirectionalOnly: boolean;
  unidirectionalOnly: boolean;
  customFilter?: (node: GraphNode) => boolean;
}

/**
 * Entity Classification for LPG Transformation
 */
export enum EntityClass {
  Resource = 'resource',      // No GUID, text identifiers (IfcLabel, IfcUnit)
  Bridging = 'bridging',      // Relationships, link objects
  Full = 'full',              // Standard objects with GUIDs
}

/**
 * Classify entity based on type
 */
export function classifyEntity(node: GraphNode): EntityClass {
  const type = (node.ifcType || '').toUpperCase();
  
  // Resource entities (no GUID)
  const resourceTypes = new Set([
    'IFCLABEL', 'IFCTEXT', 'IFCIDENTIFIER', 'IFCINTEGER', 'IFCREAL',
    'IFCBOOLEAN', 'IFCLOGICAL', 'IFCDATETIME', 'IFCDATE', 'IFCTIME',
    'IFCLENGTHME ASURE', 'IFCAREAMEASURE', 'IFCVOLUMEMEASURE',
    'IFCSIUNIT', 'IFCCONVERSIONBASEDUNIT', 'IFCDERIVEDUNIT',
    'IFCCOLOURRGB', 'IFCDIRECTION', 'IFCCARTESIANPOINT',
  ]);
  
  // Bridging entities (relationships)
  if (type.startsWith('IFCREL') || node.type === 'relationship') {
    return EntityClass.Bridging;
  }
  
  const globalId = node.properties?.GlobalId ??
    node.properties?.GLOBALID ??
    node.properties?.globalId ??
    node.properties?.globalid;

  // Resource entities
  if (resourceTypes.has(type)) {
    return EntityClass.Resource;
  }

  // If GlobalId missing, treat as full unless explicitly resource type
  if (!globalId) {
    return EntityClass.Full;
  }
  
  // Full entities
  return EntityClass.Full;
}

/**
 * Get LoD configuration
 *
 * Based on research paper: "Revealing the internal structure of IFC-Graph"
 *
 * Core principle: Relationships are the BACKBONE of IFC structure.
 * They must be included at ALL LoD levels (LoD1+) to maintain graph coherence.
 *
 * What varies by LoD level:
 * - LoD1: Only spatial relationships (simplest navigation)
 * - LoD2: ALL relationships + basic objects (core structure)
 * - LoD3: ALL relationships + property sets + objects
 * - LoD4: ALL relationships + inverse attributes + everything except geometry
 */
export function getLoDConfig(lod: GraphLoD, includeAuxiliary: boolean = false): LoDConfig {
  // Admin types that should NEVER appear (administrative metadata)
  const ADMIN_EXCLUDE_TYPES = new Set([
    'IFCOWNERHISTORY', 'IFCPERSON', 'IFCORGANIZATION', 'IFCPERSONANDORGANIZATION', 'IFCAPPLICATION',
    'IFCMAPCONVERSION', 'IFCPROJECTEDCRS',
    'IFCCOMPLEXPROPERTY',
    // TODO: Re-enable when LPG edge extraction supports these types
    'IFCRELSPACEBOUNDARY', 'IFCRELSPACEBOUNDARY1STLEVEL', 'IFCRELSPACEBOUNDARY2NDLEVEL',
    'IFCRELCONNECTSPATHELEMENTS',
  ]);

  // Auxiliary types: geometric primitives, style definitions, schema metadata
  // These are excluded from visualization but can be included for special use cases
  const AUXILIARY_EXCLUDE_TYPES = new Set([
    // Geometric primitives - mathematical helpers
    'IFCDIRECTION', 'IFCPLANE', 'IFCCARTESIANPOINT', 'IFCLINE', 'IFCCIRCLE',
    'IFCCIRCULARARCPOINTANDRADIUS', 'IFCELLIPSE', 'IFCPOLYLINE', 'IFCPOLYLOOP',
    'IFCCOMPOSITECURVE', 'IFCPOLYCURVE', 'IFCBOUNDEDCURVE', 'IFCBSPLINECURVE',
    'IFCBSPLINESURFACE', 'IFCCURVEBOUNDEDPLANE', 'IFCRECTANGULARTRIMMEDSURFACE',
    'IFCSURFACEOFLINEAREXTRUSION', 'IFCSURFACEOFREVOLUTION', 'IFCSWEPTSURFACE',

    // Profile definitions - geometric templates
    'IFCRECTANGLEPROFILEDEF', 'IFCRECTANGLEHOLLOWPROFILEDEF', 'IFCCIRCLEPROFILEDEF',
    'IFCIBEAMPROFILEDEF', 'IFCLSHAPEPROFILEDEF', 'IFCTSHAPEPROFILEDEF',
    'IFCUPROFILEDEF', 'IFCCPROFILEDEF', 'IFCZPROFILEDEF', 'IFCCOMPLEXPROFILEDEF',
    'IFCPOLYLINEPROFILEDEF', 'IFCCENTRELINEPROFILEDEF', 'IFCPARAMETERIZEDPROFILEDEF',

    // Solid/representation primitives
    'IFCBLOCK', 'IFCRECTANGULARBOX', 'IFCWEDGE', 'IFCHALFSPACESOLID',
    'IFCPOLYGONALBOUNDEDHALFSPACE', 'IFCBOXEDHALFSPACE', 'IFCPRIMITIVESHAPE3D',
    'IFCEXTRUDEDAREASOLID', 'IFCREVOLVEDAREASOLID', 'IFCSWEPTSURFACESOLID',
    'IFCMAPPEDITEM', 'IFCFACEOUTERBOUND', 'IFCFACE', 'IFCFACETEDBREP',
    'IFCBOOLEANCLIPPINGRESULT', 'IFCCLOSEDSHELL',

    // Representation and placement - structural metadata only
    'IFCPRODUCTDEFINITIONSHAPE', 'IFCSHAPEREPRESENTATION', 'IFCGEOMETRICREPRESENTATIONCONTEXT',
    'IFCLOCALPLACEMENT', 'IFCAXIS2PLACEMENT2D', 'IFCAXIS2PLACEMENT3D',

    // Style and appearance definitions
    'IFCSURFACESTYLE', 'IFCSURFACESTYLERENDERING', 'IFCCURVESTYLE', 'IFCTEXTUREMAP',
    'IFCFILLAREASTYLE', 'IFCFILLAREASTYLEHATCHING', 'IFCFILLAREASTYLETILES',
    'IFCHATCHLINESTYLE', 'IFCSTYLEMODEL', 'IFCSTYLEDITEM',
    'IFCPRESENTATIONSTYLEASSIGNMENT', 'IFCPRESENTATIONLAYERASSIGNMENT',
    'IFCCOLOURRGB', 'IFCCOLOURRGBANDCOMPONENTS', 'IFCCOLOURPROXY',

    // Text and font styling (not showing in graph visualization)
    'IFCTEXTSTYLE', 'IFCTEXTSTYLEFONTMODEL', 'IFCTEXTSTYLEFORDEFINEDFONT',
    'IFCFONTSELECTION', 'IFCFONTSPECIFICATION', 'IFCFONTDESIGNALLPROPERTIESFONTSPECIFICATION',

    // Window/Door property details
    'IFCWINDOWLININGPROPERTIES', 'IFCWINDOWPANELPROPERTIES',
    'IFCDOORCLOSINGPROPERTIES', 'IFCDOORSTYLEPANELPROPERTIES',
    'IFCDOORSTYLEARRANGEMENT', 'IFCDOORPANELPROPERTIES',
    'IFCDOORSTYLELININGPROPERTIES', 'IFCSHAPEASPECT',
    'IFCSHELLBASEDSURFACEMODEL', 'IFCTESSELLATEDFACESET', 'IFCSHAPEMODEL',

    // Material layer details
    'IFCMATERIALLAYER', 'IFCMATERIALLAYERSET', 'IFCMATERIALLAYERSETUSAGE',
    'IFCMATERIALLAYERWITHOFFFSETS', 'IFCMATERIALCOMPONENT',
    'IFCMATERIALDEFINITIONREPRESENTATION', 'IFCMATERIALPROPERTIES',

    // Unit and measure definitions - schema metadata
    'IFCSIUNIT', 'IFCUNITASSIGNMENT', 'IFCCONVERSIONBASEDUNIT', 'IFCDERIVEDUNIT',
    'IFCDERIVEDUNITELEMENT', 'IFCDIMENSIONALEXPONENTS', 'IFCNAMEDUNIT', 'IFCUNIT',
    'IFCMEASUREWITHUNIT', 'IFCMONETARYMEASURE', 'IFCDIMENSIONCOUNT',

    // Quantity nodes - container metadata
    'IFCQUANTITY', 'IFCQUANTITYAREA', 'IFCQUANTITYCOUNT', 'IFCQUANTITYLENGTH',
    'IFCQUANTITYTIME', 'IFCQUANTITYVOLUME', 'IFCQUANTITYWEIGHT',

    // Classification reference metadata
    'IFCCLASSIFICATION', 'IFCCLASSIFICATIONREFERENCE',

    // Geometry extent/bounds metadata (not semantic entities)
    'IFCPLANAREXTENT', 'IFCBOUNDINGBOX', 'IFCGEOMETRICSET',
    'IFCBOUNDINBOX2D', 'IFCBOUNDINBOX3D',

    // Topology representation items (geometric structure only)
    'IFCTOPOLOGYREPRESENTATIONITEM', 'IFCVERTEX', 'IFCVERTEXPOINT',
    'IFCEDGE', 'IFCEDGECURVE', 'IFCORIENTEDEDGE', 'IFCPATH',
    'IFCLOOP', 'IFCPOLYLINELOOPS', 'IFCFACE', 'IFCCFACESURFACE',
    'IFCFACEBOUND', 'IFCFACEOUTERBOUNDS', 'IFCSHELL', 'IFCOPENSHELL', 'IFCCLOSEDSHELL',

    // Additional geometry representation metadata
    'IFCGEOMETRICREPRESENTATIONSUBCONTEXT', 'IFCTESSELLATEDITEM',
    'IFCGEOMETRICALLYREPRESENTEDOBJECT',

    // Property representations (not individual properties - these are value containers)
    'IFCPROPERTYDEFINITION', 'IFCPROPERTYENUMERATION',
    'IFCPROPERTYREFERENCEVALUE', 'IFCPROPERTYBOUNDEDVALUE',
    'IFCPROPERTYSINGLEVALUE', 'IFCPROPERTYENUMERATEDVALUE',
    'IFCPROPERTYTABLEVALUE', 'IFCPROPERTYLISTVALUE',
  ]);

  const shouldExcludeAux = !includeAuxiliary;

  switch (lod) {
    case GraphLoD.LoD4_Core:
      // EVERYTHING except pure geometry
      // Includes: All relationships + all objects + property sets + everything
      return {
        includeGeometry: false,
        includePropertySets: true,
        includeResourceLayer: false,
        bidirectionalOnly: false,
        unidirectionalOnly: false,
        customFilter: (node) => {
          const type = node.ifcType.toUpperCase();

          // Exclude admin types only
          if (ADMIN_EXCLUDE_TYPES.has(type)) return false;
          if (shouldExcludeAux && AUXILIARY_EXCLUDE_TYPES.has(type)) return false;

          // Include everything else - ALL relationships, ALL objects, ALL property sets
          return true;
        },
      };

    case GraphLoD.LoD3_Essential:
      // ALL relationships + ALL objects + property sets
      // Excludes: Types (schema templates), auxiliary types
      return {
        includeGeometry: false,
        includePropertySets: true,
        includeResourceLayer: false,
        bidirectionalOnly: false,
        unidirectionalOnly: false,
        customFilter: (node) => {
          const type = node.ifcType.toUpperCase();

          // Exclude admin types
          if (ADMIN_EXCLUDE_TYPES.has(type)) return false;
          if (shouldExcludeAux && AUXILIARY_EXCLUDE_TYPES.has(type)) return false;

          // Type definitions are not meaningful without their instances
          const typeDefinitions = new Set([
            'IFCWALLTYPE', 'IFCDOORTYPE', 'IFCWINDOWTYPE', 'IFCCOLUMNTYPE',
            'IFCSLABTYPE', 'IFCBEAMTYPE', 'IFCRAMPTYPE', 'IFCSTAIRTYPE',
            'IFCRAILINGTYPE', 'IFCMEMBERTYPE', 'IFCSPACETYPE',
            'IFCBUILDINGELEMENTPROXYTYPE', 'IFCCOVERINGTYPE', 'IFCDISTRIBUTIONELEMENTTYPE',
            'IFCDUCTFITTINGTYPE', 'IFCDUCTSEGMENTTYPE', 'IFCAIRTERMINALTYPE',
            'IFCPIPEFITTINGTYPE', 'IFCPIPESEGMENTTYPE', 'IFCPUMPTYPE', 'IFCFANTYPE',
            'IFCDOORSTYLE', 'IFCWINDOWSTYLE',
          ]);

          // ✅ CRITICAL: Keep ALL IFCREL* types (relationships are the backbone!)
          if (type.startsWith('IFCREL')) return true;

          // Exclude type definitions
          return !typeDefinitions.has(type);
        },
      };

    case GraphLoD.LoD2_Least:
      // ALL relationships + basic objects (with direct attributes only)
      // Excludes: type definitions, organization/grouping, MEP utility ports, property set CONTAINERS
      return {
        includeGeometry: false,
        includePropertySets: false,
        includeResourceLayer: false,
        bidirectionalOnly: false,
        unidirectionalOnly: false,
        customFilter: (node) => {
          const type = node.ifcType.toUpperCase();

          // Exclude admin types
          if (ADMIN_EXCLUDE_TYPES.has(type)) return false;
          if (shouldExcludeAux && AUXILIARY_EXCLUDE_TYPES.has(type)) return false;

          // ✅ CRITICAL: Keep ALL IFCREL* types (relationships are the backbone!)
          if (type.startsWith('IFCREL')) return true;

          // For LoD2, exclude these non-relationship entity types
          const excludeObjectTypes = new Set([
            // Type definitions (schema templates, not instances)
            'IFCWALLTYPE', 'IFCDOORTYPE', 'IFCWINDOWTYPE', 'IFCCOLUMNTYPE',
            'IFCSLABTYPE', 'IFCBEAMTYPE', 'IFCRAMPTYPE', 'IFCSTAIRTYPE',
            'IFCRAILINGTYPE', 'IFCMEMBERTYPE', 'IFCSPACETYPE',
            'IFCBUILDINGELEMENTPROXYTYPE', 'IFCCOVERINGTYPE', 'IFCDISTRIBUTIONELEMENTTYPE',
            'IFCDUCTFITTINGTYPE', 'IFCDUCTSEGMENTTYPE', 'IFCPUMPTYPE', 'IFCFANTYPE',
            'IFCDOORSTYLE', 'IFCWINDOWSTYLE',
            // Organization and grouping (not essential for core structure)
            'IFCZONE', 'IFCSYSTEM', 'IFCGROUP',
            // MEP utility ports (not essential for basic structure)
            'IFCDISTRIBUTIONPORT', 'IFCFLOWSEGMENT', 'IFCFLOWFITTING',
            'IFCTERMINALDEVICE',
            // NOTE: IFCPROPERTYSET and IFCELEMENTQUANTITY are filtered separately in applyLoD
            // NOTE: IFCMATERIAL is KEPT (needed for IfcRelAssociatesMaterial relationships)
          ]);

          return !excludeObjectTypes.has(type);
        },
      };

    case GraphLoD.LoD1_Utility:
      // Bare minimum: spatial hierarchy only + spatial relationships
      // For navigation/pathfinding use cases
      return {
        includeGeometry: false,
        includePropertySets: false,
        includeResourceLayer: false,
        bidirectionalOnly: false,
        unidirectionalOnly: false,
        customFilter: (node) => {
          const type = node.ifcType.toUpperCase();

          // Exclude admin types
          if (ADMIN_EXCLUDE_TYPES.has(type)) return false;
          if (shouldExcludeAux && AUXILIARY_EXCLUDE_TYPES.has(type)) return false;

          // Only spatial structure entities
          const spatialTypes = new Set([
            'IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY', 'IFCSPACE'
          ]);
          if (spatialTypes.has(type)) return true;

          // ✅ Only spatial relationships in LoD1
          if (type === 'IFCRELAGGREGATES') return true;
          if (type === 'IFCRELCONTAINEDINSPATIALSTRUCTURE') return true;

          return false;
        },
      };

    default:
      return getLoDConfig(GraphLoD.LoD4_Core);
  }
}

/**
 * Apply LoD filter to graph data
 */
export function applyLoD(
  nodes: GraphNode[],
  edges: GraphEdge[],
  lod: GraphLoD,
  options?: { includeAuxiliary?: boolean }
): LoDResult {
  const addBidirectionalEdges = (inputEdges: GraphEdge[]): GraphEdge[] => {
    const result: GraphEdge[] = [...inputEdges];
    const seen = new Set(inputEdges.map(e => e.id));
    inputEdges.forEach(edge => {
      // Create inverse edges to simulate bidirectional links (relationship-node model)
      const inverseId = `${edge.id}__inv`;
      if (!seen.has(inverseId)) {
        // Swap role labels for inverse edges
        let inverseLabel = edge.label;
        if (edge.label === 'relating') {
          inverseLabel = 'related';
        } else if (edge.label === 'related') {
          inverseLabel = 'relating';
        }
        result.push({
          ...edge,
          id: inverseId,
          source: edge.target,
          target: edge.source,
          label: inverseLabel,
          type: edge.type,
        });
        seen.add(inverseId);
      }
    });
    return result;
  };
  const config = getLoDConfig(lod, options?.includeAuxiliary ?? false);
  logger.graph.lodChanged(lod);
  
  // Filter nodes based on LoD
  const filteredNodes = nodes.filter(node => {
    // Apply custom filter if provided
    if (config.customFilter && !config.customFilter(node)) {
      return false;
    }

    // Filter geometry
    if (!config.includeGeometry && node.type === 'geometry') {
      return false;
    }

    // CRITICAL FIX: Don't filter ALL property nodes - only filter PROPERTY CONTAINERS
    // Property values (IfcPropertySingleValue, etc.) should stay to maintain relationships
    // Only filter the containers (IFCPROPERTYSET, IFCELEMENTQUANTITY)
    const ifcType = (node.ifcType || '').toUpperCase();
    const propertyContainerTypes = new Set([
      'IFCPROPERTYSET',
      'IFCELEMENTQUANTITY',
    ]);

    if (!config.includePropertySets && propertyContainerTypes.has(ifcType)) {
      return false;  // Only filter property containers, not individual property values
    }

    // Filter resource layer
    if (!config.includeResourceLayer && classifyEntity(node) === EntityClass.Resource) {
      return false;
    }

    return true;
  });
  
  const nodeIds = new Set(filteredNodes.map(n => n.id));
  const nodeById = new Map(filteredNodes.map(n => [n.id, n]));

  const normalizeNodeId = (value: GraphEdge['source']): string => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'id' in value) {
      return String((value as { id: string }).id);
    }
    return String(value);
  };

  // Normalize edges to avoid mutated source/target objects from force-graph
  const normalizedEdges: GraphEdge[] = edges.map(edge => ({
    ...edge,
    source: normalizeNodeId(edge.source),
    target: normalizeNodeId(edge.target),
  }));
  
  // Build edge connectivity map for bidirectional filtering
  const edgeMap = new Map<string, Set<string>>();
  normalizedEdges.forEach(edge => {
    if (!edgeMap.has(edge.source)) {
      edgeMap.set(edge.source, new Set());
    }
    if (!edgeMap.has(edge.target)) {
      edgeMap.set(edge.target, new Set());
    }
    edgeMap.get(edge.source)!.add(edge.target);
    edgeMap.get(edge.target)!.add(edge.source);
  });
  
  const getEdgeType = (edge: GraphEdge): string => {
    return (edge.relationshipType || edge.type || edge.label || '').toUpperCase();
  };

  const isRelationshipNodeId = (nodeId: string): boolean => {
    const node = nodeById.get(nodeId);
    if (!node) return false;
    return node.type === 'relationship' || (node.ifcType || '').toUpperCase().startsWith('IFCREL');
  };

  // Filter edges based on LoD
  const filteredEdges = normalizedEdges.filter(edge => {
    // Must have both nodes present
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      return false;
    }

    const type = getEdgeType(edge);

    if (lod === GraphLoD.LoD4_Core) {
      // Full core: ALL relationships + all attributes
      // Exclude only pure geometry/representation metadata
      if (type.includes('GEOMETRY') || type.includes('REPRESENTATION')) return false;
      return true;
    }

    if (lod === GraphLoD.LoD3_Essential) {
      // Essential: ALL relationships + all objects + property sets
      // Exclude: pure metadata (geometry, appearance, placement)
      if (type.includes('GEOMETRY') || type.includes('REPRESENTATION') || type.includes('PLACEMENT')) return false;
      if (type.includes('SURFACESTYLE') || type.includes('CURVESTYLE') || type.includes('TEXTURE')) return false;
      return true;
    }

    if (lod === GraphLoD.LoD2_Least) {
      // Least: ALL relationships + basic objects (direct attributes only)
      // Relationships are the backbone - include ALL connectivity
      // In LPG model: Entity -(relating)-> RelNode -(related)-> Entity
      if (edge.label !== 'relating' && edge.label !== 'related') return false;

      // Include relationship edges of all types (they're all part of the backbone)
      // Exclude only edges to nodes we've already filtered out (handled above by nodeIds check)
      return true;
    }

    if (lod === GraphLoD.LoD1_Utility) {
      // Utility: Spatial hierarchy only
      if (edge.label !== 'relating' && edge.label !== 'related') return false;

      // Only spatial and containment relationships
      if (type.includes('AGGREGATES')) return true;
      if (type.includes('CONTAINEDINSPATIALSTRUCTURE')) return true;
      return false;
    }

    return true;
  });

  const finalEdges = (lod >= GraphLoD.LoD3_Essential)
    ? addBidirectionalEdges(filteredEdges)
    : filteredEdges;

  // Post-filter: remove relationship nodes that lost ALL their edges after filtering.
  // This prevents floating IFCREL* nodes when their connected endpoints are excluded at lower LoD levels.
  const connectedNodeIds = new Set<string>();
  for (const edge of finalEdges) {
    connectedNodeIds.add(typeof edge.source === 'string' ? edge.source : String(edge.source));
    connectedNodeIds.add(typeof edge.target === 'string' ? edge.target : String(edge.target));
  }
  const finalNodes = filteredNodes.filter(node => {
    // Keep non-relationship nodes always
    if (node.type !== 'relationship' && !(node.ifcType || '').toUpperCase().startsWith('IFCREL')) {
      return true;
    }
    // Relationship nodes: only keep if they have at least one edge
    return connectedNodeIds.has(node.id);
  });

  logger.info(`LoD${lod} applied: ${finalNodes.length} nodes, ${finalEdges.length} edges (reduced from ${nodes.length} nodes, ${edges.length} edges)`);
  
  const nodeReduction = nodes.length > 0 ? ((1 - finalNodes.length / nodes.length) * 100).toFixed(1) : '0';
  const edgeReduction = edges.length > 0 ? ((1 - filteredEdges.length / edges.length) * 100).toFixed(1) : '0';

  return {
    filteredData: {
      nodes: finalNodes,
      edges: finalEdges,
    },
    stats: {
      originalNodes: nodes.length,
      filteredNodes: finalNodes.length,
      originalEdges: edges.length,
      filteredEdges: filteredEdges.length,
      nodeReduction: parseFloat(nodeReduction),
      edgeReduction: parseFloat(edgeReduction),
    },
  };
}

/**
 * Get LoD statistics
 */
export function getLoDStats(lod: GraphLoD, originalData: GraphData, filteredData: GraphData) {
  const nodeReduction = ((1 - filteredData.nodes.length / originalData.nodes.length) * 100).toFixed(1);
  const edgeReduction = ((1 - filteredData.edges.length / originalData.edges.length) * 100).toFixed(1);
  
  return {
    lod,
    lodName: GraphLoD[lod],
    originalNodes: originalData.nodes.length,
    filteredNodes: filteredData.nodes.length,
    nodeReduction: `${nodeReduction}%`,
    originalEdges: originalData.edges.length,
    filteredEdges: filteredData.edges.length,
    edgeReduction: `${edgeReduction}%`,
  };
}

/**
 * Get recommended LoD based on graph size and use case
 */
export function getRecommendedLoD(nodeCount: number, useCase: 'visualization' | 'analysis' | 'pathfinding'): GraphLoD {
  if (useCase === 'pathfinding') {
    return GraphLoD.LoD1_Utility;
  }
  
  if (useCase === 'analysis') {
    if (nodeCount > 10000) return GraphLoD.LoD2_Least;
    if (nodeCount > 5000) return GraphLoD.LoD3_Essential;
    return GraphLoD.LoD4_Core;
  }
  
  // Visualization
  if (nodeCount > 20000) return GraphLoD.LoD2_Least;
  if (nodeCount > 10000) return GraphLoD.LoD3_Essential;
  if (nodeCount > 5000) return GraphLoD.LoD4_Core;
  return GraphLoD.LoD4_Core;
}
