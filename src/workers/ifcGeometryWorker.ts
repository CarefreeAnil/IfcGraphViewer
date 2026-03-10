/**
 * IFC Geometry Worker
 * Extracts mesh data from IFC using web-ifc in a Web Worker.
 */

import * as WebIFC from 'web-ifc';

export interface GeometryWorkerMessage {
  type: 'parse' | 'cancel' | 'inspect' | 'dispose' | 'getGeometry';
  buffer?: ArrayBuffer;
  // parse options
  keepModel?: boolean;
  keepAliveMs?: number;
  // inspect / getGeometry message
  id?: number;
}

export interface GeometryWorkerResponse {
  type: 'batch' | 'complete' | 'error' | 'geometryResult';
  error?: string;
  meshes?: MeshPayload[];
  processedGroups?: number;
  totalGroups?: number;
}

export interface MeshPayload {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  color: number;
  opacity: number;
  colorRgb?: { r: number; g: number; b: number; a: number };
  transforms: Float32Array;
  expressIds: Int32Array;
  ifcType: string;
  instanceCount: number;
  geometryId: number;
  colorSource?: number | null; // expressID which provided the color
  worldSpace?: boolean;        // true when positions/normals are already world-space
}

const typeColors: Record<string, number> = {
  // Architectural
  IFCWALL: 0xccbbb8,
  IFCWALLSTANDARDCASE: 0xccbbb8,
  IFCSLAB: 0xcccccc,
  IFCSLABSTANDARDCASE: 0xcccccc,
  IFCDOOR: 0x8b6f47,            // Darker brown for better visibility
  IFCWINDOW: 0x5eb3f6,           // Brighter, more saturated blue for windows
  IFCCOLUMN: 0xb3b3b3,
  IFCBEAM: 0xc0c0c0,
  IFCROOF: 0x996622,
  IFCSTAIR: 0xd9d9d9,
  IFCRAILING: 0x808080,
  IFCFURNISHINGELEMENT: 0x805020,
  IFCOPENINGELEMENT: 0x4d4d4d,
  
  // HVAC/Duct (blue tones)
  IFCDUCT: 0x4a90e2,           // Bright blue
  IFCDUCTFITTING: 0x357abd,    // Medium blue
  IFCDUCTSEGEMNT: 0x4a90e2,    // Bright blue
  IFCDUCTSILENCER: 0x5a9fdb,   // Light blue
  IFCFLOWSEGMENT: 0x4a90e2,    // Bright blue
  
  // Plumbing/Pipe (red/orange tones)
  IFCPIPE: 0xd64545,           // Red
  IFCPIPESEGMENT: 0xd64545,    // Red
  IFCPIPEFIT: 0xa83a3a,        // Dark red
  IFCPIPEFITTING: 0xa83a3a,    // Dark red
  
  // Electrical/Cable (yellow/orange tones)
  IFCCABLE: 0xf5a623,          // Orange
  IFCCABLESEGMENT: 0xf5a623,   // Orange
  IFCWIRINGELEMENT: 0xf5a623,  // Orange
  IFCELECTRICALFIXTURE: 0xffd700, // Gold
  IFCJUNCTIONBOX: 0xffa500,    // Orange
  IFCOUTLET: 0xffd700,         // Gold
  IFCSWITCH: 0xffa500,         // Orange
  IFCLAMP: 0xcc8800,           // Dark orange
  IFCPROTECTIVEDEVICE: 0xff6b6b, // Red
  IFCELECTRICDISTRIBUTIONBOARD: 0xffa500, // Orange
  
  // MEP Flow classes (generic)
  IFCFLOWFITTING: 0x666666,    // Gray
  IFCFLOWTERMINAL: 0x888888,   // Light gray
  IFCFLOWMOVINGDEVICE: 0x4a90e2, // Blue (fans, pumps)
  IFCFLOWCONTROLLER: 0xd64545, // Red (valves, dampers)
  IFCFLOWTREATMENTDEVICE: 0x357abd, // Dark blue (filters, coils)
  IFCFLOWSTORAGEDEVICE: 0x9b59b6, // Purple (tanks)
  
  // Equipment
  IFCEQUIPMENT: 0x95a5a6,      // Gray
  IFCBUILDINGEQUIPMENT: 0x95a5a6, // Gray
  
  // Spatial
  IFCSPACE: 0xfffacd,          // Light yellow (spaces)
  IFCSITE: 0x8b7355,           // Brown
  IFCBUILDING: 0xd3d3d3,       // Light gray
  IFCBUILDINGSTOREY: 0xe0e0e0, // Very light gray
  IFCPROJECT: 0xffffff,        // White
  IFCPRODUCT: 0xb3b3b3,        // Medium gray (default)
};

// Helper: Convert IFC color (0-1 floats) to hex
function ifcColorToRgbInt(colorObj: any): number {
  if (!colorObj) return 0xcccccc;
  // normalize wrappers
  if (colorObj && typeof colorObj === 'object') {
    if (colorObj.SurfaceColour) colorObj = colorObj.SurfaceColour;
    else if (colorObj.DiffuseColour) colorObj = colorObj.DiffuseColour;
  }

  const extractNumber = (v: any): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v);
      return isFinite(n) ? n : null;
    }
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'number') return v[0];
    if (typeof v === 'object') {
      if ('value' in v && typeof v.value === 'number') return v.value;
      if ('Value' in v && typeof v.Value === 'number') return v.Value;
      // try numeric-looking keys in order
      const keys = Object.keys(v);
      for (const k of keys) {
        if (typeof v[k] === 'number' && isFinite(v[k])) return v[k];
        if (typeof v[k] === 'string') {
          const n = Number(v[k]);
          if (isFinite(n)) return n;
        }
      }
    }
    return null;
  };

  let r = extractNumber(Array.isArray(colorObj) ? colorObj[0] : colorObj.Red ?? colorObj.r ?? colorObj[0]);
  let g = extractNumber(Array.isArray(colorObj) ? colorObj[1] : colorObj.Green ?? colorObj.g ?? colorObj[1]);
  let b = extractNumber(Array.isArray(colorObj) ? colorObj[2] : colorObj.Blue ?? colorObj.b ?? colorObj[2]);

  // fallback name search
  if (r === null || g === null || b === null) {
    const asObj = typeof colorObj === 'object' ? colorObj : {};
    r = r ?? extractNumber(asObj.Red) ?? extractNumber(asObj.R) ?? extractNumber(asObj.red) ?? extractNumber(asObj[0]);
    g = g ?? extractNumber(asObj.Green) ?? extractNumber(asObj.G) ?? extractNumber(asObj.green) ?? extractNumber(asObj[1]);
    b = b ?? extractNumber(asObj.Blue) ?? extractNumber(asObj.B) ?? extractNumber(asObj.blue) ?? extractNumber(asObj[2]);
  }

  // defaults
  const def = 0.8;
  const rr = r === null ? def : r;
  const gg = g === null ? def : g;
  const bb = b === null ? def : b;

  // IFC defines normalized values 0.0-1.0. If values look like 0-255 ints, normalize
  const normVal = (v: any) => {
    let n = Number(v);
    if (!isFinite(n)) return def;
    if (n > 1) n = Math.min(255, Math.max(0, n)) / 255;
    return Math.min(1, Math.max(0, n));
  };

  const rn = normVal(rr);
  const gn = normVal(gg);
  const bn = normVal(bb);

  return ((Math.round(rn * 255) << 16) | (Math.round(gn * 255) << 8) | Math.round(bn * 255)) >>> 0;
}

// Diagnostic logging helper - only log first N calls per key to avoid spam
const diagnosticLog = (() => {
  const logCounts = new Map<string, number>();
  const MAX_LOGS_PER_KEY = 5;
  return (key: string, ...args: any[]) => {
    const count = (logCounts.get(key) || 0) + 1;
    logCounts.set(key, count);
    if (count <= MAX_LOGS_PER_KEY) {
      console.log(`[DIAG ${key}] [${count}/${MAX_LOGS_PER_KEY}]`, ...args);
    } else if (count === MAX_LOGS_PER_KEY + 1) {
      console.log(`[DIAG ${key}] ... (suppressing further logs)`);
    }
  };
})();

// Comprehensive IFC Material & Color Extractor
// Traverses ALL IFC color sources and returns color + transparency with priority order
// PRIORITY: 1. StyledItem (done elsewhere) 2. RelAssociatesMaterial + IfcMaterial 3. Direct Material property
function extractColorAndTransparencyFromIFC(ifcApi: any, modelId: number, entityId: number, lineCache: Map<number, any>): { 
  color: number | null; 
  transparency: number; 
  source: string;
} {
  const result = { color: null as number | null, transparency: 0.0, source: 'fallback' };

  try {
    const entity = lineCache.has(entityId) ? lineCache.get(entityId) : ifcApi.GetLine(modelId, entityId);
    if (!entity) return result;

    const entityType = entity.type?.toString()?.toUpperCase() || 'UNKNOWN';
    const isWindow = entityType.includes('WINDOW') || entityType.includes('DOOR');

    // ===== SOURCE 1: Try IfcRelAssociatesMaterial (most common for materials) =====
    try {
      let relMatTypeId: number | null = null;
      // First find the IFCRELASSOCIATESMATERIAL type ID
      try {
        const allTypes = ifcApi.GetAllTypesOfModel ? ifcApi.GetAllTypesOfModel(modelId) : [];
        for (let i = 0; i < allTypes.length; i++) {
          const t = allTypes[i];
          const typeId = t?.typeID ?? t;
          try {
            const typeName = ((ifcApi.GetNameFromTypeCode ? ifcApi.GetNameFromTypeCode(typeId)?.toUpperCase() : '') || '').toString();
            if (typeName === 'IFCRELASSOCIATESMATERIAL') {
              relMatTypeId = typeId;
              break;
            }
          } catch (e) {}
        }
      } catch (e) {}

      if (relMatTypeId) {
        const relIds = ifcApi.GetLineIDsWithType(modelId, relMatTypeId);
        for (let i = 0; i < relIds.size(); i++) {
          const relId = relIds.get(i);
          const rel = lineCache.has(relId) ? lineCache.get(relId) : ifcApi.GetLine(modelId, relId);
          if (!rel || !rel.RelatedObjects) continue;

          // Check if this entity is in RelatedObjects
          const relatedObjs = Array.isArray(rel.RelatedObjects) ? rel.RelatedObjects : [rel.RelatedObjects];
          let isRelated = false;
          for (const obj of relatedObjs) {
            const objId = typeof obj === 'number' ? obj : (obj?.value ?? obj?.expressID);
            if (objId === entityId) {
              isRelated = true;
              break;
            }
          }

          if (!isRelated) continue;

          // Found relationship - extract material
          const mat = resolveIfcRef(ifcApi, modelId, rel.RelatingMaterial, lineCache);
          if (!mat) {
            diagnosticLog('RelMat', `Entity ${entityId} (${entityType}): RelAssociatesMaterial found but Material is null`);
            continue;
          }

          diagnosticLog('RelMat', `Entity ${entityId} (${entityType}): Found RelAssociatesMaterial, Material keys:`, Object.keys(mat).slice(0, 10));
          result.source = 'IfcRelAssociatesMaterial';

          // Extract color from material
          if (mat.Colour) {
            const col = resolveIfcRef(ifcApi, modelId, mat.Colour, lineCache);
            if (col && (col.Red !== undefined || col.Green !== undefined || col.Blue !== undefined)) {
              result.color = ifcColorToRgbInt(col);
              diagnosticLog('RelMat_Color', `Entity ${entityId}: Found color: 0x${result.color?.toString(16).padStart(6, '0')}`);
            }
          } else {
            if (isWindow) diagnosticLog('RelMat_NoColor', `Entity ${entityId} (${entityType}): No Colour property on Material`);
          }

          // Extract transparency from material
          if (mat.Transparency !== undefined && mat.Transparency !== null) {
            const t = Number(mat.Transparency);
            if (isFinite(t)) {
              result.transparency = Math.min(1, Math.max(0, t));
              diagnosticLog('RelMat_Trans', `Entity ${entityId}: Found Transparency: ${result.transparency}`);
            }
          }

          // Also check MaterialProperties on the material
          if (mat.MaterialProperties) {
            const props = Array.isArray(mat.MaterialProperties) ? mat.MaterialProperties : [mat.MaterialProperties];
            diagnosticLog('RelMat_Props', `Entity ${entityId}: MaterialProperties found, count: ${props.length}`);
            for (const propRef of props) {
              const prop = resolveIfcRef(ifcApi, modelId, propRef, lineCache);
              if (!prop) continue;

              // Check for transparency in property
              if (prop.Transparency !== undefined && prop.Transparency !== null) {
                const t = Number(prop.Transparency);
                if (isFinite(t) && result.transparency === 0.0) {
                  result.transparency = Math.min(1, Math.max(0, t));
                  diagnosticLog('RelMat_PropTrans', `Entity ${entityId}: Found transparency in property: ${result.transparency}`);
                }
              }

              // Some IFC files store transparency as IsTransparent boolean
              if (prop.IsTransparent === true && result.transparency === 0.0) {
                result.transparency = 0.7;
                diagnosticLog('RelMat_IsTransparent', `Entity ${entityId}: IsTransparent=true`);
              }
            }
          }

          // If we found something, return early (this is high priority)
          if (result.color !== null || result.transparency > 0) {
            return result;
          }
        }
      }
    } catch (e) {
      diagnosticLog('RelMat_Error', `Extraction error:`, e);
      // Continue to next source
    }

    // ===== SOURCE 2: Direct Material property on entity =====
    if (entity.Material) {
      diagnosticLog('DirectMat', `Entity ${entityId} (${entityType}): Has direct Material property`);
      const mat = resolveIfcRef(ifcApi, modelId, entity.Material, lineCache);
      if (mat) {
        diagnosticLog('DirectMat', `Entity ${entityId}: Material resolved, keys:`, Object.keys(mat).slice(0, 10));
        result.source = 'direct.Material';

        if (mat.Colour) {
          const col = resolveIfcRef(ifcApi, modelId, mat.Colour, lineCache);
          if (col && (col.Red !== undefined || col.Green !== undefined || col.Blue !== undefined)) {
            result.color = ifcColorToRgbInt(col);
            diagnosticLog('DirectMat_Color', `Entity ${entityId}: Found color: 0x${result.color?.toString(16).padStart(6, '0')}`);
          }
        }

        if (mat.Transparency !== undefined && mat.Transparency !== null) {
          const t = Number(mat.Transparency);
          if (isFinite(t)) {
            result.transparency = Math.min(1, Math.max(0, t));
            diagnosticLog('DirectMat_Trans', `Entity ${entityId}: Found transparency: ${result.transparency}`);
          }
        }

        if (result.color !== null || result.transparency > 0) {
          return result;
        }
      }
    }

    // ===== SOURCE 3: IfcMaterialList =====
    if (entity.Materials) {
      diagnosticLog('MatList', `Entity ${entityId} (${entityType}): Has Materials list`);
      const mats = Array.isArray(entity.Materials) ? entity.Materials : [entity.Materials];
      for (const matRef of mats) {
        const mat = resolveIfcRef(ifcApi, modelId, matRef, lineCache);
        if (!mat) continue;

        result.source = 'IfcMaterialList';

        if (!result.color && mat.Colour) {
          const col = resolveIfcRef(ifcApi, modelId, mat.Colour, lineCache);
          if (col && (col.Red !== undefined || col.Green !== undefined || col.Blue !== undefined)) {
            result.color = ifcColorToRgbInt(col);
            diagnosticLog('MatList_Color', `Entity ${entityId}: Found color: 0x${result.color?.toString(16).padStart(6, '0')}`);
          }
        }

        if (result.transparency === 0.0 && mat.Transparency !== undefined && mat.Transparency !== null) {
          const t = Number(mat.Transparency);
          if (isFinite(t)) {
            result.transparency = Math.min(1, Math.max(0, t));
            diagnosticLog('MatList_Trans', `Entity ${entityId}: Found transparency: ${result.transparency}`);
          }
        }

        if (result.color !== null || result.transparency > 0) {
          return result;
        }
      }
    }

  } catch (e) {
    diagnosticLog('Error', `Unexpected error during extraction:`, e);
    // Silently fail
  }

  return result;
}

// Legacy function for backward compatibility
function extractTransparencyFromMaterial(ifcApi: any, modelId: number, entityId: number, lineCache: Map<number, any>): number {
  const result = extractColorAndTransparencyFromIFC(ifcApi, modelId, entityId, lineCache);
  return result.transparency;
}

// Resolve a reference (number or wrapper) into a full IFC line object; central helper to avoid duplication
function resolveIfcRef(ifcApi: any, modelId: number, ref: any, lineCache?: Map<number, any>) {
  if (!ref) return null;
  try {
    if (typeof ref === 'number') return lineCache ? lineCache.get(ref) ?? (lineCache.set(ref, ifcApi.GetLine(modelId, ref)), lineCache.get(ref)) : ifcApi.GetLine(modelId, ref);
    if (typeof ref === 'object' && 'value' in ref && typeof ref.value === 'number') {
      const id = ref.value;
      return lineCache ? lineCache.get(id) ?? (lineCache.set(id, ifcApi.GetLine(modelId, id)), lineCache.get(id)) : ifcApi.GetLine(modelId, id);
    }
    return ref;
  } catch (e) {
    return null;
  }
}

// Helper to build element color map with transparency and specificity
function buildElementColorMap(ifcApi: any, modelId: number, lineCache: Map<number, any>): any {
  const colorMap = new Map<number, { color: number; transparency: number; specificity: number }>();
  const geometryToProduct = new Map<number, number>();
  const representationToProduct = new Map<number, number>();
  const stats: any = { styledItems: 0, colorsFound: 0, productsScanned: 0 };

  // FAST PATH FIRST: Check for IFCSTYLEDITEM before any other processing
  // If the model has no styled colors, skip all color mapping logic entirely
  let styledItemTypeId: number | null = null;
  let hasStyledItems = false;
  try {
    const allTypes = ifcApi.GetAllTypesOfModel ? ifcApi.GetAllTypesOfModel(modelId) : [];
    for (let i = 0; i < allTypes.length; i++) {
      const t = allTypes[i];
      const typeId = t?.typeID ?? t;
      try {
        const typeName = ((ifcApi.GetNameFromTypeCode ? ifcApi.GetNameFromTypeCode(typeId)?.toUpperCase() : '') || '').toString();
        if (typeName === 'IFCSTYLEDITEM') {
          styledItemTypeId = typeId;
          // Check if there's actually at least one styled item
          const ids = ifcApi.GetLineIDsWithType(modelId, typeId);
          hasStyledItems = ids.size() > 0;
          break;
        }
      } catch (e) {}
    }
  } catch (e) {}
  
  // If no styled items exist, return empty maps immediately to save time
  if (!hasStyledItems) {
    console.log('[buildElementColorMap] No IFCSTYLEDITEM found, skipping all color mapping');
    return { colorMap, geometryToProduct, stats };
  }

  // Cached GetLine to avoid redundant reads
  const getLine = (id: number) => {
    if (lineCache.has(id)) return lineCache.get(id);
    const line = ifcApi.GetLine(modelId, id);
    lineCache.set(id, line);
    return line;
  };

  try {

  // First pass: map representation item expressIDs -> parent product expressID, and representation -> product
  // Only scan types that have representations
  try {
    // Include comprehensive MEP types for ventilation/plumbing/electrical models
    const productTypeNames = new Set([
      // Architectural elements
      'IFCWALL', 'IFCWALLSTANDARDCASE', 'IFCSLAB', 'IFCSLABSTANDARDCASE',
      'IFCDOOR', 'IFCWINDOW', 'IFCCOLUMN', 'IFCBEAM', 'IFCROOF', 'IFCSTAIR',
      'IFCRAILING', 'IFCFURNISHINGELEMENT', 'IFCOPENINGELEMENT', 'IFCMEMBER',
      'IFCPLATE', 'IFCFOOTING', 'IFCPILE', 'IFCCURTAINWALL', 'IFCBUILDINGELEMENTPROXY',
      
      // MEP Flow Base Classes (covers most HVAC/plumbing/electrical)
      'IFCFLOWSEGMENT',         // Base for pipes, ducts
      'IFCFLOWFITTING',         // Base for connectors, fittings
      'IFCFLOWTERMINAL',        // Base for terminals, outlets, inlets
      'IFCFLOWMOVINGDEVICE',    // Pumps, fans, compressors
      'IFCFLOWCONTROLLER',      // Valves, dampers, switches
      'IFCFLOWTREATMENTDEVICE', // Filters, silencers, coils
      'IFCFLOWSTORAGEDEVICE',   // Tanks, accumulators
      'IFCELECTRICDISTRIBUTIONBOARD', // Electrical panels
      
      // Specific HVAC/Duct types
      'IFCDUCT', 'IFCDUCTFITTING', 'IFCDUCTSEGEMNT', 'IFCDUCTSILENCER',
      
      // Specific Plumbing/Pipe types
      'IFCPIPE', 'IFCPIPESEGMENT', 'IFCPIPEFIT', 'IFCPIPEFITTING',
      
      // Specific Electrical types
      'IFCCABLE', 'IFCCABLESEGMENT', 'IFCWIRINGELEMENT', 'IFCELECTRICALFIXTURE',
      'IFCJUNCTIONBOX', 'IFCOUTLET', 'IFCSWITCH', 'IFCLAMP', 'IFCPROTECTIVEDEVICE',
      
      // Generic equipment
      'IFCEQUIPMENT', 'IFCBUILDINGEQUIPMENT',
      
      // Spatial
      'IFCSPACE', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY', 'IFCPROJECT', 'IFCPRODUCT',
    ]);

    const allTypes = ifcApi.GetAllTypesOfModel ? ifcApi.GetAllTypesOfModel(modelId) : [];
    const typeNameCache = new Map<number, string>();
    
    for (let ti = 0; ti < allTypes.length; ti++) {
      const tinfo = allTypes[ti];
      const typeId = tinfo?.typeID ?? tinfo;
      
      let typeName = typeNameCache.get(typeId);
      if (typeName === undefined) {
        try {
          typeName = ((ifcApi.GetNameFromTypeCode ? ifcApi.GetNameFromTypeCode(typeId)?.toUpperCase() : '') || '').toString();
          typeNameCache.set(typeId, typeName);
        } catch (e) {
          typeNameCache.set(typeId, '');
        }
      }
      
      if (!typeName || !productTypeNames.has(typeName)) continue;
      
      try {
        const ids = ifcApi.GetLineIDsWithType(modelId, typeId);
        stats.productsScanned += ids.size();
        for (let i = 0; i < ids.size(); i++) {
          const eid = ids.get(i);
          const entity = getLine(eid);
          if (!entity || !entity.Representation) continue;
          let rep = entity.Representation;
          if (rep && rep.value) rep = getLine(rep.value);
          if (rep) {
            representationToProduct.set(rep.expressID, eid);
            if (rep.Representations) {
              let reps = rep.Representations;
              if (!Array.isArray(reps)) reps = [reps];
              for (const r of reps) {
                let rObj = r;
                if (rObj && rObj.value) rObj = getLine(rObj.value);
                if (rObj && rObj.expressID) representationToProduct.set(rObj.expressID, eid);
                if (rObj && rObj.Items) {
                  let items = rObj.Items;
                  if (!Array.isArray(items)) items = [items];
                  for (const item of items) {
                    let itemObj = item;
                    if (itemObj && itemObj.value) itemObj = getLine(itemObj.value);
                    try {
                      const itemId = (itemObj && (itemObj.expressID ?? (itemObj.value ?? itemObj)));
                      if (typeof itemId === 'number') geometryToProduct.set(itemId, eid);
                    } catch (e) {}
                  }
                }
              }
            }
          }
        }
      } catch (e) {}
    }
  } catch (e) {}

  // Now scan IfcStyledItem entries using the typeId we found earlier
  try {
    if (styledItemTypeId && styledItemTypeId > 0) {
      const ids = ifcApi.GetLineIDsWithType(modelId, styledItemTypeId);
      for (let si = 0; si < ids.size(); si++) {
        const sid = ids.get(si);
        const styled = getLine(sid);
        if (!styled) continue;
        stats.styledItems++;
        // targets can be single or array
        const items = styled.Item ? (Array.isArray(styled.Item) ? styled.Item : [styled.Item]) : [];
        const targetIds: number[] = [];
        for (const it of items) {
          const val = it.value ?? it;
          const tline = typeof val === 'number' ? val : (val && val.expressID) ? val.expressID : null;
          if (typeof tline === 'number') targetIds.push(tline);
        }
        if (targetIds.length === 0) continue;

        // styles attached
        const styles = styled.Styles ? (Array.isArray(styled.Styles) ? styled.Styles : [styled.Styles]) : [];
        for (const sref of styles) {
          const sObj = resolveIfcRef(ifcApi, modelId, sref);
          if (!sObj) continue;
          // IfcSurfaceStyle may contain Styles array with SurfaceStyleShading/Rendering
          let surfaceStyles = [];
          if (sObj.Styles) surfaceStyles = Array.isArray(sObj.Styles) ? sObj.Styles : [sObj.Styles];
          else surfaceStyles = [sObj];
          for (const ss of surfaceStyles) {
            const ssObj = resolveIfcRef(ifcApi, modelId, ss) || ss;
            if (!ssObj) continue;
            // Look for SurfaceColour on SurfaceStyleShading/Rendering
            let colorNode = null;
            let transparency = 0.0; // default opaque
            if (ssObj.SurfaceColour) colorNode = resolveIfcRef(ifcApi, modelId, ssObj.SurfaceColour);
            // If Rendering, transparency often stored as Transparency
            if (ssObj.Transparency !== undefined && ssObj.Transparency !== null) {
              const t = Number(ssObj.Transparency);
              if (isFinite(t)) transparency = Math.min(1, Math.max(0, t));
            }
            // If no direct SurfaceColour, check nested Styles within ssObj
            if (!colorNode && ssObj.Styles) {
              const nested = Array.isArray(ssObj.Styles) ? ssObj.Styles : [ssObj.Styles];
              for (const nref of nested) {
                const n = resolveIfcRef(ifcApi, modelId, nref);
                if (n && n.SurfaceColour) {
                  colorNode = resolveIfcRef(ifcApi, modelId, n.SurfaceColour);
                  if (n.Transparency !== undefined && n.Transparency !== null) {
                    const t = Number(n.Transparency);
                    if (isFinite(t)) transparency = Math.min(1, Math.max(0, t));
                  }
                  break;
                }
                // direct IfcColourRgb
                if (n && ((n.type && typeof n.type === 'string' && n.type.toUpperCase().includes('IFCCOLOURRGB')) || ('Red' in n && 'Green' in n && 'Blue' in n))) {
                  colorNode = n;
                  break;
                }
              }
            }
            if (!colorNode) continue;
            stats.colorsFound++;
            const hex = ifcColorToRgbInt(colorNode);
            // assign color to each target id. Determine specificity and product
            for (const tid of targetIds) {
              let productId = tid;
              let specificity = 1;
              if (geometryToProduct.has(tid)) {
                productId = geometryToProduct.get(tid)!;
                specificity = 2; // most specific: geometry item
              } else if (representationToProduct.has(tid)) {
                productId = representationToProduct.get(tid)!;
                specificity = 1; // representation level
              } // else tid is product, specificity 1
              const prev = colorMap.get(productId);
              if (!prev || specificity >= prev.specificity) {
                const rr = ((hex >> 16) & 0xff) / 255;
                const gg = ((hex >> 8) & 0xff) / 255;
                const bb = (hex & 0xff) / 255;
                const aa = typeof transparency === 'number' ? 1 - transparency : 1.0;
                colorMap.set(productId, { color: hex, transparency, specificity });
              }
            }
          }
        }
      }
    }
    } catch (e) {
      // ignore errors in style scan
    }

  // Also map material association fallback (IfcRelAssociatesMaterial) for product-level colors when not found
  try {
    let relMatType = 0;
    try { relMatType = (ifcApi as any).types.IFCRELASSOCIATESMATERIAL ?? 0; } catch {}
    if (!relMatType) relMatType = (ifcApi as any).GetIfcEntityType ? (ifcApi as any).GetIfcEntityType('IFCRELASSOCIATESMATERIAL') : 0;
    if (relMatType) {
      const relIds = ifcApi.GetLineIDsWithType(modelId, relMatType);
      for (let i = 0; i < relIds.size(); i++) {
        const relId = relIds.get(i);
        const rel = ifcApi.GetLine(modelId, relId);
        if (!rel || !rel.RelatingMaterial || !rel.RelatedObjects) continue;
        let matId = rel.RelatingMaterial.value ?? rel.RelatingMaterial;
        if (matId && typeof matId === 'object' && 'value' in matId) matId = matId.value;
        if (typeof matId === 'number') {
          const mat = ifcApi.GetLine(modelId, matId);
          if (mat && mat.HasRepresentation) {
            let rep = mat.HasRepresentation;
            if (Array.isArray(rep)) rep = rep[0];
            if (rep && rep.value) rep = ifcApi.GetLine(modelId, rep.value);
            if (rep && rep.Representations) {
              let reps = rep.Representations;
              if (!Array.isArray(reps)) reps = [reps];
              for (const r of reps) {
                let rObj = r;
                if (rObj.value) rObj = ifcApi.GetLine(modelId, rObj.value);
                if (rObj && rObj.Items) {
                  let items = rObj.Items;
                  if (!Array.isArray(items)) items = [items];
                  for (const item of items) {
                    let itemObj = item;
                    if (itemObj.value) itemObj = ifcApi.GetLine(modelId, itemObj.value);
                    if (itemObj && itemObj.SurfaceColour) {
                      const hex = ifcColorToRgbInt(itemObj.SurfaceColour);
                      const related = Array.isArray(rel.RelatedObjects) ? rel.RelatedObjects : [rel.RelatedObjects];
                      for (const obj of related) {
                        const eid = obj.value ?? obj;
                        if (typeof eid === 'number') {
                          if (!colorMap.has(eid)) {
                            const rr = ((hex >> 16) & 0xff) / 255;
                            const gg = ((hex >> 8) & 0xff) / 255;
                            const bb = (hex & 0xff) / 255;
                            colorMap.set(eid, { color: hex, transparency: 0.0, specificity: 0 });
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {}

  // Also check for direct Material on products (fallback when no RelAssociatesMaterial)
  try {
    const allTypes = ifcApi.GetAllTypesOfModel ? ifcApi.GetAllTypesOfModel(modelId) : [];
    for (let ti = 0; ti < allTypes.length; ti++) {
      const tinfo = allTypes[ti];
      const typeId = tinfo?.typeID ?? tinfo;
      try {
        const ids = ifcApi.GetLineIDsWithType(modelId, typeId);
        for (let i = 0; i < ids.size(); i++) {
          const eid = ids.get(i);
          const entity = ifcApi.GetLine(modelId, eid);
          if (!entity || !entity.Material) continue;
          let matId = entity.Material.value ?? entity.Material;
          if (matId && typeof matId === 'object' && 'value' in matId) matId = matId.value;
          if (typeof matId === 'number') {
            const mat = ifcApi.GetLine(modelId, matId);
            if (mat && mat.HasRepresentation) {
              let rep = mat.HasRepresentation;
              if (Array.isArray(rep)) rep = rep[0];
              if (rep && rep.value) rep = ifcApi.GetLine(modelId, rep.value);
              if (rep && rep.Representations) {
                let reps = rep.Representations;
                if (!Array.isArray(reps)) reps = [reps];
                for (const r of reps) {
                  let rObj = r;
                  if (rObj.value) rObj = ifcApi.GetLine(modelId, rObj.value);
                  if (rObj && rObj.Items) {
                    let items = rObj.Items;
                    if (!Array.isArray(items)) items = [items];
                    for (const item of items) {
                      let itemObj = item;
                      if (itemObj.value) itemObj = ifcApi.GetLine(modelId, itemObj.value);
                      if (itemObj && itemObj.SurfaceColour) {
                        const hex = ifcColorToRgbInt(itemObj.SurfaceColour);
                        if (!colorMap.has(eid)) {
                          const rr = ((hex >> 16) & 0xff) / 255;
                          const gg = ((hex >> 8) & 0xff) / 255;
                          const bb = (hex & 0xff) / 255;
                          colorMap.set(eid, { color: hex, transparency: 0.0, specificity: 0 });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (e) {}
    }
  } catch (e) {}

  console.log(`[buildElementColorMap] Complete - Products: ${stats.productsScanned}, Styled Items: ${stats.styledItems}, Colors Found: ${stats.colorsFound}, Color Map Size: ${colorMap.size}`);
  
  return { colorMap, geometryToProduct, stats };
} catch (e) {
  console.error('Error in buildElementColorMap:', e);
  return { colorMap: new Map(), geometryToProduct: new Map(), stats: { styledItems: 0, colorsFound: 0, productsScanned: 0 } };
}
}



// Helper: extract normalized IfcColourRgb strictly (expects normalized floats 0.0-1.0).
function extractIfcColourRgb(ifcApi: any, colourNode: any): { r: number; g: number; b: number; note?: string } | null {
  if (!colourNode) return null;
  const resolveNumber = (v: any): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string') { const n = Number(v); return isFinite(n) ? n : null; }
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'number') return v[0];
    if (typeof v === 'object') {
      if ('value' in v && typeof v.value === 'number') return v.value;
      if ('Value' in v && typeof v.Value === 'number') return v.Value;
      const keys = Object.keys(v);
      for (const k of keys) {
        const n = Number(v[k]);
        if (isFinite(n)) return n;
      }
    }
    return null;
  };

  const r = resolveNumber(colourNode.Red ?? colourNode.r ?? colourNode[0]);
  const g = resolveNumber(colourNode.Green ?? colourNode.g ?? colourNode[1]);
  const b = resolveNumber(colourNode.Blue ?? colourNode.b ?? colourNode[2]);

  if (r === null || g === null || b === null) return null;

  let note: string | undefined = undefined;

  // Strict: expect normalized 0..1. If all values <= 1, accept and clamp
  if (r <= 1 && g <=1 && b <=1) {
    const rr = Math.min(1, Math.max(0, r));
    const gg = Math.min(1, Math.max(0, g));
    const bb = Math.min(1, Math.max(0, b));
    return { r: rr, g: gg, b: bb };
  } else {
    // Non-standard values detected; attempt normalization if plausible
    if (r <= 255 && g <= 255 && b <= 255) {
      note = 'Values appear to be 0-255; normalized by /255 (non-standard)';
      return { r: Math.min(1, r/255), g: Math.min(1, g/255), b: Math.min(1, b/255), note };
    }
    note = 'Values out of expected 0..1 range';
    return { r: Math.min(1, Math.max(0, r)), g: Math.min(1, Math.max(0, g)), b: Math.min(1, Math.max(0, b)), note };
  }
}

// Get effective SurfaceColour for a target entity (product or representation item)
// Follows: IfcStyledItem -> IfcSurfaceStyle -> IfcSurfaceStyleShading|Rendering -> SurfaceColour (IfcColourRgb)
// Returns null if none found, else returns object with colorRgb, transparency, appliesTo (entity id), and styleChain
function getEffectiveSurfaceColor(ifcApi: any, modelId: number, targetId: number) : any {

  // Scan styled items directly looking for those pointing to our targetId
  let styledType: number | null = null;
  try {
    // Try to get IFCSTYLEDITEM type - handle different API versions
    if ((ifcApi as any).types && (ifcApi as any).types.IFCSTYLEDITEM) {
      styledType = (ifcApi as any).types.IFCSTYLEDITEM;
    } else if ((ifcApi as any).GetIfcEntityType) {
      styledType = (ifcApi as any).GetIfcEntityType('IFCSTYLEDITEM') ?? null;
    }
  } catch (e) {
    // Silently fail if we can't get the type
  }
  
  const candidatesFound: Array<any> = [];
  if (styledType) {
    try {
      const ids = ifcApi.GetLineIDsWithType(modelId, styledType);
      const styledItemCount = ids.size?.() ?? ids.size;
      if (styledItemCount === 0) {
        return null;
      }
      
      for (let i = 0; i < ids.size(); i++) {
        const sid = ids.get(i);
        const styled = ifcApi.GetLine(modelId, sid);
        
        // Check if this styled item's Item field points to our target geometry
        let itemId: number | null = null;
        if (styled.Item) {
          const itemRef = styled.Item;
          itemId = typeof itemRef === 'number' ? itemRef : (itemRef && itemRef.value) ? itemRef.value : null;
        }
        
        // Only proceed if this styled item points to the target geometry
        if (itemId !== targetId) {
          continue;
        }

        // Found a styled item pointing to our target geometry
        // Now extract the color from it
        const appliesToId = itemId;
        const styles = styled.Styles ? (Array.isArray(styled.Styles) ? styled.Styles : [styled.Styles]) : [];
        
        for (const sref of styles) {
          const sObj = resolveIfcRef(ifcApi, modelId, sref);
          if (!sObj) continue;
          
          // sObj should be IfcPresentationStyleAssignment or similar
          // Extract styles array from it
          const surfaceStyles = sObj.Styles ? (Array.isArray(sObj.Styles) ? sObj.Styles : [sObj.Styles]) : [sObj];
          
          for (const ss of surfaceStyles) {
            const ssObj = resolveIfcRef(ifcApi, modelId, ss) || ss;
            if (!ssObj) continue;
            
            // Look for SurfaceStyleShading or Rendering. Both may have SurfaceColour
            let colourNode = null;
            let transparency = 0.0;
            
            // Check direct SurfaceColour property on this style object
            if (ssObj.SurfaceColour) {
              colourNode = resolveIfcRef(ifcApi, modelId, ssObj.SurfaceColour);
            }
            
            // Extract transparency value  
            if (ssObj.Transparency !== undefined && ssObj.Transparency !== null) {
              const t = Number(ssObj.Transparency);
              if (isFinite(t)) transparency = Math.min(1, Math.max(0, t));
            }
            
            // Check nested Styles if no color found yet
            if (!colourNode && ssObj.Styles) {
              const nested = Array.isArray(ssObj.Styles) ? ssObj.Styles : [ssObj.Styles];
              for (const nref of nested) {
                const n = resolveIfcRef(ifcApi, modelId, nref);
                if (!n) continue;
                
                if (n.SurfaceColour) {
                  colourNode = resolveIfcRef(ifcApi, modelId, n.SurfaceColour);
                  if (n.Transparency !== undefined && n.Transparency !== null) {
                    const t = Number(n.Transparency);
                    if (isFinite(t)) transparency = Math.min(1, Math.max(0, t));
                  }
                  break;
                }
                
                // Direct RGB in nested style
                if ((n.type && typeof n.type === 'string' && n.type.toUpperCase().includes('IFCCOLOURRGB')) || ('Red' in n && 'Green' in n && 'Blue' in n)) {
                  colourNode = n;
                  break;
                }
              }
            }
            
            if (!colourNode) continue;
            
            const parsed = extractIfcColourRgb(ifcApi, colourNode);
            if (!parsed) continue;
            
            const specificity = 1;
            candidatesFound.push({ specificity, appliesToId, styledItemId: sid, surfaceStyle: ssObj, colourNode, parsed, transparency });
          }
        }
      }
    } catch (e) {}
  }

  if (candidatesFound.length === 0) {
    // Fallback: check precomputed color map from parsing (materials, RelAssociatesMaterial, etc.)
    try {
      if (_elementColorMapGlobal && _elementColorMapGlobal.size > 0) {
        const mapMatches: Array<any> = [];
        for (const cid of [targetId]) {
          // direct match
          const m = _elementColorMapGlobal.get(cid);
          if (m) mapMatches.push({ id: cid, info: m, via: 'direct' });
          // try geometry->product mapping
          if (_geometryToProductGlobal) {
            const parent = _geometryToProductGlobal.get(cid);
            if (parent) {
              const pm = _elementColorMapGlobal.get(parent);
              if (pm) mapMatches.push({ id: parent, info: pm, via: 'geometry->product' });
            }
          }
        }
        if (mapMatches.length > 0) {
          // choose best by specificity (higher wins)
          mapMatches.sort((a,b) => (b.info?.specificity ?? 0) - (a.info?.specificity ?? 0));
          const bestMatch = mapMatches[0];
          const info = bestMatch.info;
          const rgb = info.colorRgb ? { r: info.colorRgb.r, g: info.colorRgb.g, b: info.colorRgb.b, a: info.colorRgb.a ?? 1.0 } : null;
          if (rgb) {
            return {
              colorRgb: rgb,
              transparency: typeof info.transparency === 'number' ? info.transparency : 0.0,
              appliesTo: bestMatch.id,
              styleChain: [{ source: 'colorMap', id: bestMatch.id, via: bestMatch.via }],
              note: 'Derived from colorMap (rel associates/material/direct material)',
            };
          } else if (typeof info.color === 'number') {
            const hex = info.color >>> 0;
            const rr = ((hex >> 16) & 0xff) / 255;
            const gg = ((hex >> 8) & 0xff) / 255;
            const bb = (hex & 0xff) / 255;
            const aa = typeof info.transparency === 'number' ? 1 - info.transparency : 1.0;
            return {
              colorRgb: { r: rr, g: gg, b: bb, a: aa },
              transparency: typeof info.transparency === 'number' ? info.transparency : 0.0,
              appliesTo: bestMatch.id,
              styleChain: [{ source: 'colorMap', id: bestMatch.id, via: bestMatch.via }],
              note: 'Derived from colorMap (hex)',
            };
          }
        }
      }
    } catch (e) {}

    return null;
  }

  candidatesFound.sort((a,b) => b.specificity - a.specificity);
  const best = candidatesFound[0];
  const { parsed, transparency, appliesToId, styledItemId } = best;
  return {
    colorRgb: { r: parsed.r, g: parsed.g, b: parsed.b, a: 1 - (typeof transparency === 'number' ? transparency : 0) },
    transparency: transparency ?? 0.0,
    appliesTo: appliesToId,
    styleChain: [{ styledItemId, surfaceColourId: (best.colourNode && (best.colourNode.expressID ?? null)) ?? null }],
    note: parsed.note ?? null,
  };
}

// Globals to keep the model loaded so we can inspect later
let _ifcApiGlobal: any = null;
let _modelIdGlobal: number | null = null;
// Persisted mappings to aid interactive debugging
let _elementColorMapGlobal: Map<number, any> | null = null;
let _geometryToProductGlobal: Map<number, number> | null = null;

// Keep-alive / auto-dispose policy to avoid memory leaks
const DEFAULT_KEEP_ALIVE_MS = 60_000; // 60s of inactivity before auto-unload
let _keepAliveTimer: number | null = null;

function clearKeepAliveTimer() {
  if (_keepAliveTimer !== null) {
    clearTimeout(_keepAliveTimer as any);
    _keepAliveTimer = null;
  }
}

function scheduleKeepAlive(timeoutMs?: number) {
  clearKeepAliveTimer();
  if (!_ifcApiGlobal) return;
  const t = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : DEFAULT_KEEP_ALIVE_MS;
  try {
    _keepAliveTimer = setTimeout(() => {
      try {
        // Auto-close model and terminate the worker process due to inactivity.
        // This frees the full WASM heap (~200-500 MB) so the OS can reclaim it.
        closeCurrentModel();
        try { (self as any).postMessage({ type: 'disposed', reason: 'keepalive_timeout' }); } catch (_) {}
        try { (self as any).close(); } catch (_) {} // terminate worker thread
      } catch (e) {
        try { console.debug('[ifcWorker] keepalive close failed', e); } catch (_) {}
      }
    }, t) as any;
  } catch (e) {
    try { console.debug('[ifcWorker] failed to schedule keepalive', e); } catch (_) {}
  }
}

function closeCurrentModel() {
  try {
    clearKeepAliveTimer();
    if (_ifcApiGlobal && _modelIdGlobal != null) {
      try { _ifcApiGlobal.CloseModel(_modelIdGlobal); } catch (e) { try { console.debug('[ifcWorker] closeCurrentModel: CloseModel failed', e); } catch (_) {} }
      try { _ifcApiGlobal.Dispose(); } catch (e) { try { console.debug('[ifcWorker] closeCurrentModel: Dispose failed', e); } catch (_) {} }
    }
  } finally {
    _ifcApiGlobal = null;
    _modelIdGlobal = null;
    _elementColorMapGlobal = null;
    _geometryToProductGlobal = null;
  }
}

self.onmessage = async (event: MessageEvent<GeometryWorkerMessage>) => {
  const { type, buffer, id, keepModel, keepAliveMs } = event.data as GeometryWorkerMessage;

  if (type === 'cancel') return;

  // Dispose request - unload model and free wasm
  if (type === 'dispose') {
    try {
      closeCurrentModel();
      (self as any).postMessage({ type: 'disposed' });
    } catch (e) {
      (self as any).postMessage({ type: 'disposed', error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  // Handle interactive inspect requests
  if (type === 'inspect') {
    try {
      if (!_ifcApiGlobal || _modelIdGlobal == null) {
        (self as any).postMessage({ type: 'inspectResult', id: id ?? null, error: 'Model not loaded' });
        return;
      }
      const ifcApi = _ifcApiGlobal;
      const modelId = _modelIdGlobal as number;
      const target = typeof id === 'number' ? id : null;
      if (!target) {
        (self as any).postMessage({ type: 'inspectResult', id: id ?? null, error: 'No id provided' });
        return;
      }

      const dump: any = { id: target };
      try { dump.line = ifcApi.GetLine(modelId, target); } catch (e) { dump.line = null; }

      // Representation info
      try {
        const line = dump.line;
        dump.representation = null;
        dump.representationItems = [];
        if (line && line.Representation) {
          let rep = line.Representation;
          if (rep && rep.value) rep = ifcApi.GetLine(modelId, rep.value);
          dump.representation = rep || null;
          if (rep && rep.Representations) {
            let reps = rep.Representations;
            if (!Array.isArray(reps)) reps = [reps];
            for (const r of reps) {
              let rObj = r;
              if (rObj && rObj.value) rObj = ifcApi.GetLine(modelId, rObj.value);
              if (rObj && rObj.Items) {
                let items = rObj.Items;
                if (!Array.isArray(items)) items = [items];
                for (const item of items) {
                  let v = item;
                  if (v && v.value) v = ifcApi.GetLine(modelId, v.value);
                  try { dump.representationItems.push({ id: v.expressID ?? v.value ?? v, line: v }); } catch (e) {}
                }
              }
            }
          }
        }
      } catch (e) {}

      // Find styled items referencing this product or its representation items
      try {
        dump.styledItems = [];
        const styledType = (ifcApi as any).types.IFCSTYLEDITEM ?? ((ifcApi as any).GetIfcEntityType ? (ifcApi as any).GetIfcEntityType('IFCSTYLEDITEM') : 0);
        if (styledType) {
          const ids = ifcApi.GetLineIDsWithType(modelId, styledType);
          for (let i = 0; i < ids.size(); i++) {
            const sid = ids.get(i);
            const styled = ifcApi.GetLine(modelId, sid);
            const items = styled.Item ? (Array.isArray(styled.Item) ? styled.Item : [styled.Item]) : [];
            for (const it of items) {
              const val = it.value ?? it;
              const tline = typeof val === 'number' ? val : (val && val.expressID) ? val.expressID : null;
              if (tline === target || dump.representationItems.some((x: any) => x.id === tline) || (dump.representation && dump.representation.expressID === tline)) {
                dump.styledItems.push({ id: sid, line: styled });
                break;
              }
            }
          }
        }
      } catch (e) {}

      // Also include any color map matches we computed during parse for this target or its representation items
      try {
        dump.colorMapMatches = [];
        if (_elementColorMapGlobal) {
          // check target
          const cm = _elementColorMapGlobal.get(target);
          if (cm) dump.colorMapMatches.push({ id: target, info: cm });
          // representation items
          for (const ri of dump.representationItems) {
            const cid = ri.id;
            const cm2 = _elementColorMapGlobal.get(cid);
            if (cm2) dump.colorMapMatches.push({ id: cid, info: cm2 });
          }
          // Also check geometry->product mapping if present
          if (_geometryToProductGlobal) {
            for (const ri of dump.representationItems) {
              const geomId = ri.id;
              const parent = _geometryToProductGlobal.get(geomId);
              if (parent) {
                const cm3 = _elementColorMapGlobal.get(parent);
                if (cm3) dump.colorMapMatches.push({ id: parent, info: cm3, via: 'geometry->product' });
              }
            }
          }

          // add entity dumps for matcher ids so we can inspect why those map entries exist
          dump.colorMapEntities = [];
          for (const m of dump.colorMapMatches) {
            try { dump.colorMapEntities.push({ id: m.id, line: ifcApi.GetLine(modelId, m.id) }); } catch (e) {}
          }
        }
      } catch (e) {}


      // Find RelAssociatesMaterial referencing this product
      try {
        dump.materialRels = [];
        const relMatType = (ifcApi as any).types.IFCRELASSOCIATESMATERIAL ?? ((ifcApi as any).GetIfcEntityType ? (ifcApi as any).GetIfcEntityType('IFCRELASSOCIATESMATERIAL') : 0);
        if (relMatType) {
          const ids = ifcApi.GetLineIDsWithType(modelId, relMatType);
          for (let i = 0; i < ids.size(); i++) {
            const rid = ids.get(i);
            const rel = ifcApi.GetLine(modelId, rid);
            const related = Array.isArray(rel.RelatedObjects) ? rel.RelatedObjects : [rel.RelatedObjects];
            for (const obj of related) {
              const eid = obj.value ?? obj;
              if (eid === target) {
                dump.materialRels.push({ id: rid, line: rel });
                break;
              }
            }
          }
        }
      } catch (e) {}

      // Also dump any surface styles that might match (presentation style assignments etc.)
      try {
        dump.presentationMatches = [];
        const presAssignType = (ifcApi as any).types.IFCPRESENTATIONSTYLEASSIGNMENT ?? ((ifcApi as any).GetIfcEntityType ? (ifcApi as any).GetIfcEntityType('IFCPRESENTATIONSTYLEASSIGNMENT') : 0);
        if (presAssignType) {
          const ids = ifcApi.GetLineIDsWithType(modelId, presAssignType);
          for (let i = 0; i < ids.size(); i++) {
            const pid = ids.get(i);
            const pres = ifcApi.GetLine(modelId, pid);
            try {
              const styles = pres.Styles ? (Array.isArray(pres.Styles) ? pres.Styles : [pres.Styles]) : [];
              for (const s of styles) {
                const sv = s && s.value ? ifcApi.GetLine(modelId, s.value) : s;
                // check if style is referenced by presentation assign that targets product or rep ids
                if (sv && sv.Styles) {
                  // try to detect assignment to our target by looking for referencing items in the model
                  dump.presentationMatches.push({ id: pid, line: pres });
                  break;
                }
              }
            } catch (e) {}
          }
        }
      } catch (e) {}

      try {
        dump.effectiveSurfaceColor = getEffectiveSurfaceColor(ifcApi, modelId, target);
      } catch (e) {
        dump.effectiveSurfaceColor = null;
      }

      (self as any).postMessage({ type: 'inspectResult', id: target, inspect: dump });

      // Reset inactivity timer so interactive session stays alive
      scheduleKeepAlive(keepAliveMs);
    } catch (e) {
      (self as any).postMessage({ type: 'inspectResult', id: id ?? null, error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  // On-demand single-element geometry fetch (used for IFCSPACE and other hidden types
  // that aren't streamed but may be selected from the graph).
  if (type === 'getGeometry' && id !== undefined) {
    try {
      if (!_ifcApiGlobal || _modelIdGlobal == null) {
        (self as any).postMessage({ type: 'geometryResult', id, payloads: null });
        return;
      }

      let typeName = 'default';
      try {
        const lineData = _ifcApiGlobal.GetLine(_modelIdGlobal, id as number);
        if (lineData) typeName = _ifcApiGlobal.GetNameFromTypeCode(lineData.type)?.toUpperCase() || 'default';
      } catch { /* ignore */ }

      const flatMesh = _ifcApiGlobal.GetFlatMesh(_modelIdGlobal, id as number);
      if (!flatMesh || flatMesh.geometries.size() === 0) {
        (self as any).postMessage({ type: 'geometryResult', id, payloads: null });
        return;
      }

      const payloads: MeshPayload[] = [];
      const transfers: ArrayBuffer[] = [];

      for (let gi = 0; gi < flatMesh.geometries.size(); gi++) {
        const geometry = flatMesh.geometries.get(gi);
        const geometryData = _ifcApiGlobal.GetGeometry(_modelIdGlobal, geometry.geometryExpressID);
        if (!geometryData) continue;

        const vertexData = _ifcApiGlobal.GetVertexArray(
          geometryData.GetVertexData(), geometryData.GetVertexDataSize()
        );
        const rawIdx = _ifcApiGlobal.GetIndexArray(
          geometryData.GetIndexData(), geometryData.GetIndexDataSize()
        );
        geometryData.delete();

        if (!vertexData || vertexData.length === 0) continue;

        const positions = new Float32Array((vertexData.length / 6) * 3);
        const normals   = new Float32Array((vertexData.length / 6) * 3);
        for (let v = 0, p = 0; v < vertexData.length; v += 6, p += 3) {
          positions[p] = vertexData[v]; positions[p+1] = vertexData[v+1]; positions[p+2] = vertexData[v+2];
          normals[p]   = vertexData[v+3]; normals[p+1]   = vertexData[v+4]; normals[p+2]   = vertexData[v+5];
        }
        const indices = rawIdx.slice();

        // Build and apply world-space transform (same logic as StreamAllMeshes)
        const transform = new Float32Array(16);
        for (let j = 0; j < 16; j++) {
          const val = Array.isArray(geometry.flatTransformation)
            ? geometry.flatTransformation[j]
            : (geometry.flatTransformation as any)?.get?.(j) ?? 0;
          transform[j] = typeof val === 'number' ? val : 0;
        }
        {
          const m = transform;
          for (let p = 0; p < positions.length; p += 3) {
            const x = positions[p], y = positions[p+1], z = positions[p+2];
            positions[p]   = m[0]*x + m[4]*y + m[8]*z  + m[12];
            positions[p+1] = m[1]*x + m[5]*y + m[9]*z  + m[13];
            positions[p+2] = m[2]*x + m[6]*y + m[10]*z + m[14];
          }
          for (let p = 0; p < normals.length; p += 3) {
            const nx = normals[p], ny = normals[p+1], nz = normals[p+2];
            let rx = m[0]*nx + m[4]*ny + m[8]*nz;
            let ry = m[1]*nx + m[5]*ny + m[9]*nz;
            let rz = m[2]*nx + m[6]*ny + m[10]*nz;
            const len = Math.sqrt(rx*rx + ry*ry + rz*rz);
            if (len > 1e-6) { rx /= len; ry /= len; rz /= len; }
            normals[p] = rx; normals[p+1] = ry; normals[p+2] = rz;
          }
        }

        // Color (same priority as StreamAllMeshes)
        let usedColor = typeColors[typeName] ?? 0xb3b3b3;
        let usedOpacity = 1.0;
        let colorRgbObj: { r: number; g: number; b: number; a: number } | null = null;
        try {
          const mc = geometry.color;
          if (mc && typeof mc.x === 'number') {
            const r = Math.min(1, Math.max(0, mc.x));
            const g = Math.min(1, Math.max(0, mc.y));
            const b = Math.min(1, Math.max(0, mc.z));
            const a = typeof mc.w === 'number' ? Math.min(1, Math.max(0, mc.w)) : 1.0;
            usedColor = (Math.round(r*255) << 16) | (Math.round(g*255) << 8) | Math.round(b*255);
            usedOpacity = a;
            colorRgbObj = { r, g, b, a };
          }
        } catch { /* ignore */ }
        if (!colorRgbObj) {
          const hex = usedColor >>> 0;
          colorRgbObj = { r: ((hex>>16)&0xff)/255, g: ((hex>>8)&0xff)/255, b: (hex&0xff)/255, a: 1.0 };
        }

        // Force IFCSPACE to semi-transparent so the volume is legible
        if (typeName === 'IFCSPACE' || typeName === 'IFCSPACESTANDARDCASE') {
          usedOpacity = 0.25;
          colorRgbObj = { ...colorRgbObj, a: 0.25 };
        }

        const expressIds = new Int32Array([id as number]);
        payloads.push({
          positions, normals, indices, color: usedColor, opacity: usedOpacity,
          colorRgb: colorRgbObj, transforms: transform, expressIds,
          ifcType: typeName, instanceCount: 1,
          geometryId: geometry.geometryExpressID, worldSpace: true,
        });
        transfers.push(positions.buffer, normals.buffer, indices.buffer, transform.buffer, expressIds.buffer);
      }

      (self as any).postMessage(
        { type: 'geometryResult', id, payloads: payloads.length > 0 ? payloads : null },
        transfers
      );
      scheduleKeepAlive(keepAliveMs);
    } catch (e) {
      (self as any).postMessage({ type: 'geometryResult', id, payloads: null, error: String(e) });
    }
    return;
  }

  if (type === 'parse' && buffer) {
    try {
      const ifcApi = new WebIFC.IfcAPI();
      const supportsMT =
        typeof SharedArrayBuffer !== 'undefined' &&
        (self as any).crossOriginIsolated === true;

      const localBase = '/ifc-wasm/';
      const cdnBase = 'https://unpkg.com/web-ifc@0.0.74/';

      try {
        ifcApi.SetWasmPath(localBase, true);
        await ifcApi.Init();
      } catch {
        ifcApi.SetWasmPath(cdnBase, true);
        await ifcApi.Init();
      }

      const uint8Array = new Uint8Array(buffer);
      console.log('[Worker] Opening model with buffer size:', buffer.byteLength);
      const modelId = ifcApi.OpenModel(uint8Array);
      console.log('[Worker] Model opened with id:', modelId);

      // Persist globals only when requested; always notify host that model opened
      if (keepModel) {
        _ifcApiGlobal = ifcApi;
        _modelIdGlobal = modelId;
        scheduleKeepAlive(keepAliveMs);
      }
      try {
        (self as any).postMessage({ type: 'modelLoaded', modelId, kept: !!keepModel });
      } catch (e) {
        // Fall back to structured error reporting instead of console.error
        try {
          const errorMessage =
            '[Worker] Failed to send modelLoaded: ' +
            (e instanceof Error ? e.message : String(e));
          (self as any).postMessage({
            type: 'error',
            error: errorMessage,
          } as GeometryWorkerResponse);
        } catch {
          // If error reporting also fails, swallow to avoid recursive failures
        }
      }

      // Cache for IFC lines to avoid redundant GetLine calls
      const lineCache = new Map<number, any>();

      // Cached GetLine helper
      const getLine = (id: number) => {
        if (lineCache.has(id)) return lineCache.get(id);
        const line = ifcApi.GetLine(modelId, id);
        lineCache.set(id, line);
        return line;
      };

      // Skip manual IfcStyledItem scan — geometry.color from web-ifc is already fully
      // resolved. buildElementColorMap
      // was the primary loading bottleneck: it scanned every product entity before
      // StreamAllMeshes could start, causing a 2–10 s blank screen. Removing it lets
      // geometry stream appear within the first render frame.
      _elementColorMapGlobal = null;
      _geometryToProductGlobal = null;

      // Types to skip during streaming — openings are boolean-subtraction voids, spaces
      // have expensive boolean topology (adds 10-15s for a typical model) and are handled
      // on-demand via getGeometry when a space node is selected in the graph.
      const SKIP_TYPES = new Set(['IFCOPENINGELEMENT', 'IFCSPACE', 'IFCSPACESTANDARDCASE', 'IFCVIRTUALELEMENT']);

      // Geometry cache: reuse extracted vertex data when the same geometry shape appears on multiple products
      const geometryCache = new Map<number, { positions: Float32Array; normals: Float32Array; indices: Uint32Array }>();

      // Progressive streaming: emit payloads INSIDE StreamAllMeshes callback so the viewer
      // starts rendering immediately rather than waiting for the entire model to be parsed.
      const BATCH_GROUP_SIZE = 5;  // tiny first batch — first content on screen fast
      const BATCH_BYTE_SIZE = 8 * 1024 * 1024; // 8 MB per message
      let processedGroupCount = 0;
      let batchBytes = 0;
      let batchMeshes: MeshPayload[] = [];
      let batchTransfers: ArrayBuffer[] = [];
      let dynamicBatchSize = BATCH_GROUP_SIZE;

      const flushBatch = () => {
        if (batchMeshes.length === 0) return;
        const response: GeometryWorkerResponse = {
          type: 'batch',
          meshes: batchMeshes,
          processedGroups: processedGroupCount,
          totalGroups: 0,
        };
        (self as any).postMessage(response, batchTransfers);
        batchMeshes = [];
        batchTransfers = [];
        batchBytes = 0;
      };

      ifcApi.StreamAllMeshes(modelId, (flatMesh: WebIFC.FlatMesh) => {
        const expressId = flatMesh.expressID;

        let typeName = 'default';
        try {
          const lineData = getLine(expressId);
          if (lineData) {
            typeName = ifcApi.GetNameFromTypeCode(lineData.type)?.toUpperCase() || 'default';
          }
        } catch {
          // ignore
        }

        // Skip void/space elements that should not be rendered
        if (SKIP_TYPES.has(typeName)) return;

        for (let i = 0; i < flatMesh.geometries.size(); i++) {
          const geometry = flatMesh.geometries.get(i);
          let cached = geometryCache.get(geometry.geometryExpressID);
          if (!cached) {
            const geometryData = ifcApi.GetGeometry(modelId, geometry.geometryExpressID);
            if (!geometryData) continue;

            const vertexData = ifcApi.GetVertexArray(
              geometryData.GetVertexData(),
              geometryData.GetVertexDataSize()
            );
            const indices = ifcApi.GetIndexArray(
              geometryData.GetIndexData(),
              geometryData.GetIndexDataSize()
            );

            if (!vertexData || vertexData.length === 0) {
              geometryData.delete();
              continue;
            }

            const positions = new Float32Array((vertexData.length / 6) * 3);
            const normals = new Float32Array((vertexData.length / 6) * 3);

            for (let v = 0, p = 0; v < vertexData.length; v += 6, p += 3) {
              positions[p] = vertexData[v];
              positions[p + 1] = vertexData[v + 1];
              positions[p + 2] = vertexData[v + 2];
              normals[p] = vertexData[v + 3];
              normals[p + 1] = vertexData[v + 4];
              normals[p + 2] = vertexData[v + 5];
            }

            cached = { positions, normals, indices };
            geometryCache.set(geometry.geometryExpressID, cached);
            geometryData.delete();
          }

          // Build column-major transform matrix for this instance
          const transform = new Float32Array(16);
          for (let j = 0; j < 16; j++) {
            const val = Array.isArray(geometry.flatTransformation)
              ? geometry.flatTransformation[j]
              : (geometry.flatTransformation as any)?.get?.(j) ?? 0;
            transform[j] = typeof val === 'number' ? val : 0;
          }

          // ── Color extraction ──────────────────────────────────────────────────
          // PRIORITY 1: web-ifc's built-in geometry.color — most reliable because
          //             web-ifc already resolves all IfcSurfaceStyle associations
          //             internally when building PlacedGeometry.
          let usedColor = 0xcccccc;
          let usedOpacity = 1.0;
          let colorRgbObj: any = null;
          let colorExtractedFrom = 'fallback';

          try {
            const mc = geometry.color;
            if (mc && typeof mc.x === 'number' && typeof mc.y === 'number' && typeof mc.z === 'number') {
              const r = Math.min(1, Math.max(0, mc.x));
              const g = Math.min(1, Math.max(0, mc.y));
              const b = Math.min(1, Math.max(0, mc.z));
              const a = typeof mc.w === 'number' ? Math.min(1, Math.max(0, mc.w)) : 1.0;
              usedColor = (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
              usedOpacity = a;
              colorRgbObj = { r, g, b, a };
              colorExtractedFrom = 'geometry.color';
            }
          } catch {
            // ignore
          }

          // PRIORITY 2: per-type hardcoded fallback
          if (colorExtractedFrom === 'fallback') {
            usedColor = typeColors[typeName] ?? 0xb3b3b3;
            const hex = usedColor >>> 0;
            colorRgbObj = {
              r: ((hex >> 16) & 0xff) / 255,
              g: ((hex >> 8) & 0xff) / 255,
              b: (hex & 0xff) / 255,
              a: 1.0,
            };
          }
          // ─────────────────────────────────────────────────────────────────────

          // ── Post-extraction overrides ─────────────────────────────────────────
          // 1. Window glass: many IFC files set alpha=1 on window glass geometries
          //    even though they should be translucent. Enforce a sensible default so
          //    the viewer treats them as glass (opacity < 0.85 triggers glass path).
          if (
            (typeName === 'IFCWINDOW' || typeName === 'IFCWINDOWSTANDARDCASE') &&
            usedOpacity >= 0.85
          ) {
            usedOpacity = 0.35;
            if (colorRgbObj) colorRgbObj = { ...colorRgbObj, a: 0.35 };
          }

          // 2. Luminance floor: geometry.color can return near-black for elements
          //    whose IFC surface style defaults to black (common for door/MEP families).
          //    When nearly invisible, fall back to the per-type palette so the element
          //    at least gets a recognisable colour.
          if (colorExtractedFrom === 'geometry.color' && colorRgbObj) {
            const lum = colorRgbObj.r * 0.299 + colorRgbObj.g * 0.587 + colorRgbObj.b * 0.114;
            if (lum < 0.04) {
              usedColor = typeColors[typeName] ?? 0xb3b3b3;
              const hex = usedColor >>> 0;
              colorRgbObj = {
                r: ((hex >> 16) & 0xff) / 255,
                g: ((hex >> 8) & 0xff) / 255,
                b: (hex & 0xff) / 255,
                a: usedOpacity,
              };
            }
          }
          // ─────────────────────────────────────────────────────────────────────

          // Emit one payload per geometry occurrence (instanceCount=1).
          // Cloning ensures the buffer can be transferred without detaching the cache entry.
          const positions = cached.positions.slice();
          const normals   = cached.normals.slice();
          const indices   = cached.indices.slice();

          // Pre-apply world-space transform so the viewer can merge payloads without
          // per-mesh matrix multiplication.
          // transform is column-major 4×4: column j starts at index j*4.
          {
            const m = transform;
            // Transform positions: P' = M * [x, y, z, 1]
            for (let p = 0; p < positions.length; p += 3) {
              const x = positions[p], y = positions[p + 1], z = positions[p + 2];
              positions[p]     = m[0]*x + m[4]*y + m[8]*z  + m[12];
              positions[p + 1] = m[1]*x + m[5]*y + m[9]*z  + m[13];
              positions[p + 2] = m[2]*x + m[6]*y + m[10]*z + m[14];
            }
            // Transform normals: N' = upper-left 3×3 of M, then renormalize
            for (let p = 0; p < normals.length; p += 3) {
              const nx = normals[p], ny = normals[p + 1], nz = normals[p + 2];
              let rx = m[0]*nx + m[4]*ny + m[8]*nz;
              let ry = m[1]*nx + m[5]*ny + m[9]*nz;
              let rz = m[2]*nx + m[6]*ny + m[10]*nz;
              const len = Math.sqrt(rx*rx + ry*ry + rz*rz);
              if (len > 1e-6) { rx /= len; ry /= len; rz /= len; }
              normals[p] = rx; normals[p + 1] = ry; normals[p + 2] = rz;
            }
          }
          const expressIds = new Int32Array([expressId]);

          const payload: MeshPayload = {
            positions,
            normals,
            indices,
            color:         usedColor,
            opacity:       usedOpacity,
            colorRgb:      colorRgbObj,
            transforms:    transform,
            expressIds,
            ifcType:       typeName,
            instanceCount: 1,
            geometryId:    geometry.geometryExpressID,
            colorSource:   colorExtractedFrom !== 'fallback' ? expressId : null,
            worldSpace:    true,
          };

          batchMeshes.push(payload);
          batchTransfers.push(
            positions.buffer  as ArrayBuffer,
            normals.buffer    as ArrayBuffer,
            indices.buffer    as ArrayBuffer,
            transform.buffer  as ArrayBuffer,
            expressIds.buffer as ArrayBuffer,
          );
          batchBytes += positions.byteLength + normals.byteLength + indices.byteLength +
                        transform.byteLength + expressIds.byteLength;
          processedGroupCount++;

          // Flush when the batch reaches size or byte limits; ramp up batch size
          // progressively to reduce IPC overhead on large models.
          if (batchMeshes.length >= dynamicBatchSize || batchBytes >= BATCH_BYTE_SIZE) {
            flushBatch();
            if (processedGroupCount > 100) dynamicBatchSize = 100;
            if (processedGroupCount > 500) dynamicBatchSize = 300;
          }
        }
      });

      // Final flush of any payloads accumulated at the end of StreamAllMeshes
      flushBatch();

      console.log(`[Worker] Processed ${processedGroupCount} geometry instances (streaming)`);

      // Release cached vertex data to free memory
      geometryCache.clear();
      lineCache.clear();

      const response: GeometryWorkerResponse = {
        type: 'complete',
        processedGroups: processedGroupCount,
        totalGroups: processedGroupCount,
      };

      (self as any).postMessage(response);

      // If the caller didn't request to keep the model loaded for interactive inspection,
      // free web-ifc resources now to prevent memory growth in long-running sessions.
      if (!keepModel) {
        try { ifcApi.CloseModel(modelId); } catch (e) { try { console.debug('[ifcWorker] failed to CloseModel after parse', e); } catch (_) {} }
        try { ifcApi.Dispose(); } catch (e) { try { console.debug('[ifcWorker] failed to Dispose after parse', e); } catch (_) {} }
        // Clear global state to prevent memory leaks
        _elementColorMapGlobal = null;
        _geometryToProductGlobal = null;
      }

    } catch (error) {
      const response: GeometryWorkerResponse = {
        type: 'error',
        error: error instanceof Error ? error.message : 'IFC geometry worker failed',
      };
      self.postMessage(response);
    }
  }
};

export {};
