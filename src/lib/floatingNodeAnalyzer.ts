/**
 * Floating Node Analyzer and Binding System
 * Identifies isolated nodes and suggests connections based on heuristics
 */

import { GraphNode, GraphEdge } from '@/types/graph';

export interface FloatingNode {
  node: GraphNode;
  reason: 'no_connections' | 'spatial_orphan' | 'property_orphan';
  suggestedConnections: SuggestedConnection[];
}

export interface SuggestedConnection {
  targetNode: GraphNode;
  confidence: number; // 0-1
  reason: string;
  relationshipType?: string;
}

/**
 * Find all floating (isolated) nodes in the graph
 */
export function findFloatingNodes(
  nodes: GraphNode[],
  edges: GraphEdge[]
): FloatingNode[] {
  const floatingNodes: FloatingNode[] = [];
  
  // Build connection maps
  const nodeIds = new Set(nodes.map(n => n.id));
  const connectedIds = new Set<string>();
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  
  // Initialize degree maps
  nodes.forEach(n => {
    inDegree.set(n.id, 0);
    outDegree.set(n.id, 0);
  });
  
  // Calculate degrees
  edges.forEach(edge => {
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
    outDegree.set(edge.source, (outDegree.get(edge.source) || 0) + 1);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });
  
  // Find nodes with no connections
  for (const node of nodes) {
    const hasIncoming = (inDegree.get(node.id) || 0) > 0;
    const hasOutgoing = (outDegree.get(node.id) || 0) > 0;
    
    if (!hasIncoming && !hasOutgoing) {
      const suggestions = suggestConnections(node, nodes, edges);
      
      let reason: FloatingNode['reason'] = 'no_connections';
      if (isSpatialType(node.ifcType)) {
        reason = 'spatial_orphan';
      } else if (isPropertyType(node.ifcType)) {
        reason = 'property_orphan';
      }
      
      floatingNodes.push({
        node,
        reason,
        suggestedConnections: suggestions,
      });
    }
  }
  
  return floatingNodes;
}

/**
 * Suggest connections for a floating node based on heuristics
 * OPTIMIZED: Skip expensive name similarity for large datasets
 */
function suggestConnections(
  floatingNode: GraphNode,
  allNodes: GraphNode[],
  edges: GraphEdge[]
): SuggestedConnection[] {
  const suggestions: SuggestedConnection[] = [];
  
  // Performance optimization: skip expensive name similarity if dataset is large
  const isLargeDataset = allNodes.length > 500;
  
  // Heuristic 1: Same level/storey (spatial proximity)
  if (floatingNode.properties?.Level || floatingNode.properties?.StoreyElevation) {
    const sameLevel = allNodes.filter(n => 
      n.id !== floatingNode.id &&
      (n.properties?.Level === floatingNode.properties?.Level ||
       n.properties?.StoreyElevation === floatingNode.properties?.StoreyElevation)
    );
    
    for (const candidate of sameLevel.slice(0, 3)) {
      suggestions.push({
        targetNode: candidate,
        confidence: 0.7,
        reason: 'Same building level/storey',
        relationshipType: 'IFCRELCONTAINEDINSPATIALSTRUCTURE',
      });
    }
  }
  
  // Heuristic 2: Type compatibility
  const compatibleTypes = findCompatibleTypes(floatingNode.ifcType);
  if (compatibleTypes.length > 0) {
    const typeMatches = allNodes.filter(n =>
      n.id !== floatingNode.id &&
      compatibleTypes.includes(n.ifcType)
    );
    
    for (const candidate of typeMatches.slice(0, 3)) {
      suggestions.push({
        targetNode: candidate,
        confidence: 0.6,
        reason: `Compatible type: ${candidate.ifcType}`,
        relationshipType: determineRelationshipType(floatingNode.ifcType, candidate.ifcType),
      });
    }
  }
  
  // Heuristic 3: Name similarity - SKIP for large datasets (O(n²) operation)
  // Only use if dataset is small enough to handle it
  if (!isLargeDataset && floatingNode.label) {
    const nameMatches = allNodes.filter(n =>
      n.id !== floatingNode.id &&
      n.label &&
      calculateNameSimilarity(floatingNode.label, n.label) > 0.5
    );
    
    for (const candidate of nameMatches.slice(0, 2)) {
      suggestions.push({
        targetNode: candidate,
        confidence: 0.5,
        reason: 'Similar name or description',
        relationshipType: 'IFCRELASSOCIATES',
      });
    }
  }
  
  // Heuristic 4: Common parent in hierarchy
  const floatingParent = floatingNode.properties?.parentId;
  if (floatingParent) {
    const siblings = allNodes.filter(n =>
      n.id !== floatingNode.id &&
      n.properties?.parentId === floatingParent
    );
    
    for (const candidate of siblings.slice(0, 2)) {
      suggestions.push({
        targetNode: candidate,
        confidence: 0.8,
        reason: 'Shares parent entity',
        relationshipType: 'IFCRELAGGREGATES',
      });
    }
  }
  
  // Sort by confidence and remove duplicates
  const uniqueSuggestions = Array.from(
    new Map(suggestions.map(s => [s.targetNode.id, s])).values()
  );
  
  return uniqueSuggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5); // Top 5 suggestions
}

/**
 * Find compatible entity types for binding
 */
function findCompatibleTypes(ifcType: string): string[] {
  const compatibilityMap: Record<string, string[]> = {
    // Properties bind to elements
    'IFCPROPERTYSET': ['IFCWALL', 'IFCSLAB', 'IFCCOLUMN', 'IFCBEAM', 'IFCDOOR', 'IFCWINDOW'],
    'IFCPROPERTY': ['IFCWALL', 'IFCSLAB', 'IFCCOLUMN', 'IFCBEAM'],
    'IFCELEMENTQUANTITY': ['IFCBUILDINGELEMENT', 'IFCWALL', 'IFCSLAB'],
    
    // Elements bind to spatial structures
    'IFCWALL': ['IFCBUILDINGSTOREY', 'IFCBUILDING', 'IFCSPACE'],
    'IFCSLAB': ['IFCBUILDINGSTOREY', 'IFCBUILDING'],
    'IFCCOLUMN': ['IFCBUILDINGSTOREY', 'IFCBUILDING'],
    'IFCBEAM': ['IFCBUILDINGSTOREY', 'IFCBUILDING'],
    'IFCDOOR': ['IFCWALL', 'IFCSPACE'],
    'IFCWINDOW': ['IFCWALL', 'IFCSPACE'],
    
    // Spatial hierarchy
    'IFCSPACE': ['IFCBUILDINGSTOREY'],
    'IFCBUILDINGSTOREY': ['IFCBUILDING'],
    'IFCBUILDING': ['IFCSITE'],
    'IFCSITE': ['IFCPROJECT'],
  };
  
  return compatibilityMap[ifcType] || [];
}

/**
 * Determine appropriate relationship type between two entities
 */
function determineRelationshipType(sourceType: string, targetType: string): string {
  if (isPropertyType(sourceType)) {
    return 'IFCRELDEFINESBYPROPERTIES';
  }
  
  if (isSpatialType(targetType)) {
    return 'IFCRELCONTAINEDINSPATIALSTRUCTURE';
  }
  
  if (isElementType(sourceType) && isElementType(targetType)) {
    return 'IFCRELCONNECTSELEMENTS';
  }
  
  return 'IFCRELASSOCIATES';
}

/**
 * Check if entity is a spatial type
 */
function isSpatialType(ifcType: string): boolean {
  return [
    'IFCSITE',
    'IFCBUILDING',
    'IFCBUILDINGSTOREY',
    'IFCSPACE',
    'IFCZONE',
  ].includes(ifcType);
}

/**
 * Check if entity is a property type
 */
function isPropertyType(ifcType: string): boolean {
  return [
    'IFCPROPERTYSET',
    'IFCPROPERTY',
    'IFCELEMENTQUANTITY',
    'IFCQUANTITYAREA',
    'IFCQUANTITYLENGTH',
    'IFCQUANTITYVOLUME',
  ].includes(ifcType);
}

/**
 * Check if entity is an element type
 */
function isElementType(ifcType: string): boolean {
  return [
    'IFCWALL',
    'IFCSLAB',
    'IFCCOLUMN',
    'IFCBEAM',
    'IFCDOOR',
    'IFCWINDOW',
    'IFCROOF',
    'IFCSTAIR',
    'IFCRAILING',
  ].includes(ifcType);
}

/**
 * Calculate name similarity (simple Levenshtein-like metric)
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const s1 = name1.toLowerCase().trim();
  const s2 = name2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Check for substring match
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Check for word overlap
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  
  if (intersection.size > 0) {
    return intersection.size / Math.max(words1.size, words2.size);
  }
  
  return 0;
}

/**
 * Create new edges for suggested connections
 */
export function createBindingEdges(
  floatingNode: GraphNode,
  suggestions: SuggestedConnection[]
): GraphEdge[] {
  return suggestions.map((suggestion, idx) => ({
    id: `suggested-${floatingNode.id}-${suggestion.targetNode.id}-${idx}`,
    source: floatingNode.id,
    target: suggestion.targetNode.id,
    type: suggestion.relationshipType || 'SUGGESTED_CONNECTION',
    label: `Suggested (${Math.round(suggestion.confidence * 100)}%)`,
  }));
}
