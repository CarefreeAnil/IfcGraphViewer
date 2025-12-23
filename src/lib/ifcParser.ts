import * as WebIFC from 'web-ifc';
import { GraphData, GraphNode, GraphEdge, NodeType, ParsedIFCData } from '@/types/graph';
import { validateIFCData } from '@/lib/ifcValidator';
import { getEntityDef, getEntityColor, getEntityIcon, getEntityDisplayName, getEntityCategory } from '@/lib/ifcSchema';

// Geometry-related IFC types to exclude (these deal with visual representations)
const GEOMETRY_TYPES = new Set([
  'IFCSHAPEREPRESENTATION',
  'IFCPRODUCTREPRESENTATION',
  'IFCPRODUCTDEFINITIONSHAPE',
  'IFCREPRESENTATIONCONTEXT',
  'IFCGEOMETRICREPRESENTATIONCONTEXT',
  'IFCGEOMETRICREPRESENTATIONSUBCONTEXT',
  'IFCREPRESENTATIONMAP',
  'IFCMAPPEDITEM',
  'IFCSTYLEDITEM',
  'IFCSTYLEDREPRESENTATION',
  'IFCPRESENTATIONSTYLE',
  'IFCPRESENTATIONSTYLEASSIGNMENT',
  'IFCSURFACESTYLE',
  'IFCSURFACESTYLERENDERING',
  'IFCSURFACESTYLESHADING',
  'IFCSURFACESTYLELIGHTING',
  'IFCSURFACESTYLEREFRACTION',
  'IFCSURFACESTYLEWITHTEXTURES',
  'IFCTEXTUREMAP',
  'IFCBLOBTEXTURE',
  'IFCIMAGETEXTURE',
  'IFCPIXELTEXTURE',
  'IFCTEXTURECOORDINATE',
  'IFCTEXTURECOORDINATEGENERATOR',
  'IFCTEXTUREVERTEX',
  'IFCTEXTUREVERTEXLIST',
  'IFCCOLOURRGB',
  'IFCCOLOURRGBLIST',
  'IFCCOLOURSPECIFICATION',
  'IFCDRAUGHTINGPREDEFINEDCOLOUR',
  'IFCDRAUGHTINGPREDEFINEDCURVEFONT',
  'IFCPREDEFINEDCOLOUR',
  'IFCPREDEFINEDCURVEFONT',
  'IFCPREDEFINEDITEM',
  'IFCEXTERNALLYDEFINEDHATCHSTYLE',
  'IFCEXTERNALLYDEFINEDSURFACESTYLE',
  'IFCEXTERNALLYDEFINEDTEXTFONT',
  'IFCFILLSTYLESELECT',
  'IFCFILLAREASTYLE',
  'IFCFILLAREASTYLEHATCHING',
  'IFCFILLAREASTYLETILES',
  'IFCCURVESTYLE',
  'IFCCURVESTYLEFONT',
  'IFCCURVESTYLEFONTANDSCALING',
  'IFCCURVESTYLEFONTPATTERN',
  // Geometric primitives and definitions
  'IFCGEOMETRICSET',
  'IFCGEOMETRICCURVESET',
  'IFCGEOMETRICREPRESENTATIONITEM',
  'IFCPOINT',
  'IFCCARTESIANPOINT',
  'IFCPOINTONCURVE',
  'IFCPOINTONSURFACE',
  'IFCDIRECTION',
  'IFCVECTOR',
  'IFCLINE',
  'IFCPOLYLINE',
  'IFCCOMPOSITECURVE',
  'IFCCOMPOSITECURVESEGMENT',
  'IFCTRIMMEDCURVE',
  'IFCBSPLINECURVE',
  'IFCBSPLINECURVEWITHKNOTS',
  'IFCRATIONALBSPLINECURVEWITHKNOTS',
  'IFCCIRCLE',
  'IFCELLIPSE',
  'IFCCONIC',
  'IFCOFFSETCURVE2D',
  'IFCOFFSETCURVE3D',
  'IFCPCURVE',
  'IFCSURFACECURVE',
  'IFCBOUNDEDCURVE',
  'IFCCURVE',
  // Surfaces
  'IFCSURFACE',
  'IFCBOUNDEDSURFACE',
  'IFCELEMENTARYSURFACE',
  'IFCPLANE',
  'IFCCYLINDRICALSURFACE',
  'IFCCONICSURFACE',
  'IFCSPHERICALSURFACE',
  'IFCTOROIDALSURFACE',
  'IFCSWEPTSURFACE',
  'IFCSURFACEOFLINEAREXTRUSION',
  'IFCSURFACEOFREVOLUTION',
  'IFCBSPLINESURFACE',
  'IFCBSPLINESURFACEWITHKNOTS',
  'IFCRATIONALBSPLINESURFACEWITHKNOTS',
  'IFCRECTANGULARTRIMMEDSURFACE',
  'IFCCURVEBOUNDEDPLANE',
  'IFCCURVEBOUNDEDSURFACE',
  // Solids and CSG
  'IFCSOLIDMODEL',
  'IFCMANIFOLDSOLIDBREP',
  'IFCFACETEDBREP',
  'IFCFACETEDBREPWITHVOIDS',
  'IFCADVANCEDBREP',
  'IFCADVANCEDBREPWITHVOIDS',
  'IFCSWEPTAREASOLID',
  'IFCEXTRUDEDAREASOLID',
  'IFCEXTRUDEDAREASOLIDTAPERED',
  'IFCREVOLVEDAREASOLID',
  'IFCREVOLVEDAREASOLIDTAPERED',
  'IFCSURFACECURVESWEPTAREASOLID',
  'IFCSWEPTDISKSOLID',
  'IFCSWEPTDISKSOLIDPOLYGONAL',
  'IFCCSGSOLID',
  'IFCCSGPRIMITIVE3D',
  'IFCBLOCK',
  'IFCRECTANGULARPYRAMID',
  'IFCRIGHTCIRCULARCONE',
  'IFCRIGHTCIRCULARCYLINDER',
  'IFCSPHERE',
  'IFCHALFSPACESOLID',
  'IFCPOLYGONALBOUNDEDHALFSPACE',
  'IFCBOXEDHALFSPACE',
  'IFCBOOLEANRESULT',
  'IFCBOOLEANCLIPPINGRESULT',
  // Faces and shells
  'IFCCONNECTEDFACESET',
  'IFCCLOSEDSHELL',
  'IFCOPENSHELL',
  'IFCFACE',
  'IFCFACESURFACE',
  'IFCFACEOUTERBOUND',
  'IFCFACEBOUND',
  'IFCLOOP',
  'IFCPOLYLOOP',
  'IFCEDGELOOP',
  'IFCVERTEXLOOP',
  'IFCEDGE',
  'IFCEDGECURVE',
  'IFCORIENTEDEDGE',
  'IFCSUBEDGE',
  'IFCVERTEX',
  'IFCVERTEXPOINT',
  // Profiles (geometric definitions)
  'IFCARBITRARYOPENPROFILEDEF',
  'IFCARBITRARYCLOSEDPROFILEDEF',
  'IFCARBITRARYPROFILEDEFWITHVOIDS',
  'IFCRECTANGLEPROFILEDEF',
  'IFCROUNDEDRECTANGLEPROFILEDEF',
  'IFCCIRCLEPROFILEDEF',
  'IFCCIRCLEHOLLOWPROFILEDEF',
  'IFCELLIPSEPROFILEDEF',
  'IFCISHAPEPROFILEDEF',
  'IFCLSHAPEPROFILEDEF',
  'IFCTSHAPEPROFILEDEF',
  'IFCUSHAPEPROFILEDEF',
  'IFCZSHAPEPROFILEDEF',
  'IFCCSHAPEPROFILEDEF',
  'IFCASYMMETRICISHAPEPROFILEDEF',
  'IFCTRAPEZIUMPROFILEDEF',
  'IFCCENTERLINEPROFILEDEF',
  'IFCCOMPOSITEPROFILEDEF',
  'IFCDERIVEDPROFILEDEF',
  'IFCMIRROREDPROFILEDEF',
  'IFCPARAMETERIZEDPROFILEDEF',
  'IFCPROFILEDEF',
  // Tessellated geometry
  'IFCTESSELLATEDITEM',
  'IFCTRIANGULATEDFACESET',
  'IFCPOLYGONALTESSELLATEDFACESET',
  'IFCINDEXEDPOLYGONALFACE',
  'IFCINDEXEDPOLYGONALFACEWITHVOIDS',
  'IFCINDEXEDCOLOURMAP',
  'IFCINDEXEDTRIANGLETEXTUREMAP',
  'IFCCARTESIANPOINTLIST2D',
  'IFCCARTESIANPOINTLIST3D',
  // Placement and transformations
  'IFCAXIS1PLACEMENT',
  'IFCAXIS2PLACEMENT2D',
  'IFCAXIS2PLACEMENT3D',
  'IFCLOCALPLACEMENT',
  'IFCGRIDPLACEMENT',
  'IFCCARTESIANTRANSFORMATIONOPERATOR',
  'IFCCARTESIANTRANSFORMATIONOPERATOR2D',
  'IFCCARTESIANTRANSFORMATIONOPERATOR2DNONUNIFORM',
  'IFCCARTESIANTRANSFORMATIONOPERATOR3D',
  'IFCCARTESIANTRANSFORMATIONOPERATOR3DNONUNIFORM',
  // Grid
  'IFCGRID',
  'IFCGRIDAXIS',
  // Annotations (geometric)
  'IFCANNOTATIONFILLAREA',
  'IFCTEXTLITERAL',
  'IFCTEXTLITERALWITHEXTENT',
  // Connection geometry
  'IFCCONNECTIONGEOMETRY',
  'IFCCONNECTIONPOINTGEOMETRY',
  'IFCCONNECTIONCURVEGEOMETRY',
  'IFCCONNECTIONSURFACEGEOMETRY',
  'IFCCONNECTIONVOLUMEGEOMETRY',
  'IFCCONNECTIONPOINTECCENTRICITY',
]);

// Node color mapping - fallback for types without schema
const NODE_COLORS: Record<NodeType, string> = {
  building: '#1e40af',    // blue (for IFCPROJECT, IFCSITE, IFCBUILDING)
  space: '#a78bfa',       // purple (for IFCSPACE)
  element: '#fbbf24',     // amber (for walls, doors, etc.)
  property: '#4ade80',    // green (for properties)
  relationship: '#f472b6', // pink (for relationships)
  geometry: '#9ca3af',    // gray (for geometry - not visible in graph but in tree)
  other: '#6b7280',       // dark gray (for other types)
};

const IFC_TYPE_MAPPING: Record<number, NodeType> = {
  [WebIFC.IFCBUILDING]: 'building',
  [WebIFC.IFCBUILDINGSTOREY]: 'building',
  [WebIFC.IFCSITE]: 'building',
  [WebIFC.IFCPROJECT]: 'building',
  [WebIFC.IFCSPACE]: 'space',
  [WebIFC.IFCWALL]: 'element',
  [WebIFC.IFCWALLSTANDARDCASE]: 'element',
  [WebIFC.IFCDOOR]: 'element',
  [WebIFC.IFCWINDOW]: 'element',
  [WebIFC.IFCSLAB]: 'element',
  [WebIFC.IFCCOLUMN]: 'element',
  [WebIFC.IFCBEAM]: 'element',
  [WebIFC.IFCROOF]: 'element',
  [WebIFC.IFCSTAIR]: 'element',
  [WebIFC.IFCRAILING]: 'element',
  [WebIFC.IFCFURNISHINGELEMENT]: 'element',
  [WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE]: 'relationship',
  [WebIFC.IFCRELAGGREGATES]: 'relationship',
  [WebIFC.IFCRELVOIDSELEMENT]: 'relationship',
  [WebIFC.IFCRELFILLSELEMENT]: 'relationship',
  [WebIFC.IFCRELDEFINESBYPROPERTIES]: 'property',
};

function getNodeType(ifcType: number): NodeType {
  return IFC_TYPE_MAPPING[ifcType] || 'element';
}

function getTypeName(ifcApi: WebIFC.IfcAPI, modelId: number, typeId: number): string {
  try {
    const typeName = ifcApi.GetNameFromTypeCode(typeId);
    return typeName || `Type_${typeId}`;
  } catch {
    return `Type_${typeId}`;
  }
}

function isGeometryType(typeName: string): boolean {
  return GEOMETRY_TYPES.has(typeName.toUpperCase());
}

// Utility to allow UI to update without blocking
function allowUIUpdate(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// Type for progress callback
export type ParseProgressCallback = (progress: {
  stage: 'loading' | 'parsing' | 'processing' | 'validating' | 'complete';
  percentage: number;
  message: string;
}) => void;

export async function parseIFCFile(
  file: File,
  onProgress?: ParseProgressCallback
): Promise<ParsedIFCData> {
  const startTime = performance.now();
  
  // Notify progress: File loading started
  onProgress?.({
    stage: 'loading',
    percentage: 10,
    message: 'Loading IFC file...'
  });
  
  const ifcApi = new WebIFC.IfcAPI();
  
  // Set the WASM path to the root where static files are copied
  await ifcApi.Init((path: string) => {
    // In development/production, WASM files are copied to root
    return `/${path}`;
  });
  
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);
  
  const modelId = ifcApi.OpenModel(data);
  
  // Notify progress: Parsing started
  onProgress?.({
    stage: 'parsing',
    percentage: 20,
    message: 'Parsing IFC model structure...'
  });
  const allEntities: GraphNode[] = [];  // ALL parsed entities for validation, tree, properties
  const graphNodes: GraphNode[] = [];   // Only entities for graph visualization (non-geometry)
  const edges: GraphEdge[] = [];
  const nodeMap = new Map<number, GraphNode>();
  
  let geometryEntityCount = 0;
  let propertyEntityCount = 0;
  
  // Get all entity types in the model
  const allTypes = ifcApi.GetAllTypesOfModel(modelId);
  
  // PROPERTY_TYPES that should be parsed but not shown as graph nodes
  const PROPERTY_TYPES = new Set([
    'IFCPROPERTYSET',
    'IFCELEMENTQUANTITY',
    'IFCQUANTITYLENGTH',
    'IFCQUANTITYAREA',
    'IFCQUANTITYVOLUME',
    'IFCQUANTITYCOUNT',
    'IFCQUANTITYWEIGHT',
    'IFCQUANTITYTIME',
    'IFCSINGLEVALUEPROPERTIES',
    'IFCENUMERATEDVALUEPROPERTY',
    'IFCPROPERTYTABLEVALUE',
    'IFCRANGEPROPERTY',
    'IFCREFERENCEVALUEPROPERTY',
    'IFCLISTVALUEPROPERTY',
    'IFCPROPERTYENUMERATION',
    'IFCMATERIALPROPERTIES',
    'IFCMECHANICALPROPERTIES',
    'IFCTHERMALPROPERTIES',
    'IFCHYDRAULICFLUIDPROPERTIES',
    // Material and classification properties
    'IFCMATERIAL',
    'IFCMATERIALLAYER',
    'IFCMATERIALLAYERSET',
    'IFCMATERIALCONSTITUENTSET',
    'IFCCLASSIFICATION',
    'IFCCLASSIFICATIONREFERENCE',
    // Metadata/owner entities
    'IFCPERSON',
    'IFCORGANIZATION',
    'IFCPERSONANDORGANIZATION',
    'IFCAPPLICATION',
    'IFCOWNERHISTORY',
  ]);

  // Process each type - PARSE EVERYTHING, filter at display time
  const typeCount = allTypes.length;
  for (let typeIdx = 0; typeIdx < typeCount; typeIdx++) {
    const typeInfo = allTypes[typeIdx];
    const typeId = typeInfo.typeID;
    const typeName = getTypeName(ifcApi, modelId, typeId);
    
    // Report progress every 10 types
    if (typeIdx % 10 === 0) {
      const parseProgress = 20 + Math.floor((typeIdx / typeCount) * 60);
      onProgress?.({
        stage: 'processing',
        percentage: parseProgress,
        message: `Processing entity type ${typeIdx}/${typeCount}: ${typeName}...`
      });
      
      // Allow UI to update
      await allowUIUpdate();
    }
    
    // Skip relationship types for now - we'll process them separately
    if (typeName.startsWith('IFCREL')) continue;
    
    try {
      const entityIds = ifcApi.GetLineIDsWithType(modelId, typeId);
      
      for (let i = 0; i < entityIds.size(); i++) {
        const expressId = entityIds.get(i);
        
        try {
          const entity = ifcApi.GetLine(modelId, expressId);
          
          if (entity) {
            const nodeType = getNodeType(typeId);
            const properties: Record<string, any> = {};
            
            // Store the raw entity type and ID for debugging
            const rawEntityType = entity.type;
            const rawEntityId = entity.expressID;
            
            // Extract all properties from the entity (excluding geometry references)
            for (const key of Object.keys(entity)) {
              if (key === 'type' || key === 'expressID') {
                // Store these for reference
                if (key === 'type') {
                  properties['_entityType'] = entity[key];
                } else if (key === 'expressID') {
                  properties['_expressID'] = entity[key];
                }
                continue;
              }
              
              const value = entity[key];
              if (value === null || value === undefined) continue;
              
              // Skip representation/geometry properties but keep them for structural entities
              if (key === 'Representation') {
                // For now, skip representation
                continue;
              }
              
              if (key === 'ObjectPlacement') {
                // Skip object placement for now
                continue;
              }
              
              // Handle IFC values - they often come wrapped with .value property
              if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                if (value.value !== undefined) {
                  properties[key] = value.value;
                } else {
                  // For complex objects without .value, try to extract useful data
                  // This helps with GlobalId and other IfcValue types
                  properties[key] = value;
                }
              } else if (Array.isArray(value)) {
                // Handle arrays - extract values
                const arrayValues = value.map((v: any) => {
                  if (typeof v === 'object' && v?.value !== undefined) {
                    return v.value;
                  } else if (typeof v === 'object' && v?.GlobalId !== undefined) {
                    return v.GlobalId;
                  }
                  return v;
                }).filter((v: any) => v !== undefined && v !== null);
                if (arrayValues.length > 0) {
                  properties[key] = arrayValues;
                }
              } else if (typeof value !== 'function') {
                properties[key] = value;
              }
            }
            
            // For debugging: log IFCPROJECT entities
            if (typeName.toUpperCase() === 'IFCPROJECT') {
              console.debug('IFCPROJECT entity found:', {
                expressId,
                typeName,
                properties: Object.keys(properties),
                label: properties.Name || properties.name || properties.label || typeName,
              });
            }
            
            // Use schema definitions for enhanced entity information
            const schemaDef = getEntityDef(typeName);
            let entityColor = getEntityColor(typeName);
            // If color is dark grey fallback, use type-based color instead
            if (!entityColor || entityColor === '#6b7280' || entityColor === '#888') {
              entityColor = NODE_COLORS[nodeType] || '#3b82f6';
            }
            const entityIcon = getEntityIcon(typeName);
            
            // Determine node type from schema or type mapping
            let nodeTypeFromSchema: NodeType = 'element';
            let category: string = 'element';
            
            if (schemaDef) {
              category = schemaDef.category;
              if (schemaDef.category === 'spatial') {
                nodeTypeFromSchema = typeName === 'IFCSPACE' ? 'space' : 'building';
              } else if (schemaDef.category === 'structural') {
                nodeTypeFromSchema = 'element';
              } else if (schemaDef.category === 'property') {
                nodeTypeFromSchema = 'property';
              } else if (schemaDef.category === 'relationship') {
                nodeTypeFromSchema = 'relationship';
              }
            }
            
            // Determine if this should be visible in the graph
            let isGraphVisible = true;
            const typeNameUpper = typeName.toUpperCase();
            
            if (isGeometryType(typeName)) {
              nodeTypeFromSchema = 'geometry';
              isGraphVisible = false;
              geometryEntityCount++;
              console.debug(`Filtered geometry: ${typeName}`);
            } else if (PROPERTY_TYPES.has(typeNameUpper) || 
                       typeNameUpper.includes('QUANTITY') || 
                       typeNameUpper.includes('PROPERTY') ||
                       typeNameUpper.includes('PSET_') ||
                       typeNameUpper.includes('PSE_') ||
                       typeNameUpper.includes('PERSON') ||
                       typeNameUpper.includes('ORGANIZATION') ||
                       typeNameUpper.includes('APPLICATION') ||
                       typeNameUpper.includes('HISTORY') ||
                       typeNameUpper.includes('MATERIAL') ||
                       typeNameUpper.includes('CLASSIFICATION')) {
              nodeTypeFromSchema = 'property';
              isGraphVisible = false;
              propertyEntityCount++;
              console.debug(`Filtered property/metadata: ${typeName} - ${properties.Name || 'unknown'}`);
            }
            
            const finalNodeType = schemaDef ? nodeTypeFromSchema : nodeType;
            
            const node: GraphNode = {
              id: `node_${expressId}`,
              label: properties.Name || properties.name || properties.label || getEntityDisplayName(typeName),
              type: finalNodeType,
              ifcType: typeName,
              properties: {
                ...properties,
                _schemaColor: entityColor,
                _schemaIcon: entityIcon,
              },
              expressId,
              isGraphVisible,
            };
            
            // Add to all entities (for tree, validation, properties panel)
            allEntities.push(node);
            
            // Add to graph nodes only if visible
            if (isGraphVisible) {
              graphNodes.push(node);
              nodeMap.set(expressId, node);
            }
            
            // Debug IFCPROJECT specifically
            if (typeName.toUpperCase() === 'IFCPROJECT') {
              console.log('IFCPROJECT Node Created:', { 
                id: node.id, 
                label: node.label, 
                color: entityColor,
                type: finalNodeType,
                isGraphVisible 
              });
            }
          }
        } catch (err) {
          // Skip entities that can't be parsed
        }
      }
    } catch (err) {
      // Skip types that can't be enumerated
    }
  }
  
  // Process relationships
  const relationshipTypes = [
    WebIFC.IFCRELAGGREGATES,
    WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE,
    WebIFC.IFCRELVOIDSELEMENT,
    WebIFC.IFCRELFILLSELEMENT,
    WebIFC.IFCRELDEFINESBYPROPERTIES,
    WebIFC.IFCRELASSOCIATESMATERIAL,
    WebIFC.IFCRELASSOCIATESCLASSIFICATION,
  ];
  
  for (const relType of relationshipTypes) {
    try {
      const relIds = ifcApi.GetLineIDsWithType(modelId, relType);
      const typeName = getTypeName(ifcApi, modelId, relType);
      
      for (let i = 0; i < relIds.size(); i++) {
        const relId = relIds.get(i);
        
        try {
          const rel = ifcApi.GetLine(modelId, relId);
          
          if (rel) {
            // Handle IFCRELAGGREGATES
            if (rel.RelatingObject && rel.RelatedObjects) {
              const sourceId = rel.RelatingObject.value;
              const relatedObjects = rel.RelatedObjects;
              
              for (let j = 0; j < relatedObjects.length; j++) {
                const targetId = relatedObjects[j].value;
                
                if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
                  edges.push({
                    id: `edge_${relId}_${j}`,
                    source: `node_${sourceId}`,
                    target: `node_${targetId}`,
                    label: 'aggregates',
                    type: typeName,
                  });
                }
              }
            }
            
            // Handle IFCRELCONTAINEDINSPATIALSTRUCTURE
            if (rel.RelatingStructure && rel.RelatedElements) {
              const sourceId = rel.RelatingStructure.value;
              const relatedElements = rel.RelatedElements;
              
              for (let j = 0; j < relatedElements.length; j++) {
                const targetId = relatedElements[j].value;
                
                if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
                  edges.push({
                    id: `edge_${relId}_${j}`,
                    source: `node_${sourceId}`,
                    target: `node_${targetId}`,
                    label: 'contains',
                    type: typeName,
                  });
                }
              }
            }
            
            // Handle IFCRELVOIDSELEMENT
            if (rel.RelatingBuildingElement && rel.RelatedOpeningElement) {
              const sourceId = rel.RelatingBuildingElement.value;
              const targetId = rel.RelatedOpeningElement.value;
              
              if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
                edges.push({
                  id: `edge_${relId}`,
                  source: `node_${sourceId}`,
                  target: `node_${targetId}`,
                  label: 'voids',
                  type: typeName,
                });
              }
            }
            
            // Handle IFCRELFILLSELEMENT
            if (rel.RelatingOpeningElement && rel.RelatedBuildingElement) {
              const sourceId = rel.RelatingOpeningElement.value;
              const targetId = rel.RelatedBuildingElement.value;
              
              if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
                edges.push({
                  id: `edge_${relId}`,
                  source: `node_${sourceId}`,
                  target: `node_${targetId}`,
                  label: 'fills',
                  type: typeName,
                });
              }
            }
            
            // Handle IFCRELDEFINESBYPROPERTIES - link elements to property sets
            if (rel.RelatingPropertyDefinition && rel.RelatedObjects) {
              const propDefId = rel.RelatingPropertyDefinition.value;
              const relatedObjects = rel.RelatedObjects;
              
              for (let j = 0; j < relatedObjects.length; j++) {
                const targetId = relatedObjects[j].value;
                
                if (nodeMap.has(propDefId) && nodeMap.has(targetId)) {
                  edges.push({
                    id: `edge_${relId}_${j}`,
                    source: `node_${targetId}`,
                    target: `node_${propDefId}`,
                    label: 'hasProperties',
                    type: typeName,
                  });
                }
              }
            }
          }
        } catch (err) {
          // Skip relationships that can't be parsed
        }
      }
    } catch (err) {
      // Skip relationship types that can't be enumerated
    }
  }
  
  // Ensure IFCPROJECT node exists or create warning
  const hasProject = allEntities.some(n => n.ifcType?.toUpperCase() === 'IFCPROJECT');
  if (!hasProject) {
    console.warn('Warning: No IFCPROJECT entity found in parsed IFC file');
  }
  
  ifcApi.CloseModel(modelId);
  
  const endTime = performance.now();
  
  console.log('Parse Results:', {
    totalEntities: allEntities.length,
    graphNodes: graphNodes.length,
    geometryEntities: geometryEntityCount,
    propertyEntities: propertyEntityCount,
    hasProject,
    entityTypes: new Set(allEntities.map(n => n.ifcType)),
    parseTime: endTime - startTime,
  });

  // Validate parsed data - VALIDATE ALL ENTITIES, NOT JUST GRAPH NODES
  onProgress?.({
    stage: 'validating',
    percentage: 85,
    message: 'Validating parsed IFC data...'
  });
  
  const validation = validateIFCData(allEntities, edges);
  
  // Progress complete
  onProgress?.({
    stage: 'complete',
    percentage: 100,
    message: 'IFC file parsing complete!'
  });
  
  return {
    graphData: { nodes: graphNodes, edges },
    allEntities,
    metadata: {
      fileName: file.name,
      fileSize: file.size,
      entityCount: allEntities.length,
      geometryEntityCount,
      propertyEntityCount,
      relationshipCount: edges.length,
      parseTime: endTime - startTime,
    },
    validation,
  };
}

// Generate sample data for demo purposes
export function generateSampleData(): ParsedIFCData {
  const nodes: GraphNode[] = [
    { id: 'project', label: 'Sample Project', type: 'building', ifcType: 'IFCPROJECT', properties: { Name: 'Sample Building Project', GlobalId: 'PROJ001', Description: 'A sample IFC project for demonstration' } },
    { id: 'site', label: 'Building Site', type: 'building', ifcType: 'IFCSITE', properties: { Name: 'Main Site', GlobalId: 'SITE001', RefLatitude: [51, 30, 0], RefLongitude: [-0, 7, 0] } },
    { id: 'building', label: 'Main Building', type: 'building', ifcType: 'IFCBUILDING', properties: { Name: 'Office Building A', GlobalId: 'BUILD001', ElevationOfRefHeight: 0, ElevationOfTerrain: 0 } },
    { id: 'storey1', label: 'Ground Floor', type: 'building', ifcType: 'IFCBUILDINGSTOREY', properties: { Name: 'Level 0', Elevation: 0, LongName: 'Ground Floor' } },
    { id: 'storey2', label: 'First Floor', type: 'building', ifcType: 'IFCBUILDINGSTOREY', properties: { Name: 'Level 1', Elevation: 3.5, LongName: 'First Floor' } },
    { id: 'storey3', label: 'Second Floor', type: 'building', ifcType: 'IFCBUILDINGSTOREY', properties: { Name: 'Level 2', Elevation: 7.0, LongName: 'Second Floor' } },
    { id: 'space1', label: 'Lobby', type: 'space', ifcType: 'IFCSPACE', properties: { Name: 'Main Lobby', LongName: 'Reception and Waiting Area', GrossFloorArea: 120, NetFloorArea: 115 } },
    { id: 'space2', label: 'Conference Room', type: 'space', ifcType: 'IFCSPACE', properties: { Name: 'Conference Room A', Occupancy: 12, GrossFloorArea: 45 } },
    { id: 'space3', label: 'Open Office', type: 'space', ifcType: 'IFCSPACE', properties: { Name: 'Open Plan Office', Occupancy: 40, GrossFloorArea: 200 } },
    { id: 'space4', label: 'Stairwell', type: 'space', ifcType: 'IFCSPACE', properties: { Name: 'Main Stairwell', GrossFloorArea: 25 } },
    { id: 'wall1', label: 'Exterior Wall N', type: 'element', ifcType: 'IFCWALL', properties: { Name: 'North Facade', Tag: 'W-001', IsExternal: true, LoadBearing: true } },
    { id: 'wall2', label: 'Exterior Wall S', type: 'element', ifcType: 'IFCWALL', properties: { Name: 'South Facade', Tag: 'W-002', IsExternal: true, LoadBearing: true } },
    { id: 'wall3', label: 'Interior Wall 1', type: 'element', ifcType: 'IFCWALL', properties: { Name: 'Partition 1', Tag: 'W-101', IsExternal: false, LoadBearing: false, FireRating: '1HR' } },
    { id: 'wall4', label: 'Interior Wall 2', type: 'element', ifcType: 'IFCWALL', properties: { Name: 'Partition 2', Tag: 'W-102', IsExternal: false, LoadBearing: false, FireRating: '1HR' } },
    { id: 'door1', label: 'Main Entrance', type: 'element', ifcType: 'IFCDOOR', properties: { Name: 'Entry Door', Tag: 'D-001', OverallWidth: 1.2, OverallHeight: 2.4, OperationType: 'DOUBLE_DOOR_SINGLE_SWING' } },
    { id: 'door2', label: 'Office Door', type: 'element', ifcType: 'IFCDOOR', properties: { Name: 'Interior Door 1', Tag: 'D-101', OverallWidth: 0.9, OverallHeight: 2.1, OperationType: 'SINGLE_SWING_LEFT' } },
    { id: 'door3', label: 'Conference Door', type: 'element', ifcType: 'IFCDOOR', properties: { Name: 'Interior Door 2', Tag: 'D-102', OverallWidth: 0.9, OverallHeight: 2.1, OperationType: 'SINGLE_SWING_RIGHT' } },
    { id: 'window1', label: 'Window Panel 1', type: 'element', ifcType: 'IFCWINDOW', properties: { Name: 'Facade Window 1', Tag: 'WN-001', OverallWidth: 1.5, OverallHeight: 1.8, PartitioningType: 'SINGLE_PANEL' } },
    { id: 'window2', label: 'Window Panel 2', type: 'element', ifcType: 'IFCWINDOW', properties: { Name: 'Facade Window 2', Tag: 'WN-002', OverallWidth: 1.5, OverallHeight: 1.8, PartitioningType: 'SINGLE_PANEL' } },
    { id: 'window3', label: 'Skylight', type: 'element', ifcType: 'IFCWINDOW', properties: { Name: 'Roof Skylight', Tag: 'WN-R01', OverallWidth: 2.0, OverallHeight: 2.0, PartitioningType: 'SINGLE_PANEL' } },
    { id: 'slab1', label: 'Ground Slab', type: 'element', ifcType: 'IFCSLAB', properties: { Name: 'Foundation Slab', Tag: 'SL-001', PredefinedType: 'FLOOR' } },
    { id: 'slab2', label: 'Floor Slab L1', type: 'element', ifcType: 'IFCSLAB', properties: { Name: 'Level 1 Floor', Tag: 'SL-101', PredefinedType: 'FLOOR' } },
    { id: 'column1', label: 'Column A1', type: 'element', ifcType: 'IFCCOLUMN', properties: { Name: 'Grid A-1', Tag: 'COL-A1', PredefinedType: 'COLUMN' } },
    { id: 'column2', label: 'Column A2', type: 'element', ifcType: 'IFCCOLUMN', properties: { Name: 'Grid A-2', Tag: 'COL-A2', PredefinedType: 'COLUMN' } },
    { id: 'beam1', label: 'Main Beam 1', type: 'element', ifcType: 'IFCBEAM', properties: { Name: 'Primary Beam A', Tag: 'BM-001', PredefinedType: 'BEAM' } },
    { id: 'stair1', label: 'Main Staircase', type: 'element', ifcType: 'IFCSTAIR', properties: { Name: 'Central Stair', Tag: 'ST-001', NumberOfRisers: 20, NumberOfTreads: 19, RiserHeight: 0.175, TreadLength: 0.28 } },
    { id: 'roof1', label: 'Roof System', type: 'element', ifcType: 'IFCROOF', properties: { Name: 'Main Roof', Tag: 'RF-001', PredefinedType: 'FLAT_ROOF' } },
  ];

  // All entities including properties (for tree and validation)
  const allEntities: GraphNode[] = [
    ...nodes,
    // Property sets - in allEntities but NOT in graph nodes
    { id: 'pset1', label: 'Pset_WallCommon', type: 'property', ifcType: 'IFCPROPERTYSET', properties: { Name: 'Pset_WallCommon', FireRating: '2HR', IsExternal: true, ThermalTransmittance: 0.25 }, isGraphVisible: false },
    { id: 'pset2', label: 'Pset_DoorCommon', type: 'property', ifcType: 'IFCPROPERTYSET', properties: { Name: 'Pset_DoorCommon', FireRating: '1HR', IsExternal: false, SecurityRating: 'High' }, isGraphVisible: false },
  ];

  const edges: GraphEdge[] = [
    { id: 'e1', source: 'project', target: 'site', label: 'aggregates', type: 'IFCRELAGGREGATES' },
    { id: 'e2', source: 'site', target: 'building', label: 'aggregates', type: 'IFCRELAGGREGATES' },
    { id: 'e3', source: 'building', target: 'storey1', label: 'aggregates', type: 'IFCRELAGGREGATES' },
    { id: 'e4', source: 'building', target: 'storey2', label: 'aggregates', type: 'IFCRELAGGREGATES' },
    { id: 'e5', source: 'building', target: 'storey3', label: 'aggregates', type: 'IFCRELAGGREGATES' },
    { id: 'e6', source: 'storey1', target: 'space1', label: 'contains', type: 'IFCRELCONTAINEDINSPATIALSTRUCTURE' },
    { id: 'e7', source: 'storey1', target: 'space4', label: 'contains', type: 'IFCRELCONTAINEDINSPATIALSTRUCTURE' },
    { id: 'e8', source: 'storey2', target: 'space2', label: 'contains', type: 'IFCRELCONTAINEDINSPATIALSTRUCTURE' },
    { id: 'e9', source: 'storey2', target: 'space3', label: 'contains', type: 'IFCRELCONTAINEDINSPATIALSTRUCTURE' },
    { id: 'e10', source: 'storey1', target: 'wall1', label: 'contains', type: 'IFCRELCONTAINEDINSPATIALSTRUCTURE' },
    { id: 'e11', source: 'storey1', target: 'wall2', label: 'contains', type: 'IFCRELCONTAINEDINSPATIALSTRUCTURE' },
    { id: 'e12', source: 'storey1', target: 'wall3', label: 'contains', type: 'IFCRELCONTAINEDINSPATIALSTRUCTURE' },
    { id: 'e13', source: 'storey2', target: 'wall4', label: 'contains', type: 'IFCRELCONTAINEDINSPATIALSTRUCTURE' },
    { id: 'e14', source: 'wall1', target: 'door1', label: 'voids', type: 'IFCRELVOIDSELEMENT' },
    { id: 'e15', source: 'wall3', target: 'door2', label: 'voids', type: 'IFCRELVOIDSELEMENT' },
    { id: 'e16', source: 'wall4', target: 'door3', label: 'voids', type: 'IFCRELVOIDSELEMENT' },
    { id: 'e17', source: 'wall1', target: 'window1', label: 'voids', type: 'IFCRELVOIDSELEMENT' },
    { id: 'e18', source: 'wall2', target: 'window2', label: 'voids', type: 'IFCRELVOIDSELEMENT' },
    { id: 'e19', source: 'storey1', target: 'slab1', label: 'contains', type: 'IFCRELCONTAINEDINSPATIALSTRUCTURE' },
    { id: 'e20', source: 'storey2', target: 'slab2', label: 'contains', type: 'IFCRELCONTAINEDINSPATIALSTRUCTURE' },
    { id: 'e21', source: 'storey1', target: 'column1', label: 'contains', type: 'IFCRELCONTAINEDINSPATIALSTRUCTURE' },
    { id: 'e22', source: 'storey1', target: 'column2', label: 'contains', type: 'IFCRELCONTAINEDINSPATIALSTRUCTURE' },
    { id: 'e23', source: 'storey2', target: 'beam1', label: 'contains', type: 'IFCRELCONTAINEDINSPATIALSTRUCTURE' },
    { id: 'e24', source: 'space4', target: 'stair1', label: 'contains', type: 'IFCRELCONTAINEDINSPATIALSTRUCTURE' },
    { id: 'e25', source: 'storey3', target: 'roof1', label: 'contains', type: 'IFCRELCONTAINEDINSPATIALSTRUCTURE' },
    { id: 'e26', source: 'roof1', target: 'window3', label: 'voids', type: 'IFCRELVOIDSELEMENT' },
  ];

  return {
    graphData: { nodes, edges },
    allEntities,
    metadata: {
      fileName: 'sample_building.ifc',
      fileSize: 1024 * 512,
      entityCount: allEntities.length,
      geometryEntityCount: 0,
      propertyEntityCount: 2,
      relationshipCount: edges.length,
      parseTime: 0,
    },
  };
}



