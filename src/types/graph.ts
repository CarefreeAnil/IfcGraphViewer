import { ValidationResult } from '@/lib/ifcValidatorEnhanced';

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
  _ifcStep?: string; // STEP representation of the entity (for Referenced By algorithm)
  _fileFormat?: 'STEP' | 'JSON'; // File format indicator (STEP vs IFC5 JSON)
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
  relationshipType?: string; // IFC relationship type (e.g., IFCRELAGGREGATES)
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
    ifcHeader?: {
      fullHeader: string;
      fileDescription: string;
      fileName: string;
      fileSchema: string;
      timeStamp?: string;
    };
  };
  validation?: ValidationResult;
}
