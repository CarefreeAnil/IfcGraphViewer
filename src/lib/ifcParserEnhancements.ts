/**
 * IFC Parser Enhancement Module
 * Addresses comprehensive parser issues beyond just metadata filtering
 */

// Enhanced property extraction with proper normalization
export interface NormalizedEntity {
  expressId: number;
  type: string;
  properties: Record<string, any>;
  validationErrors: string[];
  validationWarnings: string[];
}

/**
 * Normalize web-ifc property values to standard format
 * Handles inconsistencies in how web-ifc returns data
 */
export function normalizePropertyValue(value: any, propertyName: string, entityType: string): any {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return undefined;
  }

  // Handle wrapped values (web-ifc sometimes wraps in { value: ... })
  if (typeof value === 'object' && value !== null && 'value' in value && Object.keys(value).length === 1) {
    return normalizePropertyValue(value.value, propertyName, entityType);
  }

  // Handle GlobalId and similar special properties
  if (propertyName === 'GlobalId' || propertyName === 'GlobalID') {
    if (typeof value === 'object' && value?.value) {
      return value.value;
    }
    return value;
  }

  // Handle boolean enums (web-ifc returns as { value: "true"/"false" })
  if (propertyName === 'HasOpenings' || propertyName.includes('Is') || propertyName.startsWith('Has')) {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '.T.';
    }
    if (typeof value === 'boolean') {
      return value;
    }
  }

  // Handle enums (.T., .F., or wrapped)
  if (typeof value === 'string' && value.match(/^\.(T|F|TRUE|FALSE)\./i)) {
    return value;
  }

  // Handle references (#123)
  if (typeof value === 'string' && value.startsWith('#')) {
    return value;
  }

  // Handle numeric values (but don't convert strings that look numeric unnecessarily)
  if (typeof value === 'number') {
    return value;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((v, idx) => normalizePropertyValue(v, `${propertyName}[${idx}]`, entityType)).filter(v => v !== undefined);
  }

  // Handle objects (nested entities)
  if (typeof value === 'object') {
    if ('expressID' in value) {
      // It's an entity reference
      return `#${value.expressID}`;
    }
    // Try to extract meaningful data
    if ('GlobalId' in value) {
      return value.GlobalId;
    }
    if ('value' in value) {
      return normalizePropertyValue(value.value, propertyName, entityType);
    }
    // Return as-is for complex objects
    return value;
  }

  // Return string values as-is
  if (typeof value === 'string') {
    return value;
  }

  return value;
}

/**
 * Complete property mapping for all common IFC entity types
 * Maps web-ifc property names to canonical IFC property names
 */
const PROPERTY_MAPPINGS: Record<string, Record<string, string>> = {
  // Spatial entities
  IFCPROJECT: {
    'Name': 'Name',
    'name': 'Name',
    'Description': 'Description',
    'description': 'Description',
    'Phase': 'Phase',
    'phase': 'Phase',
  },
  IFCSITE: {
    'Name': 'Name',
    'name': 'Name',
    'LongName': 'LongName',
    'longName': 'LongName',
    'RefLatitude': 'RefLatitude',
    'refLatitude': 'RefLatitude',
    'RefLongitude': 'RefLongitude',
    'refLongitude': 'RefLongitude',
    'RefElevation': 'RefElevation',
    'refElevation': 'RefElevation',
  },
  IFCBUILDING: {
    'Name': 'Name',
    'name': 'Name',
    'ElevationOfRefHeight': 'ElevationOfRefHeight',
    'elevationOfRefHeight': 'ElevationOfRefHeight',
    'ElevationOfTerrain': 'ElevationOfTerrain',
    'elevationOfTerrain': 'ElevationOfTerrain',
  },
  IFCBUILDINGSTOREY: {
    'Name': 'Name',
    'name': 'Name',
    'Elevation': 'Elevation',
    'elevation': 'Elevation',
  },
  IFCSPACE: {
    'Name': 'Name',
    'name': 'Name',
    'PredefinedType': 'PredefinedType',
    'predefinedType': 'PredefinedType',
    'LongName': 'LongName',
    'longName': 'LongName',
  },

  // Building elements
  IFCWALL: {
    'Name': 'Name',
    'name': 'Name',
    'PredefinedType': 'PredefinedType',
    'predefinedType': 'PredefinedType',
  },
  IFCDOOR: {
    'Name': 'Name',
    'name': 'Name',
    'OverallHeight': 'OverallHeight',
    'overallHeight': 'OverallHeight',
    'OverallWidth': 'OverallWidth',
    'overallWidth': 'OverallWidth',
  },
  IFCWINDOW: {
    'Name': 'Name',
    'name': 'Name',
    'OverallHeight': 'OverallHeight',
    'overallHeight': 'OverallHeight',
    'OverallWidth': 'OverallWidth',
    'overallWidth': 'OverallWidth',
  },
  IFCSLAB: {
    'Name': 'Name',
    'name': 'Name',
    'PredefinedType': 'PredefinedType',
    'predefinedType': 'PredefinedType',
  },
};

/**
 * Get canonical property name for an entity type and property
 */
export function getCanonicalPropertyName(entityType: string, propertyName: string): string {
  const entityMappings = PROPERTY_MAPPINGS[entityType];
  if (entityMappings) {
    return entityMappings[propertyName] || propertyName;
  }
  return propertyName;
}

/**
 * Enhanced entity extraction with validation
 */
export function extractAndValidateEntity(
  entity: any,
  entityType: string,
  expressId: number
): NormalizedEntity {
  const errors: string[] = [];
  const warnings: string[] = [];
  const properties: Record<string, any> = {};

  // Required properties for core entities
  const REQUIRED_PROPERTIES: Record<string, string[]> = {
    IFCPROJECT: ['Name', 'GlobalId'],
    IFCSITE: ['Name', 'GlobalId'],
    IFCBUILDING: ['Name', 'GlobalId'],
    IFCSPACE: ['Name', 'GlobalId'],
    IFCWALL: ['Name', 'GlobalId'],
    IFCDOOR: ['Name', 'GlobalId'],
    IFCWINDOW: ['Name', 'GlobalId'],
    IFCSLAB: ['Name', 'GlobalId'],
  };

  const requiredProps = REQUIRED_PROPERTIES[entityType] || [];

  for (const [key, value] of Object.entries(entity)) {
    // Skip system properties
    if (key === 'type' || key === 'expressID') {
      continue;
    }

    // Skip metadata properties
    if (['OwnerHistory', 'LastModifyingUser', 'CreationDate'].includes(key)) {
      continue;
    }

    // Normalize the property value
    const normalized = normalizePropertyValue(value, key, entityType);
    if (normalized !== undefined) {
      // Use canonical name
      const canonicalName = getCanonicalPropertyName(entityType, key);
      properties[canonicalName] = normalized;

      // Track if required property is missing
      if (requiredProps.includes(canonicalName) && !normalized) {
        errors.push(`Missing required property: ${canonicalName}`);
      }
    }
  }

  // Check for missing required properties
  for (const requiredProp of requiredProps) {
    if (!(requiredProp in properties)) {
      errors.push(`Missing required property: ${requiredProp}`);
    }
  }

  // Validate property types
  if (properties.Name && typeof properties.Name !== 'string') {
    warnings.push(`Name property is not a string: ${typeof properties.Name}`);
  }

  if (properties.GlobalId && typeof properties.GlobalId !== 'string') {
    warnings.push(`GlobalId property is not a string: ${typeof properties.GlobalId}`);
  }

  return {
    expressId,
    type: entityType,
    properties,
    validationErrors: errors,
    validationWarnings: warnings,
  };
}

/**
 * Detect IFC version from parsed entities
 */
export function detectIFCVersion(entities: any[]): string {
  // Check for IFC5-specific entities
  const hasIFC5Entities = entities.some((e) => {
    const type = e.type?.toUpperCase();
    return ['IFCBUNDLE', 'IFCCABLECARRIER'].includes(type);
  });
  if (hasIFC5Entities) return 'IFC5';

  // Check for IFC4x3-specific features
  const hasIFC4x3Features = entities.some((e) => {
    const type = e.type?.toUpperCase();
    return type?.includes('IFC4X3');
  });
  if (hasIFC4x3Features) return 'IFC4x3';

  // Check for IFC4-specific entities
  const hasIFC4Entities = entities.some((e) => {
    const type = e.type?.toUpperCase();
    return ['IFCSYSTEM', 'IFCGROUP'].includes(type);
  });
  if (hasIFC4Entities) return 'IFC4';

  // Default to IFC 2x3
  return 'IFC2x3';
}

/**
 * Complete relationship mapping for all IFC standard relationships
 */
export const COMPLETE_RELATIONSHIP_TYPES = [
  'IFCRELAGGREGATES',                    // Aggregates/composition
  'IFCRELCONTAINEDINSPATIALSTRUCTURE',   // Spatial containment
  'IFCRELDEFINESBYPROPERTIES',           // Property definition
  'IFCRELDEFINESBYTYPE',                 // Type definition
  'IFCRELVOIDSELEMENT',                  // Voids in elements
  'IFCRELFILLSELEMENT',                  // Fills in openings
  'IFCRELCONNECTSELEMENTS',              // Element connections
  'IFCRELCONNECTSSTRUCTURALEMEMBER',     // Structural connections
  'IFCRELASSOCIATES',                    // Associations
  'IFCRELASSOCIATESOBJECT',              // Object associations
  'IFCRELASSOCIATESAPPROVAL',            // Approval associations
  'IFCRELASSOCIATESCLASSIFICATION',      // Classification
  'IFCRELASSOCIATESMATERIAL',            // Material association
  'IFCRELASSOCIATESAPPLIEDVALUE',        // Value associations
  'IFCRELASSOCIATESDOCUMENT',            // Document association
  'IFCRELDECLARES',                      // Declarations
  'IFCRELASSIGNSTASKS',                  // Task assignments
  'IFCRELNESTS',                         // Nesting relationships
  'IFCRELSEQUENCE',                      // Sequence relationships
  'IFCRELINVOLVESASSIGNMENTS',           // Assignment involvement
  'IFCRELFLOWCONTROLELEMENTS',           // Flow control
];

/**
 * Entity type hierarchy (inheritance)
 * Helps with proper entity categorization
 */
export const ENTITY_HIERARCHY: Record<string, string[]> = {
  IFCROOT: ['IFCOBJECT', 'IFCPROPERTY', 'IFCPROPERTYABSTRACTION'],
  IFCOBJECT: ['IFCPRODUCT', 'IFCPROCESS', 'IFCCONTROL', 'IFCGROUP'],
  IFCPRODUCT: ['IFCELEMENT', 'IFCPORT', 'IFCSPATIALSTRUCTUREELEMENT'],
  IFCELEMENT: ['IFCBUILDINGELEMENT', 'IFCFEATUREELEMENT', 'IFCEQUIPMENTELEMENT'],
  IFCSPATIALSTRUCTUREELEMENT: ['IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY', 'IFCSPACE'],
  IFCBUILDINGELEMENT: ['IFCWALL', 'IFCDOOR', 'IFCWINDOW', 'IFCSLAB', 'IFCCOLUMN', 'IFCBEAM', 'IFCROOF', 'IFCSTAIR', 'IFCRAILING'],
};
