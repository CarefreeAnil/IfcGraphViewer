/**
 * IFC5 Type Definitions
 * Based on buildingSMART IFC5-development repository
 */

// Core IFC5 File Structure
export interface IFC5File {
  header: IFC5Header;
  imports: ImportNode[];
  schemas: Record<string, IFC5Schema>;
  data: IFC5Node[];
}

export interface IFC5Header {
  id: string;
  ifcxVersion: string;
  dataVersion: string;
  author: string;
  timestamp: string;
}

export interface ImportNode {
  uri: string;
  integrity?: string;
}

export interface IFC5Node {
  path: string;
  children?: Record<string, string | null>;
  inherits?: Record<string, string | null>;
  attributes?: Record<string, any>;
}

// Schema Definitions
export interface IFC5Schema {
  uri?: string;
  value: IFC5ValueDescription;
}

export interface IFC5ValueDescription {
  dataType: DataType;
  optional?: boolean;
  inherits?: string[];
  quantityKind?: QuantityKind;
  enumRestrictions?: EnumRestrictions;
  arrayRestrictions?: ArrayRestrictions;
  objectRestrictions?: ObjectRestrictions;
}

export type DataType =
  | 'Real'
  | 'Boolean'
  | 'Integer'
  | 'String'
  | 'DateTime'
  | 'Enum'
  | 'Array'
  | 'Object'
  | 'Reference'
  | 'Blob';

export type QuantityKind =
  | 'Plane angle'
  | 'Thermodynamic temperature'
  | 'Electric current'
  | 'Time'
  | 'Frequency'
  | 'Mass'
  | 'Length'
  | 'Linear velocity'
  | 'Force'
  | 'Pressure'
  | 'Area'
  | 'Energy'
  | 'Power'
  | 'Volume';

export interface EnumRestrictions {
  options: string[];
}

export interface ArrayRestrictions {
  min?: number;
  max?: number;
  value: IFC5ValueDescription;
}

export interface ObjectRestrictions {
  values: Record<string, IFC5ValueDescription>;
}

// Composition Types
export interface CompositionInputNode {
  path: string;
  children: Record<string, string | null>;
  inherits: Record<string, string | null>;
  attributes: Record<string, any>;
}

export interface PreCompositionNode {
  path: string;
  children: Record<string, string | null>;
  inherits: Record<string, string>;
  attributes: Record<string, any>;
}

export interface PostCompositionNode {
  node: string;
  attributes: Map<string, any>;
  children: Map<string, PostCompositionNode>;
}

// Composed Object for 3D Rendering
export interface ComposedObject {
  name: string;
  type?: 'Mesh' | 'Curve' | 'Points' | 'Group';
  attributes?: Record<string, any>;
  children?: ComposedObject[];
}

// Geometry Types
export interface MeshGeometry {
  points: number[];
  faceVertexIndices: number[];
  normals?: number[];
}

export interface CurveGeometry {
  points: number[];
}

export interface PointCloudGeometry {
  positions: number[];
  colors?: number[];
}

// Material Types
export interface IFC5Material {
  diffuseColor?: [number, number, number];
  opacity?: number;
  pbrMetallicRoughness?: {
    baseColorFactor?: [number, number, number, number];
    metallicFactor?: number;
    roughnessFactor?: number;
  };
  normalTexture?: any;
  occlusionTexture?: any;
  emissiveTexture?: any;
  emissiveFactor?: [number, number, number];
  alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND';
  alphaCutoff?: number;
  doubleSided?: boolean;
}

// Transform Types
export interface Transform {
  matrix?: number[]; // 4x4 matrix (16 values)
}

// Validation Error
export class IFC5ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IFC5ValidationError';
  }
}

// Cycle Detection Error
export class IFC5CycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IFC5CycleError';
  }
}

// Layer Stack
export interface IFC5LayerStack {
  layers: IFC5File[];
  federated: IFC5File;
  tree: PostCompositionNode;
  schemas: Record<string, IFC5Schema>;
}

// Parser Options
export interface IFC5ParseOptions {
  validateSchemas?: boolean;
  createArtificialRoot?: boolean;
  resolveLayers?: boolean;
}

// Graph Conversion
export interface IFC5GraphNode {
  id: string;
  label: string;
  properties: Record<string, any>;
  geometry?: {
    type: 'mesh' | 'curve' | 'points';
    data: any;
  };
  material?: IFC5Material;
  transform?: Transform;
}

export interface IFC5GraphEdge {
  source: string;
  target: string;
  type: 'child' | 'inherit' | 'reference';
  label?: string;
}
