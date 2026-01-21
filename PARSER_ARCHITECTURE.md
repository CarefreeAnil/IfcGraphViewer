# IFC Parser Architecture

## Overview

The IFC parsing system is designed to support multiple IFC file formats through specialized parsers while maintaining a unified data model for visualization. This document describes the architecture, design patterns, and implementation details of the parsing layer.

## Parser Selection Strategy

```
File Upload
    ↓
Extension Detection
    ├─→ .ifc → IFC4Parser (traditional STEP format)
    └─→ .ifcx → IFC5Parser (JSON-based format)
    ↓
Format-Specific Parsing
    ↓
Unified Graph Model
    ├─ GraphNode[]
    └─ GraphEdge[]
```

The application automatically routes files to the appropriate parser based on file extension, maintaining backward compatibility with IFC4 while adding support for the newer IFC5 format.

## IFC4 Parser (`ifcParser.ts`)

### Architecture

The IFC4 parser leverages the **web-ifc** library which provides:
- WASM-based parsing (fast and memory-efficient)
- Support for IFC2x3 and IFC4 standards
- Native entity and relationship extraction

### Key Components

**Initialization**
```typescript
const wasmPath = '/ifc-wasm/web-ifc.wasm';
IfcAPI.SetWasmPath(wasmPath);
await IfcAPI.Init();
```

**Entity Extraction**
```typescript
const ifc = await IfcAPI.ParseIFC(arrayBuffer);
const lines = IfcAPI.GetAllLines(modelID);
const entity = IfcAPI.GetEntityData(modelID, expressID);
```

**Relationship Extraction**
- Query all instances of specific relationship types
- Build inverse index for bidirectional lookup
- Map relationships to graph edges

### Supported Relationship Types

| Type | Source | Target | Description |
|------|--------|--------|-------------|
| IFCRELAGGREGATES | Parent | Child | Hierarchical aggregation |
| IFCRELCONTAINEDINSPATIALSTRUCTURE | Space | Element | Spatial containment |
| IFCRELVOIDSELEMENT | Element | Opening | Openings in elements |
| IFCRELFILLSELEMENT | Opening | Element | Fillings in openings |
| IFCRELDEFINESBYPROPERTIES | Entity | PropertySet | Property association |

### Entity Classification

Entities are classified into categories for visualization:

```typescript
type NodeType = 'building' | 'space' | 'element' | 'property' | 'relationship';

// Classification rules
IFCPROJECT, IFCSITE, IFCBUILDING, IFCBUILDINGSTOREY → 'building'
IFCSPACE, IFCZONE → 'space'
IFCWALL, IFCDOOR, IFCWINDOW, IFCSLAB, etc. → 'element'
IFCPROPERTYSET → 'property'
IFCREL* → 'relationship'
```

### Geometry Filtering

The parser intentionally filters out geometry-related entities:
- IFCSHAPEREPRESENTATION
- IFCGEOETRICREPRESENTATIONITEM
- IFCMATERIAL
- IFCSTYLE

This focuses the graph on semantic relationships rather than geometric data.

### Output Format

```typescript
interface IFCParsingResult {
  graphData: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  metadata: {
    fileName: string;
    fileSize: number;
    entityCount: number;
    relationshipCount: number;
    parseTime: number;
    ifcVersion: string;
  };
}
```

## IFC5 Parser System

### Overview

The IFC5 parser handles JSON-based IFC files using a three-step process:
1. **Parse** - Load JSON and extract base entities
2. **Compose** - Build composition relationships and hierarchy
3. **Convert** - Transform to unified graph model

### Components

#### ifc5ParserMain.ts
Main entry point for IFC5 parsing with complete workflow management.

**Key Functions**:
```typescript
async parseIFC5File(file: File): Promise<IFCParsingResult>
async extractIFC5Entities(data: any): Promise<Map<string, IFC5Entity>>
async processIFC5Relationships(entities, composition)
classifyNodeTypeIFC5(ifcType: string): NodeType
```

**Entity Extraction**:
- Iterates through `data` array
- Extracts UUID paths as unique identifiers
- Parses `bsi::ifc::class` for entity type
- Extracts properties from `bsi::ifc::prop::*` namespace

**Example IFC5 Structure**:
```json
{
  "data": [
    {
      "path": "uuid-string",
      "children": {"childKey": "child-uuid"},
      "inherits": {"inheritKey": "inherit-uuid"},
      "attributes": {
        "bsi::ifc::class": {"code": "IfcBuildingStorey"},
        "bsi::ifc::prop::Name": "Ground Floor",
        "bsi::ifc::prop::Description": "..."
      }
    }
  ]
}
```

#### ifc5Composition.ts
Extracts and manages composition relationships in IFC5 files.

**Responsibilities**:
- Build composition tree from UUID paths
- Create parent-child relationships
- Extract hierarchy levels
- Generate composition statistics

**Composition Builder Pattern**:
```typescript
interface CompositionData {
  root: IFC5Entity[];
  hierarchy: Map<string, IFC5Entity[]>;
  parentMap: Map<string, string>;
  childMap: Map<string, string[]>;
}

// Custom builder support
interface CompositionBuilder {
  build(entities: Map<string, IFC5Entity>): CompositionData;
}
```

#### ifc5ToGraph.ts
Converts IFC5 data to the standardized graph model.

**Conversion Pipeline**:
```typescript
async ifc5ToGraph(
  entities: Map<string, IFC5Entity>,
  composition: CompositionData,
  metadata?: any
): Promise<GraphData>

// Steps:
1. Create GraphNode for each entity
2. Map IFC5 type to NodeType
3. Build edges from relationships
4. Add composition edges
5. Create inverse edges for bidirectional lookup
6. Merge properties and metadata
```

**Relationship Types Created**:
- **CONTAINS** - Parent-child containment
- **AGGREGATES** - Hierarchical aggregation
- **INHERITS** - Inheritance relationships
- **REFERENCES** - Generic property references

### Data Flow

```
IFC5 JSON File
    ↓
parseIFC5File()
    ├─→ Extract entities by UUID
    ├─→ Parse bsi::ifc attributes
    └─→ Build entity map
    ↓
extractComposition()
    ├─→ Analyze hierarchy
    ├─→ Build parent-child relationships
    └─→ Create composition tree
    ↓
ifc5ToGraph()
    ├─→ Create GraphNode objects
    ├─→ Create GraphEdge objects
    ├─→ Add computed relationships
    └─→ Generate metadata
    ↓
Unified GraphData
```

## Worker Implementation

### ifcParserWorker.ts

Handles parsing in a background Web Worker to prevent UI blocking.

**Responsibilities**:
- Receive file data
- Route to appropriate parser (IFC4 or IFC5)
- Handle parsing operations
- Return results to main thread

**Communication Pattern**:
```typescript
// Main thread → Worker
worker.postMessage({
  type: 'parse',
  file: { name, size, data }
});

// Worker → Main thread
self.postMessage({
  type: 'progress',
  data: { percentage, message }
});

// Worker → Main thread (complete)
self.postMessage({
  type: 'complete',
  data: graphData
});
```

### ifcGeometryWorker.ts

New worker for geometry processing (future integration).

**Planned Features**:
- Async geometry extraction
- WASM-based geometric operations
- 3D mesh generation
- Performance monitoring

## Schema Integration

### Schema System (`ifcSchema.ts`)

Provides metadata about IFC entities:

```typescript
interface EntitySchema {
  name: string;
  category: EntityCategory;
  properties: PropertyDefinition[];
  relationships: RelationshipDefinition[];
  color: string;
  icon: string;
  displayName: string;
}

// 40+ entity types defined with:
// - Color coding by category
// - Icon associations
// - Display information
// - Validation rules
```

### Validation (`ifcValidator.ts`, `ifcValidatorEnhanced.ts`)

Validates parsed data against schema rules:

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  statistics: ValidationStatistics;
}

// Checks:
// - Project hierarchy (Project → Site → Building → Storey)
// - Entity relationship constraints
// - Required vs optional properties
// - Type compatibility
```

## Performance Optimizations

### Parsing Optimizations

1. **Web Worker Offloading**
   - Moves parsing off main thread
   - Prevents UI freezing
   - Allows progress reporting

2. **Incremental Processing**
   - Process entities in batches
   - Report progress periodically
   - Reduce memory pressure

3. **Selective Data Extraction**
   - Filter geometry entities
   - Skip unnecessary relationships
   - Focus on semantic data

### Memory Efficiency

- Geometry data not stored
- Entity references use string IDs
- Relationship edges use integer arrays
- Memoization of expensive computations

## Type Definitions

### GraphNode
```typescript
interface GraphNode {
  id: string;                      // Unique ID
  label: string;                   // Display name
  type: NodeType;                  // Category
  ifcType: string;                 // IFC entity type
  properties: Record<string, any>; // All properties
  expressId?: number;              // IFC4 Express ID
  parent?: string;                 // Parent node ID
  children?: string[];             // Child IDs
}
```

### GraphEdge
```typescript
interface GraphEdge {
  id: string;              // Unique ID (source-target-type)
  source: string;          // Source node ID
  target: string;          // Target node ID
  label: string;           // Display label
  type: string;            // Relationship type
  metadata?: Record<string, any>;
}
```

### IFC5Entity
```typescript
interface IFC5Entity {
  path: string;                    // UUID path
  ifcType: string;                 // IFC class
  properties: Record<string, any>; // All properties
  children?: string[];             // Child paths
  parent?: string;                 // Parent path
}
```

## Error Handling

### Parsing Errors
```typescript
try {
  const result = await parseIFCFile(file);
} catch (error) {
  if (error.type === 'INVALID_FORMAT') {
    // File is not valid IFC
  } else if (error.type === 'PARSE_ERROR') {
    // Parsing failed at position
  } else if (error.type === 'WASM_ERROR') {
    // WASM initialization failed
  }
}
```

### Validation Errors
- Missing required relationships
- Invalid entity hierarchy
- Type constraint violations
- Schema violations

## Testing

### Test Files
Located in `public/testFiles/`:
- `FZK Haus.ifc` - Building example (IFC4)
- `Infra-Bridge.ifc` - Infrastructure (IFC4)
- `hello-wall.ifcx` - Simple structure (IFC5)
- `esempio_01 edificius (1).ifcx` - Complex structure (IFC5)

### Test Coverage
- ✅ IFC4 parsing
- ✅ IFC5 parsing
- ✅ Relationship extraction
- ✅ Type classification
- ✅ Error handling
- ✅ Large file performance

## Extension Points

### Adding New Parsers

To support additional IFC versions or formats:

1. Create new parser module (e.g., `ifcCustomParser.ts`)
2. Implement IFCParsingResult interface
3. Register in file routing logic
4. Add type definitions if needed
5. Create corresponding components if required

### Custom Composition Builders

For specialized composition logic:

```typescript
class CustomCompositionBuilder implements CompositionBuilder {
  build(entities: Map<string, IFC5Entity>): CompositionData {
    // Custom logic here
  }
}
```

## Configuration

### WASM Path
```typescript
const wasmPath = process.env.WASM_PATH || '/ifc-wasm/web-ifc.wasm';
```

### Parser Options
```typescript
interface ParserOptions {
  includeGeometry?: boolean;  // Default: false
  filterTypes?: string[];     // Entity types to include
  maxEntities?: number;       // Parsing limit
}
```

## Performance Characteristics

### IFC4 Parsing
- 1,000 entities: < 500ms
- 5,000 entities: 1-2 seconds
- 10,000 entities: 3-5 seconds

### IFC5 Parsing
- 1,000 entities: < 200ms
- 5,000 entities: 500ms-1s
- 10,000 entities: 1-2 seconds

### Graph Creation
- Node creation: O(n) where n = entities
- Edge creation: O(m) where m = relationships
- Index building: O(n)

## Monitoring

### Available Metrics
```typescript
metadata: {
  parseTime: number;           // Milliseconds
  entityCount: number;         // Total entities
  relationshipCount: number;   // Total relationships
  memoryUsed: number;          // Bytes
  avgPropertiesPerEntity: number;
}
```

## Future Enhancements

### Short Term
- [ ] IFC2x3 full support
- [ ] Enhanced error recovery
- [ ] Streaming parser for large files
- [ ] Custom entity filtering

### Medium Term
- [ ] IFC6 support
- [ ] Industry extensions
- [ ] Custom schema support
- [ ] Property set extensions

### Long Term
- [ ] Multi-file merging
- [ ] Incremental updates
- [ ] Real-time synchronization
- [ ] Advanced query language
