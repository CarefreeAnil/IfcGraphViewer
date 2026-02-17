/**
 * Automated Documentation Link Generator
 * Generates BuildingSMART schema documentation URLs dynamically for IFC entities
 * Eliminates need for manual hardcoding of docsUrl for each entity
 * 
 * Official BuildingSMART URL structure:
 * https://standards.buildingsmart.org/IFC/RELEASE/{VERSION}/HTML/link/{entity_lowercase}.htm
 */

/**
 * Generate a documentation URL for an IFC entity
 * Automatically constructs the BuildingSMART URL based on entity name and schema version
 * 
 * URL Patterns by version:
 * - IFC4: https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/link/{entity_lowercase}.htm
 * - IFC4X3: https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/{Entity}.htm
 * - IFC2x3: https://standards.buildingsmart.org/IFC/RELEASE/IFC2x3/TC1/HTML/{schema_section}/lexical/{entity_lowercase}.htm
 * 
 * @param entityName - The IFC entity name (e.g., 'IfcWall', 'IfcBridgePart')
 * @param schemaVersion - The IFC schema version (e.g., 'IFC4', 'IFC2x3', 'IFC4X3')
 * @returns The full URL to the entity's documentation on BuildingSMART website
 * 
 * @example
 * generateDocsUrl('IfcWall', 'IFC4')
 * // Returns: 'https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/link/ifcwall.htm'
 * 
 * generateDocsUrl('IfcBridgePart', 'IFC4X3')
 * // Returns: 'https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcBridgePart.htm'
 * 
 * generateDocsUrl('IfcWallStandardCase', 'IFC2x3')
 * // Returns: 'https://standards.buildingsmart.org/IFC/RELEASE/IFC2x3/TC1/HTML/ifcsharedbldgelements/lexical/ifcwallstandardcase.htm'
 */
export function generateDocsUrl(entityName: string, schemaVersion: string = 'IFC4'): string {
  const normalizedVersion = schemaVersion.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const entityLower = entityName.toLowerCase();
  
  console.log('[DocsLink] Generating URL for:', { entityName, schemaVersion, normalizedVersion });
  
  // IFC4X3 or IFC43 - uses /lexical/ with proper entity name casing
  if (normalizedVersion.includes('IFC4X3') || normalizedVersion.includes('IFC43')) {
    const url = `https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/${entityName}.htm`;
    console.log('[DocsLink] IFC4X3 URL:', url);
    return url;
  }
  
  // IFC2X3 - temporarily use IFC4 docs as fallback
  if (normalizedVersion.includes('IFC2X3')) {
    const url = `https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/link/${entityLower}.htm`;
    console.log('[DocsLink] IFC2x3 -> Using IFC4 URL as fallback:', url);
    return url;
  }
  
  // IFC4 or default - uses /link/ with lowercase entity name
  const url = `https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/link/${entityLower}.htm`;
  console.log('[DocsLink] IFC4 (default) URL:', url);
  return url;
}

/**
 * Get the schema section for an entity (needed for IFC2x3 format)
 */
function getSchemaSection(entityName: string): string {
  const lowerName = entityName.toLowerCase();
  
  // Common mappings for IFC2x3
  if (lowerName.startsWith('ifcwall')) return 'ifcsharedbldgelements';
  if (lowerName.startsWith('ifcdoor')) return 'ifcsharedbldgelements';
  if (lowerName.startsWith('ifcwindow')) return 'ifcsharedbldgelements';
  if (lowerName.startsWith('ifcslab')) return 'ifcsharedbldgelements';
  if (lowerName.startsWith('ifccolumn')) return 'ifcsharedbldgelements';
  if (lowerName.startsWith('ifcbeam')) return 'ifcsharedbldgelements';
  if (lowerName.startsWith('ifcroof')) return 'ifcsharedbldgelements';
  if (lowerName.startsWith('ifcstair')) return 'ifcsharedbldgelements';
  if (lowerName.startsWith('ifcopeningelement')) return 'ifcproductextension';
  if (lowerName.startsWith('ifcbuilding')) return 'ifcproductextension';
  if (lowerName.startsWith('ifcsite')) return 'ifcproductextension';
  if (lowerName.startsWith('ifcspace')) return 'ifcproductextension';
  if (lowerName.startsWith('ifcrel')) return 'ifckernel';
  if (lowerName.startsWith('ifctype')) return 'ifckernel';
  if (lowerName.startsWith('ifcproperty')) return 'ifckernel';
  if (lowerName.startsWith('ifcmaterial')) return 'ifcmaterialresource';
  if (lowerName.startsWith('ifcgeometric') || lowerName.startsWith('ifccartesian')) return 'ifcgeometryresource';
  
  // Default
  return 'ifckernel';
}

/**
 * Generate docs URL for an entity based on detected schema version
 * Attempts to infer schema version from context
 * 
 * @param entityName - The IFC entity name
 * @param detectedVersion - Optional detected schema version from model
 * @returns The full URL to the entity's documentation
 */
export function generateDocsUrlForEntity(entityName: string, detectedVersion?: string): string {
  return generateDocsUrl(entityName, detectedVersion || 'IFC4');
}

/**
 * Update the mapping with custom entries if needed
 * Useful if you discover entities that should be in different sections
 * 
 * @param updates - Record of entity name to schema section mappings
 */
export function updateSchemaSectionMapping(updates: Record<string, string>): void {
  // No longer needed with /link/ URL structure, but kept for backwards compatibility
  console.warn('updateSchemaSectionMapping is deprecated - URL structure no longer requires schema section mapping');
}

export default {
  generateDocsUrl,
  generateDocsUrlForEntity,
  updateSchemaSectionMapping,
};
