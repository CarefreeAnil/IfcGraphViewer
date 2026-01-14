/**
 * Enhanced IFC Schema Validator
 * Schema-compliant validation based on IFC2x3, IFC4, IFC4x3 specifications
 * Inspired by IfcOpenShell validation patterns
 */

import { GraphNode, GraphEdge } from '@/types/graph';
import { getEntityDef, IFC_SCHEMA } from '@/lib/ifcSchema';
import { logger } from '@/utils/logger';

export interface ValidationError {
  severity: 'error' | 'warning' | 'info';
  type: string;
  code: string;
  message: string;
  entityId?: string;
  entityType?: string;
  propertyName?: string;
  lineNumber?: number;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  schemaVersion?: string;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
  stats: {
    totalErrors: number;
    totalWarnings: number;
    totalInfo: number;
    checkedEntities: number;
    checkedRelationships: number;
    checkedProperties: number;
    entityTypeCount: Record<string, number>;
    relationshipTypeCount: Record<string, number>;
    missingRequiredProperties: number;
    invalidDataTypes: number;
    brokenReferences: number;
    circularReferences: number;
  };
}

/**
 * Detect IFC schema version
 */
function detectSchemaVersion(nodes: GraphNode[]): string {
  // Check for schema-specific entities
  const ifcTypes = new Set(nodes.map(n => n.ifcType.toUpperCase()));
  
  if (ifcTypes.has('IFCALIGNMENT') || ifcTypes.has('IFCBRIDGE')) {
    return 'IFC4X3';
  }
  
  if (ifcTypes.has('IFCEXTRUDEDAREASOLIDTAPERED') || ifcTypes.has('IFCINDEXEDPOLYGONALFACE')) {
    return 'IFC4';
  }
  
  return 'IFC2X3';
}

/**
 * Validate entity against schema
 */
function validateEntity(node: GraphNode): ValidationError[] {
  const errors: ValidationError[] = [];
  const entityDef = getEntityDef(node.ifcType);
  
  if (!entityDef) {
    // Instead of warning about unknown entity, skip validation
    // Unknown entities are often custom or from newer schema versions
    return errors;
  }
  
  // Check required properties
  const requiredProps = entityDef.properties.filter(p => p.required);
  for (const propDef of requiredProps) {
    const hasProperty = node.properties[propDef.name] !== undefined && 
                       node.properties[propDef.name] !== null;
    
    if (!hasProperty) {
      errors.push({
        severity: 'error',
        type: 'MISSING_REQUIRED_PROPERTY',
        code: 'VAL002',
        message: `Missing required property: ${propDef.name}`,
        entityId: node.id,
        entityType: node.ifcType,
        propertyName: propDef.name,
        suggestion: `Add the required property "${propDef.name}" to this ${node.ifcType} entity.`,
      });
    }
  }
  
  // Check property data types
  for (const propDef of entityDef.properties) {
    const value = node.properties[propDef.name];
    if (value === undefined || value === null) continue;
    
    // Skip validation if no type info available
    const expectedType = (propDef as any).dataType || (propDef as any).type;
    if (!expectedType) continue;
    
    const typeValid = validatePropertyType(value, expectedType);
    if (!typeValid) {
      errors.push({
        severity: 'error',
        type: 'INVALID_DATA_TYPE',
        code: 'VAL003',
        message: `Invalid data type for property ${propDef.name}: expected ${expectedType}`,
        entityId: node.id,
        entityType: node.ifcType,
        propertyName: propDef.name,
        suggestion: `Ensure the value of "${propDef.name}" conforms to type ${expectedType}.`,
      });
    }
  }
  
  // Validate spatial hierarchy
  if (entityDef.category === 'spatial') {
    const spatialErrors = validateSpatialHierarchy(node);
    errors.push(...spatialErrors);
  }
  
  return errors;
}

/**
 * Validate property data type
 */
function validatePropertyType(value: any, expectedType: string): boolean {
  const type = expectedType.toUpperCase();
  
  // Handle reference types
  if (type.startsWith('IFC') && !type.includes('MEASURE') && !type.includes('VALUE')) {
    return typeof value === 'string' && value.startsWith('#');
  }
  
  // Handle measure types
  if (type.includes('MEASURE') || type === 'IFCREAL' || type === 'IFCINTEGER') {
    return typeof value === 'number';
  }
  
  // Handle string types
  if (type === 'IFCLABEL' || type === 'IFCTEXT' || type === 'IFCIDENTIFIER') {
    return typeof value === 'string';
  }
  
  // Handle boolean
  if (type === 'IFCBOOLEAN' || type === 'IFCLOGICAL') {
    return typeof value === 'boolean' || value === '.T.' || value === '.F.' || value === '.U.';
  }
  
  // Handle lists
  if (type.includes('LIST') || type.includes('SET')) {
    return Array.isArray(value);
  }
  
  return true; // Unknown types pass
}

/**
 * Validate spatial hierarchy
 */
function validateSpatialHierarchy(node: GraphNode): ValidationError[] {
  const errors: ValidationError[] = [];
  const type = node.ifcType.toUpperCase();
  
  // Hierarchy rules
  const hierarchyRules: Record<string, string[]> = {
    'IFCPROJECT': [],
    'IFCSITE': ['IFCPROJECT'],
    'IFCBUILDING': ['IFCSITE', 'IFCPROJECT'],
    'IFCBUILDINGSTOREY': ['IFCBUILDING'],
    'IFCSPACE': ['IFCBUILDINGSTOREY', 'IFCBUILDING'],
  };
  
  if (hierarchyRules[type] && hierarchyRules[type].length > 0) {
    // This would require relationship data to validate
    // For now, just add an info message
    errors.push({
      severity: 'info',
      type: 'SPATIAL_HIERARCHY_CHECK',
      code: 'VAL010',
      message: `${type} should be contained in: ${hierarchyRules[type].join(' or ')}`,
      entityId: node.id,
      entityType: node.ifcType,
    });
  }
  
  return errors;
}

/**
 * Validate relationships
 */
function validateRelationships(edges: GraphEdge[], nodes: GraphNode[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    
    // Check for broken references
    if (!sourceNode) {
      errors.push({
        severity: 'error',
        type: 'BROKEN_REFERENCE',
        code: 'VAL004',
        message: `Edge references non-existent source node: ${edge.source}`,
        entityId: edge.id,
        suggestion: 'Remove this relationship or add the missing entity.',
      });
    }
    
    if (!targetNode) {
      errors.push({
        severity: 'error',
        type: 'BROKEN_REFERENCE',
        code: 'VAL005',
        message: `Edge references non-existent target node: ${edge.target}`,
        entityId: edge.id,
        suggestion: 'Remove this relationship or add the missing entity.',
      });
    }
    
    // Validate relationship type (case-insensitive)
    if (edge.type && !edge.type.toUpperCase().startsWith('IFCREL')) {
      errors.push({
        severity: 'warning',
        type: 'INVALID_RELATIONSHIP_TYPE',
        code: 'VAL006',
        message: `Relationship type should start with IFCREL: ${edge.type}`,
        entityId: edge.id,
      });
    }
  }
  
  return errors;
}

/**
 * Detect circular references
 */
function detectCircularReferences(edges: GraphEdge[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const graph = new Map<string, Set<string>>();
  
  // Build adjacency list
  for (const edge of edges) {
    if (!graph.has(edge.source)) {
      graph.set(edge.source, new Set());
    }
    graph.get(edge.source)!.add(edge.target);
  }
  
  // DFS to detect cycles
  const visited = new Set<string>();
  const recStack = new Set<string>();
  
  function hasCycle(node: string, path: string[]): boolean {
    visited.add(node);
    recStack.add(node);
    path.push(node);
    
    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor, path)) {
          return true;
        }
      } else if (recStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart);
        errors.push({
          severity: 'error',
          type: 'CIRCULAR_REFERENCE',
          code: 'VAL007',
          message: `Circular reference detected: ${cycle.join(' → ')} → ${neighbor}`,
          suggestion: 'Remove one of the relationships in this cycle.',
        });
        return true;
      }
    }
    
    recStack.delete(node);
    path.pop();
    return false;
  }
  
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      hasCycle(node, []);
    }
  }
  
  return errors;
}

/**
 * Main validation function
 */
export function validateIFCData(
  nodes: GraphNode[],
  edges: GraphEdge[]
): ValidationResult {
  logger.validation.start(nodes.length);
  
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const info: ValidationError[] = [];
  
  // Detect schema version
  const schemaVersion = detectSchemaVersion(nodes);
  logger.info(`Detected IFC schema version: ${schemaVersion}`);
  
  // Validate entities
  let checkedProperties = 0;
  for (const node of nodes) {
    const nodeErrors = validateEntity(node);
    checkedProperties += Object.keys(node.properties).length;
    
    for (const error of nodeErrors) {
      if (error.severity === 'error') errors.push(error);
      else if (error.severity === 'warning') warnings.push(error);
      else info.push(error);
    }
  }
  
  // Validate relationships
  const relErrors = validateRelationships(edges, nodes);
  for (const error of relErrors) {
    if (error.severity === 'error') errors.push(error);
    else if (error.severity === 'warning') warnings.push(error);
    else info.push(error);
  }
  
  // Detect circular references
  const circularErrors = detectCircularReferences(edges);
  errors.push(...circularErrors);
  
  // Calculate stats
  const entityTypeCount: Record<string, number> = {};
  const relationshipTypeCount: Record<string, number> = {};
  
  for (const node of nodes) {
    entityTypeCount[node.ifcType] = (entityTypeCount[node.ifcType] || 0) + 1;
  }
  
  for (const edge of edges) {
    relationshipTypeCount[edge.type] = (relationshipTypeCount[edge.type] || 0) + 1;
  }
  
  const missingRequiredProperties = errors.filter(e => e.code === 'VAL002').length;
  const invalidDataTypes = errors.filter(e => e.code === 'VAL003').length;
  const brokenReferences = errors.filter(e => e.code === 'VAL004' || e.code === 'VAL005').length;
  const circularReferences = circularErrors.length;
  
  logger.validation.complete(errors.length, warnings.length);
  
  return {
    valid: errors.length === 0,
    schemaVersion,
    errors,
    warnings,
    info,
    stats: {
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      totalInfo: info.length,
      checkedEntities: nodes.length,
      checkedRelationships: edges.length,
      checkedProperties,
      entityTypeCount,
      relationshipTypeCount,
      missingRequiredProperties,
      invalidDataTypes,
      brokenReferences,
      circularReferences,
    },
  };
}
