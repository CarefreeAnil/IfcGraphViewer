import { GraphEdge } from '@/types/graph';

export function getEdgeRelationshipType(edge: GraphEdge): string {
  return edge.relationshipType || edge.type || edge.label || 'Relationship';
}

export function getRelationshipExplanation(relType: string): string {
  const type = relType.toUpperCase();
  if (type.includes('AGGREGATES')) return 'Whole-part decomposition (e.g., Building contains Storeys)';
  if (type.includes('NESTS')) return 'Nesting relationship between a host object and its nested components';
  if (type.includes('CONTAINEDINSPATIALSTRUCTURE')) return 'Spatial containment (e.g., Storey contains Walls)';
  if (type.includes('DEFINESBYPROPERTIES') || type.includes('PROPERTYSET')) return 'Defines properties and attributes for an element';
  if (type.includes('VOIDSELEMENT')) return 'Creates an opening or void (e.g., Opening in Wall)';
  if (type.includes('FILLSELEMENT')) return 'Fills a void (e.g., Door fills Opening)';
  if (type.includes('MATERIAL')) return 'Associates material definition';
  if (type.includes('CLASSIFICATION')) return 'Associates classification reference (e.g., Uniclass)';
  if (type.includes('CONNECTEDTO') || type.includes('CONNECTS')) return 'Physical or logical connection between elements';
  if (type.includes('BOUNDARY')) return 'Space boundary relationship';
  if (type.includes('GEOMETRY') || type.includes('REPRESENTATION')) return 'Geometric representation data';
  return 'Relationship between IFC entities';
}
