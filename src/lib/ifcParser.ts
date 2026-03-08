import * as WebIFC from 'web-ifc';
import { GraphData, GraphNode, GraphEdge, NodeType, ParsedIFCData } from '@/types/graph';
// Local validation is disabled (WIP) - will be re-enabled later
// import { validateIFCData, validateIFCFileSyntax, ValidationError } from '@/lib/ifcValidatorEnhanced';
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
  'IFCFACEBASEDSURFACEMODEL', // Deprecated in IFC4
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
    const dataStart = fileText.indexOf('DATA;');
    if (dataStart === -1) {
      console.warn('Could not find DATA section in IFC file');
      return stepLineMap;
    }
    const dataEnd = fileText.indexOf('ENDSEC;', dataStart);
    if (dataEnd === -1) {
      console.warn('Could not find ENDSEC; after DATA;');
      return stepLineMap;
    }

    console.log('[Parser] DATA section found, extracting lines sequentially...');

    let pos = dataStart + 5;
    while (pos < dataEnd) {
      const hashIdx = fileText.indexOf('#', pos);
      if (hashIdx === -1 || hashIdx >= dataEnd) break;

      // Read ID using substring instead of char-by-char concatenation
      let i = hashIdx + 1;
      while (i < dataEnd && fileText.charCodeAt(i) >= 48 && fileText.charCodeAt(i) <= 57) {
        i++;
      }
      const idLen = i - (hashIdx + 1);

      // Ensure it's an entity definition: #[id]=
      // Allow spaces between ID and =
      while (i < dataEnd && fileText.charCodeAt(i) === 32) i++;

      if (idLen > 0 && fileText.charCodeAt(i) === 61) { // '='
        const id = parseInt(fileText.substring(hashIdx + 1, hashIdx + 1 + idLen), 10);
        let inString = false;
        let lineEnd = i + 1;

        // Find the end of this statement (a semicolon not within quotes)
        // Use charCodeAt for faster character comparison in tight loop
        while (lineEnd < dataEnd) {
          const ch = fileText.charCodeAt(lineEnd);
          if (ch === 39) { // single quote
            inString = !inString;
          } else if (ch === 59 && !inString) { // semicolon
            break;
          }
          lineEnd++;
        }

        if (lineEnd <= dataEnd) {
          // Include the semicolon, only apply regex cleanup if line contains newlines
          const raw = fileText.substring(hashIdx, lineEnd + 1);
          if (raw.indexOf('\n') !== -1 || raw.indexOf('\r') !== -1) {
            stepLineMap.set(id, raw.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' '));
          } else {
            stepLineMap.set(id, raw);
          }
          pos = lineEnd + 1;
        } else {
          break; // Malformed
        }
      } else {
        // Not an ID definition, move on
        pos = hashIdx + 1;
      }
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
    const headerStart = fileText.indexOf('HEADER;');
    if (headerStart === -1) return result;
    const headerEnd = fileText.indexOf('ENDSEC;', headerStart);
    if (headerEnd === -1) return result;

    const headerContent = fileText.substring(headerStart, headerEnd + 7).trim();
    result.fullHeader = headerContent;

    // Fast regex matching on just the short header section instead of the whole file
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

      // Local validation disabled (WIP) - will be re-enabled later
      // syntaxErrors = validateIFCFileSyntax(fileText);

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
      // Relationship pointers (Crucial for GraphBuilder LPG edges)
      'RelatingObject', 'RelatedObjects',
      'RelatingStructure', 'RelatedElements',
      'RelatingPropertyDefinition', 'RelatingMaterial',
      'RelatingBuildingElement', 'RelatedOpeningElement',
      'RelatingOpeningElement', 'RelatedBuildingElement',
      'RelatingType', 'RelatingClassification',
      'RelatingElement', 'RelatedElement',
      'RelatingSpace',
      'RelatingContext', 'RelatedDefinitions',
      'RelatingLibrary',
      'RelatingGroup',           // IFCRELASSIGNSTOGROUP
      'RelatingPort', 'RelatedPort', // IFCRELCONNECTSPORTS, IFCRELCONNECTSPORTTOELEMENT
      'RelatingSystem', 'RelatedBuildings', // IFCRELSERVICESBUILDINGS
      'FlowDirection', 'FlowCondition', // IFCDISTRIBUTIONPORT MEP attributes
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

      // NOTE: IFCREL* types are parsed to create LPG relationship nodes in the graph.
      // The GraphBuilder uses these as intermediate nodes for edge creation.

      // Report progress — yield every 20 types (balance between GC opportunity and delay)
      if (typeIdx % 20 === 0) {
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

      // OPTIMIZATION: Hoist per-type computations out of inner entity loop
      // These are constant for all entities of the same type
      const isGeometry = isGeometryType(typeName);
      const propertiesSet = isGeometry ? GEOMETRY_MINIMAL_PROPERTIES_SET : ESSENTIAL_PROPERTIES_SET;
      const schemaDef = getEntityDef(typeName);
      let nodeTypeFromSchema: NodeType = 'element';
      if (schemaDef) {
        const cat = schemaDef.category;
        if (cat === 'spatial') nodeTypeFromSchema = typeName.toUpperCase() === 'IFCSPACE' ? 'space' : 'building';
        else if (cat === 'structural') nodeTypeFromSchema = 'element';
        else if (cat === 'property') nodeTypeFromSchema = 'property';
        else if (cat === 'relationship') nodeTypeFromSchema = 'relationship';
      } else if (typeName.toUpperCase().startsWith('IFCREL')) {
        // Fallback: any IFCREL* type not in schema is still a relationship
        // Note: WebIFC returns PascalCase names (e.g. 'IfcRelAssignsToGroup')
        nodeTypeFromSchema = 'relationship';
      }
      const isVisible = nodeTypeFromSchema !== 'property' && nodeTypeFromSchema !== 'relationship';

      for (let i = 0; i < lineCount; i++) {
        const expressId = lineIds.get(i);

        try {
          const entity = getLine(expressId);
          if (!entity) continue;

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
              if (key === 'RelatedObjects' || key === 'RelatedElements' || key === 'RelatedDefinitions' || key === 'RelatedBuildings' || key === 'Representation') {
                properties[key] = value;
              }
            } else if (typeof value !== 'function') {
              properties[key] = value;
            }
          }

          properties['_entityType'] = entity.type;
          properties['_expressID'] = entity.expressID;

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
          if (isGeometry) {
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
