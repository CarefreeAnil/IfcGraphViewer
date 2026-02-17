/**
 * BuildingSMART Validation Result Utilities
 * Helpers for formatting and grouping validation outcomes to match buildingSMART platform UI
 */

import { ValidationError } from '../../../src/lib/ifcValidatorEnhanced';

export interface RuleGroup {
  ruleCode: string;
  ruleName: string;
  functionalPart: string;
  functionalPartName?: string;
  occurrenceCount: number;
  errors: ValidationError[];
  ruleDescription?: string;
  documentationLink?: string;
}

/**
 * Extract rule code from feature name
 * Example: "BLT001 - Correct use of operation type attributes for doors" → "BLT001"
 * For JSON features like {"type": "entity_rule", "attribute": "IfcBuildingElement.MaxOneMaterialAssociation"}, extracts the attribute
 */
export function extractRuleCode(feature?: string): string {
  if (!feature) return '';

  // Try to match standard rule code format (BLT001, GEM003, etc.)
  const match = feature.match(/^([A-Z]{3}\d{3})/);
  if (match) return match[1];

  // Handle JSON format like {"type": "entity_rule", "attribute": "IfcBuildingElement.MaxOneMaterialAssociation"}
  try {
    const parsed = JSON.parse(feature);
    if (parsed.attribute) {
      // Extract entity rule name
      return parsed.attribute;
    }
    if (parsed.type === 'entity_rule') {
      return 'ENTITY_RULE';
    }
  } catch {
    // Not JSON, continue
  }

  return '';
}

/**
 * Extract rule name from feature name
 * Example: "BLT001 - Correct use of operation type attributes for doors" → "Correct use of operation type attributes for doors"
 * For JSON features, returns the attribute or feature itself
 */
export function extractRuleName(feature?: string): string {
  if (!feature) return '';

  // Try standard format with dash
  const match = feature.match(/^[A-Z]{3}\d{3}\s*-\s*(.+)$/);
  if (match) return match[1];

  // Handle JSON format
  try {
    const parsed = JSON.parse(feature);
    if (parsed.attribute) {
      return parsed.attribute;
    }
    return feature;
  } catch {
    // Not JSON, return as-is
  }

  return feature;
}

/**
 * Format StepID to match buildingSMART platform
 * Example: "i502818374" → "#502818374"
 */
export function formatStepId(instancePublicId?: string | null): string {
  if (!instancePublicId) return '';
  // Handle different formats
  if (instancePublicId.startsWith('i')) {
    return `#${instancePublicId.substring(1)}`;
  }
  if (instancePublicId.startsWith('#')) {
    return instancePublicId;
  }
  return `#${instancePublicId}`;
}

/**
 * Format expected/observed values for display
 */
export function formatValue(value: any): string {
  if (value === null || value === undefined) return '-';

  // Handle objects
  if (typeof value === 'object') {
    // Check for common patterns
    if (value.schema_identifier) {
      return value.schema_identifier;
    }
    if (value.value !== undefined) {
      if (Array.isArray(value.value)) {
        // For arrays, show count
        return `${value.value.length} items`;
      }
      return String(value.value);
    }
    if (value.oneOf) {
      return `One of: ${value.oneOf.join(', ')}`;
    }

    // Default: pretty print JSON
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

/**
 * Get documentation link for a rule code
 */
export function getRuleDocumentationLink(ruleCode: string): string {
  if (!ruleCode || !ruleCode.match(/^[A-Z]{3}\d{3}$/)) return '';

  // BuildingSMART IFC Gherkin rules are named like: ALB001-correct-usage-of-alignment.feature
  // We need to convert: BLT001 → BLT001-[some-name].feature
  // Since we don't have the full name, we'll link to the main rules page with anchor
  const functionalPart = ruleCode.substring(0, 3);

  return `https://buildingsmart.github.io/ifc-gherkin-rules/branches/main/index.html#${ruleCode.toLowerCase()}`;
}

/**
 * Group validation errors by rule code
 */
export function groupByRuleCode(errors: ValidationError[]): RuleGroup[] {
  const groups: Record<string, RuleGroup> = {};

  errors.forEach(error => {
    // Extract rule code from feature field (if exists in error)
    const feature = (error as any).feature || error.message;
    const ruleCode = extractRuleCode(feature);

    // If no rule code, use error code as fallback
    const key = ruleCode || error.code;

    if (!groups[key]) {
      groups[key] = {
        ruleCode: key,
        ruleName: extractRuleName(feature) || error.message,
        functionalPart: error.functionalPart || key.substring(0, 3),
        functionalPartName: error.functionalPartName,
        occurrenceCount: 0,
        errors: [],
        ruleDescription: extractRuleName(feature),
        documentationLink: ruleCode ? getRuleDocumentationLink(ruleCode) : undefined,
      };
    }

    groups[key].errors.push(error);
    groups[key].occurrenceCount++;
  });

  // Sort by rule code alphabetically
  return Object.values(groups).sort((a, b) =>
    a.ruleCode.localeCompare(b.ruleCode)
  );
}

/**
 * Check if error has buildingSMART-specific fields
 */
export function isBuildingSmartError(error: ValidationError): boolean {
  const anyError = error as any;
  return !!(
    anyError.outcomeCode ||
    anyError.validationTaskId ||
    anyError.featureVersion ||
    anyError.feature
  );
}

/**
 * Get severity display name
 */
export function getSeverityDisplay(severity: 'error' | 'warning' | 'info'): string {
  const map = {
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
  };
  return map[severity] || severity;
}

/**
 * Check if error is a schema/entity rule (vs normative Gherkin rule)
 * Schema rules have JSON features with "entity_rule" type
 */
export function isSchemaRule(error: ValidationError): boolean {
  const anyError = error as any;
  if (!anyError.feature) return false;

  // Try to parse as JSON
  try {
    const parsed = JSON.parse(anyError.feature);
    return parsed.type === 'entity_rule';
  } catch {
    // Not JSON
  }

  // Also check for "Entity Rule" in feature name
  return anyError.feature.includes('Entity Rule');
}

/**
 * Extract StepIDs from a message text
 * Returns array of StepIDs found in format #12345
 */
export function extractStepIdsFromMessage(message: string): string[] {
  if (!message) return [];

  // Match patterns like #12345, #14242#, etc.
  const matches = message.match(/#\d+/g);
  if (!matches) return [];

  // Deduplicate
  return [...new Set(matches)];
}

/**
 * Simplify technical jargon in messages for better readability
 */
export function simplifyMessage(message: string): string {
  if (!message) return '';

  // Replace common technical terms
  let simplified = message
    // JSON-like structures
    .replace(/\{"type":\s*"entity_rule",\s*"attribute":\s*"([^"]+)"\}/g, 'Rule: $1')
    .replace(/\[notValidated by ir Fallardi\s+\d+/g, '[Not validated')
    .replace(/where Fallardi\s*=\s*/g, 'where ')
    // Technical operators
    .replace(/sizeof\(/g, 'count of ')
    .replace(/\)\s*<=\s*(\d+)/g, ') should be at most $1')
    .replace(/\)\s*==\s*(\d+)/g, ') should equal $1')
    .replace(/\)\s*>=\s*(\d+)/g, ') should be at least $1')
    // Entity references
    .replace(/IfcQuantity(\w+)/g, 'Quantity-$1')
    .replace(/IfcProperty(\w+)/g, 'Property-$1')
    .replace(/IfcElement(\w+)/g, 'Element-$1');

  return simplified;
}

/**
 * Get outcome code description
 */
export function getOutcomeCodeDescription(outcomeCode?: string): string {
  if (!outcomeCode) return '';

  const descriptions: Record<string, string> = {
    'P00010': 'Passed',
    'N00010': 'Not Applicable',
    'E00001': 'Syntax Error',
    'E00002': 'Schema Error',
    'E00010': 'Type Error',
    'E00020': 'Value Error',
    'E00030': 'Geometry Error',
    'E00040': 'Cardinality Error',
    'E00050': 'Duplicate Error',
    'E00060': 'Placement Error',
    'E00070': 'Units Error',
    'E00080': 'Quantity Error',
    'E00090': 'Enumerated Value Error',
    'E00100': 'Relationship Error',
    'E00110': 'Naming Error',
    'E00120': 'Reference Error',
    'E00130': 'Resource Error',
    'E00140': 'Deprecation Error',
    'E00150': 'Shape Representation Error',
    'E00160': 'Instance Structure Error',
    'W00010': 'Alignment Contains Business Logic Only',
    'W00020': 'Alignment Contains Geometry Only',
    'W00030': 'Warning',
    'X00040': 'Executed',
  };

  return descriptions[outcomeCode] || outcomeCode;
}
