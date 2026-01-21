/**
 * IFC Graph Level of Detail (LoD) Framework
 * Based on research: "IfcGraphLoD: A framework for graph-based IFC data visualization"
 * 
 * Implements 5 levels of detail:
 * LoD5 (Full Graph): Resource layer + full semantics + geometry
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
  LoD5_Full = 5,        // Everything including geometry
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
 */
export function getLoDConfig(lod: GraphLoD, includeAuxiliary: boolean = false): LoDConfig {
  // Admin types that should NEVER appear in any visualization
  const ADMIN_EXCLUDE_TYPES = new Set([
    'IFCOWNERHISTORY', 'IFCPERSON', 'IFCORGANIZATION', 'IFCPERSONANDORGANIZATION', 'IFCAPPLICATION',
  ]);

  // Auxiliary/support types that are not meaningful entities for visualization
  // These are geometric primitives, style definitions, and schema metadata
  const AUXILIARY_EXCLUDE_TYPES = new Set([
    // Geometric primitives - mathematical helpers, not real entities
    'IFCDIRECTION',                        // Vector definitions (1052 instances)
    'IFCPLANE',                            // Plane definitions (2188 instances)
    'IFCCARTESIANPOINT',                   // Point definitions
    'IFCLINE',                             // Line definitions
    'IFCCIRCLE',                           // Circle definitions
    'IFCCIRCULARARCPOINTANDRADIUS',
    'IFCELLIPSE',                          // Ellipse definitions
    'IFCPOLYLINE',                         // Polyline definitions
    'IFCPOLYLOOP',                         // Polygon loop
    'IFCCOMPOSITECURVE',
    'IFCPOLYCURVE',
    'IFCBOUNDEDCURVE',
    'IFCBSPLINECURVE',
    'IFCBSPLINESURFACE',
    'IFCCURVEBOUNDEDPLANE',
    'IFCRECTANGULARTRIMMEDSURFACE',
    'IFCSURFACEOFLINEAREXTRUSION',
    'IFCSURFACEOFREVOLUTION',
    'IFCSWEPTSURFACE',
    
    // Profile definitions - geometric templates
    'IFCRECTANGLEPROFILEDEF',
    'IFCRECTANGLEHOLLOWPROFILEDEF',
    'IFCCIRCLEPROFILEDEF',
    'IFCCIRCLEHOWTOPROFILEDEF',
    'IFCIBEAMPROFILEDEF',
    'IFCLSHAPEPROFILEDEF',
    'IFCTSHAPEPROFILEDEF',
    'IFCUPROFILEDEF',
    'IFCCPROFILEDEF',
    'IFCZPROFILEDEF',
    'IFCTRAPEZOIDAL PROFILEDEF',
    'IFCASYMETRICISHAPEPROFILEDEF',
    'IFCCOMPLEXPROFILEDEF',
    'IFCARBITRARYCLOSEDPROFILESEGMENT',
    'IFCPOLYLINEPROFILEDEF',
    'IFCCENTRELINEPROFILEDEF',
    'IFCPARAMETERIZEDPROFILEDEF',
    'IFCARBITRARYCLOSEDPROFILEDEF',     // Arbitrary profile definition
    
    // Solid/representation primitives
    'IFCBLOCK',
    'IFCRECTANGULARBOX',
    'IFCWEDGE',
    'IFCHALFSPACESOLID',
    'IFCPOLYGONALBOUNDEDHALFSPACE',
    'IFCBOXEDHALFSPACE',
    'IFCPRIMITIVESHAPE3D',
    'IFCEXTRUDEDAREASOLID',                // (676 instances)
    'IFCREVOLVEDAREASOLID',
    'IFCSWEPTSURFACESOLID',
    'IFCEXTRUDEDAREASSIMPLIFIED',          // Simplified geometry
    'IFCMAPPEDITEM',                       // Mapped geometry instances
    'IFCFACEOUTERBOUND',                  // Face boundary
    'IFCFACE',                             // Face geometry
    'IFCFACETEDBREP',                      // Faceted B-rep representation
    'IFCBOOLEANCLIPPINGRESULT',            // Boolean clipping result
    'IFCCLOSEDSHELL',                     // Shell geometry
    
    // Representation and placement - structural metadata NOT visual elements
    'IFCPRODUCTDEFINITIONSHAPE',          // Shape representation container (largest floating node source!)
    'IFCSHAPEREPRESENTATION',              // Shape representation metadata
    'IFCGEOMETRICREPRESENTATIONCONTEXT',   // Geometric representation context
    'IFCLOCALPLACEMENT',                  // Coordinate system placement
    'IFCAXIS2PLACEMENT2D',                // 2D coordinate system
    'IFCAXIS2PLACEMENT3D',                // 3D coordinate system
    
    // Style and appearance definitions
    'IFCSURFACESTYLE',                     // Surface styling
    'IFCSURFACESTYLERENDERING',            // Surface rendering properties
    'IFCCURVESTYLE',                       // Curve styling
    'IFCTEXTUREMAP',                       // Texture mapping
    'IFCFILLAREASTYLE',
    'IFCFILLAREASTYLEHATCHING',            // (14 instances)
    'IFCFILLAREASTYLETILES',
    'IFCHATCHLINESTYLE',
    'IFCSTYLEMODEL',
    'IFCSTYLEDITEM',                       // Styled item (visual properties)
    'IFCPRESENTATIONSTYLEASSIGNMENT',     // Presentation style assignment
    'IFCPRESENTATIONLAYERASSIGNMENT',      // Presentation layer assignment
    'IFCCOLOURRGB',                        // Color definition
    'IFCCOLOURRGBANDCOMPONENTS',
    'IFCCOLOURPROXY',
    
    // Type definitions - schema templates, not instances
    'IFCWALLTYPE',                         // Type templates
    'IFCDOORTYPE',
    'IFCWINDOWTYPE',
    'IFCSLABTYPE',
    'IFCCOLUMNTYPE',
    'IFCBEAMTYPE',
    'IFCDUCTTYPE',
    'IFCPIPESEGMENTTYPE',
    'IFCPUMPTYPE',
    'IFCFANTYPE',
    'IFCCHILLERTYPE',
    'IFCCOILTYPE',
    'IFCBOILERTYPE',
    'IFCCOVERINGTYPE',
    'IFCTYPEDEFINITION',                  // Generic type definition
    'IFCRELDEFINESBYTYPE',                // Type definition relationship
    
    // Window/Door property details
    'IFCWINDOWLININGPROPERTIES',           // (468 instances)
    'IFCWINDOWPANELPROPERTIES',            // (295 instances)
    'IFCDOORCLOSINGPROPERTIES',
    'IFCDOORSTYLEPANELPROPERTIES',
    'IFCDOORSTYLEARRANGEMENT',
    'IFCDOORPANELPROPERTIES',
    'IFCDOORSTYLELININGPROPERTIES',
    'IFCSHAPEASPECT',                      // Shape metadata
    'IFCSHELLBASEDSURFACEMODEL',           // Complex geometry representation
    'IFCTESSELLATEDFACESET',               // Tessellated geometry
    'IFCSHAPEMODEL',
    
    // Material-related metadata
    'IFCMATERIALLAYER',                    // (17 instances)
    'IFCMATERIAL',
    'IFCMATERIALLAYERSET',
    'IFCMATERIALLAYERSETUSAGE',            // Material layer set usage
    'IFCMATERIALLAYERUSAGEPUTATIVE',
    'IFCMATERIALLAYERWITHOFFFSETS',
    'IFCMATERIALCOMPONENT',
    'IFCMATERIALDEFINITIONREPRESENTATION',
    'IFCMATERIALPROPERTIES',
    'IFCMECHANICALCONCRETEMATERIALPROPERTIES',
    'IFCMECHANICALMATERIALPROPERTIES',
    'IFCTHERMALMAATERIALPROPERTIES',
    'IFCWOODFINISHINGPROPERTIES',
    
    // Classification and reference metadata
    'IFCCLASSIFICATION',
    'IFCCLASSIFICATIONREFERENCE',           // Classification reference
    
    // Unit and measure definitions
    'IFCSIUNIT',
    'IFCUNITASSIGNMENT',
    'IFCCONVERSIONBASEDUNIT',
    'IFCDERIVEDUNIT',
    'IFCDERIVEDUNITELEMENT',
    'IFCDIMENSIONALEXPONENTS',
    'IFCNAMEDUNIT',
    'IFCUNIT',
    'IFCMEASUREWITHUNIT',
    'IFCMONETARYMEASURE',
    'IFCDIMENSIONCOUNT',
    'IFCMATERIAL',
    'IFCMATERIALLAYERSET',
    'IFCMATERIALLAYERUSAGEPUTATIVE',
    'IFCMATERIALLAYERWITHOFFFSETS',
    'IFCMATERIALCOMPONENT',
    'IFCMATERIALDEFINITIONREPRESENTATION',
    'IFCMATERIALPROPERTIES',
    'IFCMECHANICALCONCRETEMATERIALPROPERTIES',
    'IFCMECHANICALMATERIALPROPERTIES',
    'IFCTHERMALMAATERIALPROPERTIES',
    'IFCWOODFINISHINGPROPERTIES',
    
    // Unit and measure definitions
    'IFCSIUNIT',                           // (9 instances)
    'IFCUNITASSIGNMENT',                   // (1 instance)
    'IFCCONVERSIONBASEDUNIT',
    'IFCDERIVEDUNIT',
    'IFCDERIVEDUNITELEMENT',
    'IFCDIMENSIONALEXPONENTS',
    'IFCNAMEDUNIT',
    'IFCUNIT',
    'IFCMEASUREWITHUNIT',
    'IFCMONETARYMEASURE',
    'IFCDIMENSIONCOUNT',
    
    // Measurement and quantity primitives
    'IFCQUANTITY',
    'IFCQUANTITYAREA',
    'IFCQUANTITYCOUNT',
    'IFCQUANTITYLENGTH',
    'IFCQUANTITYTIME',
    'IFCQUANTITYVOLUME',
    'IFCQUANTITYWEIGHT',
    'IFCABSORBEDDOSEEQUIVALENTMEASURE',
    'IFCACCELERATIONMEASURE',
    'IFCANGULARVELOCITYMEASURE',
    'IFCAREATEMEASURE',
    'IFCAREAMEASURE',
    'IFCHEATINGVALUEMEASURE',
    'IFCHEATTRANSFERCOEFFICIENTMEASURE',
    'IFCILLUMINANCEMEASURE',
    'IFCINDUCTANCEMEASURE',
    'IFCINTENSITYDISTRIBUTIONMEASURE',
    'IFCKINEMATICVISCOSITYMEASURE',
    'IFCLENGTHKMEASURE',
    'IFCLENGTHME ASURE',
    'IFCLINEARFORCEMEASURE',
    'IFCLINEARMOMENTMEASURE',
    'IFCLINEARSTIFFNESSMEASURE',
    'IFCLINEARVELOCITYMEASURE',
    'IFCLOSSMEASURE',
    'IFCLUMINOUSINTENSITYDISTRIBUTIONMEASURE',
    'IFCLUMINOUSMEASURE',
    'IFCMAGENTOMOVENTUMEASURE',
    'IFCMASSDENSITYMEASURE',
    'IFCMASSMEASURE',
    'IFCMASSPERLENGTHMEASURE',
    'IFCMASSFLOWMEASURE',
    'IFCMODULOFSLIPPAGE',
    'IFCMOISTUREDIFFUSIVITYMEASURE',
    'IFCMOLECULARWEIGHTMEASURE',
    'IFCMOLENTALVOLUMEMEASURE',
    'IFCMOMENTOFINERTIAMEASURE',
    'IFCMONITORINGDEVICEEPRESENTATIONSELECT',
    'IFCNORMALISEDRATIOMEASURE',
    'IFCNUMERICMEASURE',
    'IFCPARAMETERVALUE',
    'IFCPHASEANGLMEASURE',
    'IFCPLANARMEASURE',
    'IFCPLANARSTIFFNESSMEASURE',
    'IFCPLANARFORCEMEASURE',
    'IFCPLANARMOMENTMEASURE',
    'IFCPOWERMEEASURE',
    'IFCPRESSUREMSURE',
    'IFCRADIOACTIVITYMEASURE',
    'IFCROTATIONALFREQUENCYMEASURE',
    'IFCROTATIONALSTIFFNESSMEASURE',
    'IFCROTATIONALMASSM EASURE',
    'IFCROTATIONALVELOCITYMEASURE',
    'IFCROTATIONALMASS MEASURE',
    'IFCSECTIONALAREAINTEGRALMEASURE',
    'IFCSECTIONMODULUSMEASURE',
    'IFCSEISMICBASEISOLATEDDISPLACEMENTMEASURE',
    'IFCSHEARMEASURE',
    'IFCSILUNIT',
    'IFCSIMPLYLIFTEDSPACEKEYRELATIONSHIPTOSPATIALELEMENT',
    'IFCSIZESELECT',
    'IFCSOUNDPOWERMEASURE',
    'IFCSOUNDPRESSUREMEASURE',
    'IFCSPCDEFINE',
    'IFCSPECIFICHEATCAPACITYMEASURE',
    'IFCTAXIWAYTYPEENUM',
    'IFCTEMPERATUREGRADIENTMEASURE',
    'IFCTHERMALCONDUCTIVITYMEASURE',
    'IFCTHERMALEXPANSIONCOEFFICIENTMEASURE',
    'IFCTHERMALRE SISTANCEMEASURE',
    'IFCTHERMALRESIST ANCEMEASURE',
    'IFCTHERMALTRASMITTANCEMEASURE',
    'IFCTHERMALTRANSMITTANCEMEASURE',
    'IFCTIME MEASURE',
    'IFCTIMESERIOS',
    'IFCTIMESERIES',
    'IFCTIMESTEP',
    'IFCTORQUEMEASURE',
    'IFCTORSIONALST IFFNESSMEASURE',
    'IFCTORSIONALSTRAININMEASURE',
    'IFCTORSIONALSTRAIN MEASURE',
    'IFCTOXICITYMEASURE',
    'IFCTRANSMITTANCEMEASURE',
    'IFCVAPOURPERMEABILITYMEASURE',
    'IFCVOLUMETR ICFLOWRATE',
    'IFCVOLUMETRICFLOWRATE',
    'IFCVOLUMEMEASURE',
    'IFCWARPINGCONSTANTMEASURE',
    'IFCWARPINGTORSIONALCONSTANTMEASURE',
    'IFCWASTEATERVOLUME',
    'IFCWASTERSVOLUME',
    'IFCWASTVOLUMETEMPERATURE',
    'IFCWARPINGCONSTANTMEASURE',
  ]);
  
  // For LoD5, allow optional inclusion of auxiliary layer when explicitly requested
  const shouldExcludeAux = !(includeAuxiliary && lod === GraphLoD.LoD5_Full);

  switch (lod) {
    case GraphLoD.LoD5_Full:
      // Complete graph: all geometry, shapes, representations, definitions, and relationships
      return {
        includeGeometry: true,
        includePropertySets: true,
        includeResourceLayer: true,
        bidirectionalOnly: false,
        unidirectionalOnly: false,
        customFilter: (node) => {
          const type = node.ifcType.toUpperCase();
          // Exclude admin and (optionally) auxiliary types
          if (ADMIN_EXCLUDE_TYPES.has(type)) return false;
          if (shouldExcludeAux && AUXILIARY_EXCLUDE_TYPES.has(type)) return false;
          return true;
        },
      };
      
    case GraphLoD.LoD4_Core:
      // All entities, properties, and relationships (except geometry/representations)
      return {
        includeGeometry: false,
        includePropertySets: true,
        includeResourceLayer: false,
        bidirectionalOnly: false,
        unidirectionalOnly: false,
        customFilter: (node) => {
          const type = node.ifcType.toUpperCase();
          
          // Exclude admin and (optionally) auxiliary types
          if (ADMIN_EXCLUDE_TYPES.has(type)) return false;
          if (shouldExcludeAux && AUXILIARY_EXCLUDE_TYPES.has(type)) return false;
          
          // Exclude pure geometric representations
          const geometryExcludes = new Set([
            'IFCSHAPEREPRESENTATION', // Shape representation
            'IFCTOPOLOGYREPRESENTATIONITEM',
            'IFCFACE',
            'IFCFACESET',
          ]);
          return !geometryExcludes.has(type);
        },
      };
      
    case GraphLoD.LoD3_Essential:
      // Essential graph: objects + relationships (exclude property sets and geometry)
      return {
        includeGeometry: false,
        includePropertySets: false,
        includeResourceLayer: false,
        bidirectionalOnly: false,
        unidirectionalOnly: false,
        customFilter: (node) => {
          const type = node.ifcType.toUpperCase();
          
          // Exclude admin, optional auxiliary types, and type definitions
          if (ADMIN_EXCLUDE_TYPES.has(type)) return false;
          if (shouldExcludeAux && AUXILIARY_EXCLUDE_TYPES.has(type)) return false;
          
          const typeDefinitions = new Set([
            'IFCWALLTYPE', 'IFCDOORTYPE', 'IFCWINDOWTYPE', 'IFCCOLUMNTYPE',
            'IFCSLABTYPE', 'IFCBEAMTYPE', 'IFCRAMPTYPE', 'IFCSTAIRTYPE',
            'IFCRAILINGTYPE', 'IFCMEMBERTYPE', 'IFCSPACETYPE',
            'IFCBUILDINGELEMENTPROXYTYPE', 'IFCCOVERINGTYPE', 'IFCDISTRIBUTIONELEMENTTYPE',
            'IFCDUCTFITTINGTYPE', 'IFCDUCTSEGMENTTYPE', 'IFCAIRTERMINALTYPE',
            'IFCPIPEFITTINGTYPE', 'IFCPIPESEGMENTTYPE',
            'IFCDOORSTYLE', 'IFCWINDOWSTYLE',
          ]);
          return !typeDefinitions.has(type);
        },
      };
      
    case GraphLoD.LoD2_Least:
      // Least graph: objects + relationships (one-way only, exclude property/material relationships)
      return {
        includeGeometry: false,
        includePropertySets: false,
        includeResourceLayer: false,
        bidirectionalOnly: false,
        unidirectionalOnly: false,
        customFilter: (node) => {
          const type = node.ifcType.toUpperCase();
          
          // Exclude admin and optional auxiliary types
          if (ADMIN_EXCLUDE_TYPES.has(type)) return false;
          if (shouldExcludeAux && AUXILIARY_EXCLUDE_TYPES.has(type)) return false;
          
          const excludeTypes = new Set([
            // Type definitions
            'IFCWALLTYPE', 'IFCDOORTYPE', 'IFCWINDOWTYPE', 'IFCCOLUMNTYPE',
            'IFCSLABTYPE', 'IFCBEAMTYPE', 'IFCRAMPTYPE', 'IFCSTAIRTYPE',
            'IFCRAILINGTYPE', 'IFCMEMBERTYPE', 'IFCSPACETYPE',
            'IFCBUILDINGELEMENTPROXYTYPE', 'IFCCOVERINGTYPE', 'IFCDISTRIBUTIONELEMENTTYPE',
            'IFCDOORSTYLE', 'IFCWINDOWSTYLE',
            // Organization/grouping
            'IFCZONE', 'IFCSYSTEM', 'IFCGROUP',
            // MEP/utility
            'IFCDISTRIBUTIONPORT', 'IFCFLOWSEGMENT', 'IFCFLOWFITTING',
            'IFCTERMINALDEVICE',
            // Property/definition relationships (LoD3+ only)
            'IFCRELDEFINESBYPROPERTIES',
            'IFCRELDEFINESBYTEMPLATE',
          ]);
          return !excludeTypes.has(type);
        },
      };
      
    case GraphLoD.LoD1_Utility:
      // Ultra-minimal: spatial hierarchy only (for pathfinding/navigation)
      return {
        includeGeometry: false,
        includePropertySets: false,
        includeResourceLayer: false,
        bidirectionalOnly: false,
        unidirectionalOnly: false,
        customFilter: (node) => {
          const type = node.ifcType.toUpperCase();
          
          // Exclude admin and optional auxiliary types
          if (ADMIN_EXCLUDE_TYPES.has(type)) return false;
          if (shouldExcludeAux && AUXILIARY_EXCLUDE_TYPES.has(type)) return false;
          
          // Only spatial structure for pathfinding
          const spatialTypes = new Set(['IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY', 'IFCSPACE']);
          return spatialTypes.has(node.ifcType.toUpperCase());
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
    // Apply custom filter if provided (LoD1)
    if (config.customFilter && !config.customFilter(node)) {
      return false;
    }
    
    // Filter geometry
    if (!config.includeGeometry && node.type === 'geometry') {
      return false;
    }
    
    // Filter property sets
    if (!config.includePropertySets && node.type === 'property') {
      return false;
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

    if (lod === GraphLoD.LoD3_Essential) {
      // Keep core semantic relationships, drop property/material/geometry links
      if (type.includes('DEFINESBYPROPERTIES') || type.includes('PROPERTYSET')) return false;
      if (type.includes('ASSOCIATESMATERIAL') || type.includes('ASSOCIATESCLASSIFICATION')) return false;
      if (type.includes('GEOMETRY') || type.includes('REPRESENTATION') || type.includes('MATERIAL')) return false;
      return true;
    }

    if (lod === GraphLoD.LoD2_Least) {
      // Keep only primary spatial/decomposition/connectivity relationships (one-way)
      // Unidirectional in relationship-node model: relationship -> object only
      if (!isRelationshipNodeId(edge.source)) return false;
      if (edge.label !== 'relating' && edge.label !== 'related') return false;
      if (type.includes('AGGREGATES')) return true;
      if (type.includes('CONTAINEDINSPATIALSTRUCTURE')) return true;
      if (type.includes('VOIDSELEMENT') || type.includes('FILLSELEMENT')) return true;
      if (type.includes('CONNECTS') || type.includes('CONNECTEDTO')) return true;
      if (type.includes('RELATES')) return true;
      return false;
    }

    if (lod === GraphLoD.LoD1_Utility) {
      // Spatial hierarchy only
      if (type.includes('AGGREGATES')) return true;
      if (type.includes('CONTAINEDINSPATIALSTRUCTURE')) return true;
      return false;
    }

    return true;
  });
  
  const finalEdges = (lod >= GraphLoD.LoD3_Essential)
    ? addBidirectionalEdges(filteredEdges)
    : filteredEdges;

  logger.info(`LoD${lod} applied: ${filteredNodes.length} nodes, ${finalEdges.length} edges (reduced from ${nodes.length} nodes, ${edges.length} edges)`);
  
  const nodeReduction = nodes.length > 0 ? ((1 - filteredNodes.length / nodes.length) * 100).toFixed(1) : '0';
  const edgeReduction = edges.length > 0 ? ((1 - filteredEdges.length / edges.length) * 100).toFixed(1) : '0';
  
  return {
    filteredData: {
      nodes: filteredNodes,
      edges: finalEdges,
    },
    stats: {
      originalNodes: nodes.length,
      filteredNodes: filteredNodes.length,
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
  return GraphLoD.LoD5_Full;
}
