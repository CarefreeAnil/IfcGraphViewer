import * as WebIFC from 'web-ifc';
import { GraphData, GraphNode, GraphEdge, NodeType, ParsedIFCData } from '@/types/graph';
import { validateIFCData, validateIFCFileSyntax, ValidationError } from '@/lib/ifcValidatorEnhanced';
import { getEntityDef, getEntityColor, getEntityIcon, getEntityDisplayName, getEntityCategory } from '@/lib/ifcSchema';
// IFC5 imports
import { isIFC5File, loadIFC5FromFile, getIFC5FileInfo } from '@/lib/ifc5ParserMain';
import { parseIFC5File as parseIFC5Tree } from '@/lib/ifc5ParserMain';
import { convertToComposedObject, convertToGraph, getIFC5Statistics } from '@/lib/ifc5ToGraph';
import { IFC5File, ComposedObject } from '@/types/ifc5';

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
  Mesh: '#60a5fa',        // blue (IFC5)
  Curve: '#fb923c',       // orange (IFC5)
  Points: '#c084fc',      // violet (IFC5)
  Group: '#34d399',       // emerald (IFC5)
};

const IFC_TYPE_MAPPING: Record<number, NodeType> = {
  // Spatial entities
  [WebIFC.IFCBUILDING]: 'building',
  [WebIFC.IFCBUILDINGSTOREY]: 'building',
  [WebIFC.IFCSITE]: 'building',
  [WebIFC.IFCPROJECT]: 'building',
  [WebIFC.IFCSPACE]: 'space',
  // Structural elements
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
  // Relationship entities
  [WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE]: 'relationship',
  [WebIFC.IFCRELAGGREGATES]: 'relationship',
  [WebIFC.IFCRELVOIDSELEMENT]: 'relationship',
  [WebIFC.IFCRELFILLSELEMENT]: 'relationship',
  [WebIFC.IFCRELDEFINESBYPROPERTIES]: 'property',
  // Property and quantity entities - these have type codes in WebIFC
  ...(WebIFC.IFCPROPERTYSET !== undefined && { [WebIFC.IFCPROPERTYSET]: 'property' }),
  ...(WebIFC.IFCELEMENTQUANTITY !== undefined && { [WebIFC.IFCELEMENTQUANTITY]: 'property' }),
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

/**
 * Reconstructs IFC STEP format representation preserving references.
 * Converts entity object back to IFC STEP-like format with #xxx reference markers.
 * Example: IfcSite(#9, 'Name', ...) instead of IfcSite({OwnerHistory: {...}, Name: 'Name', ...})
 */
function reconstructIFCStepFormat(typeName: string, entity: any, ifcApi: WebIFC.IfcAPI, modelId: number): string {
  try {
    // Get the entity's expressID for reference in properties
    const expressId = entity.expressID;
    
    // Build a parameter list showing references as #xxx and values as-is
    const params: string[] = [];
    
    // Iterate through all properties to preserve order and structure
    for (const [key, value] of Object.entries(entity)) {
      if (key === 'type' || key === 'expressID') continue;
      
      // Format value for display
      if (value === null || value === undefined) {
        params.push('$');  // $ represents undefined/null in IFC STEP
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // This might be a reference - check if it has expressID
        const objValue = value as any;
        if (objValue?.expressID !== undefined) {
          params.push(`#${objValue.expressID}`);
        } else if (objValue?.value !== undefined) {
          // Wrapped value - unwrap it
          const v = objValue.value;
          if (typeof v === 'string') {
            params.push(`'${v}'`);
          } else {
            params.push(String(v));
          }
        } else {
          // Complex object - try to extract a meaningful representation
          params.push(JSON.stringify(value).substring(0, 20) + '...');
        }
      } else if (Array.isArray(value)) {
        // Array of values/references
        const arrayItems = value.map((v: any) => {
          if (v === null || v === undefined) return '$';
          if (typeof v === 'object' && v.expressID !== undefined) return `#${v.expressID}`;
          if (typeof v === 'string') return `'${v}'`;
          return String(v);
        });
        params.push(`(${arrayItems.join(', ')})`);
      } else if (typeof value === 'string') {
        params.push(`'${value}'`);
      } else if (typeof value === 'number') {
        params.push(String(value));
      } else if (typeof value === 'boolean') {
        params.push(value ? '.T.' : '.F.');
      } else {
        params.push(String(value));
      }
    }
    
    return `#${expressId}= ${typeName}(${params.join(', ')})`;
  } catch (err) {
    // Fallback - just show basic info
    return `#${(entity as any)?.expressID}= ${typeName}(...)`;
  }
}

// Type for progress callback
export type ParseProgressCallback = (progress: {
  stage: 'loading' | 'parsing' | 'processing' | 'validating' | 'complete';
  percentage: number;
  message: string;
}) => void;

/**
 * Extract raw STEP format lines from IFC file
 * Returns a map of expressID to raw STEP line text (with #ID= prefix and entity data)
 */
function extractRawStepLines(fileText: string): Map<number, string> {
  const stepLineMap = new Map<number, string>();
  
  try {
    // Extract DATA section
    const dataMatch = fileText.match(/DATA;\s*([\s\S]*?)\s*ENDSEC;/i);
    if (!dataMatch) {
      console.warn('Could not find DATA section in IFC file');
      return stepLineMap;
    }

    const dataContent = dataMatch[1];
    
    // Extract each line - format: #123=ENTITYTYPE(...)
    // Lines can span multiple physical lines, so we need to handle that
    const lines = dataContent.split('\n');
    let currentLine = '';
    let currentId: number | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;
      
      // Check if this line starts a new STEP entity
      const idMatch = line.match(/^#(\d+)=/);
      
      if (idMatch) {
        // If we have a previous line, save it
        if (currentId !== null && currentLine) {
          stepLineMap.set(currentId, currentLine);
        }
        
        // Start new line
        currentId = parseInt(idMatch[1], 10);
        currentLine = line;
      } else {
        // Continue previous line
        if (currentId !== null) {
          currentLine += ' ' + line;
        }
      }
      
      // Check if line is complete (ends with ;)
      if (currentLine.endsWith(';')) {
        if (currentId !== null) {
          stepLineMap.set(currentId, currentLine);
          currentId = null;
          currentLine = '';
        }
      }
    }
    
    // Handle last line if incomplete
    if (currentId !== null && currentLine) {
      stepLineMap.set(currentId, currentLine);
    }
  } catch (err) {
    console.warn('Error extracting raw STEP lines:', err);
  }
  
  return stepLineMap;
}
function extractIFCHeader(fileText: string): any {
  const result = {
    fullHeader: '',
    fileDescription: { description: [] as string[], implementationLevel: '' },
    fileName: { name: '', timeStamp: '', author: [] as string[], organization: [] as string[], preprocessorVersion: '', originatingSystem: '', authorization: '' },
    fileSchema: { schemaIdentifiers: [] as string[] },
  };

  try {
    // Extract HEADER section - find lines between HEADER; and ENDSEC;
    const headerMatch = fileText.match(/HEADER;([\s\S]*?)ENDSEC;/i);
    if (!headerMatch) {
      console.warn('Could not find HEADER section in IFC file');
      return result;
    }

    const headerContent = headerMatch[1].trim();
    result.fullHeader = headerContent;

    // FILE_DESCRIPTION
    const fdMatch = headerContent.match(/FILE_DESCRIPTION\s*\(\s*\(([\s\S]*?)\)\s*,\s*'([^']*)'\s*\);/i);
    if (fdMatch) {
        const descStr = fdMatch[1];
        result.fileDescription.description = descStr.split(',').map(s => s.trim().replace(/^'|'$/g, ''));
        result.fileDescription.implementationLevel = fdMatch[2];
    }

    // FILE_NAME
    // Try robust match first
    const fnMatch = headerContent.match(/FILE_NAME\s*\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*\(([\s\S]*?)\)\s*,\s*\(([\s\S]*?)\)\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\);/i);
    if (fnMatch) {
        result.fileName.name = fnMatch[1];
        result.fileName.timeStamp = fnMatch[2];
        result.fileName.author = fnMatch[3].split(',').map(s => s.trim().replace(/^'|'$/g, ''));
        result.fileName.organization = fnMatch[4].split(',').map(s => s.trim().replace(/^'|'$/g, ''));
        result.fileName.preprocessorVersion = fnMatch[5];
        result.fileName.originatingSystem = fnMatch[6];
        result.fileName.authorization = fnMatch[7];
    } else {
        // Fallback or partial match
        const nameMatch = headerContent.match(/FILE_NAME\s*\(\s*'([^']*)'/i);
        if (nameMatch) result.fileName.name = nameMatch[1];
        
        const timeMatch = headerContent.match(/FILE_NAME\s*\([^,]*,\s*'([^']*)'/i);
        if (timeMatch) result.fileName.timeStamp = timeMatch[1];
    }

    // FILE_SCHEMA
    const fsMatch = headerContent.match(/FILE_SCHEMA\s*\(\s*\(([\s\S]*?)\)\s*\);/i);
    if (fsMatch) {
        result.fileSchema.schemaIdentifiers = fsMatch[1].split(',').map(s => s.trim().replace(/^'|'$/g, ''));
    }
  } catch (err) {
    console.warn('Error extracting IFC header:', err);
  }

  return result;
}

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
  
  // Detect file format (STEP vs JSON/IFCX)
  let fileFormat: 'STEP' | 'JSON' = 'STEP';
  let fileText = '';
  let isIfcxFile = file.name.toLowerCase().endsWith('.ifcx');
  
  // Extract IFC header metadata from raw file content
  let ifcHeader: any = {
    fullHeader: '',
  };
  let syntaxErrors: ValidationError[] = [];
  
  let rawStepLines: Map<number, string> = new Map();
  
  try {
    // Try to decode file as text to extract header and detect format
    fileText = new TextDecoder().decode(data);
    
    // Check if it's a JSON file (IFC5) or STEP file
    if (fileText.trim().startsWith('{') || isIFC5File(file)) {
      fileFormat = 'JSON';
      
      // For JSON/IFC5 files, use the dedicated IFC5 parser
      onProgress?.({
        stage: 'parsing',
        percentage: 20,
        message: 'Parsing IFC5 (.ifcx) JSON format...'
      });
      
      try {
        // Load IFC5 file structure
        const ifc5File: IFC5File = await loadIFC5FromFile(file);
        
        onProgress?.({
          stage: 'parsing',
          percentage: 40,
          message: 'Composing IFC5 tree structure...'
        });
        
        // Parse and compose the tree (skip schema validation for now as not all schemas are included)
        const composedTree = parseIFC5Tree(ifc5File, {
          validateSchemas: false,
          createArtificialRoot: true,
        });
        
        onProgress?.({
          stage: 'parsing',
          percentage: 60,
          message: 'Converting IFC5 to graph representation...'
        });
        
        // Convert to ComposedObject for rendering
        const composedObject: ComposedObject = convertToComposedObject(
          '',
          composedTree,
          ifc5File.schemas
        );
        
        // Convert to graph structure
        const { nodes, edges } = convertToGraph(composedObject);
        
        // Get statistics
        const stats = getIFC5Statistics(composedObject);
        const fileInfo = getIFC5FileInfo(ifc5File);
        
        onProgress?.({
          stage: 'processing',
          percentage: 80,
          message: 'Finalizing IFC5 data...'
        });
        
        // Build the result structure
        const result: ParsedIFCData = {
          graphData: {
            nodes,
            edges,
          },
          metadata: {
            ifcHeader: {
              fileDescription: `IFC5 file with ${stats.totalNodes} nodes`,
              fileName: file.name,
              fileSchema: `IFC5 (${fileInfo.version})`,
              timeStamp: fileInfo.timestamp,
              fullHeader: `IFC5 Format - Author: ${fileInfo.author}, Version: ${fileInfo.version}`,
            },
            parseTime: performance.now() - startTime,
            totalEntities: stats.totalNodes,
            entityCounts: {
              Mesh: stats.meshCount,
              Curve: stats.curveCount,
              Points: stats.pointCloudCount,
              Group: stats.groupCount,
            },
            relationships: edges.length,
            isIFC5: true,
          },
          rawData: {
            composedObject, // Store the composed object for 3D rendering
            ifc5File,       // Store the original file for reference
          },
        };
        
        onProgress?.({
          stage: 'complete',
          percentage: 100,
          message: 'IFC5 file parsed successfully'
        });
        
        return result;
      } catch (err) {
        console.error('Failed to parse as IFC5:', err);
        // Don't re-throw here - instead, log and provide user feedback
        // The user can try loading as IFC4 if this is actually an IFC4 file
        onProgress?.({
          stage: 'complete',
          percentage: 100,
          message: `Failed to parse IFC5 file: ${err instanceof Error ? err.message : 'Unknown error'}`
        });
        throw new Error(`Failed to parse IFC5 file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } else {
      fileFormat = 'STEP';
    }
    
    // Only extract header for STEP files
    if (fileFormat === 'STEP') {
      ifcHeader = extractIFCHeader(fileText);
      
      // Extract raw STEP lines from the file
      rawStepLines = extractRawStepLines(fileText);
      console.debug(`[Parser] Extracted ${rawStepLines.size} raw STEP lines from file`);
      
      // Perform syntax validation (STEP format)
      syntaxErrors = validateIFCFileSyntax(fileText);
    }
    
    // If fileName wasn't extracted from header, use the file name
    if (ifcHeader.fileName && typeof ifcHeader.fileName === 'object' && !ifcHeader.fileName.name) {
      ifcHeader.fileName.name = file.name;
    } else if (!ifcHeader.fileName) {
       // Fallback
       ifcHeader.fileName = { name: file.name };
    }
  } catch (err) {
    console.warn('Could not extract IFC header from file text:', err);
    // Fallback: use file name
    ifcHeader.fileName = { name: file.name };
  }
  
  const modelId = ifcApi.OpenModel(data);
  
  // Notify progress: Parsing started
  onProgress?.({
    stage: 'parsing',
    percentage: 20,
    message: 'Parsing IFC model structure...'
  });
  const allEntities: GraphNode[] = [];  // ALL parsed entities (complete dataset for all consumers)
  const edges: GraphEdge[] = [];
  const nodeMap = new Map<number, GraphNode>();
  
  // Get all entity types in the model
  const allTypes = ifcApi.GetAllTypesOfModel(modelId);
  
  // ADMIN_ONLY_TYPES: Entities that should NEVER appear in any visualization
  // These are purely administrative and have 0% visual value
  // All other entities will be included in the complete dataset for LoD filtering
  const ADMIN_ONLY_TYPES = new Set([
    'IFCOWNERHISTORY',           // Admin ownership tracking
    'IFCPERSON',                  // Creator/modifier person
    'IFCORGANIZATION',            // Creator/modifier organization  
    'IFCPERSONANDORGANIZATION',   // Person + org combo
    'IFCAPPLICATION',             // Software that created entity
  ]);
  
  // METADATA_PROPERTIES that should be skipped during REFERENCE EXTRACTION
  // We still parse them (for tree browser), but don't extract references from them
  // This prevents: IfcSite -> OwnerHistory -> Person false reference chains
  const METADATA_PROPERTIES = new Set([
    'OwnerHistory',               // Never extract references from this
    'LastModifyingUser',
    'LastModifyingApplication',
    'CreationDate',
    'OwningUser',                 // In OwnerHistory
    'OwningApplication',          // In OwnerHistory
  ]);

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

    // if (typeName.startsWith('IFCREL')) continue;
    
    try {
      const entityIds = ifcApi.GetLineIDsWithType(modelId, typeId);
      
      for (let i = 0; i < entityIds.size(); i++) {
        const expressId = entityIds.get(i);
        
        try {
          const entity = ifcApi.GetLine(modelId, expressId);
          
          if (entity) {
            const nodeType = getNodeType(typeId);
            const properties: Record<string, any> = {};
            // We do NOT skip geometry properties anymore. 1:1 Parsing.
            const isGeometryEntity = isGeometryType(typeName);
            
            // Store the raw entity type and ID for debugging
            const rawEntityType = entity.type;
            const rawEntityId = entity.expressID;
            
            // Extract all properties from ALL entities (including geometry/metadata)
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
                
                // CRITICAL FIX: DO NOT SKIP metadata properties
                // if (METADATA_PROPERTIES.has(key)) { ... }
                
                // Skip representation/geometry properties but keep them for structural entities
                // Actually, for 1:1, we should probably keep Representation too, 
                // but usually it's huge objects. Let's keep it but maybe not recursively expand.
                
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
            
            // Classify entity type for informational purposes
            const typeNameUpper = typeName.toUpperCase();
            let nodeClassification = 'element';
            
            if (ADMIN_ONLY_TYPES.has(typeNameUpper)) {
              nodeTypeFromSchema = 'property';
              nodeClassification = 'property';
              console.debug(`Parsed admin entity: ${typeName}`);
            } else if (isGeometryType(typeName)) {
              nodeTypeFromSchema = 'property';
              nodeClassification = 'geometry';
            } else if (PROPERTY_TYPES.has(typeNameUpper) || 
                       typeNameUpper.includes('QUANTITY') || 
                       typeNameUpper.includes('PROPERTY') ||
                       typeNameUpper.includes('PSET_') ||
                       typeNameUpper.includes('PSE_') ||
                       typeNameUpper.includes('MATERIAL') ||
                       typeNameUpper.includes('CLASSIFICATION')) {
              nodeTypeFromSchema = 'property';
              nodeClassification = 'property';
            }
            
            const finalNodeType = schemaDef ? nodeTypeFromSchema : nodeType;
            
            // Use raw STEP format from file if available, otherwise reconstruct
            // For JSON/IFC5 files, reconstructIFCStepFormat will handle it
            const rawStepLine = rawStepLines.get(expressId);
            const ifcStepRepresentation = rawStepLine || reconstructIFCStepFormat(typeName, entity, ifcApi, modelId);
            
            const node: GraphNode = {
              id: `node_${expressId}`,
              label: properties.Name || properties.name || properties.label || getEntityDisplayName(typeName),
              type: finalNodeType,
              ifcType: typeName,
              // Only show structural/spatial elements in the force-directed graph to prevent explosion
              isGraphVisible: nodeClassification !== 'geometry' && nodeClassification !== 'property',
              properties: {
                _ifcStep: ifcStepRepresentation,  // Full IFC STEP representation from file (or reconstructed)
                _fileFormat: fileFormat,           // Store file format (STEP or JSON)
                ...properties,
                _schemaColor: entityColor,
                _schemaIcon: entityIcon,
              },
              expressId,
            };
            
            // Add to complete dataset (used by all consumers)
            allEntities.push(node);
            nodeMap.set(expressId, node);
            
            // Debug IFCPROJECT specifically
            if (typeName.toUpperCase() === 'IFCPROJECT') {
              console.log('IFCPROJECT Node Created:', { 
                id: node.id, 
                label: node.label, 
                color: entityColor,
                type: finalNodeType,
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

  const ensureRelationshipNode = (relId: number, typeName: string, rel: any) => {
    if (!nodeMap.has(relId)) {
      const fallbackNode: GraphNode = {
        id: `node_${relId}`,
        label: typeName,
        type: 'relationship',
        ifcType: typeName,
        isGraphVisible: true,
        properties: {
          _ifcStep: rawStepLines.get(relId) || `#${relId}= ${typeName}(...)`,
          _fileFormat: fileFormat,
          Name: typeName,
        },
        expressId: relId,
      };
      allEntities.push(fallbackNode);
      nodeMap.set(relId, fallbackNode);
    }
  };

  const hasNodeByExpressId = (value: number | string) => {
    const id = typeof value === 'number' ? value : parseInt(String(value).replace('node_', ''), 10);
    return Number.isFinite(id) && nodeMap.has(id);
  };

  const addRelEdge = (relId: number, typeName: string, label: string, targetId: number | string) => {
    const targetNodeId = typeof targetId === 'string' ? targetId : `node_${targetId}`;
    if (!hasNodeByExpressId(targetNodeId)) {
      return;
    }
    edges.push({
      id: `edge_${relId}_${label}_${targetNodeId}`,
      source: `node_${relId}`,
      target: targetNodeId,
      label,
      type: label,
      relationshipType: typeName,
    });
  };
  
  for (const relType of relationshipTypes) {
    try {
      const relIds = ifcApi.GetLineIDsWithType(modelId, relType);
      const typeName = getTypeName(ifcApi, modelId, relType);
      
      for (let i = 0; i < relIds.size(); i++) {
        const relId = relIds.get(i);
        
        try {
          const rel = ifcApi.GetLine(modelId, relId);
          
          if (rel) {
            ensureRelationshipNode(relId, typeName, rel);

            // Handle IFCRELAGGREGATES
            if (rel.RelatingObject && rel.RelatedObjects) {
              const sourceId = rel.RelatingObject.value;
              const relatedObjects = rel.RelatedObjects;

              if (nodeMap.has(sourceId)) {
                addRelEdge(relId, typeName, 'relating', sourceId);
              }

              for (let j = 0; j < relatedObjects.length; j++) {
                const targetId = relatedObjects[j].value;
                if (nodeMap.has(targetId)) {
                  addRelEdge(relId, typeName, 'related', targetId);
                }
              }
            }
            
            // Handle IFCRELCONTAINEDINSPATIALSTRUCTURE
            if (rel.RelatingStructure && rel.RelatedElements) {
              const sourceId = rel.RelatingStructure.value;
              const relatedElements = rel.RelatedElements;

              if (nodeMap.has(sourceId)) {
                addRelEdge(relId, typeName, 'relating', sourceId);
              }

              for (let j = 0; j < relatedElements.length; j++) {
                const targetId = relatedElements[j].value;
                if (nodeMap.has(targetId)) {
                  addRelEdge(relId, typeName, 'related', targetId);
                }
              }
            }
            
            // Handle IFCRELVOIDSELEMENT
            if (rel.RelatingBuildingElement && rel.RelatedOpeningElement) {
              const sourceId = rel.RelatingBuildingElement.value;
              const targetId = rel.RelatedOpeningElement.value;

              if (nodeMap.has(sourceId)) {
                addRelEdge(relId, typeName, 'relating', sourceId);
              }
              if (nodeMap.has(targetId)) {
                addRelEdge(relId, typeName, 'related', targetId);
              }
            }
            
            // Handle IFCRELFILLSELEMENT
            if (rel.RelatingOpeningElement && rel.RelatedBuildingElement) {
              const sourceId = rel.RelatingOpeningElement.value;
              const targetId = rel.RelatedBuildingElement.value;

              if (nodeMap.has(sourceId)) {
                addRelEdge(relId, typeName, 'relating', sourceId);
              }
              if (nodeMap.has(targetId)) {
                addRelEdge(relId, typeName, 'related', targetId);
              }
            }
            
            // Handle IFCRELDEFINESBYPROPERTIES - link elements to property sets
            if (rel.RelatingPropertyDefinition && rel.RelatedObjects) {
              const propDefId = rel.RelatingPropertyDefinition.value;
              const relatedObjects = rel.RelatedObjects;

              if (nodeMap.has(propDefId)) {
                addRelEdge(relId, typeName, 'relating', propDefId);
              }

              for (let j = 0; j < relatedObjects.length; j++) {
                const targetId = relatedObjects[j].value;
                if (nodeMap.has(targetId)) {
                  addRelEdge(relId, typeName, 'related', targetId);
                }
              }
            }

            // Handle IFCRELASSOCIATESMATERIAL
            if (rel.RelatingMaterial && rel.RelatedObjects) {
              const materialId = rel.RelatingMaterial.value;
              const relatedObjects = rel.RelatedObjects;

              if (nodeMap.has(materialId)) {
                addRelEdge(relId, typeName, 'relating', materialId);
              }

              for (let j = 0; j < relatedObjects.length; j++) {
                const targetId = relatedObjects[j].value;
                if (nodeMap.has(targetId)) {
                  addRelEdge(relId, typeName, 'related', targetId);
                }
              }
            }

            // Handle IFCRELASSOCIATESCLASSIFICATION
            if (rel.RelatingClassification && rel.RelatedObjects) {
              const classificationId = rel.RelatingClassification.value;
              const relatedObjects = rel.RelatedObjects;

              if (nodeMap.has(classificationId)) {
                addRelEdge(relId, typeName, 'relating', classificationId);
              }

              for (let j = 0; j < relatedObjects.length; j++) {
                const targetId = relatedObjects[j].value;
                if (nodeMap.has(targetId)) {
                  addRelEdge(relId, typeName, 'related', targetId);
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

  // RECOVERY: Scan rawStepLines for entities that were skipped/failed by WebIFC
  // This ensures even malformed entities like "IFCPERSON(...,UK)" appear in the list.
  if (rawStepLines.size > 0) {
    for (const [id, line] of rawStepLines.entries()) {
      if (!nodeMap.has(id)) {
        // This ID exists in the file but not in our parsed node map.
        // It was skipped by WebIFC (likely due to syntax error).
        // Let's manually parse it.
        try {
          // STEP Regex: #123= IFCTYPE(...)
          // Match: [Full, ID, Type, Content]
          const match = line.match(/^\s*#(\d+)\s*=\s*([A-Za-z0-9_]+)\s*\(([\s\S]*)\)\s*;\s*$/);
          
          if (match) {
             const typeName = match[2];
             const content = match[3];
             
             // Construct a fallback node
             const node: GraphNode = {
               id: `node_${id}`,
               label: `${typeName} (Parse Error)`, // Flag it clearly
               type: 'other', // Mark as other so it's not confused with valid elements
               ifcType: typeName,
               isGraphVisible: false, // Don't show broken nodes in graph
               properties: {
                 _ifcStep: line,
                 _fileFormat: 'STEP',
                 _isSyntaxError: true, // Flag for UI
                 _rawContent: content,
                 Name: `${typeName} #${id}`,
                 // Description removed to prevent clutter in node details
               },
               expressId: id
             };
             
             allEntities.push(node);
             nodeMap.set(id, node);
             
             console.warn(`Recovered malformed entity #${id} (${typeName}) via manual parsing`);
          }
        } catch (recoveryErr) {
          console.error(`Failed to recover entity #${id}`, recoveryErr);
        }
      }
    }
  }
  
  ifcApi.CloseModel(modelId);
  
  const endTime = performance.now();

  // Log parse statistics
  console.log('Parse Results:', {
    totalEntities: allEntities.length,
    edges: edges.length,
    parseTime: endTime - startTime,
  });

  // Log node distribution by type
  const nodesByType: Record<string, number> = {};
  allEntities.forEach(node => {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
  });
  console.log('📊 Parsed entities by type:', nodesByType);

  // NOTE: Validation is NOT performed or returned here. 
  // Parser only parses and extracts data.
  // Validation is handled entirely by the UI (on-demand) via validateIFCData().
  
  // Progress complete
  onProgress?.({
    stage: 'complete',
    percentage: 100,
    message: 'IFC file parsing complete!'
  });
  
  return {
    graphData: { nodes: allEntities, edges },
    allEntities,
    metadata: {
      fileName: file.name,
      fileSize: file.size,
      entityCount: allEntities.length,
      relationshipCount: edges.length,
      parseTime: endTime - startTime,
      geometryEntityCount: 0,
      propertyEntityCount: 0,
      ifcHeader,
    },
    rawData: {
      rawStepLines, // Store raw STEP lines for on-demand validation
    },
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
      ifcHeader: {
        fileDescription: { description: ['Sample IFC Building Model for Demonstration'], implementationLevel: '2;1' },
        fileName: { 
            name: 'sample_building.ifc', 
            timeStamp: new Date().toISOString(),
            author: ['Architect'],
            organization: ['BuildingSmart'] 
        },
        fileSchema: { schemaIdentifiers: ['IFC2X3'] },
        fullHeader: 'FILE_DESCRIPTION((\'Sample IFC Building Model for Demonstration\'),\'2;1\');\nFILE_NAME(\'sample_building.ifc\',\'\',\'\',\'\',\'\',\'\',\'\');\nFILE_SCHEMA((\'IFC2X3\'));',
      },
    },
    validation: validateIFCData(allEntities, edges, {
        fileDescription: { description: ['Sample IFC Building Model for Demonstration'], implementationLevel: '2;1' },
        fileName: { 
            name: 'sample_building.ifc', 
            timeStamp: new Date().toISOString(),
            author: ['Architect'],
            organization: ['BuildingSmart']
        },
        fileSchema: { schemaIdentifiers: ['IFC2X3'] },
    }),
  };
}



