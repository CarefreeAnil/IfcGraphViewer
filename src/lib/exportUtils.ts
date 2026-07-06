/**
 * Export utilities for IFC Graph data
 * Supports multiple export formats: JSON, CSV, SVG, PNG
 * 
 * IMPORTANT: Data type distinction
 * - Enriched data (graphData): Contains _schemaColor and visualization metadata
 * - Pure data (allEntities): 1:1 with IFC file, no modifications
 * 
 * Current exports use enriched graph data for visualization purposes.
 * For pure IFC data export, pass allEntities directly instead of graphData.nodes
 */

import { GraphNode, GraphEdge } from '@/types/graph';
import { TGraph } from '@/lib/topology/tgraph';
import { toast } from 'sonner';

export type ExportFormat = 'json' | 'csv-nodes' | 'csv-edges' | 'svg' | 'png';

/**
 * Export graph data to JSON
 * Note: Exports enriched graph data (includes visualization metadata like _schemaColor)
 * For pure IFC data, pass allEntities instead of graphData.nodes
 */
export function exportToJSON(
  nodes: GraphNode[],
  edges: GraphEdge[],
  filename = 'ifc-graph.json'
): void {
  const data = {
    metadata: {
      exportDate: new Date().toISOString(),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      format: 'IFC Graph JSON Export v1.0',
    },
    nodes,
    edges,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, filename);
}

/**
 * Export nodes to CSV
 */
export function exportNodesToCSV(nodes: GraphNode[], filename = 'ifc-nodes.csv'): void {
  if (nodes.length === 0) {
    toast.error('No nodes to export');
    return;
  }

  // Get all unique property keys
  const allPropertyKeys = new Set<string>();
  nodes.forEach(node => {
    Object.keys(node.properties).forEach(key => allPropertyKeys.add(key));
  });

  const propertyKeys = Array.from(allPropertyKeys).sort();

  // Create CSV header
  const headers = [
    'ID',
    'ExpressID',
    'Type',
    'Label',
    ...propertyKeys,
  ];

  // Create CSV rows
  const rows = nodes.map(node => {
    const row = [
      node.id,
      node.expressId?.toString() || '',
      node.ifcType,
      node.label || '',
      ...propertyKeys.map(key => {
        const value = node.properties[key];
        return formatCSVValue(value);
      }),
    ];
    return row;
  });

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => escapeCSV(cell)).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, filename);
}

/**
 * Export edges to CSV
 */
export function exportEdgesToCSV(edges: GraphEdge[], filename = 'ifc-edges.csv'): void {
  if (edges.length === 0) {
    toast.error('No edges to export');
    return;
  }

  const headers = ['ID', 'Source', 'Target', 'Type'];
  const rows = edges.map(edge => [
    edge.id,
    edge.source,
    edge.target,
    edge.type,
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => escapeCSV(cell)).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, filename);
}

/**
 * Export graph visualization to SVG
 */
export function exportToSVG(
  canvasElement: HTMLCanvasElement | null,
  filename = 'ifc-graph.svg'
): void {
  if (!canvasElement) {
    toast.error('No graph canvas found');
    return;
  }

  // Get canvas dimensions
  const width = canvasElement.width;
  const height = canvasElement.height;

  // Convert canvas to data URL
  const dataURL = canvasElement.toDataURL('image/png');

  // Create SVG with embedded image
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" 
         xmlns:xlink="http://www.w3.org/1999/xlink"
         width="${width}" 
         height="${height}"
         viewBox="0 0 ${width} ${height}">
      <image width="${width}" height="${height}" xlink:href="${dataURL}"/>
    </svg>
  `.trim();

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  downloadBlob(blob, filename);
}

/**
 * Export graph visualization to PNG
 */
export function exportToPNG(
  canvasElement: HTMLCanvasElement | null,
  filename = 'ifc-graph.png'
): void {
  if (!canvasElement) {
    toast.error('No graph canvas found');
    return;
  }

  canvasElement.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, filename);
    } else {
      toast.error('Failed to create PNG image');
    }
  }, 'image/png');
}

/**
 * Export IFC STEP format (complete file)
 */
export function exportToSTEP(
  nodes: GraphNode[],
  filename = 'export.ifc'
): void {
  const lines: string[] = [];

  // Header
  lines.push('ISO-10303-21;');
  lines.push('HEADER;');
  lines.push(`FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');`);
  lines.push(
    `FILE_NAME('${filename}','${new Date().toISOString()}',(''),(''), ` +
    `'IFC Graph Visualizer','IFC Graph Visualizer','');`
  );
  lines.push(`FILE_SCHEMA(('IFC2X3'));`);
  lines.push('ENDSEC;');
  lines.push('');
  lines.push('DATA;');

  // Sort nodes by express ID
  const sortedNodes = [...nodes].sort((a, b) => (a.expressId || 0) - (b.expressId || 0));

  // Add entities
  for (const node of sortedNodes) {
    lines.push(buildSTEPLine(node));
  }

  lines.push('ENDSEC;');
  lines.push('END-ISO-10303-21;');

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain' });
  downloadBlob(blob, filename);
}

/**
 * Build a STEP line for an entity (simplified)
 */
function buildSTEPLine(node: GraphNode): string {
  const stepId = node.expressId || 0;
  const entityType = node.ifcType.toUpperCase();

  // Get property values in order
  const propValues = Object.values(node.properties)
    .map(value => formatSTEPValue(value))
    .join(',');

  return `#${stepId}=${entityType}(${propValues});`;
}

/**
 * Format a value for STEP format
 */
function formatSTEPValue(value: any): string {
  if (value === null || value === undefined) return '$';
  if (typeof value === 'string') {
    if (value.startsWith('#')) return value;
    if (value.startsWith('.') && value.endsWith('.')) return value;
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === 'boolean') return value ? '.T.' : '.F.';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return `(${value.map(formatSTEPValue).join(',')})`;
  }
  if (typeof value === 'object' && value.value !== undefined) {
    return formatSTEPValue(value.value);
  }
  return '$';
}

/**
 * Format value for CSV export
 */
function formatCSVValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Escape CSV value
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success(`Exported to ${filename}`);
}

/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Export the topology (TGraph) space graph to JSON.
 * Includes nodes, edges (with derivation provenance), stats and warnings.
 */
export function exportTopologyToJSON(tgraph: TGraph, filename = 'ifc-topology.json'): void {
  if (tgraph.nodes.length === 0) {
    toast.error('No topology graph to export');
    return;
  }

  const exportData = {
    metadata: {
      exportDate: new Date().toISOString(),
      generator: 'IfcGraphViewer Topology (TopologicPy-style client-side TGraph)',
      ...tgraph.stats,
      warnings: tgraph.warnings,
    },
    nodes: tgraph.nodes,
    edges: tgraph.edges,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

/**
 * Export the topology (TGraph) edge list to CSV — one row per space-adjacency
 * or space-portal connection, with derivation provenance.
 */
export function exportTopologyEdgesToCSV(tgraph: TGraph, filename = 'ifc-topology-edges.csv'): void {
  if (tgraph.edges.length === 0) {
    toast.error('No topology edges to export');
    return;
  }

  const nodeById = new Map(tgraph.nodes.map(n => [n.id, n]));
  const headers = ['Source', 'SourceLabel', 'Target', 'TargetLabel', 'Kind', 'Method', 'Passable', 'Vertical', 'CrossStorey', 'ViaElements'];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const rows = tgraph.edges.map(edge => [
    escape(edge.source),
    escape(nodeById.get(edge.source)?.label ?? ''),
    escape(edge.target),
    escape(nodeById.get(edge.target)?.label ?? ''),
    edge.kind,
    edge.method,
    String(edge.passable),
    String(edge.vertical ?? false),
    String(edge.crossStorey ?? false),
    escape((edge.viaIds ?? []).join(';')),
  ].join(','));

  const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
  downloadBlob(blob, filename);
}

/**
 * Export the topology space graph as BOT (Building Topology Ontology) Turtle
 * — Linked Building Data interop. Emits `bot:Space` per room and
 * `bot:adjacentZone` per adjacency, mirroring topologicpy's RDF vocabulary
 * (bot:/props:); kernel-measured gaps and volumes ride along as literals when
 * a geometry check has run.
 */
export function exportTopologyToTurtle(
  tgraph: TGraph,
  metrics?: Map<number, { volume: number; area: number }> | null,
  filename = 'ifc-topology.ttl',
): void {
  const spaces = tgraph.nodes.filter(n => n.kind === 'space');
  if (spaces.length === 0) {
    toast.error('No spaces to export');
    return;
  }

  // inst: token per space; digit-leading ids get an id_ prefix (RDFTriples rule)
  const token = (node: { expressId?: number; id: string }): string => {
    const raw = node.expressId !== undefined ? `space_${node.expressId}` : node.id;
    const safe = raw.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    return `inst:${/^[0-9]/.test(safe) ? `id_${safe}` : safe || 'space'}`;
  };
  const ttlString = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

  const lines: string[] = [
    '@prefix inst: <https://byggstyrning.se/ifc/inst#> .',
    '@prefix bot: <https://w3id.org/bot#> .',
    '@prefix props: <https://w3id.org/props#> .',
    '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
    '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .',
    '',
  ];

  const tokenOf = new Map(spaces.map(n => [n.id, token(n)]));
  for (const node of spaces) {
    const s = tokenOf.get(node.id)!;
    lines.push(`${s} a bot:Space .`);
    if (node.label) lines.push(`${s} rdfs:label ${ttlString(node.label)} .`);
    if (node.storeyName) lines.push(`${s} bot:hasStorey ${ttlString(node.storeyName)} .`);
    const m = node.expressId !== undefined ? metrics?.get(node.expressId) : undefined;
    if (m) {
      lines.push(`${s} props:volume "${m.volume.toFixed(3)}"^^xsd:decimal .`);
      lines.push(`${s} props:area "${m.area.toFixed(3)}"^^xsd:decimal .`);
    }
  }

  // Space↔space adjacencies (dedup symmetric pairs); measured gap as a literal
  const seen = new Set<string>();
  for (const edge of tgraph.edges) {
    if (edge.kind !== 'adjacent') continue;
    const a = tokenOf.get(edge.source);
    const b = tokenOf.get(edge.target);
    if (!a || !b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // bot:adjacentZone is symmetric — emit both directions
    lines.push(`${a} bot:adjacentZone ${b} .`);
    lines.push(`${b} bot:adjacentZone ${a} .`);
  }

  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/turtle' });
  downloadBlob(blob, filename);
}
