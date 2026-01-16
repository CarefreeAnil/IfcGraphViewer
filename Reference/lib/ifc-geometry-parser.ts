import * as WebIFC from 'web-ifc';
import { initWebIFC } from './web-ifc-parser';
import { LEVEL_2_ENTITIES } from '@/types/ifc';

export interface IFCGeometry {
  expressId: number;
  type: string;
  vertices: Float32Array;
  indices: Uint32Array;
  normals?: Float32Array;
  color?: { r: number; g: number; b: number; a: number };
  matrix: number[];
}

// Default colors for different IFC element types
const TYPE_COLORS: Record<string, { r: number; g: number; b: number; a: number }> = {
  'IFCWALL': { r: 0.9, g: 0.9, b: 0.85, a: 1 },
  'IFCWALLSTANDARDCASE': { r: 0.9, g: 0.9, b: 0.85, a: 1 },
  'IFCSLAB': { r: 0.8, g: 0.8, b: 0.8, a: 1 },
  'IFCSLABSTANDARDCASE': { r: 0.8, g: 0.8, b: 0.8, a: 1 },
  'IFCDOOR': { r: 0.6, g: 0.4, b: 0.2, a: 1 },
  'IFCWINDOW': { r: 0.7, g: 0.85, b: 0.95, a: 0.5 },
  'IFCCOLUMN': { r: 0.7, g: 0.7, b: 0.7, a: 1 },
  'IFCBEAM': { r: 0.75, g: 0.75, b: 0.7, a: 1 },
  'IFCROOF': { r: 0.6, g: 0.3, b: 0.2, a: 1 },
  'IFCSTAIR': { r: 0.85, g: 0.85, b: 0.85, a: 1 },
  'IFCRAILING': { r: 0.5, g: 0.5, b: 0.5, a: 1 },
  'IFCFURNISHINGELEMENT': { r: 0.5, g: 0.35, b: 0.25, a: 1 },
  'IFCOPENINGELEMENT': { r: 0.3, g: 0.3, b: 0.3, a: 0.2 },
  'default': { r: 0.7, g: 0.7, b: 0.7, a: 1 },
};

export async function extractGeometry(data: Uint8Array): Promise<Map<number, IFCGeometry>> {
  const api = await initWebIFC();
  const modelID = api.OpenModel(data);
  const geometries = new Map<number, IFCGeometry>();
  
  try {
    // Get all mesh data
    api.StreamAllMeshes(modelID, (mesh: WebIFC.FlatMesh) => {
      const expressId = mesh.expressID;
      
      // Get type name for color lookup
      let typeName = 'default';
      try {
        const lineData = api.GetLine(modelID, expressId, false);
        if (lineData) {
          const typeCode = lineData.type;
          typeName = api.GetNameFromTypeCode(typeCode)?.toUpperCase() || 'default';
        }
      } catch {
        // Ignore errors getting type
      }
      
      // Only include physical elements (Level 2)
      const isPhysicalElement = LEVEL_2_ENTITIES.has(typeName);
      if (!isPhysicalElement && !typeName.includes('WALL') && !typeName.includes('SLAB')) {
        // Still process it but mark as non-physical if needed
      }
      
      const color = TYPE_COLORS[typeName] || TYPE_COLORS['default'];
      
      // Process all geometry placeholders
      for (let i = 0; i < mesh.geometries.size(); i++) {
        const geometry = mesh.geometries.get(i);
        const geometryData = api.GetGeometry(modelID, geometry.geometryExpressID);
        
        if (geometryData) {
          const vertices = api.GetVertexArray(
            geometryData.GetVertexData(),
            geometryData.GetVertexDataSize()
          );
          
          const indices = api.GetIndexArray(
            geometryData.GetIndexData(),
            geometryData.GetIndexDataSize()
          );
          
          // Extract transformation matrix (4x4 flat array)
          const matrix: number[] = [];
          const flatTrans = geometry.flatTransformation as unknown as { get: (i: number) => number } | number[];
          for (let j = 0; j < 16; j++) {
            if (Array.isArray(flatTrans)) {
              matrix.push(flatTrans[j]);
            } else if (typeof flatTrans.get === 'function') {
              matrix.push(flatTrans.get(j));
            } else {
              matrix.push(j % 5 === 0 ? 1 : 0); // Identity matrix fallback
            }
          }
          
          // Use geometry's color if available
          const geoColor = geometry.color as unknown as { x: number; y: number; z: number; w: number } | undefined;
          const finalColor = geoColor
            ? { r: geoColor.x, g: geoColor.y, b: geoColor.z, a: geoColor.w }
            : color;
          
          // Merge with existing geometry if same expressId
          const existing = geometries.get(expressId);
          if (existing) {
            // Merge vertices and indices
            const mergedVertices = new Float32Array(existing.vertices.length + vertices.length);
            mergedVertices.set(existing.vertices, 0);
            mergedVertices.set(vertices, existing.vertices.length);
            
            // Offset indices for merged geometry
            const indexOffset = existing.vertices.length / 6; // 6 values per vertex (position + normal)
            const mergedIndices = new Uint32Array(existing.indices.length + indices.length);
            mergedIndices.set(existing.indices, 0);
            for (let j = 0; j < indices.length; j++) {
              mergedIndices[existing.indices.length + j] = indices[j] + indexOffset;
            }
            
            geometries.set(expressId, {
              ...existing,
              vertices: mergedVertices,
              indices: mergedIndices,
            });
          } else {
            geometries.set(expressId, {
              expressId,
              type: typeName,
              vertices: new Float32Array(vertices),
              indices: new Uint32Array(indices),
              color: finalColor,
              matrix,
            });
          }
          
          // Clean up geometry data
          geometryData.delete();
        }
      }
    });
    
    return geometries;
  } finally {
    api.CloseModel(modelID);
  }
}

// Get geometry for a specific entity
export function getGeometryForEntity(
  geometries: Map<number, IFCGeometry>,
  entityId: string
): IFCGeometry | undefined {
  const expressId = parseInt(entityId.replace('#', ''), 10);
  return geometries.get(expressId);
}
