/**
 * IFC5 Graph Visualization
 * 
 * Innovative approach to visualizing IFC5 JSON structure as an interactive graph.
 * 
 * Key innovations:
 * 1. Multi-layer visualization: Shows data hierarchy, inheritance, and references
 * 2. JSON path-based organization: Nodes organized by their path structure
 * 3. Attribute clustering: Groups attributes by namespace (bsi::, usd::, gltf::)
 * 4. Geometry nodes: Separate visual representation for geometry data
 * 5. Schema awareness: Uses schema information to understand relationships
 */

import {
  IFC5File,
  IFC5Node,
  ComposedObject,
  IFC5Schema,
  IFC5GraphNode,
  IFC5GraphEdge,
} from '@/types/ifc5';
import { GraphNode, GraphEdge } from '@/types/graph';

export type RelationshipFilter = 'all' | 'spatial' | 'material' | 'geometry' | 'property';

export interface IFC5GraphConfig {
  showGeometryNodes: boolean;
  showAttributeNodes: boolean;
  showInheritance: boolean;
  clusterByNamespace: boolean;
  maxDepth?: number;
  relationshipFilter?: RelationshipFilter;
}

export interface IFC5GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    totalNodes: number;
    dataNodes: number;
    attributeNodes: number;
    geometryNodes: number;
    namespaces: string[];
  };
}

/**
 * Convert IFC5 file to graph visualization
 * This is the main entry point for IFC5 graph conversion
 */
export function convertIFC5ToGraph(
  ifc5Data: IFC5File,
  config: Partial<IFC5GraphConfig> = {}
): IFC5GraphData {
  const fullConfig: IFC5GraphConfig = {
    showGeometryNodes: config.showGeometryNodes ?? true,
    showAttributeNodes: config.showAttributeNodes ?? true,
    showInheritance: config.showInheritance ?? true,
    clusterByNamespace: config.clusterByNamespace ?? true,
    maxDepth: config.maxDepth,
  };

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeMap = new Map<string, GraphNode>();
  const namespaces = new Set<string>();

  let dataNodeCount = 0;
  let attributeNodeCount = 0;
  let geometryNodeCount = 0;

  // Process each data node
  ifc5Data.data.forEach((dataNode) => {
    const { nodes: processedNodes, edges: processedEdges } = processDataNode(
      dataNode,
      ifc5Data.schemas,
      fullConfig,
      namespaces
    );

    processedNodes.forEach((node) => {
      nodes.push(node);
      nodeMap.set(node.id, node);

      // Count node types
      if (node.properties._nodeCategory === 'data') dataNodeCount++;
      else if (node.properties._nodeCategory === 'attribute') attributeNodeCount++;
      else if (node.properties._nodeCategory === 'geometry') geometryNodeCount++;
    });

    processedEdges.forEach((edge) => edges.push(edge));
  });

  // Add inheritance relationships
  if (fullConfig.showInheritance) {
    ifc5Data.data.forEach((dataNode) => {
      if (dataNode.inherits) {
        Object.entries(dataNode.inherits).forEach(([key, inheritPath]) => {
          if (inheritPath) {
            const sourceNode = nodeMap.get(dataNode.path);
            const targetNode = nodeMap.get(inheritPath);
            if (sourceNode && targetNode) {
              edges.push({
                id: `inherit_${dataNode.path}_${inheritPath}`,
                source: dataNode.path,
                target: inheritPath,
                type: 'inherit',
                label: key,
                relationshipType: 'INHERITS',
              });
            }
          }
        });
      }
    });
  }

  return {
    nodes,
    edges,
    metadata: {
      totalNodes: nodes.length,
      dataNodes: dataNodeCount,
      attributeNodes: attributeNodeCount,
      geometryNodes: geometryNodeCount,
      namespaces: Array.from(namespaces),
    },
  };
}

/**
 * Process a single IFC5 data node into graph nodes and edges
 */
function processDataNode(
  dataNode: IFC5Node,
  schemas: Record<string, IFC5Schema>,
  config: IFC5GraphConfig,
  namespaces: Set<string>
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Create main data node
  const pathParts = dataNode.path.split('/').filter(Boolean);
  const nodeDepth = pathParts.length;
  const nodeName = extractFriendlyName(dataNode.path, dataNode.attributes);

  // Skip if exceeds max depth
  if (config.maxDepth && nodeDepth > config.maxDepth) {
    return { nodes, edges };
  }

  // Determine node type from attributes
  const nodeType = determineIFC5NodeType(dataNode.attributes);
  const ifcClass = extractIFCClass(dataNode.attributes);

  const mainNode: GraphNode = {
    id: dataNode.path,
    label: nodeName,
    type: nodeType,
    ifcType: ifcClass || 'IFC5Node',
    properties: {
      path: dataNode.path,
      depth: nodeDepth,
      _nodeCategory: 'data',
      _hasChildren: !!dataNode.children && Object.keys(dataNode.children).length > 0,
      _hasInherits: !!dataNode.inherits && Object.keys(dataNode.inherits).length > 0,
      ...extractCoreAttributes(dataNode.attributes),
    },
  };

  nodes.push(mainNode);

  // Process children relationships
  if (dataNode.children) {
    Object.entries(dataNode.children).forEach(([childKey, childPath]) => {
      if (childPath) {
        edges.push({
          id: `child_${dataNode.path}_${childPath}`,
          source: dataNode.path,
          target: childPath,
          type: 'child',
          label: childKey,
          relationshipType: 'CHILD',
        });
      }
    });
  }

  // Process attributes
  if (config.showAttributeNodes && dataNode.attributes) {
    const { nodes: attrNodes, edges: attrEdges } = processAttributes(
      dataNode.path,
      dataNode.attributes,
      schemas,
      config,
      namespaces
    );
    nodes.push(...attrNodes);
    edges.push(...attrEdges);
  }

  return { nodes, edges };
}

/**
 * Process attributes into separate nodes
 */
function processAttributes(
  parentPath: string,
  attributes: Record<string, any>,
  schemas: Record<string, IFC5Schema>,
  config: IFC5GraphConfig,
  namespaces: Set<string>
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Group attributes by namespace
  const grouped = groupAttributesByNamespace(attributes);

  grouped.forEach((attrs, namespace) => {
    namespaces.add(namespace);

    attrs.forEach(({ key, value }) => {
      // Check if this is a geometry attribute
      const isGeometry = isGeometryAttribute(key, value);

      if (isGeometry && !config.showGeometryNodes) {
        return;
      }

      // Create attribute node
      const attrNodeId = `${parentPath}::attr::${key}`;
      const displayKey = key.replace(/^[^:]*::/, ''); // Remove namespace prefix

      const attrNode: GraphNode = {
        id: attrNodeId,
        label: displayKey,
        type: isGeometry ? 'geometry' : 'attribute',
        ifcType: 'Attribute',
        properties: {
          namespace,
          key,
          value: formatAttributeValue(value),
          valueType: getValueType(value),
          _nodeCategory: isGeometry ? 'geometry' : 'attribute',
          _isArray: Array.isArray(value),
          _isObject: typeof value === 'object' && !Array.isArray(value),
        },
      };

      nodes.push(attrNode);

      // Create edge from parent to attribute
      edges.push({
        id: `attr_${parentPath}_${key}`,
        source: parentPath,
        target: attrNodeId,
        type: 'attribute',
        label: namespace,
        relationshipType: 'HAS_ATTRIBUTE',
      });

      // If value is a reference, create reference edge
      if (isReference(value)) {
        const refPath = extractReferencePath(value);
        if (refPath) {
          edges.push({
            id: `ref_${attrNodeId}_${refPath}`,
            source: attrNodeId,
            target: refPath,
            type: 'reference',
            label: 'references',
            relationshipType: 'REFERENCES',
          });
        }
      }
    });
  });

  return { nodes, edges };
}

/**
 * Group attributes by namespace (bsi::, usd::, gltf::, etc.)
 */
function groupAttributesByNamespace(
  attributes: Record<string, any>
): Map<string, Array<{ key: string; value: any }>> {
  const grouped = new Map<string, Array<{ key: string; value: any }>>();

  Object.entries(attributes).forEach(([key, value]) => {
    const namespace = extractNamespace(key);
    if (!grouped.has(namespace)) {
      grouped.set(namespace, []);
    }
    grouped.get(namespace)!.push({ key, value });
  });

  return grouped;
}

/**
 * Extract namespace from attribute key
 */
function extractNamespace(key: string): string {
  const match = key.match(/^([^:]+)::/);
  return match ? match[1] : 'default';
}

/**
 * Determine if an attribute contains geometry data
 */
function isGeometryAttribute(key: string, value: any): boolean {
  const geometryKeys = [
    'points',
    'faceVertexIndices',
    'normals',
    'positions',
    'vertices',
    'indices',
    'uvs',
    'tangents',
    'mesh',
    'curve',
  ];

  const keyLower = key.toLowerCase();
  return geometryKeys.some((geoKey) => keyLower.includes(geoKey));
}

/**
 * Check if value is a reference to another node
 */
function isReference(value: any): boolean {
  if (typeof value === 'string' && value.startsWith('/')) {
    return true; // Path reference
  }
  if (typeof value === 'object' && value !== null && 'ref' in value) {
    return true; // Explicit ref object
  }
  return false;
}

/**
 * Extract reference path from value
 */
function extractReferencePath(value: any): string | null {
  if (typeof value === 'string' && value.startsWith('/')) {
    return value;
  }
  if (typeof value === 'object' && value !== null && 'ref' in value) {
    return value.ref;
  }
  return null;
}

/**
 * Determine node type from attributes
 */
function determineIFC5NodeType(attributes?: Record<string, any>): string {
  if (!attributes) return 'Group';

  // Check for mesh geometry
  if (
    attributes['usd::usdgeom::mesh::points'] ||
    attributes['usd::usdgeom::mesh::faceVertexIndices']
  ) {
    return 'Mesh';
  }

  // Check for curve geometry
  if (attributes['usd::usdgeom::basiscurves::points']) {
    return 'Curve';
  }

  // Check for point cloud
  if (
    attributes['points::base64::positions'] ||
    attributes['points::array::positions']
  ) {
    return 'Points';
  }

  // Check for IFC class
  const ifcClass = extractIFCClass(attributes);
  if (ifcClass) {
    return ifcClass;
  }

  return 'Group';
}

/**
 * Categorize relationship for filtering
 * Based on IFC class and relationship type
 */
function categorizeRelationship(
  ifcClass: string | null,
  nodeType: string | undefined,
  relType: string
): 'spatial' | 'material' | 'geometry' | 'property' | 'general' {
  // Material relationships
  if (
    ifcClass?.toLowerCase().includes('material') ||
    nodeType === 'material'
  ) {
    return 'material';
  }

  // Geometry-only relationships (Mesh/Curve/Points nodes)
  if (nodeType === 'Mesh' || nodeType === 'Curve' || nodeType === 'Points' || relType === 'geometry') {
    return 'geometry';
  }

  // Property/attribute relationships
  if (ifcClass?.includes('Property') || relType === 'property' || relType === 'attribute') {
    return 'property';
  }

  // All child (containment) relationships are spatial — this covers
  // Project→Site→Building→Storey→Space→Wall hierarchy
  if (relType === 'child') {
    return 'spatial';
  }

  return 'general';
}

/**
 * Extract material name with fallback to code.
 * After composition the nested object is flattened:
 *   bsi::ifc::material::name, bsi::ifc::material::code
 */
function extractMaterialName(attributes?: Record<string, any>): string | null {
  if (!attributes) return null;

  // Flattened form (post-composition)
  const flatName = attributes['bsi::ifc::material::name'];
  if (flatName && typeof flatName === 'string' && flatName !== '$' && flatName !== 'Unnamed') {
    return flatName;
  }
  const flatCode = attributes['bsi::ifc::material::code'];
  if (flatCode && typeof flatCode === 'string' && flatCode !== '$') {
    return flatCode;
  }

  // Raw form (pre-composition / direct IFC5Node attributes)
  const materialAttr = attributes['bsi::ifc::material'];
  if (materialAttr && typeof materialAttr === 'object') {
    if (materialAttr.name && materialAttr.name !== '$' && materialAttr.name !== 'Unnamed') {
      return materialAttr.name;
    }
    if (materialAttr.code && materialAttr.code !== '$') {
      return materialAttr.code;
    }
  }

  return null;
}

/**
 * Extract friendly name with fallback to material name or path tail
 */
function extractFriendlyName(path: string, attributes?: Record<string, any>): string {
  let displayName = path.split('/').pop() || path || 'root';
  if (attributes) {
    const nameAttr = attributes['bsi::ifc::name'] || attributes['ifc::name'];
    if (nameAttr && typeof nameAttr === 'string' && nameAttr !== '$') {
      displayName = nameAttr;
    } else {
      const ifcClass = extractIFCClass(attributes)?.toLowerCase() || '';
      // Only use material fallback naming for actual material-class nodes.
      if (ifcClass.includes('material')) {
        const materialName = extractMaterialName(attributes);
        if (materialName) {
          displayName = materialName;
        }
      }
    }
  }
  return displayName;
}

/**
 * Extract IFC class from attributes.
 * convertToComposedObject() flattens {code, uri} objects, so the class code
 * lives at 'bsi::ifc::class::code' in the composed attributes.
 */
function extractIFCClass(attributes?: Record<string, any>): string | null {
  if (!attributes) return null;

  // Flattened form (ComposedObject from convertToComposedObject)
  if (typeof attributes['bsi::ifc::class::code'] === 'string') {
    return attributes['bsi::ifc::class::code'];
  }

  // Raw form (IFC5Node attributes before composition)
  const classAttr = attributes['bsi::ifc::class'];
  if (classAttr && typeof classAttr === 'object' && 'code' in classAttr) {
    return classAttr.code;
  }
  if (typeof classAttr === 'string') {
    return classAttr;
  }

  return null;
}

/**
 * Extract core attributes (non-namespace attributes)
 */
function extractCoreAttributes(attributes?: Record<string, any>): Record<string, any> {
  if (!attributes) return {};

  const core: Record<string, any> = {};

  Object.entries(attributes).forEach(([key, value]) => {
    if (!key.includes('::')) {
      core[key] = value;
    }
  });

  return core;
}

/**
 * Format attribute value for display
 */
function formatAttributeValue(value: any): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'string') {
    return value.length > 100 ? `${value.substring(0, 100)}...` : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.length > 10) return `Array[${value.length}]`;
    return `[${value.slice(0, 3).join(', ')}${value.length > 3 ? '...' : ''}]`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    if (keys.length > 5) return `Object{${keys.length} keys}`;
    return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
  }

  return String(value);
}

/**
 * Get value type for an attribute value
 */
function getValueType(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value;
}

/**
 * Convert ComposedObject tree to graph (alternative approach)
 */
export function convertComposedObjectToGraph(
  root: ComposedObject,
  config: Partial<IFC5GraphConfig> = {}
): IFC5GraphData {
  const fullConfig: IFC5GraphConfig = {
    showGeometryNodes: config.showGeometryNodes ?? true,
    showAttributeNodes: config.showAttributeNodes ?? true,
    showInheritance: config.showInheritance ?? false,
    clusterByNamespace: config.clusterByNamespace ?? true,
    maxDepth: config.maxDepth,
  };

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const namespaces = new Set<string>();
  let dataNodeCount = 0;
  let attributeNodeCount = 0;
  let geometryNodeCount = 0;

  function traverse(obj: ComposedObject, parentId?: string, depth: number = 0) {
    // Skip if exceeds max depth
    if (fullConfig.maxDepth && depth > fullConfig.maxDepth) {
      return;
    }

    const nodeId = obj.name;
    let nodeName = extractFriendlyName(obj.name, obj.attributes);

    // Extract IFC class from attributes for color-coding.
    // After convertToComposedObject() the {code,uri} object is flattened to 'bsi::ifc::class::code'.
    const ifcClassName: string | null = extractIFCClass(obj.attributes);

    // Create main node — keep key namespaced attrs so the graph component can color nodes
    const mainNode: GraphNode = {
      id: nodeId,
      label: nodeName,
      type: obj.type || 'Group',
      ifcType: ifcClassName || obj.type || 'Group',
      properties: {
        path: obj.name,
        depth,
        _nodeCategory: 'data',
        _hasChildren: !!(obj.children && obj.children.length > 0),
        // Preserve the IFC class so graph can color-code by class.
        // After convertToComposedObject() the class object is flattened to ::code.
        'bsi::ifc::class::code': obj.attributes?.['bsi::ifc::class::code']
          ?? (obj.attributes?.['bsi::ifc::class'] as any)?.code
          ?? null,
        'bsi::ifc::name': obj.attributes?.['bsi::ifc::name'] ?? null,
        'bsi::ifc::material::name': obj.attributes?.['bsi::ifc::material::name'] ?? null,
        ...extractCoreAttributes(obj.attributes),
      },
    };

    nodes.push(mainNode);
    dataNodeCount++;

    // Create edge to parent
    if (parentId) {
      // Categorize relationship for filtering
      const ifcClass = obj.attributes ? extractIFCClass(obj.attributes) : null;
      const edgeCategory = categorizeRelationship(ifcClass, obj.type, 'child');

      edges.push({
        id: `${parentId}->${nodeId}`,
        source: parentId,
        target: nodeId,
        type: 'child',
        label: 'contains',
        relationshipType: 'CHILD',
        category: edgeCategory,
      });
    }

    // Process attributes
    if (fullConfig.showAttributeNodes && obj.attributes) {
      const { nodes: attrNodes, edges: attrEdges } = processAttributes(
        nodeId,
        obj.attributes,
        {},
        fullConfig,
        namespaces
      );
      nodes.push(...attrNodes);
      edges.push(...attrEdges);

      attrNodes.forEach((node) => {
        if (node.properties._nodeCategory === 'attribute') attributeNodeCount++;
        else if (node.properties._nodeCategory === 'geometry') geometryNodeCount++;
      });
    }

    // Process children
    if (obj.children) {
      obj.children.forEach((child) => traverse(child, nodeId, depth + 1));
    }
  }

  traverse(root);

  return {
    nodes,
    edges,
    metadata: {
      totalNodes: nodes.length,
      dataNodes: dataNodeCount,
      attributeNodes: attributeNodeCount,
      geometryNodes: geometryNodeCount,
      namespaces: Array.from(namespaces),
    },
  };
}

/**
 * Create a simplified graph view (only data nodes, no attributes)
 */
export function createSimplifiedIFC5Graph(
  ifc5Data: IFC5File
): IFC5GraphData {
  return convertIFC5ToGraph(ifc5Data, {
    showGeometryNodes: false,
    showAttributeNodes: false,
    showInheritance: true,
    clusterByNamespace: false,
  });
}

/**
 * Create a detailed graph view (all nodes and relationships)
 */
export function createDetailedIFC5Graph(
  ifc5Data: IFC5File
): IFC5GraphData {
  return convertIFC5ToGraph(ifc5Data, {
    showGeometryNodes: true,
    showAttributeNodes: true,
    showInheritance: true,
    clusterByNamespace: true,
  });
}
