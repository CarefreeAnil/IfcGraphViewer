import { GraphData, GraphNode, GraphEdge, NodeType, ParsedIFCData } from '@/types/graph';
import { validateIFCData, validateIFC5JSONStructure } from '@/lib/ifcValidator';

/**
 * IFC5 Parser - Handles JSON-based .ifcx files
 * IFC5 uses a path-based UUID system with attributes containing relationship data
 */

export async function parseIFC5File(file: File): Promise<ParsedIFCData> {
  const startTime = performance.now();
  
  try {
    const text = await file.text();
    const jsonData = JSON.parse(text);
    
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeMap = new Map<string, GraphNode>();
    
    // Extract data array
    const dataArray = jsonData.data || [];
    
    // First pass: Create all nodes from the data array
    dataArray.forEach((item: any) => {
      const uuid = item.path || item.id;
      if (!uuid) return;
      
      // Extract attributes
      const attributes = item.attributes || {};
      
      // Determine IFC type
      let ifcType = 'UNKNOWN';
      let label = uuid.substring(0, 8);
      
      if (attributes['bsi::ifc::class']?.code) {
        ifcType = attributes['bsi::ifc::class'].code;
        label = ifcType;
      }
      
      // Extract name/label from customdata if available
      if (attributes.customdata?.originalStepInstance) {
        const match = attributes.customdata.originalStepInstance.match(/'([^']+)'/);
        if (match) {
          label = match[1];
        }
      }
      
      // Extract properties
      const properties: Record<string, any> = {};
      
      Object.entries(attributes).forEach(([key, value]: [string, any]) => {
        if (key.startsWith('bsi::ifc::prop::')) {
          const propName = key.replace('bsi::ifc::prop::', '');
          properties[propName] = value;
        } else if (key === 'customdata' && value.originalStepInstance) {
          properties['OriginalSTEP'] = value.originalStepInstance;
        } else if (key.startsWith('bsi::') && typeof value === 'object' && value.code) {
          properties[key.replace('bsi::', '')] = value.code;
        }
      });
      
      const node: GraphNode = {
        id: uuid,
        label: label,
        type: classifyNodeTypeIFC5(ifcType),
        ifcType: ifcType,
        expressId: uuid,
        properties: properties,
      };
      
      nodes.push(node);
      nodeMap.set(uuid, node);
    });
    
    // Second pass: Create edges from children relationships
    dataArray.forEach((item: any) => {
      const parentUUID = item.path;
      if (!parentUUID || !item.children) return;
      
      const parentNode = nodeMap.get(parentUUID);
      if (!parentNode) return;
      
      // Handle children relationships
      if (typeof item.children === 'object') {
        Object.entries(item.children).forEach(([childKey, childUUID]: [string, any]) => {
          const childNode = nodeMap.get(childUUID);
          if (childNode) {
            edges.push({
              id: `edge_child_${parentUUID}_${childUUID}`,
              source: parentUUID,
              target: childUUID,
              label: childKey.toLowerCase(),
              type: 'CONTAINS',
            });
          }
        });
      }
      
      // Handle inherits relationships
      if (item.inherits && typeof item.inherits === 'object') {
        Object.entries(item.inherits).forEach(([inheritKey, inheritValue]: [string, any]) => {
          let inheritUUID: string | null = null;
          
          if (typeof inheritValue === 'string') {
            inheritUUID = inheritValue;
          } else if (inheritValue && typeof inheritValue === 'object') {
            inheritUUID = inheritValue.ref || inheritValue.id || inheritValue.path;
          }
          
          if (inheritUUID) {
            const inheritNode = nodeMap.get(inheritUUID);
            if (inheritNode) {
              edges.push({
                id: `edge_inherit_${parentUUID}_${inheritUUID}`,
                source: parentUUID,
                target: inheritUUID,
                label: inheritKey,
                type: 'INHERITS',
              });
            }
          }
        });
      }
      
      // Handle space boundary relationships
      if (item.attributes?.['bsi::ifc::spaceBoundary']) {
        const spaceBoundary = item.attributes['bsi::ifc::spaceBoundary'];
        const relatedElementRef = spaceBoundary.relatedelement?.ref || spaceBoundary.relatedelement;
        const relatingSpaceRef = spaceBoundary.relatingspace?.ref || spaceBoundary.relatingspace;
        
        if (relatedElementRef) {
          const relatedNode = nodeMap.get(relatedElementRef);
          if (relatedNode) {
            edges.push({
              id: `edge_sb_rel_${parentUUID}_${relatedElementRef}`,
              source: parentUUID,
              target: relatedElementRef,
              label: 'spaceBoundary',
              type: 'SPACE_BOUNDARY',
            });
          }
        }
        
        if (relatingSpaceRef) {
          const relatingNode = nodeMap.get(relatingSpaceRef);
          if (relatingNode) {
            edges.push({
              id: `edge_sb_space_${parentUUID}_${relatingSpaceRef}`,
              source: relatingSpaceRef,
              target: parentUUID,
              label: 'bounded',
              type: 'SPACE_BOUNDARY',
            });
          }
        }
      }
    });
    
    const endTime = performance.now();

    // Validate JSON structure only (IFC5 semantic validation is different from IFC4)
    const syntaxErrors = validateIFC5JSONStructure(jsonData);
    
    // Create validation result for IFC5 (only JSON structure checks)
    const validation = {
      valid: syntaxErrors.length === 0,
      errors: syntaxErrors,
      warnings: [],
      info: [{
        severity: 'info' as const,
        type: 'IFC5_FORMAT',
        message: `IFC5 (JSON) format detected. Semantic validation rules are specific to IFC4 STEP format.`,
      }],
      stats: {
        totalErrors: syntaxErrors.length,
        totalWarnings: 0,
        totalInfo: 1,
        checkedEntities: nodes.length,
        checkedRelationships: edges.length,
        entityTypeCount: {},
        relationshipTypeCount: {},
      },
    };
    
    return {
      graphData: { nodes, edges },
      allEntities: nodes,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        entityCount: nodes.length,
        geometryEntityCount: 0,
        propertyEntityCount: 0,
        relationshipCount: edges.length,
        parseTime: endTime - startTime,
      },
      validation,
    };
  } catch (error) {
    console.error('Error parsing IFC5 file:', error);
    throw new Error(`Failed to parse IFC5 file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Classify node types for IFC5 based on IFC entity type
 */
function classifyNodeTypeIFC5(ifcType: string): NodeType {
  const type = ifcType.toUpperCase();
  
  if (type.includes('BUILDING') || type.includes('SITE') || type.includes('STOREY') || type.includes('FLOOR') || type.includes('PROJECT')) {
    return 'building';
  } else if (type.includes('SPACE') || type.includes('ZONE')) {
    return 'space';
  } else if (type.includes('PROPERTY') || type.includes('PSET') || type.includes('MATERIAL')) {
    return 'property';
  } else if (type.includes('REL')) {
    return 'relationship';
  }
  return 'element';
}
