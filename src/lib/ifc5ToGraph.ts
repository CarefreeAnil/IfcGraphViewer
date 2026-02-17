/**
 * IFC5 to Graph Converter
 * Converts IFC5 composed tree to graph structure for visualization
 */

import {
  PostCompositionNode,
  ComposedObject,
  IFC5Schema,
  IFC5GraphNode,
  IFC5GraphEdge,
  MeshGeometry,
  CurveGeometry,
  PointCloudGeometry,
  IFC5Material,
  Transform,
} from '../types/ifc5';
import { GraphNode, GraphEdge } from '../types/graph';

/**
 * Convert PostCompositionNode to ComposedObject for 3D rendering
 */
export function convertToComposedObject(
  path: string,
  node: PostCompositionNode,
  schemas: Record<string, IFC5Schema>
): ComposedObject {
  const attributes: Record<string, any> = {};

  // Convert Map to object and flatten nested attributes
  node.attributes.forEach((value, key) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Flatten nested objects with :: separator
      Object.entries(value).forEach(([nestedKey, nestedValue]) => {
        attributes[`${key}::${nestedKey}`] = nestedValue;
      });
    } else {
      // Handle quantity kinds
      const schema = schemas[key];
      if (schema?.value.quantityKind) {
        // Add unit suffix based on quantity kind
        const unitSuffix = getUnitSuffix(schema.value.quantityKind);
        attributes[`${key}${unitSuffix}`] = value;
      } else {
        attributes[key] = value;
      }
    }
  });

  // Determine object type based on attributes
  const type = determineObjectType(attributes);

  // Convert children recursively
  const children: ComposedObject[] = [];
  node.children.forEach((childNode, childName) => {
    children.push(
      convertToComposedObject(`${path}/${childName}`, childNode, schemas)
    );
  });

  return {
    name: path,
    type,
    attributes,
    children,
  };
}

/**
 * Get unit suffix for quantity kind
 */
function getUnitSuffix(quantityKind: string): string {
  const suffixes: Record<string, string> = {
    Length: ' [m]',
    Area: ' [m²]',
    Volume: ' [m³]',
    Mass: ' [kg]',
    Time: ' [s]',
    'Thermodynamic temperature': ' [K]',
    'Electric current': ' [A]',
    Force: ' [N]',
    Pressure: ' [Pa]',
    Energy: ' [J]',
    Power: ' [W]',
    Frequency: ' [Hz]',
  };
  return suffixes[quantityKind] || '';
}

/**
 * Determine object type from attributes
 */
function determineObjectType(
  attributes: Record<string, any>
): ComposedObject['type'] {
  if (attributes['usd::usdgeom::mesh::points']) return 'Mesh';
  if (attributes['usd::usdgeom::basiscurves::points']) return 'Curve';
  if (
    attributes['points::base64::positions'] ||
    attributes['points::array::positions'] ||
    attributes['pcd::base64']
  ) {
    return 'Points';
  }
  return 'Group';
}

/**
 * Extract mesh geometry from attributes
 */
export function extractMeshGeometry(
  attributes: Record<string, any>
): MeshGeometry | null {
  const points = attributes['usd::usdgeom::mesh::points'];
  const indices = attributes['usd::usdgeom::mesh::faceVertexIndices'];

  if (!points || !indices) return null;

  return {
    points: Array.isArray(points) ? points.flat() : points,
    faceVertexIndices: Array.isArray(indices) ? indices : [],
    normals: attributes['usd::usdgeom::mesh::normals'],
  };
}

/**
 * Extract curve geometry from attributes
 */
export function extractCurveGeometry(
  attributes: Record<string, any>
): CurveGeometry | null {
  const points = attributes['usd::usdgeom::basiscurves::points'];

  if (!points) return null;

  return {
    points: Array.isArray(points) ? points.flat() : points,
  };
}

/**
 * Extract point cloud geometry from attributes
 */
export function extractPointCloudGeometry(
  attributes: Record<string, any>
): PointCloudGeometry | null {
  // Check for different point cloud formats
  const positions =
    attributes['points::base64::positions'] ||
    attributes['points::array::positions'];

  if (!positions) return null;

  const colors =
    attributes['points::base64::colors'] || attributes['points::array::colors'];

  return {
    positions: Array.isArray(positions) ? positions.flat() : positions,
    colors: colors ? (Array.isArray(colors) ? colors.flat() : colors) : undefined,
  };
}

/**
 * Extract material from attributes
 */
export function extractMaterial(
  attributes: Record<string, any>,
  parentAttributes?: Record<string, any> | ComposedObject[]
): IFC5Material {
  const material: IFC5Material = {};

  // Check for glTF PBR material (highest priority)
  const pbrMetallicRoughness =
    attributes['gltf::material::pbrMetallicRoughness'];
  if (pbrMetallicRoughness) {
    material.pbrMetallicRoughness = pbrMetallicRoughness;
  }

  // Check for basic IFC presentation
  const diffuseColor = attributes['bsi::ifc::presentation::diffuseColor'];
  if (diffuseColor) {
    material.diffuseColor = diffuseColor;
  }

  const opacity = attributes['bsi::ifc::presentation::opacity'];
  if (opacity !== undefined) {
    material.opacity = opacity;
  }

  // Check parent nodes for inherited material properties
  // parentAttributes can be either a single object or an array of ComposedObjects (the path)
  let parentsToCheck: Record<string, any>[] = [];
  
  if (Array.isArray(parentAttributes)) {
    // It's the path array - check each node's attributes
    parentsToCheck = parentAttributes
      .map(p => (p && typeof p === 'object' && 'attributes' in p ? p.attributes : p))
      .filter(Boolean);
  } else if (parentAttributes && typeof parentAttributes === 'object') {
    // Single parent object
    parentsToCheck = [parentAttributes];
  }

  // Walk through parents to find inherited properties
  for (const parentAttrs of parentsToCheck) {
    if (!parentAttrs) continue;
    
    // Check for glTF PBR in parent
    if (!material.pbrMetallicRoughness) {
      const parentPbr = parentAttrs['gltf::material::pbrMetallicRoughness'];
      if (parentPbr) {
        material.pbrMetallicRoughness = parentPbr;
      }
    }
    
    // Check for IFC presentation in parent
    if (!material.diffuseColor) {
      const parentColor = parentAttrs['bsi::ifc::presentation::diffuseColor'];
      if (parentColor) {
        material.diffuseColor = parentColor;
      }
    }
    
    if (material.opacity === undefined) {
      const parentOpacity = parentAttrs['bsi::ifc::presentation::opacity'];
      if (parentOpacity !== undefined) {
        material.opacity = parentOpacity;
      }
    }
  }

  // Default material
  if (!material.diffuseColor) {
    material.diffuseColor = [0.6, 0.6, 0.6];
  }
  if (material.opacity === undefined) {
    material.opacity = 1.0;
  }

  return material;
}

/**
 * Extract transform from attributes
 */
export function extractTransform(attributes: Record<string, any>): Transform | null {
  const matrix = attributes['usd::xformop::transform'];

  if (!matrix) return null;

  return {
    matrix: Array.isArray(matrix) ? matrix.flat() : matrix,
  };
}

/**
 * Convert ComposedObject to graph nodes and edges
 */
export function convertToGraph(
  root: ComposedObject
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let nodeIdCounter = 0;
  const pathToIdMap = new Map<string, string>();

  function traverse(obj: ComposedObject, parentId?: string) {
    const nodeId = `node_${nodeIdCounter++}`;
    pathToIdMap.set(obj.name, nodeId);

    // Create graph node
    const graphNode: GraphNode = {
      id: nodeId,
      label: obj.name.split('/').pop() || 'root',
      type: obj.type || 'Group',
      properties: obj.attributes || {},
    };

    // Add geometry info if present
    if (obj.type === 'Mesh' && obj.attributes) {
      const geometry = extractMeshGeometry(obj.attributes);
      if (geometry) {
        graphNode.properties._geometry = {
          type: 'mesh',
          vertexCount: geometry.points.length / 3,
          faceCount: geometry.faceVertexIndices.length / 3,
        };
      }
    }

    nodes.push(graphNode);

    // Create edge to parent
    if (parentId) {
      edges.push({
        id: `${parentId}->${nodeId}`,
        source: parentId,
        target: nodeId,
        type: 'child',
        label: 'contains',
        relationshipType: 'CHILD',
      });
    }

    // Process children
    if (obj.children) {
      obj.children.forEach((child) => traverse(child, nodeId));
    }

    // Process references in attributes
    if (obj.attributes) {
      Object.entries(obj.attributes).forEach(([key, value]) => {
        if (
          value &&
          typeof value === 'object' &&
          'ref' in value &&
          typeof value.ref === 'string'
        ) {
          const refId = pathToIdMap.get(value.ref);
          if (refId) {
            edges.push({
              id: `${nodeId}->${refId}`,
              source: nodeId,
              target: refId,
              type: 'reference',
              label: key,
              relationshipType: 'REFERENCE',
            });
          }
        }
      });
    }
  }

  traverse(root);

  return { nodes, edges };
}

/**
 * Get statistics from composed object
 */
export function getIFC5Statistics(root: ComposedObject) {
  let totalNodes = 0;
  let meshCount = 0;
  let curveCount = 0;
  let pointCloudCount = 0;
  let groupCount = 0;

  function traverse(obj: ComposedObject) {
    totalNodes++;

    switch (obj.type) {
      case 'Mesh':
        meshCount++;
        break;
      case 'Curve':
        curveCount++;
        break;
      case 'Points':
        pointCloudCount++;
        break;
      default:
        groupCount++;
    }

    if (obj.children) {
      obj.children.forEach((child) => traverse(child));
    }
  }

  traverse(root);

  return {
    totalNodes,
    meshCount,
    curveCount,
    pointCloudCount,
    groupCount,
  };
}

/**
 * Extract spatial hierarchy (Project -> Site -> Building -> Storey -> Element)
 */
export function extractSpatialHierarchy(root: ComposedObject): ComposedObject[] {
  const hierarchy: ComposedObject[] = [];

  function traverse(obj: ComposedObject) {
    const name = obj.name.toLowerCase();
    if (
      name.includes('project') ||
      name.includes('site') ||
      name.includes('building') ||
      name.includes('storey') ||
      name.includes('space')
    ) {
      hierarchy.push(obj);
    }

    if (obj.children) {
      obj.children.forEach((child) => traverse(child));
    }
  }

  traverse(root);
  return hierarchy;
}
