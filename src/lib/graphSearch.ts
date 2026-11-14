import { GraphNode } from '@/types/graph';

function flattenSearchValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.map(flattenSearchValue).join(' ');
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => `${key} ${flattenSearchValue(nestedValue)}`)
      .join(' ');
  }
  return String(value);
}

export function getNodeSearchText(node: GraphNode): string {
  return [
    node.label,
    node.ifcType,
    node.expressId,
    node.properties?.GlobalId,
    node.properties?.GLOBALID,
    node.properties?.globalId,
    flattenSearchValue(node.properties),
  ]
    .filter((value) => value !== undefined && value !== null)
    .join(' ')
    .toLowerCase();
}

export function nodeMatchesSearch(node: GraphNode, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  return normalizedQuery === '' || getNodeSearchText(node).includes(normalizedQuery);
}

export function getSearchMatches(nodes: GraphNode[], query: string): GraphNode[] {
  if (!query.trim()) return [];
  return nodes.filter((node) => nodeMatchesSearch(node, query));
}
