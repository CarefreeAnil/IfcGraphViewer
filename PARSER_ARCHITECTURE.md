# IFC Parsers - Architecture

## Separation of Concerns

The IFC file parsing functionality has been split into two separate modules for better maintainability and clarity:

### 1. **ifcParser.ts** - IFC4 Parser
Handles traditional IFC files (.ifc format) using the **web-ifc** library.

**Features:**
- Parses IFC2x3 and IFC4 standard files
- Uses web-ifc WASM API for entity and relationship extraction
- Extracts geometric representations (can be filtered)
- Supports multiple relationship types:
  - IFCRELAGGREGATES - hierarchical aggregation
  - IFCRELCONTAINEDINSPATIALSTRUCTURE - spatial structure containment
  - IFCRELVOIDSELEMENT - openings in elements
  - IFCRELFILLSELEMENT - fillings in openings
  - IFCRELDEFINESBYPROPERTIES - property set definitions

**Key Functions:**
- `parseIFCFile(file: File)` - Main parser function
- `generateSampleData()` - Creates demo data for testing

**Output Format:**
```typescript
{
  graphData: {
    nodes: GraphNode[],
    edges: GraphEdge[]
  },
  metadata: {
    fileName: string,
    fileSize: number,
    entityCount: number,
    relationshipCount: number,
    parseTime: number
  }
}
```

### 2. **ifc5Parser.ts** - IFC5 Parser
Handles JSON-based IFC5 files (.ifcx format).

**Features:**
- Parses IFC5 JSON structure with UUID-based path system
- Extracts children relationships (mapped as CONTAINS edges)
- Processes inherits relationships
- Handles space boundary relationships
- Extracts properties from bsi::ifc::* namespace

**Key Functions:**
- `parseIFC5File(file: File)` - Main IFC5 parser function
- `classifyNodeTypeIFC5(ifcType: string)` - Type classification helper

**IFC5 Structure Support:**
```json
{
  "data": [
    {
      "path": "uuid-string",
      "children": { "childKey": "child-uuid" },
      "inherits": { "inheritKey": "inherit-uuid" },
      "attributes": {
        "bsi::ifc::class": { "code": "IfcBuildingStorey" },
        "bsi::ifc::prop::*": "value",
        "customdata": { "originalStepInstance": "..." }
      }
    }
  ]
}
```

## Usage in Index.tsx

```typescript
import { parseIFCFile, generateSampleData } from '@/lib/ifcParser';
import { parseIFC5File } from '@/lib/ifc5Parser';

// Route files to appropriate parser
if (file.name.toLowerCase().endsWith('.ifcx')) {
  data = await parseIFC5File(file);
} else {
  data = await parseIFCFile(file);
}
```

## File Structure

```
src/lib/
├── ifcParser.ts       # IFC4 parser (web-ifc based)
├── ifc5Parser.ts      # IFC5 parser (JSON based)
├── utils.ts           # Shared utilities
└── ...
```

## Node Types

Both parsers classify nodes into these categories:
- **building** - Projects, sites, buildings, storeys, floors
- **space** - Spaces, zones
- **element** - Walls, doors, windows, slabs, columns, beams, roofs, etc.
- **property** - Property sets, materials
- **relationship** - Relationship entities

## Edge Types

Common edge types across both parsers:
- **CONTAINS** - Parent-child containment
- **AGGREGATES** - Hierarchical aggregation
- **INHERITS** - Inheritance relationships
- **SPACE_BOUNDARY** - Space boundary definitions
- **VOIDS** - Openings in building elements
- **FILLS** - Fillings in openings
- **PROPERTY_REFERENCE** - References to properties

## Testing

Load sample data:
```typescript
const sampleData = generateSampleData();
```

Or upload a real IFC or IFCX file through the FileUpload component.
