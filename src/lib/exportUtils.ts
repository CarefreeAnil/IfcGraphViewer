/**
 * Export utilities for IFC Graph data
 * Supports multiple export formats: JSON, CSV, SVG, PNG
 */

import { GraphNode, GraphEdge } from '@/types/graph';
import { toast } from 'sonner';

export type ExportFormat = 'json' | 'csv-nodes' | 'csv-edges' | 'svg' | 'png';

/**
 * Export graph data to JSON
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
