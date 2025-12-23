import { GraphNode, GraphEdge } from '@/types/graph';
import { IFC_SCHEMA, getEntityDef, getEntityCategory, canBeParent } from '@/lib/ifcSchema';

/**
 * IFC Schema Validation Module
 * Validates IFC files for schema compliance, syntax errors, and data integrity
 * Based on buildingSMART validation patterns and comprehensive IFC schema definitions
 */

export interface ValidationError {
  severity: 'error' | 'warning' | 'info';
  type: string;
  message: string;
  entityId?: string;
  entityType?: string;
  lineNumber?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
  stats: {
    totalErrors: number;
    totalWarnings: number;
    totalInfo: number;
    checkedEntities: number;
    checkedRelationships: number;
    entityTypeCount: Record<string, number>;
    relationshipTypeCount: Record<string, number>;
  };
}

/**
 * Define required properties for common IFC entity types
 * (Now using IFC_SCHEMA from ifcSchema.ts for comprehensive definitions)
 */
const IFC_ENTITY_REQUIREMENTS: Record<string, { required: string[]; optional: string[] }> = {
  // Legacy mapping for backward compatibility - these are now defined in IFC_SCHEMA
  IFCPROJECT: { required: ['GlobalId', 'Name'], optional: ['Description', 'Phase', 'RepresentationContexts'] },
  IFCSITE: { required: ['GlobalId', 'Name'], optional: ['Description', 'SiteAddress'] },
  IFCBUILDING: { required: ['GlobalId', 'Name'], optional: ['Description', 'ElevationOfRefHeight'] },
  IFCBUILDINGSTOREY: { required: ['GlobalId', 'Name'], optional: ['Description', 'Elevation'] },
  IFCSPACE: { required: ['GlobalId', 'Name'], optional: ['Description', 'PredefinedType'] },
  IFCWALL: { required: ['GlobalId'], optional: ['Name', 'Description'] },
  IFCDOOR: { required: ['GlobalId'], optional: ['Name', 'OverallHeight', 'OverallWidth'] },
  IFCWINDOW: { required: ['GlobalId'], optional: ['Name', 'OverallHeight', 'OverallWidth'] },
  IFCSLAB: { required: ['GlobalId'], optional: ['Name', 'Description'] },
  IFCCOLUMN: { required: ['GlobalId'], optional: ['Name', 'Description'] },
  IFCBEAM: { required: ['GlobalId'], optional: ['Name', 'Description'] },
  IFCROOF: { required: ['GlobalId'], optional: ['Name', 'Description'] },
};

/**
 * Get required and optional properties from schema
 */
function getSchemaRequirements(ifcType: string): { required: string[]; optional: string[] } {
  const schemaDef = getEntityDef(ifcType);
  if (!schemaDef) {
    return { required: [], optional: [] };
  }

  const required = schemaDef.properties
    .filter(p => p.required)
    .map(p => p.name);
  const optional = schemaDef.properties
    .filter(p => !p.required)
    .map(p => p.name);

  return { required, optional };
}

/**
 * Valid relationship types in IFC
 */
const VALID_RELATIONSHIP_TYPES = new Set([
  'IFCRELAGGREGATES',
  'IFCRELCONTAINEDINSPATIALSTRUCTURE',
  'IFCRELVOIDSELEMENT',
  'IFCRELFILLSELEMENT',
  'IFCRELDEFINESBYPROPERTIES',
  'IFCRELASSOCIATESMATERIAL',
  'IFCRELASSOCIATESCLASSIFICATION',
  'IFCRELCONNECTSSTRUCTURALACTIVITY',
  'IFCRELCONNECTSSTRUCTURALMEMBER',
]);

/**
 * Validate parsed IFC graph data
 */
export function validateIFCData(
  nodes: GraphNode[],
  edges: GraphEdge[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const info: ValidationError[] = [];

  // Check for empty data
  if (nodes.length === 0) {
    errors.push({
      severity: 'error',
      type: 'EMPTY_DATA',
      message: 'No entities found in IFC file. File may be empty or corrupted.',
    });
  }

  // Validate nodes and collect entity type counts
  const entityTypeCount = validateNodes(nodes, edges, errors, warnings, info);

  // Validate edges and collect relationship type counts
  const relationshipTypeCount = validateEdges(nodes, edges, errors, warnings, info);

  // Validate spatial structure
  validateSpatialStructure(nodes, edges, errors, warnings, info);

  // Validate project hierarchy
  validateProjectHierarchy(nodes, edges, errors, warnings, info);

  // Add entity type statistics to info
  if (Object.keys(entityTypeCount).length > 0) {
    info.push({
      severity: 'info',
      type: 'ENTITY_TYPE_DISTRIBUTION',
      message: `Entity types: ${Object.entries(entityTypeCount)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ')}`,
    });
  }

  const result: ValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings,
    info,
    stats: {
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      totalInfo: info.length,
      checkedEntities: nodes.length,
      checkedRelationships: edges.length,
      entityTypeCount,
      relationshipTypeCount,
    },
  };

  return result;
}

/**
 * Validate individual nodes (entities)
 */
function validateNodes(
  nodes: GraphNode[],
  edges: GraphEdge[],
  errors: ValidationError[],
  warnings: ValidationError[],
  info: ValidationError[]
): Record<string, number> {
  const nodeIds = new Set(nodes.map(n => n.id));
  const ifcTypeCount: Record<string, number> = {};

  nodes.forEach(node => {
    // Count entity types
    ifcTypeCount[node.ifcType] = (ifcTypeCount[node.ifcType] || 0) + 1;

    // Get schema definition for this entity type
    const schemaDef = getEntityDef(node.ifcType);
    
    // Check for required properties (from schema)
    if (schemaDef) {
      schemaDef.properties
        .filter(p => p.required)
        .forEach(prop => {
          if (!node.properties[prop.name]) {
            errors.push({
              severity: 'error',
              type: 'MISSING_REQUIRED_PROPERTY',
              message: `Entity ${node.label} (${node.ifcType}) is missing required property: ${prop.name}`,
              entityId: node.id,
              entityType: node.ifcType,
            });
          }
        });
    } else {
      // Fallback to legacy requirements if schema not found
      const requirements = IFC_ENTITY_REQUIREMENTS[node.ifcType];
      if (requirements) {
        requirements.required.forEach(prop => {
          if (!node.properties[prop]) {
            errors.push({
              severity: 'error',
              type: 'MISSING_REQUIRED_PROPERTY',
              message: `Entity ${node.label} (${node.ifcType}) is missing required property: ${prop}`,
              entityId: node.id,
              entityType: node.ifcType,
            });
          }
        });
      }
    }

    // Check for empty label
    if (!node.label || node.label.trim() === '') {
      warnings.push({
        severity: 'warning',
        type: 'MISSING_LABEL',
        message: `Entity ${node.ifcType} (${node.id}) has no name/label`,
        entityId: node.id,
        entityType: node.ifcType,
      });
    }

    // Check for duplicate GlobalIds
    const globalId = node.properties['GlobalId'];
    if (globalId) {
      const duplicates = nodes.filter(
        n => n.properties['GlobalId'] === globalId && n.id !== node.id
      );
      if (duplicates.length > 0) {
        errors.push({
          severity: 'error',
          type: 'DUPLICATE_GLOBALID',
          message: `Entity ${node.label} has duplicate GlobalId: ${globalId}`,
          entityId: node.id,
          entityType: node.ifcType,
        });
      }
    }

    // Track entity types
    if (node.ifcType === 'IFCSPACE') {
      const hasContainment = nodes.some(
        n =>
          n.ifcType === 'IFCBUILDINGSTOREY' &&
          edges.some(
            e =>
              e.source === n.id &&
              e.target === node.id &&
              e.type === 'IFCRELCONTAINEDINSPATIALSTRUCTURE'
          )
      );

      if (!hasContainment) {
        warnings.push({
          severity: 'warning',
          type: 'ORPHANED_SPACE',
          message: `Space "${node.label}" is not contained in any building storey`,
          entityId: node.id,
          entityType: 'IFCSPACE',
        });
      }
    }
  });

  return ifcTypeCount;
}

/**
 * Validate project hierarchy and structure
 */
function validateProjectHierarchy(
  nodes: GraphNode[],
  edges: GraphEdge[],
  errors: ValidationError[],
  warnings: ValidationError[],
  info: ValidationError[]
): void {
  console.debug('Validating project hierarchy with nodes:', {
    totalNodes: nodes.length,
    allIfcTypes: nodes.map(n => n.ifcType),
  });
  
  const projectNode = nodes.find(n => n.ifcType?.toUpperCase() === 'IFCPROJECT');
  
  console.debug('IFCPROJECT search result:', {
    found: !!projectNode,
    projectLabel: projectNode?.label,
    projectIfcType: projectNode?.ifcType,
  });
  
  if (!projectNode) {
    console.warn('IFCPROJECT not found in validation nodes', {
      nodeTypes: Array.from(new Set(nodes.map(n => n.ifcType))),
    });
    errors.push({
      severity: 'error',
      type: 'MISSING_PROJECT',
      message: 'No IFCPROJECT entity found in the model. Every IFC model must have exactly one IFCPROJECT as the root entity.',
    });
    return;
  }

  // Debug: log the project found
  console.debug('IFCPROJECT found:', {
    id: projectNode.id,
    label: projectNode.label,
    properties: Object.keys(projectNode.properties),
  });

  const hasSite = nodes.some(n => n.ifcType === 'IFCSITE');
  if (!hasSite) {
    info.push({
      severity: 'info',
      type: 'MISSING_SITE',
      message: 'No IFCSITE entity found (optional but recommended)',
    });
  }

  const hasBuilding = nodes.some(n => n.ifcType === 'IFCBUILDING');
  if (!hasBuilding) {
    warnings.push({
      severity: 'warning',
      type: 'MISSING_BUILDING',
      message: 'No IFCBUILDING entity found',
    });
  }

  // Validate storey elevation order if multiple storeys exist
  const storeys = nodes.filter(n => n.ifcType === 'IFCBUILDINGSTOREY')
    .map(n => ({ node: n, elevation: Number(n.properties.Elevation) || 0 }))
    .sort((a, b) => a.elevation - b.elevation);

  for (let i = 1; i < storeys.length; i++) {
    if (storeys[i].elevation <= storeys[i - 1].elevation) {
      warnings.push({
        severity: 'warning',
        type: 'STOREY_ELEVATION_ORDER',
        message: `Storeys not in ascending elevation order: ${storeys[i - 1].node.label} (${storeys[i - 1].elevation}) >= ${storeys[i].node.label} (${storeys[i].elevation})`,
        entityId: storeys[i].node.id,
        entityType: 'IFCBUILDINGSTOREY',
      });
    }
  }
}

/**
 * Validate edges (relationships)
 */
function validateEdges(
  nodes: GraphNode[],
  edges: GraphEdge[],
  errors: ValidationError[],
  warnings: ValidationError[],
  info: ValidationError[]
): Record<string, number> {
  const nodeIds = new Set(nodes.map(n => n.id));
  const relTypeCount: Record<string, number> = {};

  edges.forEach(edge => {
    // Count relationship types
    relTypeCount[edge.type] = (relTypeCount[edge.type] || 0) + 1;

    // Check if referenced nodes exist
    if (!nodeIds.has(edge.source)) {
      errors.push({
        severity: 'error',
        type: 'INVALID_EDGE_SOURCE',
        message: `Relationship references non-existent source entity: ${edge.source}`,
        entityId: edge.id,
      });
    }

    if (!nodeIds.has(edge.target)) {
      errors.push({
        severity: 'error',
        type: 'INVALID_EDGE_TARGET',
        message: `Relationship references non-existent target entity: ${edge.target}`,
        entityId: edge.id,
      });
    }

    // Check for circular references (except aggregates)
    if (edge.type !== 'IFCRELAGGREGATES') {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      if (sourceNode && targetNode && sourceNode.id === targetNode.id) {
        warnings.push({
          severity: 'warning',
          type: 'SELF_REFERENCE',
          message: `Entity ${sourceNode.label} has self-referencing relationship`,
          entityId: edge.id,
        });
      }
    }
  });

  if (Object.keys(relTypeCount).length > 0) {
    info.push({
      severity: 'info',
      type: 'RELATIONSHIP_STATISTICS',
      message: `Total relationships: ${edges.length}. Types: ${Object.entries(relTypeCount)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ')}`,
    });
  }

  return relTypeCount;
}

/**
 * Validate spatial structure hierarchy
 */
function validateSpatialStructure(
  nodes: GraphNode[],
  edges: GraphEdge[],
  errors: ValidationError[],
  warnings: ValidationError[],
  info: ValidationError[]
): void {
  // Check that all building elements are contained in spaces or storeys
  const structuralElements = nodes.filter(n =>
    [
      'IFCWALL',
      'IFCDOOR',
      'IFCWINDOW',
      'IFCSLAB',
      'IFCCOLUMN',
      'IFCBEAM',
      'IFCROOF',
      'IFCSTAIR',
    ].includes(n.ifcType)
  );

  structuralElements.forEach(element => {
    const isContained = edges.some(
      e =>
        e.target === element.id &&
        e.type === 'IFCRELCONTAINEDINSPATIALSTRUCTURE'
    );

    if (!isContained) {
      warnings.push({
        severity: 'warning',
        type: 'UNCONTAINED_ELEMENT',
        message: `Structural element "${element.label}" is not contained in any spatial structure`,
        entityId: element.id,
        entityType: element.ifcType,
      });
    }
  });

  // Check storey hierarchy
  const storeys = nodes.filter(n => n.ifcType === 'IFCBUILDINGSTOREY');
  if (storeys.length > 1) {
    // Check elevation ordering (should be sorted)
    const storeyElevations = storeys
      .map(s => ({
        name: s.label,
        elevation: s.properties['Elevation'] || 0,
      }))
      .sort((a, b) => (a.elevation as number) - (b.elevation as number));

    info.push({
      severity: 'info',
      type: 'STOREY_ELEVATIONS',
      message: `Storeys found: ${storeyElevations.map(s => `${s.name} @ ${s.elevation}m`).join(', ')}`,
    });
  }
}

/**
 * Validate project hierarchy (Project -> Site -> Building -> Storey)
 */
/**
 * Validate IFC file syntax (for .ifc files)
 */
export function validateIFCFileSyntax(content: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Basic syntax checks for STEP format
  if (!content.includes('ISO-10303-21')) {
    errors.push({
      severity: 'error',
      type: 'INVALID_FILE_FORMAT',
      message: 'Not a valid IFC file - missing ISO-10303-21 header',
    });
    return errors;
  }

  if (!content.includes('DATA;')) {
    errors.push({
      severity: 'error',
      type: 'MISSING_DATA_SECTION',
      message: 'IFC file missing DATA section',
    });
  }

  if (!content.includes('ENDSEC;')) {
    errors.push({
      severity: 'error',
      type: 'INCOMPLETE_FILE',
      message: 'IFC file is incomplete - missing ENDSEC delimiter',
    });
  }

  // Check for balanced parentheses and semicolons in data lines
  const dataSection = content.match(/DATA;([\s\S]*?)ENDSEC;/);
  if (dataSection) {
    const lines = dataSection[1].split('\n').filter(line => line.trim());
    lines.forEach((line, index) => {
      if (!line.trim().endsWith(';')) {
        errors.push({
          severity: 'error',
          type: 'SYNTAX_ERROR',
          message: `Line ${index + 1} does not end with semicolon`,
          lineNumber: index + 1,
        });
      }
    });
  }

  return errors;
}

/**
 * Validate IFC5 JSON structure
 */
export function validateIFC5JSONStructure(jsonData: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!jsonData) {
    errors.push({
      severity: 'error',
      type: 'INVALID_JSON',
      message: 'Invalid or empty JSON data',
    });
    return errors;
  }

  // Check for required data array
  const dataArray = jsonData.data || jsonData.entities || jsonData.objects;
  if (!Array.isArray(dataArray)) {
    errors.push({
      severity: 'error',
      type: 'MISSING_DATA_ARRAY',
      message: 'IFC5 JSON must contain "data" array',
    });
    return errors;
  }

  if (dataArray.length === 0) {
    errors.push({
      severity: 'error',
      type: 'EMPTY_DATA_ARRAY',
      message: 'Data array is empty',
    });
  }

  // Validate each entity
  dataArray.forEach((entity, index) => {
    if (!entity.path && !entity.id) {
      errors.push({
        severity: 'error',
        type: 'MISSING_ENTITY_ID',
        message: `Entity at index ${index} missing path/id field`,
        lineNumber: index,
      });
    }

    if (!entity.attributes) {
      errors.push({
        severity: 'warning',
        type: 'MISSING_ATTRIBUTES',
        message: `Entity at index ${index} has no attributes`,
        lineNumber: index,
      });
    }
  });

  return errors;
}
