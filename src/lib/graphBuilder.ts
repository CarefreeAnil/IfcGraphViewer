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
  rawStepLines?: Map<number, string>,
  projectUnits: Record<string, string> = {}
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

  // Attach Property Sets using raw string parsing (Lightning fast, ~5ms for 2.5MB)
  if (rawStepLines) {
    attachPropertySets(graphNodes, rawStepLines, projectUnits);
  }

  // Use pre-computed edges from parser if available, otherwise extract from properties
  let edges = [...parsedEdges];

  // DEBUG: Track relationship node connectivity
  const relationshipDebug: Record<string, { count: number; edgesCreated: number; missingNodeCount: number; examples: string[] }> = {};
  let relCount = 0;

  // Build a single Map of node IDs for fast existence checks AND lookups
  // Used by both edge extraction (below) and edge analysis (later)
  // Also counts relationship node types in the same pass
  const nodeById = new Map<string, GraphNode>();
  const relationshipNodeCount: Record<string, number> = {};
  for (const node of graphNodes) {
    nodeById.set(node.id, node);
    if (node.type === 'relationship' && node.ifcType) {
      relationshipNodeCount[node.ifcType] = (relationshipNodeCount[node.ifcType] || 0) + 1;
    }
  }

  // Only extract additional edges from properties if we have very few edges
  // (fallback mechanism for edge cases or alternative data sources)
  if (edges.length === 0) {
    console.log('[GraphBuilder] Extracting relationships from entity properties (LPG model)...');
    const edgeSet = new Set<string>();
    const relNodesWithEdges = new Set<string>(); // Track which relationship nodes have edges

    // Helper to format ID
    const toNodeId = (id: number | string) =>
      typeof id === 'string' && id.startsWith('node_') ? id : `node_${id}`;

    const ensureMaterialNodeFromStep = (refId: number | string): string => {
      const nodeId = toNodeId(refId);
      if (nodeById.has(nodeId)) return nodeId;
      if (!rawStepLines) return nodeId;

      const numericId = typeof refId === 'number' ? refId : parseInt(String(refId).replace(/^node_/, ''), 10);
      if (!Number.isFinite(numericId)) return nodeId;

      const stepLine = rawStepLines.get(numericId);
      if (!stepLine) return nodeId;

      const typeMatch = stepLine.match(/^#\d+=\s*([A-Z0-9_]+)\s*\(/i);
      const ifcType = (typeMatch?.[1] || '').toUpperCase();
      if (!ifcType.startsWith('IFCMATERIAL')) return nodeId;

      const nameMatch = stepLine.match(/'([^']+)'/);
      const label = nameMatch?.[1] || ifcType;

      const syntheticNode: GraphNode = {
        id: nodeId,
        label,
        type: 'element',
        ifcType,
        isGraphVisible: true,
        expressId: numericId,
        properties: {
          Name: label,
          _ifcStep: stepLine,
          _schemaColor: NODE_COLORS.element || '#f59e0b',
          _syntheticFromStep: true,
        },
      };

      graphNodes.push(syntheticNode);
      nodeById.set(nodeId, syntheticNode);
      return nodeId;
    };

    const addEdgeThroughRelationshipNode = (
      source: number | string,
      target: number | string,
      relationshipNodeId: string,
      relationshipType: string
    ) => {
      if (source === undefined || source === null || target === undefined || target === null) return;
      if (source === 0 || target === 0) return; // expressID 0 is invalid

      const sId = toNodeId(source);
      const tId = toNodeId(target);

      // Some models reference material resources in IfcRelAssociatesMaterial
      // even when those material entities are not emitted in semantic parsing.
      // Recover such nodes from raw STEP so the material chain is navigable.
      if (String(relationshipType).toUpperCase() === 'IFCRELASSOCIATESMATERIAL') {
        ensureMaterialNodeFromStep(source);
        ensureMaterialNodeFromStep(target);
      }

      // Only add valid edges where all nodes exist
      if (!nodeById.has(sId) || !nodeById.has(tId) || !nodeById.has(relationshipNodeId)) {
        // Track missing nodes for this relationship type
        if (relationshipDebug[relationshipType]) {
          relationshipDebug[relationshipType].missingNodeCount++;

          // Store example of missing node for debugging
          const missing = [];
          if (!nodeById.has(sId)) missing.push(`source:${sId}`);
          if (!nodeById.has(tId)) missing.push(`target:${tId}`);
          if (!nodeById.has(relationshipNodeId)) missing.push(`relNode:${relationshipNodeId}`);

          if (relationshipDebug[relationshipType].examples.length < 3) {
            relationshipDebug[relationshipType].examples.push(`${missing.join(', ')}`);
          }
        }

        if (relCount < 10) {
          const missing = [];
          if (!nodeById.has(sId)) missing.push(`source:${sId}`);
          if (!nodeById.has(tId)) missing.push(`target:${tId}`);
          if (!nodeById.has(relationshipNodeId)) missing.push(`relNode:${relationshipNodeId}`);
          console.log(`[GraphBuilder] MISSING NODES for ${relationshipType} (${relationshipNodeId}): ${missing.join(', ')}`);
        }
        return;
      }

      // Update counter for successful edge creation
      if (relationshipDebug[relationshipType]) {
        relationshipDebug[relationshipType].edgesCreated += 2; // Two edges per relationship
      }
      relNodesWithEdges.add(relationshipNodeId);

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
    const relationshipDebugInner: Record<string, { count: number; edgesCreated: number; missingNodeCount: number; examples: string[] }> = {};

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
          RelatingType: props.RelatingType,
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

      // 8. Space Boundaries (IFCRELSPACEBOUNDARY)
      // RelatingSpace → RelationshipNode → RelatedBuildingElement
      if (props.RelatingSpace !== undefined && props.RelatedBuildingElement !== undefined) {
        addEdgeThroughRelationshipNode(unwrapValue(props.RelatingSpace), unwrapValue(props.RelatedBuildingElement), relNodeId, relType);
      }
      // Fallback: space boundary may also link via RelatingSpace + RelatedElement (IFC4 subtype variations)
      else if (props.RelatingSpace !== undefined && props.RelatedElement !== undefined) {
        addEdgeThroughRelationshipNode(unwrapValue(props.RelatingSpace), unwrapValue(props.RelatedElement), relNodeId, relType);
      }

      // 9. Element Connections (IFCRELCONNECTSPATHELEMENTS, IFCRELCONNECTSELEMENTS, IFCRELCONNECTSPORTS)
      // RelatingElement → RelationshipNode → RelatedElement
      if (props.RelatingElement !== undefined && props.RelatedElement !== undefined) {
        addEdgeThroughRelationshipNode(unwrapValue(props.RelatingElement), unwrapValue(props.RelatedElement), relNodeId, relType);
      }

      // 10. Declarations (IFCRELDECLARES)
      // RelatingContext → RelationshipNode → RelatedDefinitions
      if (props.RelatingContext !== undefined && props.RelatedDefinitions) {
        const source = unwrapValue(props.RelatingContext);
        const targets = unwrapArray(props.RelatedDefinitions);
        targets.forEach((target: any) => addEdgeThroughRelationshipNode(source, target, relNodeId, relType));
      }

      // 11. Library (IFCRELASSOCIATESLIBRARY)
      // RelatingLibrary → RelationshipNode → RelatedObjects
      if (props.RelatingLibrary !== undefined && props.RelatedObjects) {
        const source = unwrapValue(props.RelatingLibrary);
        const targets = unwrapArray(props.RelatedObjects);
        targets.forEach((target: any) => addEdgeThroughRelationshipNode(source, target, relNodeId, relType));
      }

      // 13. Group Assignment (IFCRELASSIGNSTOGROUP)
      // RelatingGroup → RelationshipNode → RelatedObjects
      if (props.RelatingGroup !== undefined && props.RelatedObjects) {
        const source = unwrapValue(props.RelatingGroup);
        const targets = unwrapArray(props.RelatedObjects);
        targets.forEach((target: any) => addEdgeThroughRelationshipNode(source, target, relNodeId, relType));
      }

      // 14. Port-to-Element (IFCRELCONNECTSPORTTOELEMENT)
      // RelatingPort → RelationshipNode → RelatedElement
      if (props.RelatingPort !== undefined && props.RelatedElement !== undefined) {
        addEdgeThroughRelationshipNode(unwrapValue(props.RelatingPort), unwrapValue(props.RelatedElement), relNodeId, relType);
      }

      // 15. Port-to-Port (IFCRELCONNECTSPORTS)
      // RelatingPort → RelationshipNode → RelatedPort
      if (props.RelatingPort !== undefined && props.RelatedPort !== undefined) {
        addEdgeThroughRelationshipNode(unwrapValue(props.RelatingPort), unwrapValue(props.RelatedPort), relNodeId, relType);
      }

      // 16. Services Buildings (IFCRELSERVICESBUILDINGS)
      // RelatingSystem → RelationshipNode → RelatedBuildings
      if (props.RelatingSystem !== undefined && props.RelatedBuildings) {
        const source = unwrapValue(props.RelatingSystem);
        const targets = unwrapArray(props.RelatedBuildings);
        targets.forEach((target: any) => addEdgeThroughRelationshipNode(source, target, relNodeId, relType));
      }

      // 12. Generic STEP-line fallback for any relationship type not matched above.
      // Checks if this specific entity has zero edges, then parses the raw STEP line
      // to extract entity references. This handles relationship types whose property
      // names aren't in ESSENTIAL_PROPERTIES_SET or that WebIFC returns differently.
      //
      // IFC STEP relationship format (after IfcRoot's 4 attrs: GlobalId, OwnerHistory, Name, Description):
      //   #ID= IFCREL*('guid',#ownerHist,'name','desc', <relationship-specific params>);
      // The relationship-specific params contain #refs to Relating/Related entities.
      if (rawStepLines && !relNodesWithEdges.has(relNodeId)) {
        const stepLine = rawStepLines.get(entity.expressId);
        if (stepLine) {
          // Extract all #ID entity references from the STEP line
          const allRefs: number[] = [];
          const refRegex = /#(\d+)/g;
          let match;
          while ((match = refRegex.exec(stepLine)) !== null) {
            allRefs.push(parseInt(match[1], 10));
          }

          // Remove the entity's own ID
          const otherRefs = allRefs.filter(r => r !== entity.expressId);
          if (otherRefs.length >= 2) {
            if (relType.toUpperCase() === 'IFCRELASSOCIATESMATERIAL') {
              // IFCRELASSOCIATESMATERIAL STEP order is:
              // RelatedObjects..., RelatingMaterial
              // Do NOT assume OwnerHistory appears as a #ref (it is often '$').
              // Use all relationship refs and let addEdgeThroughRelationshipNode
              // discard non-node refs safely.
              const source = otherRefs[otherRefs.length - 1];
              ensureMaterialNodeFromStep(source);
              const targets = otherRefs.slice(0, -1);
              for (const target of targets) {
                addEdgeThroughRelationshipNode(source, target, relNodeId, relType);
              }
              continue;
            }

            // For non-material relationships, keep legacy assumption that the
            // first ref after self is OwnerHistory.
            const relRefs = otherRefs.slice(1);

            // Filter to only refs that exist as graph nodes (skips geometry/null refs)
            const validRefs = relRefs.filter(r => nodeById.has(toNodeId(r)));

            if (validRefs.length >= 2) {
              {
              // First valid ref = relating (source), remaining = related (targets)
                const source = validRefs[0];
                const targets = validRefs.slice(1);
                for (const target of targets) {
                  addEdgeThroughRelationshipNode(source, target, relNodeId, relType);
                }
              }
            }
          }
        }
      }
    }

    // Robust reconciliation for IfcRelAssociatesMaterial:
    // Some files expose RelatedObjects but not a usable RelatingMaterial property via WebIFC.
    // Ensure material resources are still reachable in the graph by parsing STEP refs directly.
    if (rawStepLines) {
      const materialRelNodes = graphNodes.filter(n => (n.ifcType || '').toUpperCase() === 'IFCRELASSOCIATESMATERIAL');
      for (const relNode of materialRelNodes) {
        const stepLine = rawStepLines.get(relNode.expressId);
        if (!stepLine) continue;

        const allRefs: number[] = [];
        const refRegex = /#(\d+)/g;
        let match;
        while ((match = refRegex.exec(stepLine)) !== null) {
          allRefs.push(parseInt(match[1], 10));
        }

        const otherRefs = allRefs.filter(r => r !== relNode.expressId);
        if (otherRefs.length < 2) continue;

        // Do NOT assume OwnerHistory is present as a #ref; use full refs list.
        const sourceMaterialRef = otherRefs[otherRefs.length - 1];
        const targetObjectRefs = otherRefs.slice(0, -1);
        const sourceMaterialNodeId = ensureMaterialNodeFromStep(sourceMaterialRef);

        if (!nodeById.has(sourceMaterialNodeId)) continue;

        for (const targetRef of targetObjectRefs) {
          const targetNodeId = toNodeId(targetRef);
          if (!nodeById.has(targetNodeId)) continue;

          const edgeKey1 = `${sourceMaterialNodeId}-relating-${relNode.id}`;
          if (!edgeSet.has(edgeKey1)) {
            edgeSet.add(edgeKey1);
            edges.push({
              id: `edge_${edges.length}`,
              source: sourceMaterialNodeId,
              target: relNode.id,
              label: 'relating',
              type: 'relationship_role',
              relationshipType: 'IFCRELASSOCIATESMATERIAL',
            });
          }

          const edgeKey2 = `${relNode.id}-related-${targetNodeId}`;
          if (!edgeSet.has(edgeKey2)) {
            edgeSet.add(edgeKey2);
            edges.push({
              id: `edge_${edges.length}`,
              source: relNode.id,
              target: targetNodeId,
              label: 'related',
              type: 'relationship_role',
              relationshipType: 'IFCRELASSOCIATESMATERIAL',
            });
          }
        }
      }

      // Build explicit material-reference links so material-select chains are visible:
      // IfcMaterialLayerSetUsage -> IfcMaterialLayerSet -> IfcMaterialLayer -> IfcMaterial
      const materialNodes = graphNodes.filter(n => (n.ifcType || '').toUpperCase().startsWith('IFCMATERIAL'));
      for (const matNode of materialNodes) {
        const stepLine = rawStepLines.get(matNode.expressId);
        if (!stepLine) continue;

        const allRefs: number[] = [];
        const refRegex = /#(\d+)/g;
        let match;
        while ((match = refRegex.exec(stepLine)) !== null) {
          allRefs.push(parseInt(match[1], 10));
        }

        const childRefs = allRefs.filter(r => r !== matNode.expressId);
        for (const childRef of childRefs) {
          const childNodeId = ensureMaterialNodeFromStep(childRef);
          const childNode = nodeById.get(childNodeId);
          if (!childNode) continue;
          if (!((childNode.ifcType || '').toUpperCase().startsWith('IFCMATERIAL'))) continue;

          const edgeKey = `${matNode.id}-materialRef-${childNodeId}`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edges.push({
              id: `edge_${edges.length}`,
              source: matNode.id,
              target: childNodeId,
              label: 'materialRef',
              type: 'material_ref',
              relationshipType: 'IFCMATERIALREFERENCE',
            });
          }
        }
      }
    }

    console.log(`[GraphBuilder] Created ${edges.length} edges through relationship nodes (LPG model).`);
    console.log('[GraphBuilder] Relationship types processed:', relationshipDebug);

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

  edges.forEach(edge => {
    // Check if either endpoint is a relationship node
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);

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

/**
 * Extracts property sets directly from raw STEP lines and attaches them natively to node.properties.
 * This runs in O(N) using raw string parsing, preventing memory bloat from instantiating WebIFC objects.
 */

// Maps IFCQUANTITY* entity type → unit type key from projectUnits.
// Static — does not depend on any specific IFC file.
const QUANTITY_UNIT_TYPE: Record<string, string> = {
  IFCQUANTITYLENGTH: 'LENGTHUNIT',
  IFCQUANTITYAREA:   'AREAUNIT',
  IFCQUANTITYVOLUME: 'VOLUMEUNIT',
  IFCQUANTITYWEIGHT: 'MASSUNIT',
  IFCQUANTITYTIME:   'TIMEUNIT',
};

function attachPropertySets(
  nodes: GraphNode[],
  rawStepLines: Map<number, string>,
  projectUnits: Record<string, string> = {}
) {
  console.log('[GraphBuilder] Extracting property sets from raw strings...');
  const start = performance.now();

  // Create a fast lookup map for nodes by expressId
  const nodeMap = new Map<number, GraphNode>();
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].expressId) {
      nodeMap.set(nodes[i].expressId, nodes[i]);
    }
  }

  const psetsToElements = new Map<number, number[]>();
  const psetHasProperties = new Map<number, { name: string, propIds: number[] }>();

  // Pass 1: Find IFCRELDEFINESBYPROPERTIES
  for (const [id, line] of rawStepLines.entries()) {
    if (line.includes('IFCRELDEFINESBYPROPERTIES')) {
      // IFCRELDEFINESBYPROPERTIES('guid',#owner,'name','desc',(#elem1,#elem2),#pset);
      const elementsMatch = line.match(/\(\s*(#[0-9, \t#]+)\s*\)/);
      const psetMatch = line.match(/,\s*#([0-9]+)\s*\);/);

      if (elementsMatch && psetMatch) {
        const psetId = parseInt(psetMatch[1], 10);
        const elementsStr = elementsMatch[1];

        const elemIds: number[] = [];
        const parts = elementsStr.split(',');
        for (const p of parts) {
          const num = parseInt(p.trim().substring(1), 10);
          if (!isNaN(num)) elemIds.push(num);
        }

        psetsToElements.set(psetId, elemIds);
      }
    }
  }

  // Pass 2: Find IFCPROPERTYSET sizes
  for (const psetId of psetsToElements.keys()) {
    const psetLine = rawStepLines.get(psetId);
    if (psetLine && psetLine.includes('IFCPROPERTYSET')) {
      // IFCPROPERTYSET('guid',#owner,'PsetName','desc',(#prop1,#prop2));

      let name = 'PropertySet';
      const nameMatch = psetLine.match(/'([^']+)'/g); // Find all string literals
      if (nameMatch && nameMatch.length >= 2) {
        // nameMatch[0] is typically the GUID ('1234...'). nameMatch[1] is the Name ('Pset_WallCommon').
        name = nameMatch[1].replace(/'/g, '');
      }

      const propsMatch = psetLine.match(/\(\s*(#[0-9, \t#]+)\s*\)/);
      if (propsMatch) {
        const propIds: number[] = [];
        const parts = propsMatch[1].split(',');
        for (const p of parts) {
          const num = parseInt(p.trim().substring(1), 10);
          if (!isNaN(num)) propIds.push(num);
        }
        psetHasProperties.set(psetId, { name, propIds });
      }
    } else if (psetLine && psetLine.includes('IFCELEMENTQUANTITY')) {
      let name = 'QuantityTakeOff';
      const nameMatch = psetLine.match(/'([^']+)'/g); // Find all string literals
      if (nameMatch && nameMatch.length >= 2) {
        // nameMatch[0] is the GUID. nameMatch[1] is the Name.
        name = nameMatch[1].replace(/'/g, '');
      }

      const propsMatch = psetLine.match(/\(\s*(#[0-9, \t#]+)\s*\)/);
      if (propsMatch) {
        const propIds: number[] = [];
        const parts = propsMatch[1].split(',');
        for (const p of parts) {
          const num = parseInt(p.trim().substring(1), 10);
          if (!isNaN(num)) propIds.push(num);
        }
        psetHasProperties.set(psetId, { name, propIds });
      }
    }
  }

  // Pass 3: Extract actual values and assign
  for (const [psetId, { name, propIds }] of psetHasProperties.entries()) {
    const propertiesObj: Record<string, string | number | boolean> = {};

    for (const propId of propIds) {
      const propLine = rawStepLines.get(propId);
      if (!propLine) continue;

      if (propLine.includes('IFCPROPERTYSINGLEVALUE') || propLine.includes('IFCQUANTITY')) {
        // IFCPROPERTYSINGLEVALUE('PropertyName',$,IFCTEXT('Value'),$);
        const nameMatch = propLine.match(/\(\s*'([^']+)'/);
        if (nameMatch) {
          const propName = nameMatch[1];

          // Value parser
          let val: string | number | boolean = 'Unknown';

          // String value
          const strMatch = propLine.match(/,\s*IFC[A-Z0-9_]+\s*\(\s*'([^']+)'\s*\)/i);
          if (strMatch) {
            val = strMatch[1];
          } else {
            // Numeric value
            const numMatch = propLine.match(/,\s*IFC[A-Z0-9_]+\s*\(\s*([0-9.-]+)\s*\)/i);
            if (numMatch) {
              val = parseFloat(numMatch[1]);
            } else {
              // Boolean
              const boolMatch = propLine.match(/,\s*IFC(BOOLEAN|LOGICAL)\s*\(\s*\.([TF])\.\s*\)/i);
              if (boolMatch) {
                val = boolMatch[2] === 'T';
              } else if (propLine.match(/,\s*([0-9.-]+)\s*[,)]/)) {
                // Raw number for quantities
                const rawNum = propLine.match(/,\s*([0-9.-]+)\s*[,)]/);
                if (rawNum) val = parseFloat(rawNum[1]);
              }
            }
          }

          propertiesObj[propName] = val;

          // Annotate numeric quantity values with the project unit symbol.
          // IFCPROPERTYSINGLEVALUE values are unitless here; only IFCQUANTITY*
          // types map to the project's IFCUNITASSIGNMENT (provided as projectUnits).
          if (typeof val === 'number' && propLine.includes('IFCQUANTITY')) {
            const qtypeMatch = propLine.match(/IFCQUANTITY([A-Z]+)/);
            if (qtypeMatch) {
              const unitKey = QUANTITY_UNIT_TYPE[`IFCQUANTITY${qtypeMatch[1]}`];
              const symbol  = unitKey ? projectUnits[unitKey] : undefined;
              if (symbol) propertiesObj[propName] = `${val} ${symbol}`;
            }
          }
        }
      }
    }

    // Attach to elements
    const elemIds = psetsToElements.get(psetId);
    if (elemIds) {
      for (const elemId of elemIds) {
        const node = nodeMap.get(elemId);
        if (node) {
          // Flatten into node properties to make it visible in PropertyViewer natively
          // Prefix with PSet name for clarity visually (e.g. "Pset_WallCommon.Reference")
          for (const [k, v] of Object.entries(propertiesObj)) {
            // Include in main properties map so search works!
            node.properties[`[${name}] ${k}`] = v;
          }
        }
      }
    }

    // NEW: Also attach properties directly to the Property Set node itself
    // so that when a user clicks on the IFCPROPERTYSET node, they can see its properties
    const psetNode = nodeMap.get(psetId);
    if (psetNode) {
      for (const [k, v] of Object.entries(propertiesObj)) {
        psetNode.properties[`[${name}] ${k}`] = v;
      }
    }
  }

  const end = performance.now();
  console.log(`[GraphBuilder] Attached properties in ${(end - start).toFixed(1)}ms`);
}
