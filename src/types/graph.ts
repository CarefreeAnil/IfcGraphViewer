import { ValidationResult } from '@/lib/ifcValidator';

export type NodeType = 'building' | 'space' | 'element' | 'property' | 'relationship' | 'geometry' | 'other';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  ifcType: string;
  properties: Record<string, any>;
  expressId?: number;
  isGraphVisible?: boolean; // Whether this entity is visible in the graph (not geometry)
  isMetadata?: boolean; // Whether this is a metadata entity (Person, Organization, OwnerHistory, etc.)
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ParsedIFCData {
  graphData: GraphData;
  allEntities: GraphNode[]; // ALL parsed entities (including geometry, properties)
  metadata: {
    fileName: string;
    fileSize: number;
    entityCount: number;
    relationshipCount: number;
    parseTime: number;
    geometryEntityCount: number;
    propertyEntityCount: number;
  };
  validation?: ValidationResult;
}
