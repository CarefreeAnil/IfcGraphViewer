/**
 * Graph analysis algorithms — TypeScript ports of TopologicPy's Graph methods
 *
 * TopologicPy (https://github.com/wassimj/topologicpy) implements its graph
 * analysis in pure Python ("without relying on the C++ core") — which is what
 * makes a faithful browser port possible. Each function below names the
 * TopologicPy method it mirrors and keeps the same algorithm and normalization
 * so results are comparable with the desktop/Python workflow:
 *
 * - shortestPath          → Graph.ShortestPath   (BFS; unweighted hop count)
 * - betweennessCentrality → Graph.BetweennessCentrality (Brandes 2001,
 *                           undirected unweighted, NetworkX-compatible scaling)
 * - closenessCentrality   → Graph.ClosenessCentrality (Wasserman–Faust)
 * - degreeCentrality      → Graph.DegreeCentrality (degree / (n-1))
 * - connectedComponents   → Graph.ConnectedComponents (iterative DFS,
 *                           components sorted descending by size)
 * - diameter              → Graph.Diameter (max BFS eccentricity; on a
 *                           disconnected graph: max finite eccentricity)
 * - density               → Graph.Density (2·|E| / (|V|·(|V|−1)))
 *
 * All functions operate on a compact indexed representation built once via
 * buildGraphIndex(), so the panel can run several analyses over the same
 * (optionally filtered) edge set without repeated id lookups.
 */

// ────────────────────────────────────────────────────────────────────────────
// Indexed graph
// ────────────────────────────────────────────────────────────────────────────

export interface IndexedGraph {
  ids: string[];                                  // index → node id
  indexOf: Map<string, number>;                   // node id → index
  adjacency: Array<Array<{ n: number; e: number }>>; // per node: neighbor idx + edge idx
  edges: Array<{ source: number; target: number; id: string }>;
}

interface EdgeLike {
  id: string;
  source: string;
  target: string;
}

export function buildGraphIndex(
  nodeIds: string[],
  edges: EdgeLike[],
  edgeFilter?: (edge: EdgeLike) => boolean,
): IndexedGraph {
  const ids = [...nodeIds];
  const indexOf = new Map<string, number>();
  ids.forEach((id, i) => indexOf.set(id, i));

  const adjacency: Array<Array<{ n: number; e: number }>> = ids.map(() => []);
  const indexedEdges: IndexedGraph['edges'] = [];

  for (const edge of edges) {
    if (edgeFilter && !edgeFilter(edge)) continue;
    const s = indexOf.get(edge.source);
    const t = indexOf.get(edge.target);
    if (s === undefined || t === undefined || s === t) continue;
    const e = indexedEdges.length;
    indexedEdges.push({ source: s, target: t, id: edge.id });
    adjacency[s].push({ n: t, e });
    adjacency[t].push({ n: s, e }); // undirected, like TopologicPy's Graph
  }

  return { ids, indexOf, adjacency, edges: indexedEdges };
}

// ────────────────────────────────────────────────────────────────────────────
// Shortest path — port of Graph.ShortestPath (unweighted engine)
// ────────────────────────────────────────────────────────────────────────────

export interface PathResult {
  nodeIds: string[];  // ordered start → end
  edgeIds: string[];
  hops: number;       // nodeIds.length - 1
}

/**
 * Unweighted shortest path via BFS (equivalent to Dijkstra with unit costs —
 * the semantic space graph has no geometric edge lengths, so hop count is the
 * meaningful metric; TopologicPy calls this "topological distance").
 * Returns null when unreachable.
 */
export function shortestPath(graph: IndexedGraph, fromId: string, toId: string): PathResult | null {
  const start = graph.indexOf.get(fromId);
  const goal = graph.indexOf.get(toId);
  if (start === undefined || goal === undefined) return null;
  if (start === goal) return { nodeIds: [fromId], edgeIds: [], hops: 0 };

  const prevNode = new Int32Array(graph.ids.length).fill(-1);
  const prevEdge = new Int32Array(graph.ids.length).fill(-1);
  const visited = new Uint8Array(graph.ids.length);
  visited[start] = 1;
  let frontier = [start];

  while (frontier.length > 0) {
    const next: number[] = [];
    for (const v of frontier) {
      for (const { n, e } of graph.adjacency[v]) {
        if (visited[n]) continue;
        visited[n] = 1;
        prevNode[n] = v;
        prevEdge[n] = e;
        if (n === goal) {
          // Reconstruct
          const nodeIds: string[] = [];
          const edgeIds: string[] = [];
          let cur = goal;
          while (cur !== -1) {
            nodeIds.push(graph.ids[cur]);
            if (prevEdge[cur] !== -1) edgeIds.push(graph.edges[prevEdge[cur]].id);
            cur = prevNode[cur];
          }
          nodeIds.reverse();
          edgeIds.reverse();
          return { nodeIds, edgeIds, hops: nodeIds.length - 1 };
        }
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Betweenness centrality — port of Graph.BetweennessCentrality
// (_brandes_unweighted: Brandes 2001, undirected, NetworkX-compatible scaling)
// ────────────────────────────────────────────────────────────────────────────

export function betweennessCentrality(graph: IndexedGraph): Map<string, number> {
  const n = graph.ids.length;
  const centrality = new Float64Array(n);

  for (let s = 0; s < n; s++) {
    // BFS from s, tracking shortest-path counts (sigma) and predecessors
    const stack: number[] = [];
    const predecessors: number[][] = Array.from({ length: n }, () => []);
    const sigma = new Float64Array(n);
    const dist = new Int32Array(n).fill(-1);
    sigma[s] = 1;
    dist[s] = 0;

    const queue = [s];
    let head = 0;
    while (head < queue.length) {
      const v = queue[head++];
      stack.push(v);
      for (const { n: w } of graph.adjacency[v]) {
        if (dist[w] < 0) {
          dist[w] = dist[v] + 1;
          queue.push(w);
        }
        if (dist[w] === dist[v] + 1) {
          sigma[w] += sigma[v];
          predecessors[w].push(v);
        }
      }
    }

    // Dependency back-propagation
    const delta = new Float64Array(n);
    for (let i = stack.length - 1; i >= 0; i--) {
      const w = stack[i];
      for (const v of predecessors[w]) {
        delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      }
      if (w !== s) centrality[w] += delta[w];
    }
  }

  // Undirected: every pair was counted twice → halve, then apply the
  // NetworkX-compatible normalization 2 / ((n-1)(n-2)) that TopologicPy
  // defaults to (nxCompatible=True).
  const scale = n > 2 ? 2 / ((n - 1) * (n - 2)) : 0;
  const result = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    result.set(graph.ids[i], (centrality[i] / 2) * scale);
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Closeness centrality — port of Graph.ClosenessCentrality
// (unweighted BFS distances, Wasserman–Faust disconnected-graph correction)
// ────────────────────────────────────────────────────────────────────────────

export function closenessCentrality(graph: IndexedGraph): Map<string, number> {
  const n = graph.ids.length;
  const result = new Map<string, number>();

  for (let s = 0; s < n; s++) {
    const dist = new Int32Array(n).fill(-1);
    dist[s] = 0;
    const queue = [s];
    let head = 0;
    let reachable = 0;
    let total = 0;
    while (head < queue.length) {
      const v = queue[head++];
      for (const { n: w } of graph.adjacency[v]) {
        if (dist[w] >= 0) continue;
        dist[w] = dist[v] + 1;
        reachable++;
        total += dist[w];
        queue.push(w);
      }
    }
    // Wasserman–Faust: (s/(n-1)) * (s/tot) with s = reachable count
    const value = reachable > 0 && total > 0 && n > 1
      ? (reachable / (n - 1)) * (reachable / total)
      : 0;
    result.set(graph.ids[s], value);
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Degree centrality — port of Graph.DegreeCentrality (deg / (n-1))
// ────────────────────────────────────────────────────────────────────────────

export function degreeCentrality(graph: IndexedGraph): Map<string, number> {
  const n = graph.ids.length;
  const result = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    result.set(graph.ids[i], n > 1 ? graph.adjacency[i].length / (n - 1) : 0);
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Connected components — port of Graph.ConnectedComponents
// (iterative DFS; returned sorted descending by size)
// ────────────────────────────────────────────────────────────────────────────

export function connectedComponents(graph: IndexedGraph): string[][] {
  const n = graph.ids.length;
  const seen = new Uint8Array(n);
  const components: string[][] = [];

  for (let s = 0; s < n; s++) {
    if (seen[s]) continue;
    seen[s] = 1;
    const component: string[] = [];
    const stack = [s];
    while (stack.length > 0) {
      const v = stack.pop() as number;
      component.push(graph.ids[v]);
      for (const { n: w } of graph.adjacency[v]) {
        if (!seen[w]) {
          seen[w] = 1;
          stack.push(w);
        }
      }
    }
    components.push(component);
  }

  components.sort((a, b) => b.length - a.length);
  return components;
}

// ────────────────────────────────────────────────────────────────────────────
// Diameter — port of Graph.Diameter (BFS eccentricity from every vertex;
// disconnected graphs return the maximum finite eccentricity)
// ────────────────────────────────────────────────────────────────────────────

export function diameter(graph: IndexedGraph): number {
  const n = graph.ids.length;
  let max = 0;
  const dist = new Int32Array(n);

  for (let s = 0; s < n; s++) {
    dist.fill(-1);
    dist[s] = 0;
    const queue = [s];
    let head = 0;
    let eccentricity = 0;
    while (head < queue.length) {
      const v = queue[head++];
      for (const { n: w } of graph.adjacency[v]) {
        if (dist[w] >= 0) continue;
        dist[w] = dist[v] + 1;
        if (dist[w] > eccentricity) eccentricity = dist[w];
        queue.push(w);
      }
    }
    if (eccentricity > max) max = eccentricity;
  }
  return max;
}

// ────────────────────────────────────────────────────────────────────────────
// Density — port of Graph.Density: 2|E| / (|V|(|V|-1))
// ────────────────────────────────────────────────────────────────────────────

export function density(graph: IndexedGraph): number {
  const n = graph.ids.length;
  if (n < 2) return 0;
  return (2 * graph.edges.length) / (n * (n - 1));
}
