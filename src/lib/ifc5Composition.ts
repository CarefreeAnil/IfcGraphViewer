/**
 * IFC5 Composition Engine
 * Handles inheritance, children resolution, and tree composition
 * Based on buildingSMART IFC5-development composition logic
 */

import {
  IFC5Node,
  CompositionInputNode,
  PreCompositionNode,
  PostCompositionNode,
  IFC5CycleError,
} from '../types/ifc5';

/**
 * Get the head component of a path (before first /)
 */
function getHead(path: string): string {
  return path.split('/')[0];
}

/**
 * Get the tail of a path (after first /)
 */
function getTail(path: string): string {
  const parts = path.split('/');
  parts.shift();
  return parts.join('/');
}

/**
 * Convert IFC5Node array to CompositionInputNode map
 */
export function toInputNodes(nodes: IFC5Node[]): Map<string, CompositionInputNode[]> {
  const inputNodes = new Map<string, CompositionInputNode[]>();

  for (const node of nodes) {
    const inputNode: CompositionInputNode = {
      path: node.path,
      children: node.children || {},
      inherits: node.inherits || {},
      attributes: node.attributes || {},
    };

    if (!inputNodes.has(node.path)) {
      inputNodes.set(node.path, []);
    }
    inputNodes.get(node.path)!.push(inputNode);
  }

  return inputNodes;
}

/**
 * Flatten multiple CompositionInputNodes at same path to PreCompositionNode
 */
function flattenPathToPreCompositionNode(
  path: string,
  inputNodes: CompositionInputNode[]
): PreCompositionNode {
  const compositionNode: PreCompositionNode = {
    path,
    children: {},
    inherits: {},
    attributes: {},
  };

  for (const node of inputNodes) {
    // Merge children
    Object.keys(node.children).forEach((childName) => {
      const value = node.children[childName];
      if (value === null) {
        delete compositionNode.children[childName];
      } else {
        compositionNode.children[childName] = value;
      }
    });

    // Merge inherits
    Object.keys(node.inherits).forEach((inheritName) => {
      const value = node.inherits[inheritName];
      if (value === null) {
        delete compositionNode.inherits[inheritName];
      } else {
        compositionNode.inherits[inheritName] = value;
      }
    });

    // Merge attributes
    Object.keys(node.attributes).forEach((attrName) => {
      compositionNode.attributes[attrName] = node.attributes[attrName];
    });
  }

  return compositionNode;
}

/**
 * Flatten composition input to pre-composition nodes
 */
export function flattenCompositionInput(
  input: Map<string, CompositionInputNode[]>
): Map<string, PreCompositionNode> {
  const compositionNodes = new Map<string, PreCompositionNode>();

  for (const [path, inputNodes] of input) {
    compositionNodes.set(path, flattenPathToPreCompositionNode(path, inputNodes));
  }

  return compositionNodes;
}

/**
 * Find roots or detect cycles using topological sorting
 */
export function findRootsOrCycles(
  nodes: Map<string, PreCompositionNode>
): Set<string> | null {
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();

  // Build dependency graph
  nodes.forEach((node, path) => {
    Object.values(node.inherits).forEach((inheritPath) => {
      if (!dependencies.has(path)) {
        dependencies.set(path, new Set());
      }
      dependencies.get(path)!.add(inheritPath);

      if (!dependents.has(inheritPath)) {
        dependents.set(inheritPath, new Set());
      }
      dependents.get(inheritPath)!.add(path);
    });

    Object.values(node.children).forEach((childPath) => {
      if (childPath === null) return;
      if (!dependencies.has(path)) {
        dependencies.set(path, new Set());
      }
      dependencies.get(path)!.add(childPath);

      if (!dependents.has(childPath)) {
        dependents.set(childPath, new Set());
      }
      dependents.get(childPath)!.add(path);
    });
  });

  const paths = Array.from(nodes.keys());
  const perm = new Set<string>();
  const temp = new Set<string>();
  const roots = new Set<string>();

  function visit(path: string) {
    if (perm.has(path)) return;
    if (temp.has(path)) {
      throw new IFC5CycleError(`Cycle detected involving path: ${path}`);
    }

    temp.add(path);
    const deps = dependencies.get(path);
    if (deps) {
      deps.forEach((dep) => visit(dep));
    }
    temp.delete(path);
    perm.add(path);
  }

  try {
    paths.forEach((path) => {
      if (!perm.has(path)) {
        visit(path);
      }
    });

    // Find roots (nodes with no dependents)
    paths.forEach((path) => {
      if (!dependents.has(path) || dependents.get(path)!.size === 0) {
        roots.add(path);
      }
    });

    return roots;
  } catch (error) {
    if (error instanceof IFC5CycleError) {
      return null;
    }
    throw error;
  }
}

/**
 * Create PostCompositionNode
 */
export function makePostCompositionNode(node: string): PostCompositionNode {
  return {
    node,
    children: new Map(),
    attributes: new Map(),
  };
}

/**
 * Add child to PostCompositionNode
 */
function addChildToNode(
  parent: PostCompositionNode,
  childName: string,
  childPath: string,
  preCompositionNodes: Map<string, PreCompositionNode>
): void {
  if (!parent.children.has(childName)) {
    const childNode = makePostCompositionNode(`${parent.node}/${childName}`);
    parent.children.set(childName, childNode);
  }

  const child = parent.children.get(childName)!;
  composeNode(childPath, child, preCompositionNodes);
}

/**
 * Add data from PreCompositionNode to PostCompositionNode
 */
function addDataFromPreComposition(
  preNode: PreCompositionNode,
  postNode: PostCompositionNode,
  preCompositionNodes: Map<string, PreCompositionNode>
): void {
  // Add attributes
  Object.entries(preNode.attributes).forEach(([key, value]) => {
    postNode.attributes.set(key, value);
  });

  // Process inherits
  Object.entries(preNode.inherits).forEach(([_name, inheritPath]) => {
    composeNode(inheritPath, postNode, preCompositionNodes);
  });

  // Process children
  Object.entries(preNode.children).forEach(([childName, childPath]) => {
    if (childPath === null) return;
    addChildToNode(postNode, childName, childPath, preCompositionNodes);
  });
}

/**
 * Compose node recursively
 */
export function composeNode(
  path: string,
  postCompositionNode: PostCompositionNode,
  preCompositionNodes: Map<string, PreCompositionNode>
): PostCompositionNode {
  const preCompositionNode = preCompositionNodes.get(path);

  if (preCompositionNode) {
    addDataFromPreComposition(preCompositionNode, postCompositionNode, preCompositionNodes);
  }

  // Recursively compose children
  postCompositionNode.children.forEach((child, name) => {
    composeNode(`${path}/${name}`, child, preCompositionNodes);
  });

  return postCompositionNode;
}

/**
 * Compose node from path
 */
export function composeNodeFromPath(
  path: string,
  preCompositionNodes: Map<string, PreCompositionNode>
): PostCompositionNode {
  return composeNode(path, makePostCompositionNode(path), preCompositionNodes);
}

/**
 * Expand first root in input
 */
export function expandFirstRootInInput(
  nodes: Map<string, PreCompositionNode>
): PostCompositionNode {
  const roots = findRootsOrCycles(nodes);
  if (!roots || roots.size === 0) {
    throw new IFC5CycleError('Cycle detected or no roots found');
  }
  return composeNodeFromPath(Array.from(roots)[0], nodes);
}

/**
 * Create artificial root that includes all roots
 */
export function createArtificialRoot(
  nodes: Map<string, PreCompositionNode>
): PostCompositionNode {
  const roots = findRootsOrCycles(nodes);
  if (!roots || roots.size === 0) {
    throw new IFC5CycleError('Cycle detected or no roots found');
  }

  const artificialRoot = makePostCompositionNode('__root__');

  roots.forEach((rootPath) => {
    const rootName = rootPath.split('/').pop() || rootPath;
    const childNode = makePostCompositionNode(rootPath);
    artificialRoot.children.set(rootName, childNode);
    composeNode(rootPath, childNode, nodes);
  });

  return artificialRoot;
}

/**
 * Get child node with path
 */
export function getChildNodeWithPath(
  node: PostCompositionNode,
  path: string
): PostCompositionNode | null {
  if (path === '') return node;

  const parts = path.split('/');
  const child = node.children.get(parts[0]);

  if (child) {
    if (parts.length === 1) {
      return child;
    }
    return getChildNodeWithPath(child, getTail(path));
  }

  return null;
}
