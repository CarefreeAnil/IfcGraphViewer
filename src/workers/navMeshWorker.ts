/**
 * Navmesh worker — real walking routes through the building.
 *
 * Streams the building geometry with web-ifc (walls, slabs, stairs — doors,
 * windows, openings and spaces excluded so doorways stay walkable), generates
 * a Recast/Detour navigation mesh once, caches it, then answers routing
 * queries between room floor points with string-pulled walking paths and true
 * walking distances. This is the geometric counterpart to the graph's hop
 * path: it routes through actual door openings, not room-centre lines.
 *
 * recast-navigation is MIT and bundled (its wasm is small and self-contained),
 * so — unlike the AGPL geometry kernel — it ships in the app; the walk feature
 * therefore works offline once the panel is loaded.
 */
import * as WebIFC from 'web-ifc';
import { init as recastInit, NavMeshQuery, type NavMesh } from 'recast-navigation';
import { generateSoloNavMesh } from 'recast-navigation/generators';

// Element categories that must NOT block walking (doorways are the whole point)
const NON_BLOCKING = new Set<number>([
  WebIFC.IFCDOOR, WebIFC.IFCWINDOW, WebIFC.IFCOPENINGELEMENT,
  WebIFC.IFCSPACE, WebIFC.IFCFURNISHINGELEMENT,
]);

interface BuildMessage { type: 'build'; buffer: ArrayBuffer }
interface RouteMessage { type: 'route'; fromExpressId: number; toExpressId: number }
type InMessage = BuildMessage | RouteMessage;

export interface NavReadyMessage {
  type: 'navReady';
  triangleCount: number;
  spaceCount: number;
  elapsedMs: number;
}
export interface RouteResultMessage {
  type: 'routeResult';
  fromExpressId: number;
  toExpressId: number;
  points: Array<[number, number, number]>; // web-ifc native (Y-up) space, ready for the 3D viewer
  length: number;                          // metres walked
}
export interface NavErrorMessage { type: 'navError'; message: string }

const applyTransform = (m: Float64Array | number[], x: number, y: number, z: number): [number, number, number] => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

// Worker-scoped cache: build once, route many
let navMesh: NavMesh | null = null;
let navQuery: NavMeshQuery | null = null;
// expressId → [x, y, z] floor-level point (Recast/web-ifc are both Y-up → no swizzle)
const spacePoints = new Map<number, [number, number, number]>();

async function initApi(): Promise<WebIFC.IfcAPI> {
  const api = new WebIFC.IfcAPI();
  try {
    api.SetWasmPath('/ifc-wasm/', true);
    await api.Init();
  } catch {
    api.SetWasmPath('https://unpkg.com/web-ifc@0.0.74/', true);
    await api.Init();
  }
  return api;
}

async function build(buffer: ArrayBuffer): Promise<NavReadyMessage> {
  const started = performance.now();
  await recastInit();
  const api = await initApi();
  const modelID = api.OpenModel(new Uint8Array(buffer));

  // 1. Building triangles (blocking elements only)
  const positions: number[] = [];
  const indices: number[] = [];
  let offset = 0;
  api.StreamAllMeshes(modelID, (mesh: WebIFC.FlatMesh) => {
    const type = api.GetLineType(modelID, mesh.expressID);
    if (NON_BLOCKING.has(type)) return;
    for (let g = 0; g < mesh.geometries.size(); g++) {
      const placed = mesh.geometries.get(g);
      const geom = api.GetGeometry(modelID, placed.geometryExpressID);
      const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
      const idx = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
      const m = placed.flatTransformation;
      const vertCount = verts.length / 6;
      for (let v = 0; v < vertCount; v++) {
        const [x, y, z] = applyTransform(m, verts[v * 6], verts[v * 6 + 1], verts[v * 6 + 2]);
        positions.push(x, y, z);
      }
      for (let k = 0; k < idx.length; k++) indices.push(idx[k] + offset);
      offset += vertCount;
      geom.delete();
    }
  });

  // 2. Space floor points (centroid x/z, min y + a small lift onto the floor)
  spacePoints.clear();
  const spaceIds = api.GetLineIDsWithType(modelID, WebIFC.IFCSPACE);
  for (let i = 0; i < spaceIds.size(); i++) {
    const expressId = spaceIds.get(i);
    const flat = api.GetFlatMesh(modelID, expressId);
    let cx = 0, cz = 0, count = 0, minY = Infinity;
    for (let g = 0; g < flat.geometries.size(); g++) {
      const placed = flat.geometries.get(g);
      const geom = api.GetGeometry(modelID, placed.geometryExpressID);
      const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
      const m = placed.flatTransformation;
      for (let v = 0; v < verts.length / 6; v++) {
        const [x, y, z] = applyTransform(m, verts[v * 6], verts[v * 6 + 1], verts[v * 6 + 2]);
        cx += x; cz += z; count++;
        if (y < minY) minY = y;
      }
      geom.delete();
    }
    if (count > 0) spacePoints.set(expressId, [cx / count, minY + 0.1, cz / count]);
  }

  api.CloseModel(modelID);

  if (indices.length < 12) throw new Error('no walkable building geometry found');

  // 3. Navmesh (voxel cell 0.1 m; agent radius/height/climb in voxels)
  const result = generateSoloNavMesh(new Float32Array(positions), new Uint32Array(indices), {
    cs: 0.1, ch: 0.1,
    walkableRadius: 2,   // 0.2 m
    walkableHeight: 18,  // 1.8 m
    walkableClimb: 4,    // 0.4 m — clears thresholds and single steps
    walkableSlopeAngle: 50,
  });
  if (!result.success || !result.navMesh) {
    throw new Error(`navmesh generation failed${'error' in result && result.error ? `: ${result.error}` : ''}`);
  }
  navMesh?.destroy?.();
  navQuery?.destroy?.();
  navMesh = result.navMesh;
  navQuery = new NavMeshQuery(navMesh);

  return {
    type: 'navReady',
    triangleCount: indices.length / 3,
    spaceCount: spacePoints.size,
    elapsedMs: Math.round(performance.now() - started),
  };
}

function route(fromExpressId: number, toExpressId: number): RouteResultMessage {
  if (!navQuery) throw new Error('navmesh not built');
  const from = spacePoints.get(fromExpressId);
  const to = spacePoints.get(toExpressId);
  if (!from || !to) throw new Error('room has no floor point');

  const halfExtents = { x: 2, y: 3, z: 2 };
  const res = navQuery.computePath(
    { x: from[0], y: from[1], z: from[2] },
    { x: to[0], y: to[1], z: to[2] },
    { halfExtents },
  );
  if (!res.success || !res.path || res.path.length === 0) throw new Error('no walkable route');

  const points = res.path.map(
    (p: { x: number; y: number; z: number }) => [p.x, p.y, p.z] as [number, number, number],
  );
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(
      points[i][0] - points[i - 1][0],
      points[i][1] - points[i - 1][1],
      points[i][2] - points[i - 1][2],
    );
  }
  return { type: 'routeResult', fromExpressId, toExpressId, points, length };
}

self.onmessage = async (event: MessageEvent<InMessage>) => {
  const msg = event.data;
  try {
    if (msg.type === 'build') {
      self.postMessage(await build(msg.buffer));
    } else if (msg.type === 'route') {
      self.postMessage(route(msg.fromExpressId, msg.toExpressId));
    }
  } catch (error) {
    self.postMessage({
      type: 'navError',
      message: error instanceof Error ? error.message : String(error),
    } as NavErrorMessage);
  }
};
