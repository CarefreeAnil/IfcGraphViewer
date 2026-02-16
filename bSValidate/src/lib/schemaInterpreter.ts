/**
 * Schema Error Interpreter - Diagnostic Only
 * Translates raw EXPRESS validation into human-understandable BIM issues
 * Philosophy: Diagnose what's wrong, don't prescribe workflow
 */

import { ValidationError } from '../../../src/lib/ifcValidatorEnhanced';

export interface InterpretedSchemaError {
  // Original data
  originalMessage: string;
  ruleAttribute: string;
  entityId: string;
  entityType: string;

  // Parsed violation details
  violationSummary: string;
  expectedValue?: string | number;
  actualValue?: string | number;
  involvedEntities: string[];

  // Diagnostic interpretation (not prescriptive)
  diagnosis: string;
  technicalContext: string;

  // Visualization data
  affectedElement: {
    id: string;
    type: string;
    name?: string;
    guid?: string;
  };
  relatedElements: Array<{
    id: string;
    type: string;
    relationship: string;
  }>;
}

/**
 * Parse buildingSMART violation message to extract structured data
 */
function parseViolationMessage(message: string): {
  violation: string;
  entities: string[];
  instanceDetails: string;
} {
  let violation = '';
  let entities: string[] = [];
  let instanceDetails = '';

  if (!message) {
    return { violation, entities, instanceDetails };
  }

  // Extract "Violated by:" section - can be multi-line
  const violatedMatch = message.match(/Violated by:\s*\(([^)]+)\)/);
  if (violatedMatch) {
    violation = violatedMatch[0]; // Keep full "Violated by:" text
  }

  // Extract all StepIDs (#12345) - get unique IDs
  const stepIds = message.match(/#\d+/g);
  if (stepIds) {
    entities = [...new Set(stepIds)]; // Deduplicate
  }

  // Extract "On instance:" section - everything after this marker
  const instanceMatch = message.match(/On instance:\s*(.+)/s);
  if (instanceMatch) {
    instanceDetails = instanceMatch[1].trim();
  }

  return { violation, entities, instanceDetails };
}

/**
 * Parse instance details to extract entity information
 * Format: #131363=IfcSlab('0LKJKCHUL1kBtnlFXddz6a',#42,'Basic Roof:Warm Roof - Timber:724430',...)
 */
function parseInstanceDetails(instanceStr: string): {
  id: string;
  type: string;
  guid?: string;
  name?: string;
} {
  const result: any = {
    id: '',
    type: '',
  };

  if (!instanceStr) return result;

  // Extract StepID and Type: #12345=IfcSlab(...)
  // More flexible regex to handle variations
  const match = instanceStr.match(/#(\d+)\s*=\s*([A-Za-z0-9_]+)\s*\(/);
  if (match) {
    result.id = `#${match[1]}`;
    result.type = match[2];

    // Extract everything inside parentheses
    const paramsMatch = instanceStr.match(/\((.+)\)$/s);
    if (paramsMatch) {
      const params = paramsMatch[1];

      // First parameter is typically GUID - look for 22-character IFC GUID pattern
      const allStrings = params.match(/'([^']*)'/g);
      if (allStrings && allStrings.length > 0) {
        // First string - check if it's a GUID (22 chars)
        const firstString = allStrings[0].replace(/'/g, '');
        if (firstString.length === 22) {
          result.guid = firstString;
        }

        // Look for name pattern (contains colons) - typically the 3rd or 4th string
        for (const str of allStrings) {
          const cleaned = str.replace(/'/g, '');
          if (cleaned.includes(':') && cleaned !== result.guid) {
            result.name = cleaned;
            break;
          }
        }
      }
    }
  }

  return result;
}

/**
 * Interpret MaxOneMaterialAssociation rule failure
 * Example: Element has multiple material associations when only one is allowed
 */
function interpretMaxOneMaterialAssociation(
  error: any,
  message: string,
  ruleLogic?: string
): Partial<InterpretedSchemaError> {
  console.log('[schemaInterpreter] MaxOneMaterialAssociation:', {
    hasRawMessage: !!error.rawMessage,
    messageLength: message?.length || 0,
    messagePreview: message?.substring(0, 200),
    hasInstancePublicId: !!error.instance_public_id,
    instance_public_id: error.instance_public_id
  });

  const parsed = parseViolationMessage(message);
  const instanceDetails = parseInstanceDetails(parsed.instanceDetails);

  console.log('[schemaInterpreter] Parsed data:', {
    violation: parsed.violation,
    entities: parsed.entities,
    instanceDetails: instanceDetails
  });

  // Fallback: If parsing failed, use error object fields
  if (!instanceDetails.id && error.instance_public_id) {
    console.log('[schemaInterpreter] Using fallback instance_public_id:', error.instance_public_id);
    instanceDetails.id = error.instance_public_id.startsWith('i')
      ? `#${error.instance_public_id.substring(1)}`
      : error.instance_public_id.startsWith('#')
      ? error.instance_public_id
      : `#${error.instance_public_id}`;
  }

  // Extract count from violation: (2 <= 1) means actual=2, expected=1
  const countMatch = parsed.violation.match(/\((\d+)\s*<=\s*(\d+)\)/);
  const actualCount = countMatch ? parseInt(countMatch[1]) : 0;
  const expectedCount = 1;

  // Extract material relationship StepIDs (exclude the main instance ID)
  const materialRels = parsed.entities.filter(
    (id) => id !== instanceDetails.id
  );

  // Build diagnostic message - simple, factual, not prescriptive
  let elementDesc = '';
  if (instanceDetails.type) {
    if (instanceDetails.guid && instanceDetails.id) {
      elementDesc = `${instanceDetails.type} (GUID: ${instanceDetails.guid}, ${instanceDetails.id})`;
    } else if (instanceDetails.id) {
      elementDesc = `${instanceDetails.type} ${instanceDetails.id}`;
    } else {
      elementDesc = instanceDetails.type;
    }
  } else if (instanceDetails.id) {
    elementDesc = `element ${instanceDetails.id}`;
  } else {
    elementDesc = 'building element';
  }

  const diagnosis = `The IFC schema allows a building element (wall, slab, beam, roof, etc.) to be linked to only one material definition. The ${elementDesc} is linked to ${actualCount} material relationship${actualCount !== 1 ? 's' : ''}${materialRels.length > 0 ? `: ${materialRels.join(', ')}` : ''}`;

  const result = {
    diagnosis,
    expectedValue: expectedCount,
    actualValue: actualCount,
    violationSummary: `Expected ${expectedCount}, found ${actualCount}`,
    technicalContext: `EXPRESS Rule: ${ruleLogic || 'sizeof([...]) <= 1'}
${parsed.violation}
${parsed.instanceDetails || message}`,
    affectedElement: instanceDetails,
    relatedElements: materialRels.map((id) => ({
      id,
      type: 'IfcRelAssociatesMaterial',
      relationship: 'material association',
    })),
  };

  console.log('[schemaInterpreter] Returning interpretation:', {
    entityId: result.affectedElement.id,
    entityType: result.affectedElement.type,
    guid: result.affectedElement.guid,
    relatedElements: result.relatedElements.length,
    diagnosisLength: result.diagnosis.length,
  });

  return result;
}

/**
 * Interpret UniqueQuantityNames rule failure
 * Example: Quantity set has duplicate quantity names
 */
function interpretUniqueQuantityNames(
  error: any,
  message: string,
  ruleLogic?: string
): Partial<InterpretedSchemaError> {
  const parsed = parseViolationMessage(message);
  const instanceDetails = parseInstanceDetails(parsed.instanceDetails);

  // Fallback to error object
  if (!instanceDetails.id && error.instance_public_id) {
    instanceDetails.id = error.instance_public_id.startsWith('i')
      ? `#${error.instance_public_id.substring(1)}`
      : error.instance_public_id.startsWith('#')
      ? error.instance_public_id
      : `#${error.instance_public_id}`;
  }

  let elementDesc = '';
  if (instanceDetails.type) {
    if (instanceDetails.guid && instanceDetails.id) {
      elementDesc = `${instanceDetails.type} (GUID: ${instanceDetails.guid}, ${instanceDetails.id})`;
    } else if (instanceDetails.id) {
      elementDesc = `${instanceDetails.type} ${instanceDetails.id}`;
    } else {
      elementDesc = instanceDetails.type;
    }
  } else if (instanceDetails.id) {
    elementDesc = `element ${instanceDetails.id}`;
  } else {
    elementDesc = 'quantity set';
  }

  const diagnosis = `The IFC schema requires all quantity names within a quantity set to be unique. The ${elementDesc} contains duplicate quantity identifiers`;

  return {
    diagnosis,
    technicalContext: `EXPRESS Rule: ${ruleLogic || 'Quantity names must be unique'}
${message}`,
    affectedElement: instanceDetails,
    relatedElements: [],
  };
}

/**
 * Interpret UniquePropertySetNames rule failure
 * Example: Element has duplicate property set names
 */
function interpretUniquePropertySetNames(
  error: any,
  message: string,
  ruleLogic?: string
): Partial<InterpretedSchemaError> {
  const parsed = parseViolationMessage(message);
  const instanceDetails = parseInstanceDetails(parsed.instanceDetails);

  // Fallback to error object
  if (!instanceDetails.id && error.instance_public_id) {
    instanceDetails.id = error.instance_public_id.startsWith('i')
      ? `#${error.instance_public_id.substring(1)}`
      : error.instance_public_id.startsWith('#')
      ? error.instance_public_id
      : `#${error.instance_public_id}`;
  }

  let elementDesc = '';
  if (instanceDetails.type) {
    if (instanceDetails.guid && instanceDetails.id) {
      elementDesc = `${instanceDetails.type} (GUID: ${instanceDetails.guid}, ${instanceDetails.id})`;
    } else if (instanceDetails.id) {
      elementDesc = `${instanceDetails.type} ${instanceDetails.id}`;
    } else {
      elementDesc = instanceDetails.type;
    }
  } else if (instanceDetails.id) {
    elementDesc = `element ${instanceDetails.id}`;
  } else {
    elementDesc = 'entity';
  }

  const diagnosis = `The IFC schema requires all property set names on an element to be unique. The ${elementDesc} has duplicate property set assignments`;

  return {
    diagnosis,
    technicalContext: `EXPRESS Rule: ${ruleLogic || 'Property set names must be unique'}
${message}`,
    affectedElement: instanceDetails,
    relatedElements: [],
  };
}

/**
 * Generic interpreter for unknown rules - factual diagnosis
 */
function interpretGeneric(
  error: any,
  message: string,
  ruleAttribute: string,
  ruleLogic?: string
): Partial<InterpretedSchemaError> {
  const parsed = parseViolationMessage(message);
  const instanceDetails = parseInstanceDetails(parsed.instanceDetails);

  // Fallback to error object
  if (!instanceDetails.id && error.instance_public_id) {
    instanceDetails.id = error.instance_public_id.startsWith('i')
      ? `#${error.instance_public_id.substring(1)}`
      : error.instance_public_id.startsWith('#')
      ? error.instance_public_id
      : `#${error.instance_public_id}`;
  }

  // Extract just the rule name without full path
  const ruleName = ruleAttribute.split('.').pop() || ruleAttribute;

  let elementDesc = '';
  if (instanceDetails.type) {
    if (instanceDetails.guid && instanceDetails.id) {
      elementDesc = `${instanceDetails.type} (GUID: ${instanceDetails.guid}, ${instanceDetails.id})`;
    } else if (instanceDetails.id) {
      elementDesc = `${instanceDetails.type} ${instanceDetails.id}`;
    } else {
      elementDesc = instanceDetails.type;
    }
  } else if (instanceDetails.id) {
    elementDesc = `Entity ${instanceDetails.id}`;
  } else {
    elementDesc = 'An entity';
  }

  const diagnosis = `${elementDesc} violates the IFC schema rule "${ruleName}"${parsed.violation ? `: ${parsed.violation}` : ''}`;

  return {
    diagnosis,
    technicalContext: `EXPRESS Rule: ${ruleLogic || ruleAttribute}
${message}`,
    affectedElement: instanceDetails,
    relatedElements: parsed.entities
      .filter((id) => id !== instanceDetails.id)
      .map((id) => ({
        id,
        type: 'Related Entity',
        relationship: 'referenced in violation',
      })),
  };
}

/**
 * Main interpretation function - routes to specific interpreter
 */
export function interpretSchemaError(
  error: ValidationError,
  ruleLogic?: string
): InterpretedSchemaError {
  const anyError = error as any;
  // Prefer rawMessage from buildingSMART API which contains full violation details
  const message = anyError.rawMessage || error.message || '';

  // Extract rule attribute from feature JSON
  let ruleAttribute = '';
  try {
    const parsed = JSON.parse(anyError.feature || '{}');
    ruleAttribute = parsed.attribute || '';
  } catch {
    // Not JSON, try to extract from feature string
    const featureStr = anyError.feature || error.code || '';
    if (featureStr.includes(' - ')) {
      const parts = featureStr.split(' - ');
      ruleAttribute = parts[1] || parts[0];
    } else {
      ruleAttribute = featureStr;
    }
  }

  // Route to specific interpreter based on rule - pass error object for fallback
  let interpretation: Partial<InterpretedSchemaError> = {};

  if (ruleAttribute.includes('MaxOneMaterialAssociation')) {
    interpretation = interpretMaxOneMaterialAssociation(anyError, message, ruleLogic);
  } else if (ruleAttribute.includes('UniqueQuantityNames')) {
    interpretation = interpretUniqueQuantityNames(anyError, message, ruleLogic);
  } else if (ruleAttribute.includes('UniquePropertySetNames')) {
    interpretation = interpretUniquePropertySetNames(anyError, message, ruleLogic);
  } else {
    interpretation = interpretGeneric(anyError, message, ruleAttribute, ruleLogic);
  }

  // Build complete result with defaults and fallbacks
  const affectedElement = interpretation.affectedElement || {
    id: anyError.instance_public_id
      ? (anyError.instance_public_id.startsWith('i')
          ? `#${anyError.instance_public_id.substring(1)}`
          : anyError.instance_public_id.startsWith('#')
          ? anyError.instance_public_id
          : `#${anyError.instance_public_id}`)
      : error.entityId || '',
    type: error.entityType || '',
  };

  return {
    originalMessage: message,
    ruleAttribute,
    entityId: affectedElement.id,
    entityType: affectedElement.type,
    violationSummary: interpretation.violationSummary || '',
    expectedValue: interpretation.expectedValue,
    actualValue: interpretation.actualValue,
    involvedEntities: interpretation.relatedElements?.map((r) => r.id) || [],
    diagnosis: interpretation.diagnosis || message,
    technicalContext: interpretation.technicalContext || message,
    affectedElement,
    relatedElements: interpretation.relatedElements || [],
  };
}

/**
 * Get short summary for quick display
 */
export function getShortSummary(interpreted: InterpretedSchemaError): string {
  if (interpreted.violationSummary) {
    return interpreted.violationSummary;
  }

  // Extract first sentence from diagnosis
  const firstSentence = interpreted.diagnosis.split('.')[0];
  return firstSentence;
}

/**
 * Get emoji indicator for rule type
 */
export function getRuleTypeEmoji(ruleAttribute: string): string {
  if (ruleAttribute.includes('Material')) return '🧱';
  if (ruleAttribute.includes('Quantity')) return '📏';
  if (ruleAttribute.includes('Property')) return '📋';
  if (ruleAttribute.includes('Relationship')) return '🔗';
  if (ruleAttribute.includes('Name') || ruleAttribute.includes('Unique')) return '🏷️';
  if (ruleAttribute.includes('Spatial')) return '🏗️';
  if (ruleAttribute.includes('Geometry')) return '📐';
  return '⚠️';
}
