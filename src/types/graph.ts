import { ValidationResult } from '@/lib/ifcValidatorEnhanced';
import { ComposedObject, IFC5File } from './ifc5';

export type NodeType = 'building' | 'space' | 'element' | 'property' | 'relationship' | 'geometry' | 'other' | 'Mesh' | 'Curve' | 'Points' | 'Group';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType | string;
  ifcType?: string;
  properties: Record<string, any>;
  expressId?: number;
  isGraphVisible?: boolean; // Whether this entity is visible in the graph (not geometry)
  isMetadata?: boolean; // Whether this is a metadata entity (Person, Organization, OwnerHistory, etc.)
  _ifcStep?: string; // STEP representation of the entity (for Referenced By algorithm)
  _fileFormat?: 'STEP' | 'JSON'; // File format indicator (STEP vs IFC5 JSON)
  
  // D3-force layout properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  index?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
  relationshipType?: string; // IFC relationship type (e.g., IFCRELAGGREGATES)
  category?: 'spatial' | 'material' | 'geometry' | 'property' | 'general'; // For filtering
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ParsedIFCData {
  graphData: GraphData;
  allEntities?: GraphNode[]; // ALL parsed entities (including geometry, properties) - for IFC4
  metadata: {
    fileName?: string;
    fileSize?: number;
    entityCount?: number;
    relationshipCount?: number;
    parseTime: number;
    geometryEntityCount?: number;
    propertyEntityCount?: number;
    totalEntities?: number;
    entityCounts?: Record<string, number>;
    relationships?: number;
    ifcHeader?: any;
    isIFC5?: boolean; // Flag to indicate IFC5 format
  };
  validation?: ValidationResult;
  rawData?: {
    composedObject?: ComposedObject; // IFC5 composed object for 3D rendering
    ifc5File?: IFC5File; // IFC5 file structure
    rawStepLines?: Map<number, string>; // Raw STEP lines from file for validation
  };
}

