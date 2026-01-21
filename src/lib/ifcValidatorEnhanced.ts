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
  syntaxErrors: ValidationError[];
  schemaErrors: ValidationError[];
  headerErrors: ValidationError[];
  // Legacy collections for compatibility
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
  
  // Debug logging for IFCSITE
  if (node.ifcType.toUpperCase() === 'IFCSITE') {
    console.log('[Validator] IFCSITE entity found:', {
      id: node.id,
      ifcType: node.ifcType,
      properties: node.properties,
      globalIdValue: node.properties?.GlobalId || node.properties?.globalId,
    });
  }
  
  const entityDef = getEntityDef(node.ifcType);
  
  if (!entityDef) {
    // Instead of warning about unknown entity, skip validation
    // Unknown entities are often custom or from newer schema versions
    console.log('[Validator] No entity definition found for:', node.ifcType);
    return errors;
  }
  
  // Check required properties
  const requiredProps = entityDef.properties.filter(p => p.required);
  for (const propDef of requiredProps) {
    const value = node.properties[propDef.name];
    const hasProperty = value !== undefined && value !== null;
    
    // Debug logging for GlobalId specifically
    if (propDef.name === 'GlobalId' && node.ifcType.toUpperCase() === 'IFCSITE') {
      console.log('[Validator Debug] IFCSITE GlobalId check:', {
        entityId: node.id,
        value: value,
        valueType: typeof value,
        valueLength: typeof value === 'string' ? value.length : 'N/A',
        hasProperty,
        isEmpty: typeof value === 'string' && value.trim() === '',
        allProperties: Object.keys(node.properties)
      });
    }
    
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
    } else if (typeof value === 'string' && value.trim() === '') {
      // Check for empty strings in required properties
      errors.push({
        severity: 'error',
        type: 'EMPTY_REQUIRED_PROPERTY',
        code: 'VAL002B',
        message: `Required property "${propDef.name}" cannot be empty`,
        entityId: node.id,
        entityType: node.ifcType,
        propertyName: propDef.name,
        suggestion: `Provide a valid value for the required property "${propDef.name}".`,
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
  
  // Handle GUID type - strict validation
  if (type === 'IFCGLOBALLYUNIQUEID') {
    if (typeof value !== 'string') return false;
    // Must be exactly 22 characters
    if (value.length !== 22) return false;
    // Must match Base64 character set used in IFC GUIDs: [0-9A-Za-z_$]
    const guidPattern = /^[0-9A-Za-z_$]{22}$/;
    return guidPattern.test(value);
  }
  
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
    const relType = edge.relationshipType || edge.type;
    const isRoleEdge = edge.type === 'relating' || edge.type === 'related';
    if (relType && !isRoleEdge && !relType.toUpperCase().startsWith('IFCREL')) {
      errors.push({
        severity: 'warning',
        type: 'INVALID_RELATIONSHIP_TYPE',
        code: 'VAL006',
        message: `Relationship type should start with IFCREL: ${relType}`,
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
 * Validate IFC Header
 * Checks based on buildingSMART header policy
 */
function validateHeader(header: any): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!header) {
    errors.push({
      severity: 'warning',
      type: 'MISSING_HEADER',
      code: 'HDR001',
      message: 'IFC Header information is missing or could not be parsed.',
      suggestion: 'Ensure the file has a valid HEADER section.',
    });
    return errors;
  }

  // FILE_NAME check
  if (header.fileName) {
     const fn = header.fileName;
     if (!fn.name || fn.name.trim() === '') {
        errors.push({ severity: 'error', type: 'HEADER_POLICY', code: 'HDR002', message: 'FILE_NAME name field is empty.' });
     }
     if (fn.timeStamp) {
        if (isNaN(Date.parse(fn.timeStamp))) {
           errors.push({ severity: 'error', type: 'HEADER_POLICY', code: 'HDR003', message: `Invalid timestamp format in FILE_NAME: ${fn.timeStamp}. Expected ISO 8601.` });
        }
     }
     if (!fn.author || fn.author.length === 0) {
        errors.push({ severity: 'warning', type: 'HEADER_POLICY', code: 'HDR004', message: 'FILE_NAME author field is empty.' });
     }
     if (!fn.organization || fn.organization.length === 0) {
        errors.push({ severity: 'warning', type: 'HEADER_POLICY', code: 'HDR005', message: 'FILE_NAME organization field is empty.' });
     }
  }

  if (header.fileDescription) {
      if (!header.fileDescription.description || header.fileDescription.description.length === 0) {
          errors.push({ severity: 'warning', type: 'HEADER_POLICY', code: 'HDR006', message: 'FILE_DESCRIPTION description is empty.' });
      } else {
          // Check for ViewDefinition (Best Practice)
          const hasViewDef = header.fileDescription.description.some((d: string) => d.includes('ViewDefinition'));
          if (!hasViewDef) {
              errors.push({ severity: 'info', type: 'HEADER_POLICY', code: 'HDR008', message: 'No ViewDefinition found in FILE_DESCRIPTION. It is recommended to specify the Model View Definition.' });
          }
      }
      
      if (header.fileDescription.implementationLevel !== '2;1') {
           errors.push({ severity: 'warning', type: 'HEADER_POLICY', code: 'HDR009', message: `Unexpected implementation level: ${header.fileDescription.implementationLevel}. Expected '2;1'.` });
      }
  }

  if (header.fileSchema) {
      if (!header.fileSchema.schemaIdentifiers || header.fileSchema.schemaIdentifiers.length === 0) {
           errors.push({ severity: 'error', type: 'HEADER_POLICY', code: 'HDR007', message: 'Missing Schema Identifier in FILE_SCHEMA.' });
      } else {
           const validSchemas = ['IFC2X3', 'IFC4', 'IFC4X1', 'IFC4X2', 'IFC4X3', 'IFC4X3_ADD1', 'IFC4X3_ADD2'];
           const schemas = header.fileSchema.schemaIdentifiers;
           const hasValidSchema = schemas.some((s: string) => validSchemas.some(vs => s.toUpperCase().includes(vs)));
           if (!hasValidSchema) {
               errors.push({ severity: 'error', type: 'HEADER_POLICY', code: 'HDR010', message: `Unknown or unsupported schema version: ${schemas.join(', ')}` });
           }
      }
  }

  return errors;
}

/**
 * Validate IFC file syntax (for .ifc files)
 * This acts as a separate pass (Step 1 in buildingSMART workflow)
 */
// Helper to analyze raw lines that failed parsing
function analyzeRawLineForIssues(line: string): string {
    const contentMatch = line.match(/=\s*\w+\s*\((.*)\)\s*;$/);
    if (!contentMatch) return "Invalid STEP syntax structure.";
    
    const args = contentMatch[1];
    
    // Look for unquoted strings that are NOT numbers, NOT null ($), NOT enums/bools (.T.), NOT references (#123)
    // Regex explanation:
    // (?<=,|^)      : Lookbehind for comma or start of string
    // \s*           : Optional whitespace
    // [a-zA-Z0-9_]+ : The suspicious token (alphanumeric)
    // (?=\s*(,|$))  : Lookahead for comma or end of string
    // We then filter out valid numeric/special forms
    
    // Simple tokenizer approach is safer than complex regex
    const tokens = args.split(',').map(t => t.trim());
    for (const token of tokens) {
        if (!token) continue; // Empty token (double comma) usually $ or default, strictly speaking should be $
        
        // Skip valid forms
        if (token === '$') continue; // Null
        if (token === '*') continue; // Derived
        if (token.startsWith("'") && token.endsWith("'")) continue; // Quoted string
        if (token.startsWith('"') && token.endsWith('"')) continue; // Quoted (less common in STEP)
        if (token.startsWith("#")) continue; // Reference
        if (token.startsWith(".")) continue; // Enum/Bool .T. .ENUM.
        if (!isNaN(parseFloat(token))) continue; // Number
        if (token.startsWith("(") || token.endsWith(")")) continue; // Nested list part - simplistic check
        
        // If we get here, it's likely an unquoted string!
        // E.g. "UK" in "IFCPERSON(..., UK)"
        return `Suspicious token found: "${token}". Strings must be quoted (e.g. 'UK').`;
    }
    
    return "Contains invalid arguments or syntax structure.";
}

export function validateIFCFileSyntax(content: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Basic syntax checks for STEP format
  if (!content.includes('ISO-10303-21')) {
    errors.push({
      severity: 'error',
      type: 'INVALID_FILE_FORMAT',
      code: 'SYN001',
      message: 'Not a valid IFC file - missing ISO-10303-21 header',
    });
    return errors;
  }

  if (!content.includes('DATA;')) {
    errors.push({
      severity: 'error',
      type: 'MISSING_DATA_SECTION',
      code: 'SYN002',
      message: 'IFC file missing DATA section',
    });
  }

  if (!content.includes('ENDSEC;')) {
    errors.push({
      severity: 'error',
      type: 'INCOMPLETE_FILE',
      code: 'SYN003',
      message: 'IFC file is incomplete - missing ENDSEC delimiter',
    });
  }

  // Check for balanced parentheses and semicolons in data lines
  const dataSection = content.match(/DATA;([\s\S]*?)ENDSEC;/);
  if (dataSection) {
    const lines = dataSection[1].split('\n').filter(line => line.trim());
    // Only check sample of lines if file is huge to avoid browser hang
    const limit = Math.min(lines.length, 500); 
    
    for(let i=0; i<limit; i++) {
        const line = lines[i];
        if (line.trim().length > 0 && !line.trim().endsWith(';')) {
        errors.push({
          severity: 'error',
          type: 'SYNTAX_ERROR',
          code: 'SYN004',
          message: `Line ${i + 1} does not end with semicolon (checked first 500 lines)`,
          lineNumber: i + 1,
        });
      }
    }
  }

  return errors;
}

/**
 * Main validation function
 */
export function validateIFCData(
  nodes: GraphNode[],
  edges: GraphEdge[],
  header?: any,
  initialSyntaxErrors: ValidationError[] = [],
  rawLines?: Map<number, string>
): ValidationResult {
  logger.validation.start(nodes.length);
  console.debug(`[Validator] Called with nodes=${nodes.length}, rawLines=${rawLines ? rawLines.size : 'undefined'}`);
  
  const headerErrors: ValidationError[] = [];
  const syntaxErrors: ValidationError[] = [...initialSyntaxErrors];
  const schemaErrors: ValidationError[] = [];
  const bsddErrors: ValidationError[] = [];
  const normativeErrors: ValidationError[] = [];
  
  // 1. Header Validation
  if (header) {
      headerErrors.push(...validateHeader(header));
  }

  // 2. Syntax/Parsing Validation (Missing entities & Bad tokens)
  if (rawLines) {
      const parsedIds = new Set(nodes.map(n => n.expressId));
      console.debug(`[Validator] Checking ${nodes.length} nodes for syntax errors. rawLines has ${rawLines.size} entries.`);
      
      // Check for fully recovered syntax errors (marked by parser)
      for (const node of nodes) {
         // Determine if this is a recovered node
         if (node.properties?._isSyntaxError) {
             console.debug(`[Validator] Found recovered syntax error node: #${node.expressId} (${node.ifcType})`);
             const id = node.expressId;
             const line = rawLines.get(id) || node.properties._ifcStep || '';
             
             // Analyze strictly
             const issues = analyzeRawLineForIssues(line);
             console.debug(`[Validator] Analyzed issues for #${id}: ${issues}`);
              
             const error: ValidationError = {
                  severity: 'error',
                  type: 'PARSING_FAILURE',
                  code: 'SYN005',
                  message: `Critical Syntax Error at #${id}: ${issues}`,
                  entityId: `#${id}`,
                  suggestion: 'Check for unquoted strings, missing parentheses, or invalid enum values.'
              };
              
              console.debug(`[Validator] Pushing SYN005 error: ${error.message}`);
              syntaxErrors.push(error);
         }
      }

      // Check for entities completely missing from parsed data (recovery failed)
      for (const [id, line] of rawLines.entries()) {
          // Check if the entity was successfully parsed by WebIFC AND not recovered manually
          // The recovered node IS in 'parsedIds' now because we added it to 'nodes'
          // So we need to make sure we don't report it twice (once here, once above).
          // Above covers it if it's in nodes.
          // This block covers it if it's NOT in nodes at all (recovery failed).
          if (!parsedIds.has(id)) {
              // It's in the file but not in our node list at all. 
              // This is a catastrophic failure for this entity.
              const issues = analyzeRawLineForIssues(line);
              
              syntaxErrors.push({
                  severity: 'error',
                  type: 'PARSING_FAILURE',
                  code: 'SYN005',
                  message: `Entity #${id} completely failed to parse. ${issues}`,
                  entityId: `#${id}`,
                  suggestion: 'Check for unquoted strings, missing parentheses, or invalid enum values.'
              });
          }
      }
  } else {
      console.debug(`[Validator] rawLines is undefined or null, skipping syntax error check`);
  }

  // Detect schema version
  const schemaVersion = detectSchemaVersion(nodes);

  logger.info(`Detected IFC schema version: ${schemaVersion}`);
  
  // 2. Entity Validation (Schema)
  let checkedProperties = 0;
  for (const node of nodes) {
    const nodeErrors = validateEntity(node);
    checkedProperties += Object.keys(node.properties).length;
    schemaErrors.push(...nodeErrors);
  }
  
  // 3. Relationship Validation (Schema/Integrity)
  const relErrors = validateRelationships(edges, nodes);
  schemaErrors.push(...relErrors); 
  
  // 4. Circular References
  const circularErrors = detectCircularReferences(edges);
  schemaErrors.push(...circularErrors);
  
  // Combine all into flat lists for legacy support
  const errors = [
      ...headerErrors.filter(e => e.severity === 'error'),
      ...syntaxErrors.filter(e => e.severity === 'error'),
      ...schemaErrors.filter(e => e.severity === 'error'),
      ...bsddErrors.filter(e => e.severity === 'error'),
      ...normativeErrors.filter(e => e.severity === 'error'),
  ];
  
  const warnings = [
      ...headerErrors.filter(e => e.severity === 'warning'),
      ...syntaxErrors.filter(e => e.severity === 'warning'),
      ...schemaErrors.filter(e => e.severity === 'warning'),
      ...bsddErrors.filter(e => e.severity === 'warning'),
      ...normativeErrors.filter(e => e.severity === 'warning'),
  ];
  
  const info = [
      ...headerErrors.filter(e => e.severity === 'info'),
      ...syntaxErrors.filter(e => e.severity === 'info'),
      ...schemaErrors.filter(e => e.severity === 'info'),
      ...bsddErrors.filter(e => e.severity === 'info'),
      ...normativeErrors.filter(e => e.severity === 'info'),
  ];

  // Calculate stats
  const entityTypeCount: Record<string, number> = {};
  const relationshipTypeCount: Record<string, number> = {};
  
  for (const node of nodes) {
    entityTypeCount[node.ifcType] = (entityTypeCount[node.ifcType] || 0) + 1;
  }
  
  for (const edge of edges) {
    relationshipTypeCount[edge.type] = (relationshipTypeCount[edge.type] || 0) + 1;
  }
  
  const missingRequiredProperties = schemaErrors.filter(e => e.code === 'VAL002').length;
  const invalidDataTypes = schemaErrors.filter(e => e.code === 'VAL003').length;
  const brokenReferences = schemaErrors.filter(e => e.code === 'VAL004' || e.code === 'VAL005').length;
  const circularReferences = circularErrors.length;
  
  logger.validation.complete(errors.length, warnings.length);
  
  console.debug(`[Validator] Final syntaxErrors array: ${syntaxErrors.length} items`, syntaxErrors);
  console.debug(`[Validator] Final result.syntaxErrors will have: ${syntaxErrors.length} items`);
  
  return {
    valid: errors.length === 0,
    schemaVersion,
    
    // New categorized buckets
    syntaxErrors,
    schemaErrors: [...schemaErrors],
    headerErrors,
    
    // Legacy buckets
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
