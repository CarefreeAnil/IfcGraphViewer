/**
 * Maps BuildingSmart API responses to internal ValidationResult format
 */

import { BuildingSmartResultsResponse } from './buildingsmartApi';
import { ValidationError, ValidationResult } from '../../../src/lib/ifcValidatorEnhanced';
import { mapBuildingSmartFeatureToFunctionalPart, getFunctionalPart } from '../lib/functionalParts';

/**
 * Map BuildingSmart severity to internal severity
 * BuildingSmart API severity enum (from OpenAPI spec):
 * - 0 = N/A (Not Applicable)
 * - 1 = Executed (rule was executed)
 * - 2 = Passed (validation passed)
 * - 3 = Warning
 * - 4 = Error
 */
function mapSeverity(bsSeverity?: any): 'error' | 'warning' | 'info' {
  // Handle numeric severity
  if (typeof bsSeverity === 'number') {
    if (bsSeverity === 4) return 'error';      // Error
    if (bsSeverity === 3) return 'warning';    // Warning
    if (bsSeverity === 2) return 'info';       // Passed
    if (bsSeverity === 1) return 'info';       // Executed
    return 'info';                              // N/A (0) or unknown
  }

  // Handle string severity (fallback)
  if (!bsSeverity) return 'info';
  const severity = String(bsSeverity).toLowerCase();
  if (severity.includes('error') || severity.includes('critical')) return 'error';
  if (severity.includes('warning') || severity.includes('warn')) return 'warning';
  return 'info';
}

/**
 * Map BuildingSmart feature to validation type
 */
function mapFeatureToType(feature?: any): string {
  if (!feature) return 'BUILDINGSMART_VALIDATION';

  // Ensure it's a string
  const featureLower = String(feature).toLowerCase();

  // Syntax and structure errors
  if (featureLower.includes('syntax') || featureLower.includes('parse')) {
    return 'SYNTAX_ERROR';
  }

  // Schema and data type errors
  if (
    featureLower.includes('schema') ||
    featureLower.includes('type') ||
    featureLower.includes('datatype') ||
    featureLower.includes('entity')
  ) {
    return 'SCHEMA_ERROR';
  }

  // Header and file structure errors
  if (featureLower.includes('header') || featureLower.includes('file')) {
    return 'HEADER_ERROR';
  }

  // Property and attribute errors
  if (
    featureLower.includes('property') ||
    featureLower.includes('attribute') ||
    featureLower.includes('pset')
  ) {
    return 'PROPERTY_ERROR';
  }

  // Reference and relationship errors
  if (
    featureLower.includes('reference') ||
    featureLower.includes('relationship') ||
    featureLower.includes('link')
  ) {
    return 'REFERENCE_ERROR';
  }

  // MVD and view definition
  if (featureLower.includes('mvd') || featureLower.includes('view')) {
    return 'MVD_VALIDATION';
  }

  // Geometry errors
  if (featureLower.includes('geometry') || featureLower.includes('shape')) {
    return 'GEOMETRY_ERROR';
  }

  // IDS (Information Delivery Specification) errors
  if (featureLower.includes('ids')) {
    return 'IDS_VALIDATION';
  }

  return 'BUILDINGSMART_VALIDATION';
}

/**
 * Generate validation code based on feature
 */
function generateCode(feature?: any, index: number = 0): string {
  const featureStr = feature ? String(feature) : '';
  const prefix = featureStr.substring(0, 3).toUpperCase() || 'BS';
  return `${prefix}${String(index + 1).padStart(3, '0')}`;
}

/**
 * Extract entity ID from various BuildingSmart result formats
 */
function extractEntityId(result: any): string | undefined {
  // Try direct fields first
  if (result.instance_id) return String(result.instance_id);
  if (result.instanceId) return String(result.instanceId);
  if (result.instance_public_id && result.instance_public_id !== null) return String(result.instance_public_id);
  if (result.id) return String(result.id);
  
  // Try parsing from 'On instance:' text if available
  if (result.instance_ref || result.on_instance) {
    const instanceText = result.instance_ref || result.on_instance;
    const match = instanceText.match(/#(\d+)/);
    if (match) return `#${match[1]}`;
  }
  
  // Try parsing from msg field which might contain entity references
  if (result.msg || result.message) {
    const msg = result.msg || result.message;
    const match = String(msg).match(/#(\d+)/);
    if (match) return `#${match[1]}`;
  }
  
  return undefined;
}

/**
 * Extract entity type from various BuildingSmart result formats
 */
function extractEntityType(result: any): string | undefined {
  // Try direct fields first
  if (result.instance_type) return String(result.instance_type);
  if (result.instanceType) return String(result.instanceType);
  if (result.entity_type) return String(result.entity_type);
  if (result.entityType) return String(result.entityType);
  
  // Try parsing from 'On instance:' text if available
  if (result.instance_ref || result.on_instance) {
    const instanceText = result.instance_ref || result.on_instance;
    const match = instanceText.match(/#\d+=([A-Za-z0-9]+)/);
    if (match) return match[1];
  }
  
  // Try parsing from msg field
  if (result.msg || result.message) {
    const msg = result.msg || result.message;
    const match = String(msg).match(/\b(Ifc[A-Za-z0-9]+)\b/);
    if (match) return match[1];
  }
  
  return undefined;
}

/**
 * Get human-readable description for BuildingSmart outcome codes
 */
function getOutcomeDescription(outcomeCode: string, feature: string): string | null {
  // Map common outcome codes to descriptions
  const outcomeDescriptions: Record<string, string> = {
    'N00010': 'Not applicable - feature not used in file',
    'X00040': 'Feature validation failed',
    'X00010': 'Required feature missing',
    'X00020': 'Invalid feature implementation',
    'X00030': 'Feature constraint violation',
    'P00010': 'Feature passed validation',
  };

  const description = outcomeDescriptions[outcomeCode];
  if (description) {
    return description;
  }

  // Return generic description based on code prefix
  if (outcomeCode.startsWith('N')) return 'Not applicable or not checked';
  if (outcomeCode.startsWith('X')) return 'Validation failed';
  if (outcomeCode.startsWith('P')) return 'Passed validation';

  return null;
}

/**
 * Map BuildingSmart result to ValidationError
 */
function mapResultToError(
  result: any,
  index: number
): ValidationError {
  const severity = mapSeverity(result.severity);
  const type = mapFeatureToType(result.feature);

  // Extract message - build a comprehensive message
  let message = result.msg || result.message;

  if (!message && result.feature) {
    // Build message from feature and outcome
    message = `${result.feature}`;

    if (result.outcome_code) {
      const outcomeDesc = getOutcomeDescription(result.outcome_code, result.feature);
      if (outcomeDesc) {
        message = `${result.feature}: ${outcomeDesc} (${result.outcome_code})`;
      } else {
        message += ` (${result.outcome_code})`;
      }
    }
  }

  if (!message) {
    message = 'Validation issue detected';
  }

  // Extract entity information with fallback strategies
  const entityId = extractEntityId(result);
  const entityType = extractEntityType(result);

  // Extract property name
  const propertyName = result.attribute || result.property || result.propertyName;

  // Build detailed suggestion with all available context
  const suggestionParts: string[] = [];

  if (result.expected !== undefined && result.expected !== null) {
    suggestionParts.push(`Expected: ${JSON.stringify(result.expected)}`);
  }

  if (result.observed !== undefined && result.observed !== null) {
    suggestionParts.push(`Observed: ${JSON.stringify(result.observed)}`);
  }

  if (result.validation_task) {
    suggestionParts.push(`Task: ${result.validation_task}`);
  }

  if (result.feature_version) {
    suggestionParts.push(`Feature Version: ${result.feature_version}`);
  }

  // Add outcome code description if no suggestion yet
  if (suggestionParts.length === 0 && result.outcome_code) {
    const outcomeDesc = getOutcomeDescription(result.outcome_code, result.feature);
    if (outcomeDesc) {
      suggestionParts.push(outcomeDesc);
    }
  }

  // Log extraction for debugging (first 3 results)
  if (index < 3) {
    console.log(`BuildingSmart result [${index}]:`, {
      allFields: Object.keys(result),
      allValues: result,
      extracted: { entityId, entityType, propertyName, message },
      feature: result.feature,
      outcome_code: result.outcome_code,
      public_id: result.public_id,
      task_type: result.task_type, // DEBUG: Check if task_type is present
      validation_task_public_id: result.validation_task_public_id
    });
  }

  // Map to functional part
  const featureStr = result.feature ? String(result.feature) : '';
  const functionalPartTag = mapBuildingSmartFeatureToFunctionalPart(featureStr);
  const functionalPart = getFunctionalPart(functionalPartTag);

  // Build error object with all available API fields
  const error: ValidationError = {
    severity,
    type,
    code: generateCode(result.feature, index),
    message,
    entityId,
    entityType,
    propertyName,
    suggestion: suggestionParts.length > 0 ? suggestionParts.join(' | ') : undefined,
    functionalPart: functionalPartTag,
    functionalPartName: functionalPart?.name,
  };

  // Add additional API fields if available (enhancing error context)
  // These fields provide traceability back to the API response
  if (result.validation_task_public_id) {
    (error as any).validationTaskId = result.validation_task_public_id;
  }
  if (result.task_type) {
    (error as any).taskType = result.task_type; // NORMATIVE_IA, NORMATIVE_IP, INDUSTRY, etc.
  }
  if (result.feature_version !== undefined && result.feature_version !== null) {
    (error as any).featureVersion = result.feature_version;
  }
  if (result.outcome_code) {
    (error as any).outcomeCode = result.outcome_code;
  }
  if (result.public_id) {
    (error as any).outcomeId = result.public_id;
  }
  if (result.feature) {
    (error as any).feature = result.feature; // Full feature name like "BLT001 - Correct use..."
  }
  // Store raw expected/observed for better display formatting
  if (result.expected !== undefined && result.expected !== null) {
    (error as any).expectedValue = result.expected;
  }
  if (result.observed !== undefined && result.observed !== null) {
    (error as any).observedValue = result.observed;
  }
  // Store instance_public_id for entity identification
  if (result.instance_public_id !== undefined && result.instance_public_id !== null) {
    (error as any).instance_public_id = result.instance_public_id;
  }

  // Store complete raw message for schema interpreters
  // CRITICAL: The 'observed' field contains detailed violation messages for schema errors
  // including "Violated by:", "On instance:", entity IDs, GUIDs, etc.
  let rawMessage = result.msg || result.observed || result.expected;

  // Handle observed field which might be string or object
  if (!rawMessage && result.observed) {
    rawMessage = typeof result.observed === 'string'
      ? result.observed
      : JSON.stringify(result.observed);
  }

  if (rawMessage) {
    (error as any).rawMessage = rawMessage;

    // DEBUG: Log first 3 schema errors to verify message content
    if (index < 3 && type === 'SCHEMA_ERROR') {
      console.log(`[buildingsmartMapper] Schema error ${index}:`, {
        instance_public_id: result.instance_public_id,
        hasRawMessage: !!rawMessage,
        rawMessageLength: typeof rawMessage === 'string' ? rawMessage.length : 0,
        rawMessagePreview: typeof rawMessage === 'string' ? rawMessage.substring(0, 300) : JSON.stringify(rawMessage).substring(0, 300),
        feature: result.feature,
        hasObserved: !!result.observed,
        observedType: typeof result.observed,
      });
    }
  }

  return error;
}

/**
 * Categorize errors by type for the categorized tabs
 * IMPORTANT: For buildingSMART results:
 * - Only categorize schema entity_rule errors (into schemaErrors)
 * - Do NOT categorize normative Gherkin rules (SWE*, GRF*, SPS*, etc.)
 *   → They belong in Normative Rules / Industry Practices tabs (filtered by taskType)
 */
function categorizeErrors(errors: ValidationError[]) {
  const syntaxErrors: ValidationError[] = [];
  const schemaErrors: ValidationError[] = [];
  const headerErrors: ValidationError[] = [];
  const otherErrors: ValidationError[] = [];

  errors.forEach(error => {
    const anyError = error as any;

    // Check if this is a buildingSMART schema entity_rule
    // These should go into schemaErrors tab
    if (anyError.feature) {
      try {
        const parsed = JSON.parse(anyError.feature);
        if (parsed.type === 'entity_rule') {
          schemaErrors.push(error);
          return; // Categorized, skip further checks
        }
      } catch {
        // Not JSON, continue
      }
    }

    // Check if this is a buildingSMART normative/industry rule
    // These should NOT be categorized - they go to Normative/Industry tabs
    // Method 1: Check taskType if available
    if (anyError.taskType && ['NORMATIVE_IA', 'NORMATIVE_IP', 'INDUSTRY'].includes(anyError.taskType)) {
      // Skip categorization - will be shown in Normative/Industry tabs
      return;
    }

    // Method 2: Check feature format (fallback if taskType not set yet)
    // Normative/industry rules have features like "SWE001 - ...", "GRF003 - ...", "SPS002 - ..."
    if (anyError.feature && typeof anyError.feature === 'string') {
      const featureStr = anyError.feature;
      // Match pattern: ABC123 - Description
      if (/^[A-Z]{3}\d{3}\s+-/.test(featureStr)) {
        // This is a Gherkin rule with standard code format
        return; // Skip categorization
      }
    }

    // For non-buildingSMART errors or unknown types, categorize normally
    const typeLower = error.type.toLowerCase();
    const codeLower = error.code.toLowerCase();
    const messageLower = error.message.toLowerCase();

    // Check multiple indicators for better categorization
    if (
      typeLower.includes('syntax') ||
      codeLower.includes('syn') ||
      messageLower.includes('syntax')
    ) {
      syntaxErrors.push(error);
    } else if (
      typeLower.includes('header') ||
      codeLower.includes('hea') ||
      messageLower.includes('header') ||
      messageLower.includes('file header')
    ) {
      headerErrors.push(error);
    } else if (
      typeLower.includes('schema') ||
      typeLower.includes('property') ||
      typeLower.includes('reference') ||
      typeLower.includes('attribute') ||
      codeLower.includes('sch') ||
      codeLower.includes('pro') ||
      codeLower.includes('ref') ||
      error.propertyName || // Has property name = schema/property issue
      error.entityType // Has entity type = schema issue
    ) {
      schemaErrors.push(error);
    } else {
      otherErrors.push(error);
    }
  });

  return { syntaxErrors, schemaErrors, headerErrors, otherErrors };
}

/**
 * Map BuildingSmart API response to ValidationResult
 */
export function mapBuildingSmartToValidationResult(
  response: BuildingSmartResultsResponse
): ValidationResult {
  // Handle failed validation (case-insensitive)
  if (response.status?.toLowerCase() === 'failed') {
    const functionalPartTag = 'PJS'; // Project definition failure
    const functionalPart = getFunctionalPart(functionalPartTag);

    return {
      valid: false,
      schemaVersion: 'BuildingSMART API',
      syntaxErrors: [],
      schemaErrors: [],
      headerErrors: [],
      errors: [{
        severity: 'error',
        type: 'VALIDATION_FAILED',
        code: 'BS000',
        message: 'BuildingSMART validation service failed to process the file',
        functionalPart: functionalPartTag,
        functionalPartName: functionalPart?.name,
      }],
      warnings: [],
      info: [],
      stats: {
        totalErrors: 1,
        totalWarnings: 0,
        totalInfo: 0,
        checkedEntities: 0,
        checkedRelationships: 0,
        checkedProperties: 0,
        entityTypeCount: {},
        relationshipTypeCount: {},
        missingRequiredProperties: 0,
        invalidDataTypes: 0,
        brokenReferences: 0,
        circularReferences: 0,
      },
    };
  }

  // Map all results to ValidationError format
  const allMappedErrors = (response.outcome?.results || []).map(mapResultToError);

  // DEBUG: Log task type distribution
  console.log('\n=== TASK TYPE DISTRIBUTION ===');
  const taskTypeCount: Record<string, number> = {};
  allMappedErrors.forEach(e => {
    const taskType = (e as any).taskType || 'NONE';
    taskTypeCount[taskType] = (taskTypeCount[taskType] || 0) + 1;
  });
  console.log('Task types found in mapped errors:', taskTypeCount);
  console.log('Sample errors with taskType:', allMappedErrors.slice(0, 3).map(e => ({
    type: e.type,
    code: e.code,
    taskType: (e as any).taskType,
    feature: (e as any).feature
  })));
  console.log('==============================\n');

  // Log statistics about entity extraction
  const withEntity = allMappedErrors.filter(e => e.entityId || e.entityType).length;
  const total = allMappedErrors.length;
  console.log(`BuildingSmart entity extraction: ${withEntity}/${total} results have entity context`);
  
  if (withEntity === 0 && total > 0) {
    console.warn('⚠️ BuildingSmart did not provide entity context (instance_public_id is null). Entity references will not be available for navigation.');
  }

  // Categorize errors
  const { syntaxErrors, schemaErrors, headerErrors, otherErrors } = categorizeErrors(allMappedErrors);

  // DEBUG: Show what got categorized
  console.log('\n=== CATEGORIZATION RESULTS ===');
  console.log('Schema errors (entity_rule):', schemaErrors.length);
  console.log('Header errors:', headerErrors.length);
  console.log('Syntax errors:', syntaxErrors.length);
  console.log('Other errors:', otherErrors.length);
  console.log('Skipped (normative/industry):', allMappedErrors.length - schemaErrors.length - headerErrors.length - syntaxErrors.length - otherErrors.length);
  console.log('Sample header errors:', headerErrors.slice(0, 3).map(e => ({
    code: e.code,
    type: e.type,
    taskType: (e as any).taskType,
    feature: (e as any).feature
  })));
  console.log('===============================\n');

  // Separate by severity for legacy fields
  const errors = allMappedErrors.filter(e => e.severity === 'error');
  const warnings = allMappedErrors.filter(e => e.severity === 'warning');
  const info = allMappedErrors.filter(e => e.severity === 'info');

  const totalResults = response.outcome?.metadata?.result_set?.total || allMappedErrors.length;

  return {
    valid: errors.length === 0,
    schemaVersion: 'BuildingSMART API',
    syntaxErrors,
    schemaErrors,
    headerErrors,
    errors: [...errors, ...otherErrors.filter(e => e.severity === 'error')],
    warnings,
    info,
    stats: {
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      totalInfo: info.length,
      totalChecks: totalResults, // Total number of validation checks performed
      checkedEntities: 0, // BuildingSmart doesn't provide this granularity
      checkedRelationships: 0,
      checkedProperties: 0,
      entityTypeCount: {},
      relationshipTypeCount: {},
      missingRequiredProperties: schemaErrors.filter(e =>
        e.type === 'PROPERTY_ERROR' && e.severity === 'error'
      ).length,
      invalidDataTypes: schemaErrors.filter(e =>
        e.type === 'SCHEMA_ERROR' && e.severity === 'error'
      ).length,
      brokenReferences: schemaErrors.filter(e =>
        e.type === 'REFERENCE_ERROR' && e.severity === 'error'
      ).length,
      circularReferences: 0,
    },
  };
}
