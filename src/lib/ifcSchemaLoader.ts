/**
 * IFC Schema Loader - Loads pre-processed JSON schemas
 * Uses schema-ifc2x3.json, IFC4.json, IFC4X3.json generated from .exp files
 */

export interface SchemaProperty {
  name: string;
  type_name: string;
  cardinality: string | null;
  is_optional: boolean;
  is_unique: boolean;
  is_inverse: boolean;
}

export interface SchemaEntity {
  name: string;
  is_abstract: boolean;
  supertype: string | null;
  subtypes: string[];
  attributes: SchemaProperty[];
  where_rules?: any;
}

export interface SchemaFile {
  schema?: string;
  version: string;
  entities: Record<string, SchemaEntity>;
  entity_count: number;
}

// Cache loaded schemas
let ifc2x3Schema: SchemaFile | null = null;
let ifc4Schema: SchemaFile | null = null;
let ifc4x3Schema: SchemaFile | null = null;

/**
 * Load schema file dynamically
 */
async function loadSchemaFile(path: string): Promise<SchemaFile> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load schema from ${path}`);
  }
  return await response.json();
}

/**
 * Find entity key in schema by case-insensitive match
 */
function findEntityKeyInSchema(schema: SchemaFile, entityName: string): string | undefined {
  const upperName = entityName.toUpperCase();
  // Find key that matches case-insensitively
  return Object.keys(schema.entities).find(key => key.toUpperCase() === upperName);
}

/**
 * Load only specific entities from schema (not all 746/846)
 * Includes supertypes for complete attribute validation
 */
export async function loadSpecificEntities(entityNames: string[], schemaVersion: string): Promise<Map<string, SchemaEntity>> {
  const schema = getSchema(schemaVersion);
  if (!schema) {
    // Schema not loaded yet, need to load it
    await ensureSchemaLoaded(schemaVersion);
  }
  
  const fullSchema = getSchema(schemaVersion);
  if (!fullSchema) {
    console.error('[Schema Loader] Failed to load schema for', schemaVersion);
    return new Map();
  }
  
  const entityMap = new Map<string, SchemaEntity>();
  const processed = new Set<string>();
  
  // Recursively load entities and their supertypes
  const loadWithSupertypes = (entityName: string) => {
    const actualKey = findEntityKeyInSchema(fullSchema, entityName);
    if (!actualKey || processed.has(actualKey)) {
      return;
    }
    processed.add(actualKey);
    
    const entity = fullSchema.entities[actualKey];
    if (!entity) return;
    
    entityMap.set(actualKey, entity);
    
    // Load supertype if exists
    if (entity.supertype) {
      loadWithSupertypes(entity.supertype);
    }
  };
  
  // Load all file entities and their supertypes
  entityNames.forEach(name => loadWithSupertypes(name));
  
  console.log(`[Schema Loader] Loaded ${entityMap.size} entities (including supertypes) from ${Object.keys(fullSchema.entities).length} in schema`);
  return entityMap;
}

/**
 * Load only the schema for the specified version (lazy loading)
 */
export async function ensureSchemaLoaded(version: string): Promise<void> {
  const normalized = version.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  if (normalized.includes('IFC4X3') || normalized.includes('IFC4X3ADD')) {
    if (!ifc4x3Schema) {
      ifc4x3Schema = await loadSchemaFile('/schemas/IFC4X3.json');
      console.log('[Schema Loader] Loaded IFC4X3:', ifc4x3Schema.entity_count, 'entities');
    }
  } else if (normalized.includes('IFC4')) {
    if (!ifc4Schema) {
      ifc4Schema = await loadSchemaFile('/schemas/IFC4.json');
      console.log('[Schema Loader] Loaded IFC4:', ifc4Schema.entity_count, 'entities');
    }
  } else {
    // Default to IFC2X3
    if (!ifc2x3Schema) {
      ifc2x3Schema = await loadSchemaFile('/schemas/schema-ifc2x3.json');
      console.log('[Schema Loader] Loaded IFC2X3:', ifc2x3Schema.entity_count, 'entities');
    }
  }
}

/**
 * Get schema by version
 */
export function getSchema(version: string): SchemaFile | null {
  const normalized = version.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  if (normalized.includes('IFC4X3') || normalized.includes('IFC4X3ADD')) {
    return ifc4x3Schema;
  }
  
  if (normalized.includes('IFC4')) {
    return ifc4Schema;
  }
  
  // Default to IFC2X3
  return ifc2x3Schema;
}

/**
 * Get entity definition from schema (async-safe)
 */
export async function getEntityFromSchemaAsync(entityName: string, schemaVersion: string): Promise<SchemaEntity | undefined> {
  await ensureSchemaLoaded(schemaVersion);
  const schema = getSchema(schemaVersion);
  if (!schema) return undefined;
  const actualKey = findEntityKeyInSchema(schema, entityName);
  return actualKey ? schema.entities[actualKey] : undefined;
}

/**
 * Get all attributes for an entity including inherited ones from supertypes
 */
export async function getAllAttributesAsync(entityName: string, schemaVersion: string): Promise<SchemaProperty[]> {
  await ensureSchemaLoaded(schemaVersion);
  const schema = getSchema(schemaVersion);
  if (!schema) return [];
  
  const attributes: SchemaProperty[] = [];
  const visited = new Set<string>();
  
  const collectAttributes = (name: string) => {
    const actualKey = findEntityKeyInSchema(schema, name);
    if (!actualKey || visited.has(actualKey)) return;
    visited.add(actualKey);
    
    const entity = schema.entities[actualKey];
    if (!entity) return;
    
    // Collect attributes from this entity
    attributes.push(...entity.attributes);
    
    // Recursively collect from supertype
    if (entity.supertype) {
      collectAttributes(entity.supertype);
    }
  };
  
  collectAttributes(entityName);
  return attributes;
}

/**
 * Get entity definition from schema (sync - may return undefined if not loaded)
 */
export function getEntityFromSchema(entityName: string, schemaVersion: string): SchemaEntity | undefined {
  const schema = getSchema(schemaVersion);
  if (!schema) return undefined;
  const actualKey = findEntityKeyInSchema(schema, entityName);
  return actualKey ? schema.entities[actualKey] : undefined;
}

/**
 * Get all entity names from schema
 */
export function getAllEntityNames(schemaVersion: string): string[] {
  const schema = getSchema(schemaVersion);
  if (!schema) return [];
  return Object.keys(schema.entities);
}

/**
 * Check if entity exists in schema
 */
export function entityExistsInSchema(entityName: string, schemaVersion: string): boolean {
  const schema = getSchema(schemaVersion);
  if (!schema) return false;
  const actualKey = findEntityKeyInSchema(schema, entityName);
  return actualKey !== undefined;
}

/**
 * Get required attributes for an entity
 */
export function getRequiredAttributes(entityName: string, schemaVersion: string): SchemaProperty[] {
  const entity = getEntityFromSchema(entityName, schemaVersion);
  if (!entity) return [];
  return entity.attributes.filter(attr => !attr.is_optional);
}
