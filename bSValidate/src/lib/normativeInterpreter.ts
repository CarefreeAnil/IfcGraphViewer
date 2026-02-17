/**
 * Normative Rules Interpreter
 * Extracts entity IDs, types, and other details from buildingSMART normative rule results
 */

import { ValidationError } from '../../../src/lib/ifcValidatorEnhanced';

export interface ExtractedEntityInfo {
  stepIds: string[];        // e.g., ["#29928", "#34576"]
  entityTypes: string[];    // e.g., ["IfcProductDefinitionShape", "IfcMaterialList"]
  hasEntityInfo: boolean;
}

/**
 * Extract entity information from normative rule observed/expected fields
 * These fields often contain objects like:
 *   { "instance": "IfcProductDefinitionShape(#29928)" }
 *   { "value": ["IfcMaterialList(#34576)", "IfcMaterialList(#34878)"] }
 */
export function extractNormativeEntityInfo(error: ValidationError): ExtractedEntityInfo {
  const anyError = error as any;
  const stepIds: string[] = [];
  const entityTypes: string[] = [];

  // Check observed field
  if (anyError.observedValue) {
    extractFromField(anyError.observedValue, stepIds, entityTypes);
  }

  // Check expected field
  if (anyError.expectedValue) {
    extractFromField(anyError.expectedValue, stepIds, entityTypes);
  }

  // Also check rawMessage if available (similar to schema)
  if (anyError.rawMessage && typeof anyError.rawMessage === 'string') {
    const extractedFromMessage = extractFromString(anyError.rawMessage);
    stepIds.push(...extractedFromMessage.stepIds);
    entityTypes.push(...extractedFromMessage.entityTypes);
  }

  // Deduplicate
  const uniqueStepIds = [...new Set(stepIds)];
  const uniqueEntityTypes = [...new Set(entityTypes)];

  return {
    stepIds: uniqueStepIds,
    entityTypes: uniqueEntityTypes,
    hasEntityInfo: uniqueStepIds.length > 0 || uniqueEntityTypes.length > 0
  };
}

/**
 * Extract from a field (can be string, object, or array)
 */
function extractFromField(field: any, stepIds: string[], entityTypes: string[]) {
  if (!field) return;

  // Handle string values
  if (typeof field === 'string') {
    const extracted = extractFromString(field);
    stepIds.push(...extracted.stepIds);
    entityTypes.push(...extracted.entityTypes);
    return;
  }

  // Handle objects with specific patterns
  if (typeof field === 'object') {
    // Pattern: { "instance": "IfcProductDefinitionShape(#29928)" }
    if (field.instance && typeof field.instance === 'string') {
      const extracted = extractFromString(field.instance);
      stepIds.push(...extracted.stepIds);
      entityTypes.push(...extracted.entityTypes);
    }

    // Pattern: { "value": ["IfcMaterialList(#34576)", ...] }
    if (field.value && Array.isArray(field.value)) {
      field.value.forEach((item: any) => {
        if (typeof item === 'string') {
          const extracted = extractFromString(item);
          stepIds.push(...extracted.stepIds);
          entityTypes.push(...extracted.entityTypes);
        }
      });
    }

    // Pattern: { "schema_identifier": "..." }
    // This doesn't contain entity info, skip

    // Pattern: { "oneOf": [...] }
    // This is expected values list, might contain entities
    if (field.oneOf && Array.isArray(field.oneOf)) {
      field.oneOf.forEach((item: any) => {
        if (typeof item === 'string') {
          const extracted = extractFromString(item);
          stepIds.push(...extracted.stepIds);
          entityTypes.push(...extracted.entityTypes);
        }
      });
    }
  }

  // Handle arrays
  if (Array.isArray(field)) {
    field.forEach((item: any) => {
      extractFromField(item, stepIds, entityTypes);
    });
  }
}

/**
 * Extract StepIDs and entity types from a string
 * Examples:
 *   "IfcProductDefinitionShape(#29928)" → #29928, IfcProductDefinitionShape
 *   "IfcMaterialList(#34576)" → #34576, IfcMaterialList
 */
function extractFromString(str: string): { stepIds: string[]; entityTypes: string[] } {
  const stepIds: string[] = [];
  const entityTypes: string[] = [];

  if (!str) return { stepIds, entityTypes };

  // Extract pattern: EntityType(#12345)
  // Example: IfcProductDefinitionShape(#29928)
  const entityPattern = /(Ifc[A-Za-z0-9_]+)\s*\(\s*#(\d+)\s*\)/g;
  let match;

  while ((match = entityPattern.exec(str)) !== null) {
    const entityType = match[1];
    const stepId = `#${match[2]}`;

    entityTypes.push(entityType);
    stepIds.push(stepId);
  }

  // Also extract standalone StepIDs: #12345
  const stepIdPattern = /#(\d+)/g;
  while ((match = stepIdPattern.exec(str)) !== null) {
    const stepId = `#${match[1]}`;
    if (!stepIds.includes(stepId)) {
      stepIds.push(stepId);
    }
  }

  return { stepIds, entityTypes };
}

/**
 * Format entity info for display
 */
export function formatEntityInfo(info: ExtractedEntityInfo): string {
  if (!info.hasEntityInfo) return '';

  const parts: string[] = [];

  if (info.entityTypes.length > 0) {
    parts.push(info.entityTypes.slice(0, 3).join(', '));
    if (info.entityTypes.length > 3) {
      parts[parts.length - 1] += ` (+${info.entityTypes.length - 3} more)`;
    }
  }

  if (info.stepIds.length > 0 && info.stepIds.length <= 5) {
    parts.push(info.stepIds.join(', '));
  } else if (info.stepIds.length > 5) {
    parts.push(`${info.stepIds.length} entities`);
  }

  return parts.join(' • ');
}
