import * as WebIFC from 'web-ifc';
import { GraphData, GraphNode, GraphEdge, NodeType, ParsedIFCData } from '@/types/graph';
import { validateIFCData, validateIFCFileSyntax, ValidationError } from '@/lib/ifcValidatorEnhanced';
import { getEntityDef, getEntityDisplayName } from '@/lib/ifcSchema';
import { NODE_COLORS } from '@/lib/colorScheme';
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

// IFC Type mapping - fallback for types without schema
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
  // Relationship entities - ALL relationships should have type 'relationship'
  [WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE]: 'relationship',
  [WebIFC.IFCRELAGGREGATES]: 'relationship',
  [WebIFC.IFCRELVOIDSELEMENT]: 'relationship',
  [WebIFC.IFCRELFILLSELEMENT]: 'relationship',
  [WebIFC.IFCRELDEFINESBYPROPERTIES]: 'relationship',  // FIXED: Was 'property', should be 'relationship'
  [WebIFC.IFCRELDEFINESBYTYPE]: 'relationship',  // ADDED: Was missing, causing default to 'element'
  [WebIFC.IFCRELASSOCIATES]: 'relationship',  // ADDED: Material/classification associations
  [WebIFC.IFCRELASSOCIATESMATERIAL]: 'relationship',  // ADDED: Material associations
  [WebIFC.IFCRELASSOCIATESCLASSIFICATION]: 'relationship',  // ADDED: Classification associations
  [WebIFC.IFCRELASSOCIATESLIBRARY]: 'relationship',  // ADDED: Library associations
  [WebIFC.IFCRELSPACEBOUNDARY]: 'relationship',  // ADDED: Space boundary relationships
  [WebIFC.IFCRELCONNECTS]: 'relationship',  // ADDED: Generic connects
  [WebIFC.IFCRELCONNECTSTOREVISIONCONTROL]: 'relationship',  // ADDED: Revision control
  [WebIFC.IFCRELDECLARES]: 'relationship',  // ADDED: Declaration relationships
  // Property and quantity entities - these have type codes in WebIFC
  ...(WebIFC.IFCPROPERTYSET !== undefined && { [WebIFC.IFCPROPERTYSET]: 'property' }),
  ...(WebIFC.IFCELEMENTQUANTITY !== undefined && { [WebIFC.IFCELEMENTQUANTITY]: 'property' }),
};

function getNodeType(ifcType: number): NodeType {
  const mapped = IFC_TYPE_MAPPING[ifcType];
  if (mapped) return mapped;

  // If not in explicit mapping, infer from WebIFC type name
  const typeName = Object.entries(WebIFC).find(([key, val]) => val === ifcType)?.[0] || '';
  if (typeName.includes('REL')) return 'relationship';  // Any IFCREL* type
  if (typeName.includes('PROPERTY') || typeName.includes('QUANTITY')) return 'property';

  return 'element';  // Default fallback
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

export { isGeometryType };

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
    console.log('[Parser] DATA section found, length:', dataContent.length);
    
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
    
    console.log('[Parser] Extracted', stepLineMap.size, 'STEP lines');
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
  console.log('[Parser] Starting parse:', file.name, 'size:', file.size);
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
  
  const loadTime = performance.now();
  
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);
  
  // Detect file format (STEP vs JSON/IFCX)
  let fileFormat: 'STEP' | 'JSON' = 'STEP';
  let fileText = '';
  // Force Read as Text to ensure we can detect header commands
  // This is fast for 16MB
  try {
     fileText = new TextDecoder().decode(data);
  } catch (e) { console.warn('Text decode failed'); }
  
  let isIfcxFile = file.name.toLowerCase().endsWith('.ifcx');
  
  // Extract IFC header metadata from raw file content
  let ifcHeader: any = {
    fullHeader: '',
  };
  let syntaxErrors: ValidationError[] = [];
  
  let rawStepLines: Map<number, string> = new Map();
  
  try {
    // Check if it's a JSON file (IFC5) or STEP file
    if (fileText.trim().startsWith('{') || isIFC5File(file)) {
      fileFormat = 'JSON';
      console.log(`[Parser] Detected file format: JSON (IFC5)`);
      
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
          allEntities: nodes,
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            ifcHeader: {
              fileDescription: `IFC5 file with ${stats.totalNodes} nodes`,
              fileName: file.name,
              fileSchema: `IFC5 (${fileInfo.version})`,
              timeStamp: fileInfo.timestamp,
              fullHeader: `IFC5 Format - Author: ${fileInfo.author}, Version: ${fileInfo.version}`,
            },
            parseTime: performance.now() - startTime,
            entityCount: stats.totalNodes,
            totalEntities: stats.totalNodes,
            entityCounts: {
              Mesh: stats.meshCount,
              Curve: stats.curveCount,
              Points: stats.pointCloudCount,
              Group: stats.groupCount,
            },
            relationshipCount: edges.length,
            relationships: edges.length,
            geometryEntityCount: 0,
            propertyEntityCount: 0,
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
      console.log(`[Parser] Detected file format: STEP`);
    }
    
    // Only extract header for STEP files
    if (fileFormat === 'STEP') {
      ifcHeader = extractIFCHeader(fileText);

      // CRITICAL: Extract ALL STEP lines for 1:1 IFC Browser representation
      // IFC Browser MUST show every entity in the file, no exceptions
      // This is non-negotiable for POC usability
      rawStepLines = extractRawStepLines(fileText);
      console.log(`[Parser] STEP: Extracted ${rawStepLines.size} raw STEP lines (ALL entities)`);

      // Perform syntax validation (STEP format)
      syntaxErrors = validateIFCFileSyntax(fileText);

      // Clear fileText after extraction - it's no longer needed and can consume significant memory
      // This frees ~20MB for the 19MB file
      fileText = '';
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
  
  const modelOpenStart = performance.now();
  const modelId = ifcApi.OpenModel(data);
  const modelOpenEnd = performance.now();
  const modelOpenTime = modelOpenEnd - modelOpenStart;
  console.log(`[Parser Timing] WebIFC.OpenModel(): ${modelOpenTime.toFixed(2)}ms`);
  
  // Notify progress: Parsing started
  onProgress?.({
    stage: 'parsing',
    percentage: 20,
    message: 'Parsing IFC model structure...'
  });
  
  // Cache for IFC lines to avoid redundant GetLine calls
  const lineCache = new Map<number, any>();
  const getLine = (id: number) => {
    if (lineCache.has(id)) return lineCache.get(id);
    const line = ifcApi.GetLine(modelId, id);
    lineCache.set(id, line);
    return line;
  };
  
  const allEntities: GraphNode[] = [];  // Semantic entities (non-geometry)
  const geometryEntities: GraphNode[] = [];  // Geometry and representation entities
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
    // Representation and placement - geometric/structural metadata
    'IFCPRODUCTDEFINITIONSHAPE',        // Shape representation container
    'IFCLOCALPLACEMENT',                // Coordinate system placement
    'IFCAXIS2PLACEMENT2D',              // 2D coordinate system
    'IFCAXIS2PLACEMENT3D',              // 3D coordinate system
    // Profile and boundary definitions - geometric templates
    'IFCARBITRARYCLOSEDPROFILEDEF',     // Profile definition
    'IFCFACEOUTERBOUND',                // Face boundary
    'IFCCLOSEDSHELL',                   // Shell geometry primitive
    'IFCCLOSINGCONTEXT',                // Closing definition
    // Type definitions - schema templates, not instances
    'IFCWALLTYPE',                      // Wall type template
    'IFCDOORTYPE',                      // Door type template
    'IFCWINDOWTYPE',                    // Window type template
    'IFCSLABTYPE',                      // Slab type template
    'IFCCOLUMNTYPE',                    // Column type template
    'IFCBEAMTYPE',                      // Beam type template
    'IFCDUCTTYPE',                      // Duct type template
    'IFCPIPESEGMENTTYPE',               // Pipe type template
    'IFCPUMPTYPE',                      // Pump type template
    'IFCFANTYPE',                       // Fan type template
    'IFCCHILLERTYPE',                   // Chiller type template
    'IFCCOILTYPE',                      // Coil type template
    'IFCBOILERTYPE',                    // Boiler type template
    'IFCCOVERING TYPE',                 // Covering type template
    'IFCRELDEFINESBYTYPE',              // Type definition relationship
    // Color and styling - appearance metadata
    'IFCCOLOURRGB',                     // Color definition
    'IFCSURFACESTYLE',                  // Surface styling
  ]);

  // 3. Process entities
  // OPTIMIZATION: Instead of iterating by Schema Type (which requires checking 800+ types),
  // we iterate ALL lines present in the model. This is O(N) where N is entity count.
  console.log('[Parser] Starting entity extraction...');
  const entityLoopStart = performance.now();
  
  try {
      // Parse ALL entity types to get complete 1:1 representation of IFC file
      // Geometry filtering happens in graph building, not in the parser
      // This ensures IFC Browser shows all entities exactly as in the file
      const relevantTypes = allTypes;

      console.log(`[Parser] Processing: ${allTypes.length} types (including geometry for IFC Browser)`);

      // OPTIMIZATION 1: Use Set for O(1) property lookup instead of O(n) array iteration
      const ESSENTIAL_PROPERTIES_SET = new Set([
        'Name', 'name',
        'Description', 'description',
        'GlobalId', 'globalId',
        'ObjectType', 'objectType',
        'Tag', 'tag',
        'type', 'expressID',
        // Relationship pointers (Crucial for GraphBuilder)
        'RelatingObject', 'RelatedObjects',
        'RelatingStructure', 'RelatedElements',
        'RelatingPropertyDefinition', 'RelatingMaterial',
        'RelatingElement', 'RelatedElement',
        'RelatingBuildingElement', 'RelatedOpeningElement',
        'RelatingOpeningElement', 'RelatedBuildingElement',
        'Representation'
      ]);

      // OPTIMIZATION 2: Minimal properties for geometry entities (much faster extraction)
      const GEOMETRY_MINIMAL_PROPERTIES_SET = new Set([
        'Name', 'name', 'type', 'expressID'
      ]);

      const typeCount = relevantTypes.length;

      for (let typeIdx = 0; typeIdx < typeCount; typeIdx++) {
          const typeInfo = relevantTypes[typeIdx];
          const typeId = typeInfo.typeID;
          const typeName = getTypeName(ifcApi, modelId, typeId);

          // PERFORMANCE: Skip IFCREL* types (relationships)
          // GraphBuilder already extracts relationships from entity properties
          // Parsing these adds 85+ seconds for no benefit
          if (typeName.startsWith('IFCREL')) continue;

          // Report progress
          if (typeIdx % 5 === 0) {
            const pct = 10 + Math.floor((typeIdx / typeCount) * 80);
            onProgress?.({
                stage: 'processing',
                percentage: pct,
                message: `Scanning ${typeName} (${typeIdx}/${typeCount})...`
            });
            await allowUIUpdate();
          }

          const lineIds = ifcApi.GetLineIDsWithType(modelId, typeId);
          const lineCount = lineIds.size();
          
          for (let i = 0; i < lineCount; i++) {
              const expressId = lineIds.get(i);
              
              try {
                  const entity = getLine(expressId);
                  if (!entity) continue;

                  // OPTIMIZATION 3: Geometry entities use minimal property set (much faster!)
                  const isGeometry = isGeometryType(typeName);
                  const propertiesSet = isGeometry ? GEOMETRY_MINIMAL_PROPERTIES_SET : ESSENTIAL_PROPERTIES_SET;

                  // --- PROPERTY EXTRACTION START ---
                  const properties: Record<string, any> = {};

                  for (const key of propertiesSet) {
                    const value = entity[key as keyof typeof entity];
                    if (value === null || value === undefined) continue;

                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                      if (value.value !== undefined) {
                        properties[key] = value.value;
                      } else if (key === 'GlobalId' || key === 'globalId') {
                        properties[key] = value;
                      }
                    } else if (Array.isArray(value)) {
                      // OPTIMIZATION 5: Store raw array, defer unwrapping to graphBuilder
                      // Avoids .map() call per entity (saves 10% of parse time)
                      if (key === 'RelatedObjects' || key === 'RelatedElements' || key === 'Representation') {
                          properties[key] = value;
                      }
                    } else if (typeof value !== 'function') {
                      properties[key] = value;
                    }
                  }

                  properties['_entityType'] = entity.type;
                  properties['_expressID'] = entity.expressID;

                  const schemaDef = getEntityDef(typeName);
                  let nodeTypeFromSchema: NodeType = 'element';
                  if (schemaDef) {
                     const cat = schemaDef.category;
                     if (cat === 'spatial') nodeTypeFromSchema = typeName === 'IFCSPACE' ? 'space' : 'building';
                     else if (cat === 'structural') nodeTypeFromSchema = 'element';
                     else if (cat === 'property') nodeTypeFromSchema = 'property';
                     else if (cat === 'relationship') nodeTypeFromSchema = 'relationship';
                  }

                  const isVisible = nodeTypeFromSchema !== 'property' && nodeTypeFromSchema !== 'relationship';

                  const node: GraphNode = {
                    id: `node_${expressId}`,
                    label: properties.Name || properties.name || properties.label || getEntityDisplayName(typeName),
                    type: nodeTypeFromSchema,
                    ifcType: typeName,
                    isGraphVisible: isVisible,
                    properties,  // OPTIMIZATION 6: No spread operator - direct assignment
                    expressId,
                  };

                  // Separate geometry entities from semantic entities
                  if (isGeometryType(typeName)) {
                    geometryEntities.push(node);
                  } else {
                    allEntities.push(node);
                  }
                  nodeMap.set(expressId, node);
              } catch (e) { /* skip */ }
          }

          // OPTIMIZATION 7: Clear cache per type batch (every ~50-100 types)
          // Frees memory for WebIFC entity objects after they're parsed
          if (typeIdx % 50 === 0) {
              lineCache.clear();
          }
      }
  } catch (err) {
      console.error('Fatal error in entity loop:', err);
  }
  
  const entityLoopEnd = performance.now();
  const entityLoopTime = entityLoopEnd - entityLoopStart;

  // SKIP RELATIONSHIP PROCESSING - parser should only parse, not build graph

  // Post progress
  onProgress?.({
    stage: 'processing',
    percentage: 90,
    message: `Parsed ${allEntities.length + geometryEntities.length} entities (${allEntities.length} semantic, ${geometryEntities.length} geometry) in ${entityLoopTime.toFixed(0)}ms`
  });

  
  // Clear cache and free resources immediately
  lineCache.clear();
  ifcApi.CloseModel(modelId);
  ifcApi.Dispose();
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  
  // Post final progress
  onProgress?.({
    stage: 'complete',
    percentage: 100,
    message: `Parse complete in ${totalTime.toFixed(0)}ms - ${allEntities.length + geometryEntities.length} entities extracted`
  });

  // Return parsed entities - NO relationship processing in parser!
  return {
    graphData: { nodes: [], edges: [] },  // Empty - consumers will build graph via graphBuilder
    allEntities,  // Semantic entities (use for graph building)
    geometryEntities,  // Geometry entities (use for complete IFC Browser display)
    metadata: {
      fileName: file.name,
      fileSize: file.size,
      entityCount: allEntities.length,
      geometryEntityCount: geometryEntities.length,
      relationshipCount: 0,  // Not computed in parser
      parseTime: totalTime,
      propertyEntityCount: 0,
      ifcHeader,
    },
    rawData: {
      rawStepLines,
    },
  };
}

// End of parser implementation
