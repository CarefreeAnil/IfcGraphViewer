import { GraphData, GraphNode, GraphEdge, NodeType, ParsedIFCData } from '@/types/graph';

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
    
    // Extract header information from IFC5 JSON structure
    const fileHeader = extractIFC5Header(jsonData);
    
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
      
      // Generate STEP-like representation for Referenced By algorithm
      const ifcStepLine = generateIFC5StepLine(uuid, ifcType, properties, attributes);
      
      const node: GraphNode = {
        id: uuid,
        label: label,
        type: classifyNodeTypeIFC5(ifcType),
        ifcType: ifcType,
        expressId: uuid,
        properties: properties,
        _ifcStep: ifcStepLine,
        _fileFormat: 'JSON',
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
        ifcHeader: fileHeader,
        isIFC5: true,
      },
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

/**
 * Generate a STEP-like representation for IFC5 JSON nodes
 * This allows the Referenced By algorithm to work with JSON-parsed entities
 */
function generateIFC5StepLine(uuid: string, ifcType: string, properties: Record<string, any>, attributes: any): string {
  // Build a STEP-like line that includes the UUID and type
  // Format: #UUID = IFCTYPE(prop1, prop2, ...)
  
  const propArray: string[] = [];
  
  // Add class code if available
  if (attributes['bsi::ifc::class']?.code) {
    propArray.push(`'${attributes['bsi::ifc::class'].code}'`);
  }
  
  // Add key properties
  Object.entries(properties).forEach(([key, value]) => {
    if (key !== 'OriginalSTEP' && key !== 'ifc::') {
      if (typeof value === 'string') {
        propArray.push(`'${value}'`);
      } else if (typeof value === 'number') {
        propArray.push(String(value));
      } else if (typeof value === 'object' && value.code) {
        propArray.push(`'${value.code}'`);
      }
    }
  });
  
  // Use originalStepInstance if available
  if (properties['OriginalSTEP']) {
    return properties['OriginalSTEP'];
  }
  
  // Construct synthetic STEP line
  return `#${uuid} = ${ifcType}(${propArray.join(', ')});`;
}

/**
 * Extract header information from IFC5 JSON structure
 */
function extractIFC5Header(jsonData: any) {
  const header = {
    fileDescription: '',
    fileName: 'Unknown',
    fileSchema: 'IFC5',
    timeStamp: new Date().toISOString(),
    fullHeader: 'IFC5 (JSON Format)',
  };
  
  // Try to extract header from JSON structure
  if (jsonData.header) {
    const fdArray = jsonData.header.fileDescription || [];
    header.fileDescription = Array.isArray(fdArray) ? fdArray.join(', ') : String(fdArray);
    header.fileName = jsonData.header.fileName || 'Unknown';
    header.fileSchema = jsonData.header.fileSchema || 'IFC5';
    
    if (jsonData.header.timeStamp) {
      header.timeStamp = jsonData.header.timeStamp;
    }
    
    // Build fullHeader from available fields
    const headerLines = [
      `HEADER;`,
      `FILE_DESCRIPTION('${header.fileDescription}', '${header.fileSchema}');`,
      `FILE_NAME('${header.fileName}', '${header.timeStamp}');`,
      `FILE_SCHEMA(('${header.fileSchema}'));`,
      `ENDSEC;`,
    ];
    header.fullHeader = headerLines.join('\n');
  } else {
    // Minimal header if not available
    header.fullHeader = `HEADER;\nFILE_SCHEMA(('IFC5 - JSON Format'));\nENDSEC;`;
  }
  
  return header;
}
