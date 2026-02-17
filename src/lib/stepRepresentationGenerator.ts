/**
 * Lazy STEP Representation Generator
 * 
 * This module provides on-demand STEP representation generation for IFC entities
 * instead of generating them at parse time (which was the bottleneck)
 */

import * as WebIFC from 'web-ifc';

/**
 * Generates STEP representation for an entity
 * This is called lazily when user expands entity in tree browser
 * NOT during initial parsing for performance
 * 
 * @param typeName - IFC entity type (e.g., 'IFCWALL')
 * @param entity - The raw entity object from WebIFC
 * @param ifcApi - WebIFC API instance (optional, for fallback reconstruction)
 * @param modelId - Model ID (optional, for fallback reconstruction)
 * @param rawStepLine - Raw STEP line from file (preferred if available)
 * @returns Formatted STEP representation
 */
export function generateSTEPRepresentation(
  typeName: string,
  entity: any,
  rawStepLine?: string,
  ifcApi?: WebIFC.IfcAPI,
  modelId?: number
): string {
  // Priority 1: Use raw STEP line from file if available
  // This is exact and fast
  if (rawStepLine) {
    return rawStepLine;
  }
  
  // Priority 2: Geometry entities - use lightweight placeholder
  if (isGeometryType(typeName)) {
    return `#${entity?.expressID || '?'}= ${typeName}(...)`;
  }
  
  // Priority 3: Reconstruct from entity object
  // This is expensive but only done on-demand
  try {
    return reconstructIFCStepFormat(typeName, entity);
  } catch (err) {
    // Fallback if reconstruction fails
    return `#${entity?.expressID || '?'}= ${typeName}(...)`;
  }
}

/**
 * Reconstructs IFC STEP format from entity object
 * Called only when user needs full STEP representation
 */
function reconstructIFCStepFormat(typeName: string, entity: any): string {
  try {
    const expressId = entity.expressID;
    const params: string[] = [];
    
    // Iterate through properties
    for (const [key, value] of Object.entries(entity)) {
      if (key === 'type' || key === 'expressID') continue;
      
      if (value === null || value === undefined) {
        params.push('$');
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        const objValue = value as any;
        if (objValue?.expressID !== undefined) {
          params.push(`#${objValue.expressID}`);
        } else if (objValue?.value !== undefined) {
          const v = objValue.value;
          if (typeof v === 'string') {
            params.push(`'${v}'`);
          } else {
            params.push(String(v));
          }
        } else {
          params.push(JSON.stringify(value).substring(0, 20) + '...');
        }
      } else if (Array.isArray(value)) {
        const arrayItems = value.map((v: any) => {
          if (v === null || v === undefined) return '$';
          if (typeof v === 'object' && v.expressID !== undefined) return `#${v.expressID}`;
          if (typeof v === 'string') return `'${v}'`;
          return String(v);
        });
        params.push(`(${arrayItems.join(', ')})`);
      } else if (typeof value === 'string') {
        params.push(`'${value}'`);
      } else if (typeof value === 'number') {
        params.push(String(value));
      } else if (typeof value === 'boolean') {
        params.push(value ? '.T.' : '.F.');
      } else {
        params.push(String(value));
      }
    }
    
    return `#${expressId}= ${typeName}(${params.join(', ')})`;
  } catch (err) {
    return `#${(entity as any)?.expressID}= ${typeName}(...)`;
  }
}

/**
 * Checks if entity type is a geometry type
 */
function isGeometryType(typeName: string): boolean {
  const GEOMETRY_TYPES = new Set([
    'IFCSHAPEREPRESENTATION',
    'IFCPRODUCTREPRESENTATION',
    'IFCPRODUCTDEFINITIONSHAPE',
    'IFCREPRESENTATIONCONTEXT',
    'IFCGEOMETRICREPRESENTATIONCONTEXT',
    'IFCGEOMETRICREPRESENTATIONSUBCONTEXT',
    'IFCREPRESENTATIONMAP',
    'IFCMAPPEDITEM',
    'IFCSTYLEDITEM',
    'IFCSTYLEDREPRESENTATION',
    'IFCPRESENTATIONSTYLE',
    'IFCPRESENTATIONSTYLEASSIGNMENT',
    'IFCSURFACESTYLE',
    'IFCSURFACESTYLERENDERING',
    'IFCSURFACESTYLELIGHTING',
    'IFCPOINT',
    'IFCCARTESIANPOINT',
    'IFCDIRECTION',
    'IFCVECTOR',
    'IFCLINE',
    'IFCPOLYLINE',
  ]);
  return GEOMETRY_TYPES.has(typeName.toUpperCase());
}
