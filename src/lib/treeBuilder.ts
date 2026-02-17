/**
 * Tree Builder Module
 * 
 * Responsible for creating tree visualization data from raw IFC entities.
 * This is a pure transformation layer: raw entities → enriched tree data
 * 
 * Separation of concerns:
 * - Parser: reads IFC file → produces pure 1:1 entity data
 * - TreeBuilder: takes entity data → adds tree display metadata (_ifcStep)
 * - Tree Visualization: renders the enriched tree
 */

import { GraphNode } from '@/types/graph';

/**
 * Enrich entities with tree display metadata
 * 
 * This separates tree display metadata from pure IFC data.
 * 
 * @param allEntities Raw IFC entities (1:1 with file) - PURE DATA
 * @param rawStepLines Pre-computed STEP lines from parser (optional for reconstruction fallback)
 * @returns Enriched entities with _ifcStep for tree display
 * 
 * Flow:
 * 1. Clone entities to avoid mutating originals
 * 2. Add _ifcStep for tree browser display
 * 3. Return enriched entities
 */
export function enrichEntitiesForTree(
  allEntities: GraphNode[],
  rawStepLines?: Map<number, string>
): GraphNode[] {
  console.log('[TreeBuilder] Enriching entities for tree:', {
    entitiesCount: allEntities.length,
    rawStepLinesCount: rawStepLines?.size || 0
  });
  
  // Clone entities and add tree display metadata
  const enrichedEntities = allEntities.map(entity => {
    // Check if we already have the STEP line from rawStepLines
    const stepLine = rawStepLines?.get(entity.expressId);
    
    // If no raw STEP line, construct a minimal representation
    const ifcStepRepresentation = stepLine || `#${entity.expressId}= ${entity.ifcType}(...);`;
    
    return {
      ...entity,
      properties: {
        ...entity.properties,
        // Add STEP representation for tree browser display
        // This is enrichment metadata, not part of pure IFC data
        _ifcStep: ifcStepRepresentation,
      },
    };
  });

  return enrichedEntities;
}
