/**
 * Graph Builder Module
 * 
 * Responsible for creating graph visualization data from raw IFC entities.
 * This is a pure transformation layer: raw entities → enriched graph data
 * 
 * Separation of concerns:
 * - Parser: reads IFC file → produces pure 1:1 entity data
 * - GraphBuilder: takes entity data → adds visualization metadata (colors, edges)
 * - Graph Visualization: renders the enriched graph
 */

import { GraphNode, GraphEdge, NodeType } from '@/types/graph';
import { NODE_COLORS } from '@/lib/colorScheme';
import { isGeometryType } from '@/lib/ifcParser';

/**
 * Create graph data from raw parsed entities
 *
 * OPTIMIZATION: Single pass that both filters geometry and adds rich metadata
 * - Filters out geometry types (kept in allEntities for IFC Browser)
 * - Adds _schemaColor for graph visualization
 * - Adds _ifcStep from rawStepLines (eliminates separate treeBuilder pass)
 * - Extracts relationships and creates edges through relationship nodes
 *
 * @param allEntities Raw IFC entities (1:1 with file) - PURE DATA
 * @param parsedEdges Pre-computed edges from parser
 * @param rawStepLines Map of expressId to STEP line (from parser, optional)
 * @returns Graph data with edges + enriched nodes (geometry filtered out)
 *
 * Flow:
 * 1. Filter out geometry types
 * 2. Add both _schemaColor AND _ifcStep in single pass
 * 3. Extract relationships and create edges through relationship nodes
 * 4. Return enriched nodes and edges
 */
export function createGraphDataFromEntities(
  allEntities: GraphNode[],
  parsedEdges: GraphEdge[] = [],
  rawStepLines?: Map<number, string>
): { nodes: GraphNode[], edges: GraphEdge[] } {
  console.log('[GraphBuilder] Creating graph data:', {
    entitiesCount: allEntities.length,
    parsedEdgesCount: parsedEdges.length,
    rawStepLines: rawStepLines?.size || 0
  });

  // Filter out geometry types - they should not appear in graph visualization
  // IFC Browser shows all entities 1:1, but graph visualization excludes geometry
  const nonGeometryEntities = allEntities.filter(entity => {
    const typeName = entity.ifcType || '';
    return !isGeometryType(typeName);
  });

  console.log(`[GraphBuilder] Filtered: ${allEntities.length} entities → ${nonGeometryEntities.length} non-geometry entities for graph`);

  // OPTIMIZATION: Single pass - add BOTH _schemaColor and _ifcStep
  // This eliminates the separate enrichEntitiesForTree pass (50 MB saved!)
  const graphNodes = nonGeometryEntities.map(entity => {
    // Get STEP line from parser, or generate placeholder
    const stepLine = rawStepLines?.get(entity.expressId) ||
                    `#${entity.expressId}= ${entity.ifcType}(...);`;

    return {
      ...entity,
      properties: {
        ...entity.properties,
        _schemaColor: NODE_COLORS[entity.type as NodeType] || '#6b7280',
        _ifcStep: stepLine,  // Add _ifcStep directly (no separate pass!)
      },
    };
  });

  // Use pre-computed edges from parser if available, otherwise extract from properties
  let edges = [...parsedEdges];

  // DEBUG: Track relationship node connectivity
  const relationshipDebug: Record<string, { count: number; edgesCreated: number; missingNodeCount: number; examples: string[] }> = {};
  let relCount = 0;

  // Only extract additional edges from properties if we have very few edges
  // (fallback mechanism for edge cases or alternative data sources)
  if (edges.length === 0) {
    console.log('[GraphBuilder] Extracting relationships from entity properties (LPG model)...');
    const edgeSet = new Set<string>();

    // Helper to format ID
    const toNodeId = (id: number | string) =>
       typeof id === 'string' && id.startsWith('node_') ? id : `node_${id}`;

    // Optimization: Build a Set of existing node IDs for fast existence checks
    const nodeIds = new Set(graphNodes.map(n => n.id));

    const addEdgeThroughRelationshipNode = (
      source: number|string,
      target: number|string,
      relationshipNodeId: string,
      relationshipType: string
    ) => {
       if (source === undefined || target === undefined) return;

       const sId = toNodeId(source);
       const tId = toNodeId(target);

       // Only add valid edges where all nodes exist
       if (!nodeIds.has(sId) || !nodeIds.has(tId) || !nodeIds.has(relationshipNodeId)) {
         // Track missing nodes for this relationship type
         if (relationshipDebug[relationshipType]) {
           relationshipDebug[relationshipType].missingNodeCount++;

           // Store example of missing node for debugging
           const missing = [];
           if (!nodeIds.has(sId)) missing.push(`source:${sId}`);
           if (!nodeIds.has(tId)) missing.push(`target:${tId}`);
           if (!nodeIds.has(relationshipNodeId)) missing.push(`relNode:${relationshipNodeId}`);

           if (relationshipDebug[relationshipType].examples.length < 3) {
             relationshipDebug[relationshipType].examples.push(`${missing.join(', ')}`);
           }
         }

         if (relCount < 10) {
           const missing = [];
           if (!nodeIds.has(sId)) missing.push(`source:${sId}`);
           if (!nodeIds.has(tId)) missing.push(`target:${tId}`);
           if (!nodeIds.has(relationshipNodeId)) missing.push(`relNode:${relationshipNodeId}`);
           console.log(`[GraphBuilder] MISSING NODES for ${relationshipType} (${relationshipNodeId}): ${missing.join(', ')}`);
         }
         return;
       }

       // Update counter for successful edge creation
       if (relationshipDebug[relationshipType]) {
         relationshipDebug[relationshipType].edgesCreated += 2; // Two edges per relationship
       }

       // Edge 1: Source → RelationshipNode (labeled 'relating')
       const edgeKey1 = `${sId}-relating-${relationshipNodeId}`;
       if (!edgeSet.has(edgeKey1)) {
         edgeSet.add(edgeKey1);
         edges.push({
           id: `edge_${edges.length}`,
           source: sId,
           target: relationshipNodeId,
           label: 'relating',
           type: 'relationship_role',
           relationshipType: relationshipType,
         });
       }

       // Edge 2: RelationshipNode → Target (labeled 'related')
       const edgeKey2 = `${relationshipNodeId}-related-${tId}`;
       if (!edgeSet.has(edgeKey2)) {
         edgeSet.add(edgeKey2);
         edges.push({
           id: `edge_${edges.length}`,
           source: relationshipNodeId,
           target: tId,
           label: 'related',
           type: 'relationship_role',
           relationshipType: relationshipType,
         });
       }
    };

    // Iterate all entities to build LPG-format relationships
    let relCount = 0;
    const relationshipDebug: Record<string, { count: number; edgesCreated: number; missingNodeCount: number; examples: string[] }> = {};

    // OPTIMIZATION: Helper to unwrap raw arrays from parser (deferred unwrapping)
    // Parser stores raw arrays; graphBuilder unwraps on-demand during edge building
    const unwrapValue = (val: any): any => {
      if (val === null || val === undefined) return val;
      if (typeof val === 'object' && val.value !== undefined) return val.value;
      return val;
    };

    const unwrapArray = (arr: any[]): any[] => {
      if (!Array.isArray(arr)) return [arr];
      return arr.map(unwrapValue);
    };

    for (const entity of graphNodes) {
       const props = entity.properties as any;
       if (!props) continue;

       // Only process relationship entities
       if (entity.type !== 'relationship') continue;

       const relNodeId = entity.id; // The relationship node itself
       const relType = entity.ifcType || 'unknown';

       // Initialize tracking for this relationship type
       if (!relationshipDebug[relType]) {
         relationshipDebug[relType] = { count: 0, edgesCreated: 0, missingNodeCount: 0, examples: [] };
       }
       relationshipDebug[relType].count++;

       // Debug first few relationships to check property format
       if (relCount < 3) {
           console.log(`[GraphBuilder] Relationship #${relCount} (${relType}) - ID: ${relNodeId}`, {
             allProperties: Object.keys(props).filter(k => !k.startsWith('_')),
             RelatingObject: props.RelatingObject,
             RelatedObjects: props.RelatedObjects,
             RelatingStructure: props.RelatingStructure,
             RelatedElements: props.RelatedElements,
             RelatingBuildingElement: props.RelatingBuildingElement,
             RelatedOpeningElement: props.RelatedOpeningElement,
             RelatingPropertyDefinition: props.RelatingPropertyDefinition,
             RelatingMaterial: props.RelatingMaterial,
           });
       }

       // 1. Aggregation (IFCRELAGGREGATES)
       // RelatingObject → RelationshipNode → RelatedObjects
       if (props.RelatingObject !== undefined && props.RelatedObjects) {
          const source = unwrapValue(props.RelatingObject);
          const targets = unwrapArray(props.RelatedObjects);

          if (relCount < 3) console.log(`[GraphBuilder] Found aggregation: ${source} → RelNode → ${targets.length} targets`);

          targets.forEach((target: any) => addEdgeThroughRelationshipNode(source, target, relNodeId, relType));
          relCount++;
       }

       // 2. Spatial Containment (IFCRELCONTAINEDINSPATIALSTRUCTURE)
       // RelatingStructure → RelationshipNode → RelatedElements
       if (props.RelatingStructure !== undefined && props.RelatedElements) {
          const source = unwrapValue(props.RelatingStructure);
          const targets = unwrapArray(props.RelatedElements);
          targets.forEach((target: any) => addEdgeThroughRelationshipNode(source, target, relNodeId, relType));
       }

       // 3. Property Definitions (IFCRELDEFINESBYPROPERTIES)
       // RelatingPropertyDefinition → RelationshipNode → RelatedObjects
       if (props.RelatingPropertyDefinition !== undefined && props.RelatedObjects) {
           const source = unwrapValue(props.RelatingPropertyDefinition);
           const targets = unwrapArray(props.RelatedObjects);
           targets.forEach((target: any) => addEdgeThroughRelationshipNode(source, target, relNodeId, relType));
       }

       // 4. Materials (IFCRELASSOCIATESMATERIAL)
       // RelatingMaterial → RelationshipNode → RelatedObjects/RelatedElements
        if (props.RelatingMaterial !== undefined) {
           const source = unwrapValue(props.RelatingMaterial);
           const targets = props.RelatedElements || props.RelatedObjects;
           if (targets) {
               const arr = unwrapArray(targets);
               arr.forEach((target: any) => addEdgeThroughRelationshipNode(source, target, relNodeId, relType));
           }
       }

       // 5. Type Definitions (IFCRELDEFINESBYTYPE)
       // RelatingType → RelationshipNode → RelatedObjects
       if (props.RelatingType !== undefined && props.RelatedObjects) {
           const source = unwrapValue(props.RelatingType);
           const targets = unwrapArray(props.RelatedObjects);
           targets.forEach((target: any) => addEdgeThroughRelationshipNode(source, target, relNodeId, relType));
       }

       // 6. Voids / Fills (IFCRELVOIDSELEMENT, IFCRELFILLSELEMENT)
       // RelatingBuildingElement → RelationshipNode → RelatedOpeningElement
       if (props.RelatingBuildingElement !== undefined && props.RelatedOpeningElement !== undefined) {
           addEdgeThroughRelationshipNode(unwrapValue(props.RelatingBuildingElement), unwrapValue(props.RelatedOpeningElement), relNodeId, relType);
       }
       // RelatingOpeningElement → RelationshipNode → RelatedBuildingElement
       if (props.RelatingOpeningElement !== undefined && props.RelatedBuildingElement !== undefined) {
           addEdgeThroughRelationshipNode(unwrapValue(props.RelatingOpeningElement), unwrapValue(props.RelatedBuildingElement), relNodeId, relType);
       }

       // 7. Classification (IFCRELASSOCIATESCLASSIFICATION)
       // RelatingClassification → RelationshipNode → RelatedObjects
       if (props.RelatingClassification !== undefined && props.RelatedObjects) {
           const source = unwrapValue(props.RelatingClassification);
           const targets = unwrapArray(props.RelatedObjects);
           targets.forEach((target: any) => addEdgeThroughRelationshipNode(source, target, relNodeId, relType));
       }
    }
    console.log(`[GraphBuilder] Created ${edges.length} edges through relationship nodes (LPG model).`);
    console.log('[GraphBuilder] Relationship types processed:', {
      aggregates: graphNodes.filter(n => n.ifcType === 'IFCRELAGGREGATES').length,
      containedInSpatial: graphNodes.filter(n => n.ifcType === 'IFCRELCONTAINEDINSPATIALSTRUCTURE').length,
      definesProperties: graphNodes.filter(n => n.ifcType === 'IFCRELDEFINESBYPROPERTIES').length,
      associatesMaterial: graphNodes.filter(n => n.ifcType === 'IFCRELASSOCIATESMATERIAL').length,
      voidsElement: graphNodes.filter(n => n.ifcType === 'IFCRELVOIDSELEMENT').length,
      fillsElement: graphNodes.filter(n => n.ifcType === 'IFCRELFILLSELEMENT').length,
      definesType: graphNodes.filter(n => n.ifcType === 'IFCRELDEFINESBYTYPE').length,
      associatesClassification: graphNodes.filter(n => n.ifcType === 'IFCRELASSOCIATESCLASSIFICATION').length,
    });

    // Detailed debug summary showing which relationships failed to create edges
    console.log('[GraphBuilder] === RELATIONSHIP DEBUG SUMMARY (from entity properties) ===');
    console.table(Object.entries(relationshipDebug).map(([type, data]) => ({
      RelationType: type,
      'Total Count': data.count,
      'Edges Created': data.edgesCreated,
      'Missing Nodes': data.missingNodeCount,
      'Success Rate': data.count > 0 ? `${((data.edgesCreated / (data.count * 2)) * 100).toFixed(1)}%` : 'N/A',
      'Example Missing': data.examples[0] || 'none'
    })));
    console.log('[GraphBuilder] === END DEBUG SUMMARY ===');
  }

  // ANALYZE PRE-COMPUTED EDGES (from parser)
  console.log('[GraphBuilder] === ANALYZING PRE-COMPUTED EDGES ===');

  // Count which relationships have edges
  const relationshipEdgeCount: Record<string, number> = {};
  const relationshipNodeCount: Record<string, number> = {};

  graphNodes.forEach(node => {
    if (node.type === 'relationship' && node.ifcType) {
      relationshipNodeCount[node.ifcType] = (relationshipNodeCount[node.ifcType] || 0) + 1;
    }
  });

  edges.forEach(edge => {
    // Check if either endpoint is a relationship node
    const sourceNode = graphNodes.find(n => n.id === edge.source);
    const targetNode = graphNodes.find(n => n.id === edge.target);

    if (sourceNode?.type === 'relationship' && sourceNode.ifcType) {
      relationshipEdgeCount[sourceNode.ifcType] = (relationshipEdgeCount[sourceNode.ifcType] || 0) + 1;
    }
    if (targetNode?.type === 'relationship' && targetNode.ifcType) {
      relationshipEdgeCount[targetNode.ifcType] = (relationshipEdgeCount[targetNode.ifcType] || 0) + 1;
    }
  });

  console.table(Object.keys(relationshipNodeCount).map(relType => ({
    'Relationship Type': relType,
    'Total Nodes': relationshipNodeCount[relType] || 0,
    'Nodes With Edges': relationshipEdgeCount[relType] || 0,
    'Floating Nodes': (relationshipNodeCount[relType] || 0) - (relationshipEdgeCount[relType] ? Math.ceil((relationshipEdgeCount[relType] || 0) / 2) : 0),
    'Success Rate': relationshipNodeCount[relType] > 0 ? `${(((relationshipEdgeCount[relType] || 0) / (relationshipNodeCount[relType] * 2)) * 100).toFixed(1)}%` : 'N/A'
  })));
  console.log('[GraphBuilder] === END EDGE ANALYSIS ===');

  console.log('[GraphBuilder] Returning:', { nodesCount: graphNodes.length, edgesCount: edges.length });

  return { nodes: graphNodes, edges };
}
