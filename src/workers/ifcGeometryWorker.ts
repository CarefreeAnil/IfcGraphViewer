/**
 * IFC Geometry Worker
 * Extracts mesh data from IFC using web-ifc in a Web Worker.
 */

import * as WebIFC from 'web-ifc';

export interface GeometryWorkerMessage {
  type: 'parse' | 'cancel';
  buffer?: ArrayBuffer;
}

export interface GeometryWorkerResponse {
  type: 'complete' | 'error';
  error?: string;
  meshes?: MeshPayload[];
}

export interface MeshPayload {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  color: number;
  transforms: Float32Array;
  expressIds: Int32Array;
  ifcType: string;
  instanceCount: number;
}

const typeColors: Record<string, number> = {
  IFCWALL: 0xccbbb8,
  IFCWALLSTANDARDCASE: 0xccbbb8,
  IFCSLAB: 0xcccccc,
  IFCSLABSTANDARDCASE: 0xcccccc,
  IFCDOOR: 0x996633,
  IFCWINDOW: 0xb3d9ff,
  IFCCOLUMN: 0xb3b3b3,
  IFCBEAM: 0xc0c0c0,
  IFCROOF: 0x996622,
  IFCSTAIR: 0xd9d9d9,
  IFCRAILING: 0x808080,
  IFCFURNISHINGELEMENT: 0x805020,
  IFCOPENINGELEMENT: 0x4d4d4d,
};

self.onmessage = async (event: MessageEvent<GeometryWorkerMessage>) => {
  const { type, buffer } = event.data;

  if (type === 'cancel') return;

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
      const modelId = ifcApi.OpenModel(uint8Array);

      const meshes: MeshPayload[] = [];
      const transfers: Transferable[] = [];

      const geometryCache = new Map<number, { positions: Float32Array; normals: Float32Array; indices: Uint32Array }>();
      const groups = new Map<string, {
        geometryId: number;
        positions: Float32Array;
        normals: Float32Array;
        indices: Uint32Array;
        color: number;
        ifcType: string;
        transforms: number[];
        expressIds: number[];
      }>();

      ifcApi.StreamAllMeshes(modelId, (flatMesh: WebIFC.FlatMesh) => {
        const expressId = flatMesh.expressID;

        let typeName = 'default';
        try {
          const lineData = ifcApi.GetLine(modelId, expressId, false);
          if (lineData) {
            typeName = ifcApi.GetNameFromTypeCode(lineData.type)?.toUpperCase() || 'default';
          }
        } catch {
          // ignore
        }

        const color = typeColors[typeName] ?? 0xb3b3b3;

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

          const transform = Array.from({ length: 16 }, (_, j) => {
            const val = Array.isArray(geometry.flatTransformation)
              ? geometry.flatTransformation[j]
              : (geometry.flatTransformation as any)?.get?.(j) ?? 0;
            return typeof val === 'number' ? val : 0;
          });

          const key = `${geometry.geometryExpressID}|${color}`;
          let group = groups.get(key);
          if (!group) {
            group = {
              geometryId: geometry.geometryExpressID,
              positions: cached.positions,
              normals: cached.normals,
              indices: cached.indices,
              color,
              ifcType: typeName,
              transforms: [],
              expressIds: [],
            };
            groups.set(key, group);
          }

          group.transforms.push(...transform);
          group.expressIds.push(expressId);
        }
      });

      groups.forEach((group) => {
        const transforms = new Float32Array(group.transforms);
        const expressIds = new Int32Array(group.expressIds);

        meshes.push({
          positions: group.positions,
          normals: group.normals,
          indices: group.indices,
          color: group.color,
          transforms,
          expressIds,
          ifcType: group.ifcType,
          instanceCount: expressIds.length,
        });

        transfers.push(
          group.positions.buffer as ArrayBuffer,
          group.normals.buffer as ArrayBuffer,
          group.indices.buffer as ArrayBuffer,
          transforms.buffer as ArrayBuffer,
          expressIds.buffer as ArrayBuffer
        );
      });

      ifcApi.CloseModel(modelId);
      ifcApi.Dispose();

      const response: GeometryWorkerResponse = {
        type: 'complete',
        meshes,
      };

      (self as any).postMessage(response, transfers);
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
