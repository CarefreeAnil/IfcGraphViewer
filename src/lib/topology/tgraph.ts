/**
 * TGraph Builder — TopologicPy-style topological space graph, fully client-side
 *
 * Derives a space-level topology graph (rooms, doors/portals, adjacency and
 * circulation) from the LPG graph data that ifcParser/graphBuilder already
 * produce. No geometry kernel and no server: everything is inferred from the
 * IFC relationship entities that are present in `parsedData.graphData`.
 *
 * Semantics are modelled after TopologicPy (https://github.com/wassimj/topologicpy):
 * - `adjacent` edges ≈ Graph.ByTopology `direct` (two cells sharing a boundary):
 *   two spaces referencing the same bounding element through IfcRelSpaceBoundary.
 * - `through` edges ≈ `viaSharedApertures` / an egress "space → portal → space"
 *   two-hop: each passable portal (door, stair, ramp, elevator, opening) becomes
 *   its own node linked to the spaces it serves.
 * - portals bounding exactly one space ≈ `toExteriorApertures`: modelled as a
 *   link to a synthetic Exterior node so escape routes can be traced.
 *
 * IMPORTANT approximation vs the real Topologic kernel: TopologicPy derives
 * `direct` adjacency from exact shared faces (OpenCASCADE booleans). Here two
 * spaces are considered adjacent when they share a bounding ELEMENT, which can
 * over-connect along long walls. Every edge therefore carries a `method`
 * provenance tag so consumers can see how it was derived.
 *
 * Identity: TGraph nodes reuse the main graph's `node_${expressId}` ids, so
 * selection sync with the Graph / IFC Browser / 3D panels is free.
 */

import { GraphData, GraphNode } from '@/types/graph';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type PortalType = 'door' | 'open passage' | 'stair' | 'elevator' | 'ramp';

export type TGraphEdgeMethod =
  | 'space_boundary'    // both endpoints found via IfcRelSpaceBoundary
  | 'fills_opening'     // portal resolved via IfcRelFillsElement → opening boundaries
  | 'host_wall'         // portal resolved via opening → IfcRelVoidsElement → wall boundaries
  | 'virtual_boundary'  // IfcVirtualElement boundary (open-plan connection)
  | 'geometric';        // topologic-wasm kernel proximity (not in the relationship data)

export interface TGraphNode {
  id: string;                 // same as main graph: `node_${expressId}` (or EXTERIOR_NODE_ID)
  expressId?: number;
  kind: 'space' | 'portal' | 'exterior';
  ifcType: string;            // original casing from the parser (e.g. 'IfcDoor')
  label: string;
  storeyId?: string | null;
  storeyName?: string | null;
  portalType?: PortalType;    // portals only
}

export interface TGraphEdge {
  id: string;
  source: string;
  target: string;
  kind: 'adjacent' | 'through';
  passable: boolean;          // true when the edge represents possible movement
  method: TGraphEdgeMethod;
  viaIds?: string[];          // shared bounding element ids ('adjacent' edges)
  vertical?: boolean;         // stair/ramp/elevator link (expected to cross storeys)
  crossStorey?: boolean;      // a DOOR linking different storeys (suspicious data)
  gap?: number;               // kernel-measured min distance between the space volumes (m)
  geometryVerified?: boolean; // relationship edge confirmed by the geometry kernel
}

export interface TGraphStats {
  spaceCount: number;
  portalCount: number;
  adjacentEdgeCount: number;
  throughEdgeCount: number;
  boundaryRelCount: number;
  crossStoreyDoorCount: number;
  exteriorPortalCount: number;
  storeyNames: string[];
}

export interface TGraph {
  nodes: TGraphNode[];
  edges: TGraphEdge[];
  stats: TGraphStats;
  warnings: string[];
}

export const EXTERIOR_NODE_ID = 'tgraph_exterior';

/**
 * One hop of a computed route, exported for 3D visualization: the Viewer3D
 * panel renders each step's element with its hop color (spaces translucent,
 * portals solid). Kept here (not in Viewer3D) so the type can be shared
 * without coupling the lazy chunks.
 */
export interface TopologyPathStep {
  expressId: number;
  color: string;
  kind: 'space' | 'portal';
}

// ────────────────────────────────────────────────────────────────────────────
// IFC class sets (comparisons are always done in UPPERCASE — WebIFC returns
// PascalCase names like 'IfcRelSpaceBoundary')
// ────────────────────────────────────────────────────────────────────────────

const SPACE_TYPES = new Set(['IFCSPACE', 'IFCSPACESTANDARDCASE']);

/**
 * Elements a person can move through. Mirrors the portal-class set used for
 * egress graph extraction in TopologicPy-based BIM pipelines (doors, openings,
 * stairs, elevators, ramps).
 */
const PORTAL_TYPES = new Set([
  'IFCDOOR', 'IFCDOORSTANDARDCASE',
  'IFCOPENINGELEMENT', 'IFCOPENINGSTANDARDCASE',
  'IFCSTAIR', 'IFCSTAIRFLIGHT',
  'IFCTRANSPORTELEMENT', // elevator
  'IFCRAMP', 'IFCRAMPFLIGHT',
]);

const VERTICAL_PORTAL_TYPES = new Set([
  'IFCSTAIR', 'IFCSTAIRFLIGHT',
  'IFCTRANSPORTELEMENT',
  'IFCRAMP', 'IFCRAMPFLIGHT',
]);

const DOOR_TYPES = new Set(['IFCDOOR', 'IFCDOORSTANDARDCASE']);

const SPACE_BOUNDARY_RELS = new Set([
  'IFCRELSPACEBOUNDARY',
  'IFCRELSPACEBOUNDARY1STLEVEL',
  'IFCRELSPACEBOUNDARY2NDLEVEL',
]);

const CONTAINMENT_RELS = new Set([
  'IFCRELCONTAINEDINSPATIALSTRUCTURE',
  'IFCRELAGGREGATES',
]);

/**
 * A single bounding element shared by more than this many spaces (typically a
 * slab or a very long wall) would create a misleading adjacency clique, so it
 * is skipped and reported in `warnings` instead of silently over-connecting.
 */
const MAX_SHARED_FANOUT = 6;

export function portalTypeLabel(ifcType: string): PortalType {
  const upper = ifcType.toUpperCase();
  if (upper.includes('OPENING')) return 'open passage';
  if (upper.includes('STAIR')) return 'stair';
  if (upper.includes('TRANSPORT')) return 'elevator';
  if (upper.includes('RAMP')) return 'ramp';
  return 'door';
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * react-force-graph mutates edge.source/target from string ids into node
 * OBJECTS once the main graph has rendered. Every read of graphData.edges must
 * therefore normalize back to string ids (same idiom as graphLoD.ts).
 */
function normalizeId(value: unknown): string {
  if (value && typeof value === 'object') {
    const id = (value as { id?: unknown }).id;
    return id === undefined || id === null ? '' : String(id);
  }
  return value === undefined || value === null ? '' : String(value);
}

interface RelInstance {
  relType: string;      // UPPERCASE relationship class
  relating: string;     // node id of the Relating* entity
  related: string[];    // node ids of the Related* entities
}

/**
 * Rebuild `Relating → rel → Related` triples from the LPG edges.
 *
 * graphBuilder emits, for every IfcRel* entity, one 'relating' edge
 * (source entity → rel node) and one 'related' edge per target
 * (rel node → target entity). Reading the triples back from edges — instead of
 * from rel-node properties — also covers relationships that were recovered via
 * the raw-STEP fallback path, where properties may be absent.
 */
function collectRelationshipInstances(data: GraphData): Map<string, RelInstance> {
  const relNodeTypes = new Map<string, string>();
  for (const node of data.nodes) {
    if (node.type === 'relationship') {
      relNodeTypes.set(node.id, (node.ifcType || '').toUpperCase());
    }
  }

  const instances = new Map<string, RelInstance>();
  const ensure = (relNodeId: string): RelInstance | null => {
    const relType = relNodeTypes.get(relNodeId);
    if (relType === undefined) return null;
    let inst = instances.get(relNodeId);
    if (!inst) {
      inst = { relType, relating: '', related: [] };
      instances.set(relNodeId, inst);
    }
    return inst;
  };

  for (const edge of data.edges) {
    if (edge.type !== 'relationship_role') continue;
    const source = normalizeId(edge.source);
    const target = normalizeId(edge.target);

    if (edge.label === 'relating') {
      // source entity → rel node
      const inst = ensure(target);
      if (inst) inst.relating = source;
    } else if (edge.label === 'related') {
      // rel node → target entity
      const inst = ensure(source);
      if (inst) inst.related.push(target);
    }
  }

  return instances;
}

/** Walk containment/aggregation parents until an IfcBuildingStorey is found. */
function resolveStorey(
  nodeId: string,
  parentOf: Map<string, string>,
  nodesById: Map<string, GraphNode>,
): GraphNode | null {
  let current: string | undefined = nodeId;
  for (let hops = 0; hops < 20 && current; hops++) {
    const node = nodesById.get(current);
    if (node && (node.ifcType || '').toUpperCase() === 'IFCBUILDINGSTOREY') return node;
    current = parentOf.get(current);
  }
  return null;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Geometry-kernel merge (topologic-wasm)
// ────────────────────────────────────────────────────────────────────────────

export interface KernelAdjacencyInput {
  expressIdA: number;
  expressIdB: number;
  gap: number; // metres; ~0 = exact contact (open plan)
}

export interface KernelMergeResult {
  graph: TGraph;
  confirmed: number;        // relationship adjacency also found geometrically
  kernelOnly: number;       // geometric adjacency the relationships missed
  relationshipOnly: number; // relationship adjacency with no geometric support
}

/**
 * Cross-check relationship-derived space adjacency against exact geometric
 * proximity from the topologic-wasm kernel. Matching edges get the measured
 * gap (wall thickness) and a verified flag; kernel-only pairs are appended
 * as 'geometric' edges (passable when the volumes actually touch — the
 * geometric signature of an open-plan connection).
 */
export function mergeKernelAdjacency(graph: TGraph, kernel: KernelAdjacencyInput[]): KernelMergeResult {
  const idByExpress = new Map<number, string>();
  for (const n of graph.nodes) {
    if (n.kind === 'space' && n.expressId !== undefined) idByExpress.set(n.expressId, n.id);
  }

  const gapByPair = new Map<string, number>();
  for (const k of kernel) {
    const a = idByExpress.get(k.expressIdA);
    const b = idByExpress.get(k.expressIdB);
    if (!a || !b || a === b) continue;
    const key = pairKey(a, b);
    const existing = gapByPair.get(key);
    if (existing === undefined || k.gap < existing) gapByPair.set(key, k.gap);
  }

  let confirmed = 0;
  let relationshipOnly = 0;
  const seenPairs = new Set<string>();
  const edges: TGraphEdge[] = graph.edges.map(edge => {
    if (edge.kind !== 'adjacent') return edge;
    const key = pairKey(edge.source, edge.target);
    seenPairs.add(key);
    const gap = gapByPair.get(key);
    if (gap === undefined) {
      relationshipOnly++;
      return { ...edge, geometryVerified: false };
    }
    confirmed++;
    return { ...edge, gap, geometryVerified: true };
  });

  let kernelOnly = 0;
  for (const [key, gap] of gapByPair) {
    if (seenPairs.has(key)) continue;
    kernelOnly++;
    const [a, b] = key.split('|');
    edges.push({
      id: `tedge_geo_${key}`,
      source: a,
      target: b,
      kind: 'adjacent',
      passable: gap < 0.01,
      method: 'geometric',
      gap,
    });
  }

  return { graph: { ...graph, edges }, confirmed, kernelOnly, relationshipOnly };
}

// ────────────────────────────────────────────────────────────────────────────
// Builder
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build the topological space graph from raw (UNFILTERED) graph data.
 *
 * Always pass `parsedData.graphData` — never LoD-filtered data: space-boundary
 * relationship nodes are excluded from the rendered graph at every LoD level,
 * but they are present in the raw data and are exactly what this builder needs.
 */
export function buildTGraph(data: GraphData): TGraph {
  const warnings: string[] = [];
  const nodesById = new Map<string, GraphNode>();
  for (const node of data.nodes) nodesById.set(node.id, node);

  const rels = collectRelationshipInstances(data);

  // ── Pass 1: containment / aggregation → child-to-parent map ──────────────
  const parentOf = new Map<string, string>();
  for (const rel of rels.values()) {
    if (!CONTAINMENT_RELS.has(rel.relType) || !rel.relating) continue;
    for (const child of rel.related) {
      if (child) parentOf.set(child, rel.relating);
    }
  }

  // ── Pass 2: space boundaries → element↔space incidence ───────────────────
  // spacesOfElement: bounding element id → set of space ids it bounds
  const spacesOfElement = new Map<string, Set<string>>();
  let boundaryRelCount = 0;
  for (const rel of rels.values()) {
    if (!SPACE_BOUNDARY_RELS.has(rel.relType)) continue;
    const space = nodesById.get(rel.relating);
    if (!space || !SPACE_TYPES.has((space.ifcType || '').toUpperCase())) continue;
    boundaryRelCount++;
    for (const elementId of rel.related) {
      if (!nodesById.has(elementId)) continue;
      let set = spacesOfElement.get(elementId);
      if (!set) {
        set = new Set();
        spacesOfElement.set(elementId, set);
      }
      set.add(space.id);
    }
  }

  // ── Pass 3: fills/voids chains for portals without own boundaries ─────────
  // IfcRelVoidsElement: wall (relating) → opening (related)
  // IfcRelFillsElement: opening (relating) → door/filler (related)
  const wallOfOpening = new Map<string, string>();
  const openingOfFiller = new Map<string, string>();
  for (const rel of rels.values()) {
    if (rel.relType === 'IFCRELVOIDSELEMENT' && rel.relating) {
      for (const opening of rel.related) wallOfOpening.set(opening, rel.relating);
    } else if (rel.relType === 'IFCRELFILLSELEMENT' && rel.relating) {
      for (const filler of rel.related) openingOfFiller.set(filler, rel.relating);
    }
  }

  // ── Collect space nodes ───────────────────────────────────────────────────
  const spaceNodes: GraphNode[] = data.nodes.filter(
    n => SPACE_TYPES.has((n.ifcType || '').toUpperCase()),
  );

  if (spaceNodes.length === 0) {
    warnings.push('No IfcSpace entities found — the model has no rooms to build a topology graph from.');
  } else if (boundaryRelCount === 0) {
    warnings.push('No IfcRelSpaceBoundary relationships found — space adjacency and door connectivity cannot be derived. (Re-export with 2nd-level space boundaries enabled.)');
  }

  const tNodes = new Map<string, TGraphNode>();
  const storeyNames = new Set<string>();

  const addSpaceNode = (node: GraphNode) => {
    if (tNodes.has(node.id)) return;
    const storey = resolveStorey(node.id, parentOf, nodesById);
    if (storey) storeyNames.add(storey.label);
    tNodes.set(node.id, {
      id: node.id,
      expressId: node.expressId,
      kind: 'space',
      ifcType: node.ifcType || 'IfcSpace',
      label: node.label || `Space ${node.expressId}`,
      storeyId: storey?.id ?? null,
      storeyName: storey?.label ?? null,
    });
  };
  spaceNodes.forEach(addSpaceNode);

  const addPortalNode = (node: GraphNode) => {
    if (tNodes.has(node.id)) return;
    const storey = resolveStorey(node.id, parentOf, nodesById);
    tNodes.set(node.id, {
      id: node.id,
      expressId: node.expressId,
      kind: 'portal',
      ifcType: node.ifcType || 'IfcDoor',
      label: node.label || `Portal ${node.expressId}`,
      storeyId: storey?.id ?? null,
      storeyName: storey?.label ?? null,
      portalType: portalTypeLabel(node.ifcType || ''),
    });
  };

  // ── Edge accumulators (dedup by canonical pair key) ───────────────────────
  const edges: TGraphEdge[] = [];
  const adjacentByPair = new Map<string, TGraphEdge>();
  const throughSeen = new Set<string>();
  let skippedWideElements = 0;

  const addAdjacentEdge = (
    spaceA: string,
    spaceB: string,
    viaId: string,
    method: TGraphEdgeMethod,
    passable: boolean,
  ) => {
    if (spaceA === spaceB) return;
    const key = pairKey(spaceA, spaceB);
    const existing = adjacentByPair.get(key);
    if (existing) {
      if (existing.viaIds && !existing.viaIds.includes(viaId)) existing.viaIds.push(viaId);
      // An open-plan (virtual) boundary upgrades the pair to passable.
      if (passable) existing.passable = true;
      return;
    }
    const edge: TGraphEdge = {
      id: `tedge_adj_${key}`,
      source: spaceA,
      target: spaceB,
      kind: 'adjacent',
      passable,
      method,
      viaIds: [viaId],
    };
    adjacentByPair.set(key, edge);
    edges.push(edge);
  };

  const addThroughEdge = (spaceId: string, portalId: string, method: TGraphEdgeMethod) => {
    const key = `${portalId}|${spaceId}`;
    if (throughSeen.has(key)) return;
    throughSeen.add(key);
    edges.push({
      id: `tedge_thru_${key}`,
      source: spaceId,
      target: portalId,
      kind: 'through',
      passable: true,
      method,
    });
  };

  // ── Direct adjacency from shared bounding elements ────────────────────────
  for (const [elementId, spaceSet] of spacesOfElement.entries()) {
    const element = nodesById.get(elementId);
    if (!element) continue;
    const upper = (element.ifcType || '').toUpperCase();
    if (PORTAL_TYPES.has(upper)) continue; // portals handled below

    const isVirtual = upper === 'IFCVIRTUALELEMENT';
    const spaces = Array.from(spaceSet);
    if (spaces.length < 2) continue;
    if (spaces.length > MAX_SHARED_FANOUT) {
      skippedWideElements++;
      continue;
    }
    for (let i = 0; i < spaces.length; i++) {
      for (let j = i + 1; j < spaces.length; j++) {
        addAdjacentEdge(
          spaces[i],
          spaces[j],
          elementId,
          isVirtual ? 'virtual_boundary' : 'space_boundary',
          isVirtual, // only open-plan (virtual) adjacency is passable
        );
      }
    }
  }

  if (skippedWideElements > 0) {
    warnings.push(
      `${skippedWideElements} bounding element(s) shared by more than ${MAX_SHARED_FANOUT} spaces (slabs/long walls) were skipped to avoid misleading adjacency cliques.`,
    );
  }

  // ── Portal connectivity (space → portal → space two-hop) ─────────────────
  // Evidence sources per portal, unioned with per-space provenance:
  //   1. the portal's own space boundaries        → 'space_boundary'
  //   2. its opening's boundaries (FillsElement; a standalone opening is its
  //      own opening)                             → 'fills_opening'
  //   3. its host wall's boundaries (VoidsElement), only when unambiguous
  //      (wall bounds exactly 2 spaces)           → 'host_wall'
  const portalNodes = data.nodes.filter(n => PORTAL_TYPES.has((n.ifcType || '').toUpperCase()));
  let crossStoreyDoorCount = 0;
  let exteriorPortalCount = 0;

  for (const portal of portalNodes) {
    const upper = (portal.ifcType || '').toUpperCase();
    // Openings that are filled by a door are just door hosts — the door itself
    // is the portal. Standalone (unfilled) openings count as open passages.
    if (upper.startsWith('IFCOPENING')) {
      let filledByDoor = false;
      for (const [filler, opening] of openingOfFiller.entries()) {
        if (opening === portal.id && nodesById.has(filler)) {
          filledByDoor = true;
          break;
        }
      }
      if (filledByDoor) continue;
    }

    // Union the evidence sources with per-space provenance. Running the
    // fills/voids chain whenever FEWER than two spaces are known (not only at
    // zero) matters for real exports: IfcRelSpaceBoundary is emitted per
    // space, and a door whose boundary was exported for only one of its two
    // rooms would otherwise be misclassified as an exterior door.
    const spaceMethod = new Map<string, TGraphEdgeMethod>();
    for (const spaceId of spacesOfElement.get(portal.id) ?? []) {
      spaceMethod.set(spaceId, 'space_boundary');
    }

    if (spaceMethod.size < 2) {
      // A standalone opening IS its own opening; a door/filler hops to its
      // opening first (IfcRelFillsElement).
      const opening = upper.startsWith('IFCOPENING')
        ? portal.id
        : openingOfFiller.get(portal.id);
      if (opening && opening !== portal.id) {
        for (const spaceId of spacesOfElement.get(opening) ?? []) {
          if (!spaceMethod.has(spaceId)) spaceMethod.set(spaceId, 'fills_opening');
        }
      }
      if (opening && spaceMethod.size < 2) {
        const wall = wallOfOpening.get(opening);
        const wallSpaces = wall ? spacesOfElement.get(wall) : undefined;
        // Only when unambiguous: the host wall separates exactly two spaces.
        if (wallSpaces && wallSpaces.size === 2) {
          for (const spaceId of wallSpaces) {
            if (!spaceMethod.has(spaceId)) spaceMethod.set(spaceId, 'host_wall');
          }
        }
      }
    }

    if (spaceMethod.size === 0) continue;

    addPortalNode(portal);
    const spaceIds = Array.from(spaceMethod.keys());
    for (const [spaceId, method] of spaceMethod) addThroughEdge(spaceId, portal.id, method);

    // Storey sanity (a door should not connect storeys — stairs/lifts should).
    const storeys = new Set(
      spaceIds.map(id => tNodes.get(id)?.storeyId).filter(Boolean) as string[],
    );
    const isVertical = VERTICAL_PORTAL_TYPES.has(upper);
    if (storeys.size > 1) {
      for (const edge of edges) {
        if (edge.kind !== 'through' || edge.target !== portal.id) continue;
        if (isVertical) edge.vertical = true;
        else edge.crossStorey = true;
      }
      if (!isVertical && DOOR_TYPES.has(upper)) crossStoreyDoorCount++;
    }

    // Exterior: a door that still resolves to exactly ONE space after the
    // full evidence chain most likely leads outside (TopologicPy's
    // `toExteriorApertures` analogue).
    if (DOOR_TYPES.has(upper) && spaceIds.length === 1) {
      exteriorPortalCount++;
      if (!tNodes.has(EXTERIOR_NODE_ID)) {
        tNodes.set(EXTERIOR_NODE_ID, {
          id: EXTERIOR_NODE_ID,
          kind: 'exterior',
          ifcType: 'Exterior',
          label: 'Exterior',
        });
      }
      addThroughEdge(EXTERIOR_NODE_ID, portal.id, spaceMethod.get(spaceIds[0]) ?? 'space_boundary');
    }
  }

  if (crossStoreyDoorCount > 0) {
    warnings.push(
      `${crossStoreyDoorCount} door(s) connect spaces on different storeys — likely inconsistent space boundaries in the source model.`,
    );
  }

  const nodes = Array.from(tNodes.values());
  const adjacentEdgeCount = edges.filter(e => e.kind === 'adjacent').length;
  const throughEdgeCount = edges.filter(e => e.kind === 'through').length;

  return {
    nodes,
    edges,
    stats: {
      spaceCount: nodes.filter(n => n.kind === 'space').length,
      portalCount: nodes.filter(n => n.kind === 'portal').length,
      adjacentEdgeCount,
      throughEdgeCount,
      boundaryRelCount,
      crossStoreyDoorCount,
      exteriorPortalCount,
      storeyNames: Array.from(storeyNames).sort(),
    },
    warnings,
  };
}
