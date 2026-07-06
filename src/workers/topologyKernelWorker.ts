/**
 * Topology kernel worker — geometric space adjacency via topologic-wasm.
 *
 * Self-contained: receives the raw IFC buffer, re-opens it with web-ifc to
 * tessellate IfcSpace solids (spaces are cheap to mesh in isolation), then
 * runs the TopologicCore/OpenCASCADE wasm kernel:
 *
 *   - cellFromMesh: sew each space's triangles into a solid Cell
 *   - cellsProximity: exact minimum gap per cell pair (BRepExtrema) —
 *     "adjacent through a wall", with the wall thickness measured
 *   - graphByTopology(direct) on a Cluster: exact-contact adjacency
 *
 * The kernel (AGPL-3.0, ~12 MB wasm) is loaded at runtime from jsDelivr, so
 * it never enters this repository or its bundle; the panel treats it as an
 * optional analysis plugin and degrades gracefully when unavailable.
 */
import * as WebIFC from 'web-ifc';

// Pinned to an exact commit: immutable on the CDN (no stale-cache surprises)
// and the analysis stays reproducible. Bump deliberately on kernel upgrades.
const KERNEL_VERSION = '55fd5f7e507106ed4e3edc53c3bd12a0ac7fdeb1';
const KERNEL_BASE = `https://cdn.jsdelivr.net/gh/jonatanjacobsson/topologic-wasm@${KERNEL_VERSION}/dist`;
const KERNEL_URL = `${KERNEL_BASE}/topologic.js`;
const KERNEL_WASM_URL = `${KERNEL_BASE}/topologic.wasm`;

export interface KernelAdjacency {
  expressIdA: number;
  expressIdB: number;
  gap: number;                       // metres; ~0 = exact contact (open plan)
  midpoint: [number, number, number];
}

export interface KernelResult {
  type: 'kernelResult';
  adjacency: KernelAdjacency[];
  cellCount: number;
  failedSpaces: number[];            // expressIds whose mesh didn't close
  kernelVersion: string;
  elapsedMs: number;
}

interface AnalyzeMessage {
  type: 'analyze';
  buffer: ArrayBuffer;
  maxGap?: number;                   // default 0.5 m
}

const applyTransform = (m: Float64Array | number[], x: number, y: number, z: number) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

self.onmessage = async (event: MessageEvent<AnalyzeMessage>) => {
  const { type, buffer, maxGap = 0.5 } = event.data ?? {};
  if (type !== 'analyze' || !buffer) return;
  const started = performance.now();

  try {
    // 1. Kernel module (runtime plugin — never bundled)
    const kernelModule = await import(/* @vite-ignore */ KERNEL_URL);
    const T = await kernelModule.default({
      locateFile: (path: string) => (path.endsWith('.wasm') ? KERNEL_WASM_URL : path),
    });

    // 2. Space tessellations via web-ifc (same wasm-path fallback as the
    // geometry worker — a bare Init() would resolve relative to this worker
    // file and get the SPA fallback page instead of the wasm)
    const api = new WebIFC.IfcAPI();
    try {
      api.SetWasmPath('/ifc-wasm/', true);
      await api.Init();
    } catch {
      api.SetWasmPath('https://unpkg.com/web-ifc@0.0.74/', true);
      await api.Init();
    }
    const modelID = api.OpenModel(new Uint8Array(buffer));

    const spaces: Array<{ expressId: number; positions: Float64Array; indices: Uint32Array }> = [];
    const ids = api.GetLineIDsWithType(modelID, WebIFC.IFCSPACE);
    for (let i = 0; i < ids.size(); i++) {
      const expressId = ids.get(i);
      const flat = api.GetFlatMesh(modelID, expressId);
      const positions: number[] = [];
      const indices: number[] = [];
      let vertexOffset = 0;
      for (let g = 0; g < flat.geometries.size(); g++) {
        const placed = flat.geometries.get(g);
        const geom = api.GetGeometry(modelID, placed.geometryExpressID);
        const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
        const idx = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
        const m = placed.flatTransformation;
        const vertCount = verts.length / 6;
        for (let v = 0; v < vertCount; v++) {
          const [x, y, z] = applyTransform(m, verts[v * 6], verts[v * 6 + 1], verts[v * 6 + 2]);
          positions.push(x, y, z);
        }
        for (let k = 0; k < idx.length; k++) indices.push(idx[k] + vertexOffset);
        vertexOffset += vertCount;
        geom.delete();
      }
      if (indices.length >= 12) {
        spaces.push({ expressId, positions: new Float64Array(positions), indices: new Uint32Array(indices) });
      }
    }
    api.CloseModel(modelID);

    // 3. Kernel analysis
    const cells: unknown[] = [];
    const cellExpressIds: number[] = [];
    const failedSpaces: number[] = [];
    for (const space of spaces) {
      try {
        cells.push(T.cellFromMesh(space.positions, space.indices, 1e-4));
        cellExpressIds.push(space.expressId);
      } catch {
        failedSpaces.push(space.expressId);
      }
    }

    const adjacency: KernelAdjacency[] = [];
    if (cells.length >= 2) {
      const prox = T.cellsProximity(cells, maxGap);
      for (let i = 0; i < prox.gaps.length; i++) {
        adjacency.push({
          expressIdA: cellExpressIds[prox.pairs[i * 2]],
          expressIdB: cellExpressIds[prox.pairs[i * 2 + 1]],
          gap: prox.gaps[i],
          midpoint: [prox.midpoints[i * 3], prox.midpoints[i * 3 + 1], prox.midpoints[i * 3 + 2]],
        });
      }
    }

    const result: KernelResult = {
      type: 'kernelResult',
      adjacency,
      cellCount: cells.length,
      failedSpaces,
      kernelVersion: T.version(),
      elapsedMs: Math.round(performance.now() - started),
    };
    self.postMessage(result);
  } catch (error) {
    self.postMessage({
      type: 'kernelError',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
