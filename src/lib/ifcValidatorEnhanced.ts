/**
 * ============================================================================
 * WORK IN PROGRESS - LOCAL VALIDATION (DISABLED)
 * ============================================================================
 *
 * This local validation system is currently DISABLED and needs significant
 * refactoring and improvements. The buildingSMART API-based validation is
 * working well for the POC, so we will revisit this later with a fresh mind.
 *
 * TODO (Future work):
 * - Refactor validation logic for better maintainability
 * - Improve schema loading and caching
 * - Add comprehensive test coverage
 * - Optimize performance for large files
 * - Better error messages and suggestions
 *
 * For now, use the buildingSMART API validation in the Validation page.
 * This code is preserved for future reference and development.
 * ============================================================================
 */

/**
 * Enhanced IFC Schema Validator
 * Schema-compliant validation based on IFC2x3, IFC4, IFC4x3 specifications
 * Inspired by IfcOpenShell validation patterns
 */

import { GraphNode, GraphEdge } from '@/types/graph';
import { getEntityDef } from '@/lib/ifcSchema';
import { getEntityFromSchemaAsync, ensureSchemaLoaded, getAllAttributesAsync, loadSpecificEntities } from '@/lib/ifcSchemaLoader';
import { logger } from '@/utils/logger';
import { mapValidationTypeToFunctionalPart, getFunctionalPart } from '../../bSValidate/src/lib/functionalParts';

/**
 * Find entity key in schema map by case-insensitive match
 */
function findEntityKeyInMap(entityMap: Map<string, any>, entityName: string): string | undefined {
  const upperName = entityName.toUpperCase();
  return Array.from(entityMap.keys()).find(key => key.toUpperCase() === upperName);
}

/**
 * Add functional part information to validation error
 */
function enrichErrorWithFunctionalPart(error: ValidationError): ValidationError {
  const functionalPartTag = mapValidationTypeToFunctionalPart(error.type, error.code);
  const functionalPart = getFunctionalPart(functionalPartTag);

  return {
    ...error,
    functionalPart: functionalPartTag,
    functionalPartName: functionalPart?.name,
  };
}

/**
 * Validate data type of a value
 */
function validateDataType(value: any, expectedType: string, node: GraphNode, propertyName: string): ValidationError | null {
  if (value === undefined || value === null) return null;

  const typeUpper = expectedType.toUpperCase();

  // Skip validation for complex collection types without explicit schema info
  if (typeUpper.includes('SET OF') || typeUpper.includes('LIST OF') || typeUpper.includes('ARRAY')) {
    return null; // Collections need schema definition for proper validation
  }

  // Basic type validation - but lenient to handle variations
  if (typeUpper === 'STRING' || typeUpper === 'IFCLABEL' || typeUpper === 'IFCTEXT') {
    if (typeof value !== 'string' && typeof value !== 'object') {
      return enrichErrorWithFunctionalPart({
        severity: 'warning',
        type: 'INVALID_DATA_TYPE',
        code: 'VAL003',
        message: `Property "${propertyName}" should be STRING but got ${typeof value}`,
        entityId: node.id,
        entityType: node.ifcType,
        propertyName,
        suggestion: `Ensure "${propertyName}" is string type`,
      });
    }
    return null;
  }

  if (typeUpper === 'INTEGER' || typeUpper === 'IFCINTEGER') {
    const isInt = Number.isInteger(value) || typeof value === 'string' && /^\d+$/.test(value);
    if (!isInt && typeof value !== 'string') {
      return enrichErrorWithFunctionalPart({
        severity: 'info',
        type: 'INVALID_DATA_TYPE',
        code: 'VAL003',
        message: `Property "${propertyName}" should be INTEGER but got ${typeof value}`,
        entityId: node.id,
        entityType: node.ifcType,
        propertyName,
      });
    }
    return null;
  }

  if (typeUpper === 'REAL' || typeUpper === 'IFCREAL' || typeUpper === 'DOUBLE') {
    const isReal = typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)));
    if (!isReal) {
      return enrichErrorWithFunctionalPart({
        severity: 'info',
        type: 'INVALID_DATA_TYPE',
        code: 'VAL003',
        message: `Property "${propertyName}" should be REAL but got ${typeof value}`,
        entityId: node.id,
        entityType: node.ifcType,
        propertyName,
      });
    }
    return null;
  }

  if (typeUpper === 'BOOLEAN' || typeUpper === 'IFCBOOLEAN') {
    if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
      return enrichErrorWithFunctionalPart({
        severity: 'info',
        type: 'INVALID_DATA_TYPE',
        code: 'VAL003',
        message: `Property "${propertyName}" should be BOOLEAN`,
        entityId: node.id,
        entityType: node.ifcType,
        propertyName,
      });
    }
    return null;
  }

  return null;
}

/**
 * Validate cardinality (list/array sizes)
 */
function validateCardinality(value: any, cardinality: string | null, node: GraphNode, propertyName: string): ValidationError | null {
  if (!cardinality || value === undefined || value === null) return null;

  // Only validate if cardinality is clearly defined
  const match = cardinality.match(/(\d+):(\d+|\?)/);
  if (!match) return null;

  const [, minStr, maxStr] = match;
  const min = parseInt(minStr);
  const max = maxStr === '?' ? Infinity : parseInt(maxStr);

  // Check if value is a collection
  const isArray = Array.isArray(value);
  const size = isArray ? value.length : (value ? 1 : 0);

  // Only report if clearly violates constraint
  if (size < min) {
    return enrichErrorWithFunctionalPart({
      severity: 'warning',
      type: 'CARDINALITY_VIOLATION',
      code: 'VAL006',
      message: `Property "${propertyName}" needs at least ${min} items but has ${size}`,
      entityId: node.id,
      entityType: node.ifcType,
      propertyName,
    });
  }

  // Max constraint - only report egregious violations
  if (size > max && max > 0 && size > max * 2) {
    return enrichErrorWithFunctionalPart({
      severity: 'warning',
      type: 'CARDINALITY_VIOLATION',
      code: 'VAL006',
      message: `Property "${propertyName}" exceeds maximum size of ${max}`,
      entityId: node.id,
      entityType: node.ifcType,
      propertyName,
    });
  }

  return null;
}

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
  functionalPart?: string; // buildingSMART functional part TAG (e.g., 'PJS', 'PSE', 'GEM')
  functionalPartName?: string; // Human-readable name (e.g., 'Project definition')
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
async function validateEntity(node: GraphNode, schemaVersion: string, loadedSchemas: Map<string, any>): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  
  // Get entity from pre-loaded schemas
  const entityKey = findEntityKeyInMap(loadedSchemas, node.ifcType);
  const entityDef = entityKey ? loadedSchemas.get(entityKey) : undefined;
  if (!entityDef) return errors;
  
  // Collect all attributes including inherited ones from supertypes
  const allAttributes: any[] = [];
  const collectAttrs = (entityName: string) => {
    const key = findEntityKeyInMap(loadedSchemas, entityName);
    const entity = key ? loadedSchemas.get(key) : undefined;
    if (!entity) return;
    if (entity.attributes) allAttributes.push(...entity.attributes);
    if (entity.supertype) collectAttrs(entity.supertype);
  };
  collectAttrs(node.ifcType);
  
  // Only validate attributes that are actually present in the node
  const nodePropertyKeys = new Set(Object.keys(node.properties));
  
  for (const attr of allAttributes) {
    // Skip WHERE rules and inverse attributes
    if (attr.name.startsWith('WR') || attr.is_inverse) {
      continue;
    }
    
    // Only validate if attribute exists in node
    if (!nodePropertyKeys.has(attr.name)) {
      // Special handling for critical attributes
      // Only GlobalId is truly critical across all IFC versions
      const isCriticalAttribute = attr.name === 'GlobalId';
      const isOwnerHistory = attr.name === 'OwnerHistory';
      
      if (!attr.is_optional && isCriticalAttribute) {
        errors.push(enrichErrorWithFunctionalPart({
          severity: 'error',
          type: 'MISSING_REQUIRED_PROPERTY',
          code: 'VAL002',
          message: `Missing critical attribute: ${attr.name}`,
          entityId: node.id,
          entityType: node.ifcType,
          propertyName: attr.name,
          suggestion: `The ${node.ifcType} entity requires the "${attr.name}" attribute.`,
        }));
      } else if (!attr.is_optional && isOwnerHistory && schemaVersion === 'IFC2X3') {
        // OwnerHistory is required in IFC2x3 but commonly omitted - report as warning
        errors.push(enrichErrorWithFunctionalPart({
          severity: 'warning',
          type: 'MISSING_METADATA',
          code: 'VAL002C',
          message: `Missing OwnerHistory (required in IFC2x3)`,
          entityId: node.id,
          entityType: node.ifcType,
          propertyName: attr.name,
          suggestion: `OwnerHistory is required in IFC2x3 but became optional in IFC4. While commonly omitted for brevity, including it improves file metadata tracking.`,
        }));
      }
      // For IFC4+: OwnerHistory is optional per schema, so don't report if missing
      continue;
    }
    
    const value = node.properties[attr.name];
    
    // Check if value is null/undefined for required attributes
    if (!attr.is_optional && (value === undefined || value === null)) {
      errors.push(enrichErrorWithFunctionalPart({
        severity: 'error',
        type: 'MISSING_REQUIRED_PROPERTY',
        code: 'VAL002',
        message: `Missing required attribute: ${attr.name}`,
        entityId: node.id,
        entityType: node.ifcType,
        propertyName: attr.name,
        suggestion: `Provide a value for required attribute "${attr.name}"`,
      }));
      continue;
    }

    // Check for empty required strings
    if (!attr.is_optional && typeof value === 'string' && value.trim() === '') {
      errors.push(enrichErrorWithFunctionalPart({
        severity: 'warning',
        type: 'EMPTY_REQUIRED_PROPERTY',
        code: 'VAL002B',
        message: `Required attribute "${attr.name}" is empty`,
        entityId: node.id,
        entityType: node.ifcType,
        propertyName: attr.name,
        suggestion: `Provide a non-empty value for "${attr.name}"`,
      }));
      continue;
    }
    
    // Validate data type
    const typeError = validateDataType(value, attr.type_name, node, attr.name);
    if (typeError) errors.push(typeError);
    
    // Validate cardinality
    const cardError = validateCardinality(value, attr.cardinality, node, attr.name);
    if (cardError) errors.push(cardError);
  }
  
  return errors;
}

/**
 * Validate entity references
 */
/**
 * Validate entity references point to valid entities
 * Robust version: Only reports if reference is truly broken (entity ID doesn't exist at all)
 * Skips internal node properties and hex color codes
 */
function validateEntityReferences(node: GraphNode, allEntitiesMap: Map<string, GraphNode>): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Internal/metadata properties that are not real IFC properties
  const internalProps = new Set(['_ifcStep', '_schemaColor', '_color', '_metadata', '_isSyntaxError']);
  
  for (const [propName, value] of Object.entries(node.properties)) {
    // Skip internal node metadata properties
    if (internalProps.has(propName) || propName.startsWith('_')) {
      continue;
    }
    
    // Check single entity reference
    if (typeof value === 'string' && value.startsWith('#')) {
      const refId = value;
      
      // Skip hex color codes (like #fbbf24, #1e40af, #8b5cf6) - they're 6-7 chars with hex digits
      if (/^#[0-9a-fA-F]{6,7}$/.test(refId)) {
        continue;
      }
      
      // Skip if reference includes IFC definition (e.g., #7= IFCPERSONANDORGANIZATION(...))
      // These are raw STEP format, not actual entity IDs
      if (refId.includes('=') || refId.includes('(') || refId.includes(';')) {
        continue;
      }
      
      // Valid entity reference: #123 format only
      if (!/^#\d+$/.test(refId)) {
        continue; // Not a valid entity ID format
      }
      
      if (!allEntitiesMap.has(refId)) {
        errors.push(enrichErrorWithFunctionalPart({
          severity: 'error',
          type: 'BROKEN_ENTITY_REFERENCE',
          code: 'VAL007',
          message: `Entity reference ${refId} in property "${propName}" does not exist in file`,
          entityId: node.id,
          entityType: node.ifcType,
          propertyName: propName,
          suggestion: `Verify entity ${refId} exists or correct the reference`,
        }));
      }
    }
    
    // Check array of entity references
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && item.startsWith('#')) {
          const refId = item;
          
          // Skip hex colors
          if (/^#[0-9a-fA-F]{6,7}$/.test(refId)) {
            continue;
          }
          
          // Skip raw STEP definitions
          if (refId.includes('=') || refId.includes('(') || refId.includes(';')) {
            continue;
          }
          
          // Only valid entity IDs
          if (!/^#\d+$/.test(refId)) {
            continue;
          }
          
          if (!allEntitiesMap.has(refId)) {
            errors.push(enrichErrorWithFunctionalPart({
              severity: 'error',
              type: 'BROKEN_ENTITY_REFERENCE',
              code: 'VAL007',
              message: `Entity reference ${refId} in array property "${propName}" does not exist in file`,
              entityId: node.id,
              entityType: node.ifcType,
              propertyName: propName,
              suggestion: `Verify entity ${refId} exists or correct the reference`,
            }));
          }
        }
      }
    }
  }
  
  return errors;
}

/**
 * Validate spatial hierarchy
 * Note: Only reports actual errors, not informational checks
 * (Informational hierarchy checks spam large files with thousands of entities)
 */
function validateSpatialHierarchy(node: GraphNode): ValidationError[] {
  const errors: ValidationError[] = [];
  // Spatial hierarchy validation requires relationship data which is done separately
  // in validateRelationships(). This function is a placeholder for future entity-level checks.
  return errors;
}

/**
 * Validate relationships
 * Note: Skipped when validating allEntities since graphData.edges only covers visualization subset
 */
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
        errors.push(enrichErrorWithFunctionalPart({
          severity: 'error',
          type: 'CIRCULAR_REFERENCE',
          code: 'VAL007',
          message: `Circular reference detected: ${cycle.join(' → ')} → ${neighbor}`,
          suggestion: 'Remove one of the relationships in this cycle.',
        }));
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
    errors.push(enrichErrorWithFunctionalPart({
      severity: 'warning',
      type: 'MISSING_HEADER',
      code: 'HDR001',
      message: 'IFC Header information is missing or could not be parsed.',
      suggestion: 'Ensure the file has a valid HEADER section.',
    }));
    return errors;
  }

  // FILE_NAME check
  if (header.fileName) {
     const fn = header.fileName;
     if (!fn.name || fn.name.trim() === '') {
        errors.push(enrichErrorWithFunctionalPart({ severity: 'error', type: 'HEADER_POLICY', code: 'HDR002', message: 'FILE_NAME name field is empty.' }));
     }
     if (fn.timeStamp) {
        if (isNaN(Date.parse(fn.timeStamp))) {
           errors.push(enrichErrorWithFunctionalPart({ severity: 'error', type: 'HEADER_POLICY', code: 'HDR003', message: `Invalid timestamp format in FILE_NAME: ${fn.timeStamp}. Expected ISO 8601.` }));
        }
     }
     if (!fn.author || fn.author.length === 0) {
        errors.push(enrichErrorWithFunctionalPart({ severity: 'warning', type: 'HEADER_POLICY', code: 'HDR004', message: 'FILE_NAME author field is empty.' }));
     }
     if (!fn.organization || fn.organization.length === 0) {
        errors.push(enrichErrorWithFunctionalPart({ severity: 'warning', type: 'HEADER_POLICY', code: 'HDR005', message: 'FILE_NAME organization field is empty.' }));
     }
  }

  if (header.fileDescription) {
      if (!header.fileDescription.description || header.fileDescription.description.length === 0) {
          errors.push(enrichErrorWithFunctionalPart({ severity: 'warning', type: 'HEADER_POLICY', code: 'HDR006', message: 'FILE_DESCRIPTION description is empty.' }));
      } else {
          // Check for ViewDefinition (Best Practice)
          const viewDefEntry = header.fileDescription.description.find((d: string) => d.includes('ViewDefinition'));

          if (!viewDefEntry) {
              errors.push(enrichErrorWithFunctionalPart({ severity: 'info', type: 'HEADER_POLICY', code: 'HDR008', message: 'No ViewDefinition found in FILE_DESCRIPTION. It is recommended to specify the Model View Definition.' }));
          } else {
              // Validate ViewDefinition syntax
              // Note: Parser splits by comma, so 'ViewDefinition [, MVD]' becomes 'ViewDefinition [' as separate entry
              // Valid patterns: 'ViewDefinition [CoordinationView]', 'ViewDefinition [CoordinationView, QuantityTakeOff]'
              // Invalid patterns: 'ViewDefinition [' (ends with bracket, incomplete), 'ViewDefinition []'

              let isMalformed = false;
              let malformedReason = '';

              // Pattern 1: ViewDefinition ends with [ and nothing else (was split by comma)
              if (/ViewDefinition\s*\[\s*$/.test(viewDefEntry)) {
                  isMalformed = true;
                  malformedReason = 'ViewDefinition bracket is incomplete (missing MVD name before comma)';
              }

              // Pattern 2: Empty brackets []
              if (/ViewDefinition\s*\[\s*\]/.test(viewDefEntry)) {
                  isMalformed = true;
                  malformedReason = 'ViewDefinition has empty brackets';
              }

              // Pattern 3: [, with nothing before comma (if not already split)
              if (/ViewDefinition\s*\[\s*,/.test(viewDefEntry)) {
                  isMalformed = true;
                  malformedReason = 'ViewDefinition has comma immediately after bracket';
              }

              if (isMalformed) {
                  errors.push(enrichErrorWithFunctionalPart({
                      severity: 'warning',
                      type: 'HEADER_POLICY',
                      code: 'HDR011',
                      message: `Malformed ViewDefinition in FILE_DESCRIPTION: ${malformedReason}. Found: "${viewDefEntry}". Expected format: 'ViewDefinition [MVDName]'.`,
                      suggestion: 'Specify a valid Model View Definition such as CoordinationView, ReferenceView, or DesignTransferView.'
                  }));
              }
          }
      }

      if (header.fileDescription.implementationLevel !== '2;1') {
           errors.push(enrichErrorWithFunctionalPart({ severity: 'warning', type: 'HEADER_POLICY', code: 'HDR009', message: `Unexpected implementation level: ${header.fileDescription.implementationLevel}. Expected '2;1'.` }));
      }
  }

  if (header.fileSchema) {
      if (!header.fileSchema.schemaIdentifiers || header.fileSchema.schemaIdentifiers.length === 0) {
           errors.push(enrichErrorWithFunctionalPart({ severity: 'error', type: 'HEADER_POLICY', code: 'HDR007', message: 'Missing Schema Identifier in FILE_SCHEMA.' }));
      } else {
           const validSchemas = ['IFC2X3', 'IFC4', 'IFC4X1', 'IFC4X2', 'IFC4X3', 'IFC4X3_ADD1', 'IFC4X3_ADD2'];
           const schemas = header.fileSchema.schemaIdentifiers;
           const hasValidSchema = schemas.some((s: string) => validSchemas.some(vs => s.toUpperCase().includes(vs)));
           if (!hasValidSchema) {
               errors.push(enrichErrorWithFunctionalPart({ severity: 'error', type: 'HEADER_POLICY', code: 'HDR010', message: `Unknown or unsupported schema version: ${schemas.join(', ')}` }));
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
    errors.push(enrichErrorWithFunctionalPart({
      severity: 'error',
      type: 'INVALID_FILE_FORMAT',
      code: 'SYN001',
      message: 'Not a valid IFC file - missing ISO-10303-21 header',
    }));
    return errors;
  }

  if (!content.includes('DATA;')) {
    errors.push(enrichErrorWithFunctionalPart({
      severity: 'error',
      type: 'MISSING_DATA_SECTION',
      code: 'SYN002',
      message: 'IFC file missing DATA section',
    }));
  }

  if (!content.includes('ENDSEC;')) {
    errors.push(enrichErrorWithFunctionalPart({
      severity: 'error',
      type: 'INCOMPLETE_FILE',
      code: 'SYN003',
      message: 'IFC file is incomplete - missing ENDSEC delimiter',
    }));
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
        errors.push(enrichErrorWithFunctionalPart({
          severity: 'error',
          type: 'SYNTAX_ERROR',
          code: 'SYN004',
          message: `Line ${i + 1} does not end with semicolon (checked first 500 lines)`,
          lineNumber: i + 1,
        }));
      }
    }
  }

  return errors;
}

/**
 * Main validation function
 */
export async function validateIFCData(
  nodes: GraphNode[],
  edges: GraphEdge[],
  header?: any,
  initialSyntaxErrors: ValidationError[] = [],
  rawLines?: Map<number, string>
): Promise<ValidationResult> {
  logger.validation.start(nodes.length);
  
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
      
      // Check for fully recovered syntax errors (marked by parser)
      for (const node of nodes) {
         // Determine if this is a recovered node
         if (node.properties?._isSyntaxError) {
             const id = node.expressId;
             const line = rawLines.get(id) || node.properties._ifcStep || '';
             
             // Analyze strictly
             const issues = analyzeRawLineForIssues(line);

             const error: ValidationError = enrichErrorWithFunctionalPart({
                  severity: 'error',
                  type: 'PARSING_FAILURE',
                  code: 'SYN005',
                  message: `Critical Syntax Error at #${id}: ${issues}`,
                  entityId: `#${id}`,
                  suggestion: 'Check for unquoted strings, missing parentheses, or invalid enum values.'
              });

              syntaxErrors.push(error);
         }
      }

      // NOTE: We don't check for missing entities here because:
      // 1. The parser intentionally skips geometry entities (IFCSHAPEREPRESENTATION, etc.)
      // 2. rawLines contains ALL entities, but nodes only contains semantic entities
      // 3. This was causing 43,000+ false positive errors
      // If we want to detect truly failed parsing, the parser should mark them with _isSyntaxError
  } else {
      console.debug(`[Validator] rawLines is undefined or null, skipping syntax error check`);
  }

  // Detect schema version
  const schemaVersion = detectSchemaVersion(nodes);
  logger.info(`Detected IFC schema version: ${schemaVersion}`);
  
  // STEP 1: Scan file - what entity types are present?
  const entityTypesInFile = new Set(nodes.map(n => n.ifcType));
  logger.info(`File contains ${entityTypesInFile.size} unique entity types (out of ${nodes.length} total entities)`);
  
  // STEP 2: Load ONLY schemas for entities in this file (not all 581)
  const loadedSchemas = await loadSpecificEntities(Array.from(entityTypesInFile), schemaVersion);
  logger.info(`Loaded ${loadedSchemas.size} entity schemas (including supertypes)`);
  
  // 2. Entity Validation (Schema) - Run in parallel batches for performance
  let checkedProperties = 0;
  const BATCH_SIZE = 1000;
  
  // Create a map of nodes for reference validation
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
    const batch = nodes.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(node => validateEntity(node, schemaVersion, loadedSchemas))
    );
    
    batchResults.forEach(nodeErrors => {
      schemaErrors.push(...nodeErrors);
    });
    
    batch.forEach(node => {
      checkedProperties += Object.keys(node.properties).length;
    });
  }
  
  // 2b. Reference Validation - Check entity references point to valid entities
  for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
    const batch = nodes.slice(i, i + BATCH_SIZE);
    batch.forEach(node => {
      const refErrors = validateEntityReferences(node, nodeMap);
      schemaErrors.push(...refErrors);
    });
  }
  
  // 3. Circular References
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
