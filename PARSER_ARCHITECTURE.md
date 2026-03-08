# IFC Parser Architecture

## Overview

The IFC parsing system supports two fundamentally different IFC file formats through specialized parsers while delivering a **unified data model** (`ParsedIFCData`) for all visualization and validation features. All heavy parsing runs in Web Workers to keep the UI responsive.

```
File Upload
    |
    v
Extension Detection
    |-- .ifc  --> IFC STEP Parser Pipeline  (Web Worker)
    |-- .ifcx --> IFC5 JSON Parser Pipeline (main thread, JSON.parse)
    |
    v
Format-specific parsing
    |
    v
Unified ParsedIFCData
    |- graphData        (GraphNode[] + GraphEdge[])
    |- allEntities      (semantic entities only)
    |- geometryEntities (geometry entities only)
    |- metadata         (fileName, fileSize, entityCount, parseTime, isIFC5)
    |- rawData          (rawStepLines Map | composedObject | ifc5File)
    |- validation?      (ValidationResult)
```

---

## IFC STEP Parser Pipeline

### Entry Point: `ifcParserWorker.ts`

All IFC STEP parsing runs inside a Web Worker to prevent UI blocking. The worker:

1. Receives `{ type: 'parse', fileId, file }` from the main thread
2. Calls `parseIFCFile(file)` (from `ifcParser.ts`)
3. Calls `createGraphDataFromEntities(...)` (from `graphBuilder.ts`)
4. Serializes `rawStepLines` as parallel arrays for zero-copy transfer
5. Posts `complete` with the full `ParsedIFCData`

### Core Parser: `src/lib/ifcParser.ts`

The main STEP parser uses the **web-ifc** v0.0.74 WASM library.

**Initialization:**
```typescript
const ifcApi = new IfcAPI();
ifcApi.SetWasmPath('/ifc-wasm/');
await ifcApi.Init();
const modelID = ifcApi.OpenModel(data);
```

**Entity iteration:**
```typescript
const lines = ifcApi.GetAllLines(modelID);
for (const expressID of lines) {
  const entity = ifcApi.GetEntityData(modelID, expressID);
  // classify, extract properties, store
}
```

**Geometry exclusion:**
- `GEOMETRY_TYPES` set contains 100+ IFC types (IFCSHAPEREPRESENTATION, IFCFACE, IFCPOLYLOOP, profile definitions, etc.)
- Geometry entities are stored in `geometryEntities[]` (shown in IFC Browser) but excluded from `graphData` (shown in Graph View)
- `isGeometryType(ifcType)` exported for use by `graphBuilder.ts`

**Relationship extraction:**
The parser queries all relationship entities (IFCRELAGGREGATES, IFCRELCONTAINEDINSPATIALSTRUCTURE, IFCRELVOIDSELEMENT, IFCRELFILLSELEMENT, IFCRELDEFINESBYPROPERTIES, IFCRELASSOCIATESMATERIAL, etc.) and builds typed `GraphEdge` objects.

### Supported Relationship Types

| IFC Type | Edge Type | Description |
|----------|-----------|-------------|
| IFCRELAGGREGATES | AGGREGATES | Hierarchical aggregation |
| IFCRELCONTAINEDINSPATIALSTRUCTURE | CONTAINS | Spatial containment |
| IFCRELVOIDSELEMENT | VOIDS | Openings in elements |
| IFCRELFILLSELEMENT | FILLS | Fillings in openings |
| IFCRELDEFINESBYPROPERTIES | PROPERTY_REFERENCE | Property set association |
| IFCRELASSOCIATESMATERIAL | MATERIAL | Material association |
| IFCRELASSOCIATESCLASSIFICATION | CLASSIFICATION | Classification reference |
| IFCRELDEFINESBYTYPE | TYPE_DEFINITION | Type object linking |

### Entity Classification

```typescript
type NodeType = 'building' | 'space' | 'element' | 'property' | 'relationship' | 'geometry' | 'other' | 'Mesh' | 'Curve' | 'Points' | 'Group'

// Classification rules:
IFCPROJECT, IFCSITE, IFCBUILDING, IFCBUILDINGSTOREY  -> 'building'
IFCSPACE, IFCZONE                                     -> 'space'
IFCWALL, IFCDOOR, IFCWINDOW, IFCSLAB, IFCCOLUMN, ... -> 'element'
IFCPROPERTYSET, IFCPROPERTYSETDEFINITION, ...         -> 'property'
IFCREL*                                               -> 'relationship'
[GEOMETRY_TYPES]                                      -> 'geometry'
```

### Parser Enhancements: `src/lib/ifcParserEnhancements.ts`

- **`normalizePropertyValue(value)`**: handles wrapped IFC values (IFCLABEL, IFCTEXT, boolean enums like `.TRUE.`, reference extraction)
- **`PROPERTY_MAPPINGS`**: per-entity-type canonical property name maps (e.g., `IfcWall` -> `{ name: 'Name', description: 'Description', ... }`)
- **`NormalizedEntity`** interface: consistent entity shape post-normalization

### Graph Builder: `src/lib/graphBuilder.ts`

After `parseIFCFile()` runs, `createGraphDataFromEntities()` enriches the output:

1. Assigns `_schemaColor` to each node using `colorScheme.ts`
2. Assigns `_ifcStep` (raw STEP line text) from `rawStepLines` Map
3. Calls `attachPropertySets()`  parses raw STEP strings for `IFCRELDEFINESBYPROPERTIES` to link property data
4. Returns the final `GraphData` ready for `GraphVisualization`

### STEP Representation Generator: `src/lib/stepRepresentationGenerator.ts`

Called lazily by `IFCBrowser.tsx` when a user selects an entity and needs the STEP text:

```
Priority:
  1. rawStepLines.get(expressId)  -> direct from parsed file (best)
  2. geometry placeholder          -> for geometry entities without stored lines
  3. reconstruct from entity obj   -> fallback for any remaining entities
```

### rawStepLines Transfer Optimization

`rawStepLines` is a `Map<expressId: number, stepLine: string>` that can contain 100,000+ entries for large models.

**Problem**: Posting a plain JavaScript Object with 100,000+ integer keys across the Worker boundary requires full serialization.

**Solution**: Serialize as parallel arrays:
```typescript
// In worker (before postMessage):
const keys = new Int32Array(rawStepLines.size);   // zero-copy Transferable
const values: string[] = new Array(rawStepLines.size);
let i = 0;
for (const [k, v] of rawStepLines) {
  keys[i] = k;
  values[i] = v;
  i++;
}
// Transfer keys buffer, copy values
postMessage({ type: 'complete', data: { ..., keys, values } }, [keys.buffer]);
```
```typescript
// In main thread (useIFCWorker.ts):
const rawStepLines = new Map<number, string>();
for (let i = 0; i < keys.length; i++) {
  rawStepLines.set(keys[i], values[i]);
}
```

This gives zero-copy transfer for the integer key buffer (Transferable `ArrayBuffer`) while the string values are serialized normally. This approach is significantly faster than serializing a 100K-key Object.

---

## IFC5 JSON Parser Pipeline

IFC5 parsing uses a **three-stage pipeline** running on the main thread (JSON.parse is fast and non-blocking for typical IFC5 file sizes):

```
.ifcx file (JSON)
    |
    v
Stage 1: ifc5ParserMain.ts  -- JSON.parse + attribute validation
    |
    v
Stage 2: ifc5Composition.ts -- inheritance/composition resolution
    |
    v
Stage 3: ifc5ToGraph.ts     -- ComposedObject tree + GraphData
```

### Stage 1: IFC5 Parser Main (`src/lib/ifc5ParserMain.ts`)

Entry point. Key functions:

**`isIFC5File(data)`**  Detection heuristic: checks for `{ data: [...] }` structure with path-based UUIDs.

**`loadIFC5FromFile(file)`**  Orchestrator:
1. Reads file as text, `JSON.parse()`
2. Calls `ifc5Composition` engine
3. Calls `ifc5ToGraph.convertToGraph()`
4. Validates attributes against `IFC5Schema`
5. Returns `ParsedIFCData`

**`parseIFC5Tree(nodes, schema)`**  Validates each node's attributes against the schema definition, reporting type mismatches.

### IFC5 Node Structure

```json
{
  "path": "uuid-string/child-path",
  "children": { "childKey": "child-uuid/path" },
  "inherits": { "baseKey": "base-uuid/path" },
  "attributes": {
    "bsi::ifc::class": { "code": "IfcBuildingStorey" },
    "bsi::ifc::prop::Name": { "String": "Ground Floor" },
    "usd::usdgeom::xformop:transform": { "Matrix4d": [[...], [...], [...], [...]] }
  }
}
```

### Stage 2: IFC5 Composition Engine (`src/lib/ifc5Composition.ts`)

Implements the buildingSMART IFC5 inheritance/composition specification.

**Key concept**: IFC5 nodes can inherit attributes from other nodes via the `inherits` field. The composition engine resolves this inheritance chain to produce a flat `PostCompositionNode` with all inherited attributes merged.

**Functions:**
- `toInputNodes(ifc5File)`  Converts IFC5File nodes to `CompositionInputNode[]`
- `flattenCompositionInput(inputs)`  Flattens nested input structure
- `createArtificialRoot(inputs)`  Creates a virtual root for disconnected trees
- `expandFirstRootInInput(inputs)`  Resolves the composition tree starting from the root, applying inheritance in path-ordered traversal

**Output**: `PostCompositionNode` tree where each node has its **final merged attributes** (own attributes + inherited attributes, with own taking precedence).

### Stage 3: IFC5 To Graph (`src/lib/ifc5ToGraph.ts`)

Converts the `PostCompositionNode` tree to two output formats:

**`ComposedObject`** (for 3D and IFC5 panels):
```typescript
interface ComposedObject {
  name: string;           // UUID path
  type: string;           // IFC class (from bsi::ifc::class attribute)
  attributes: Record<string, any>; // Merged attributes
  children: ComposedObject[];
  geometry?: {
    mesh?: MeshGeometry;
    curve?: CurveGeometry;
    points?: PointsGeometry;
  };
  material?: MaterialDef;
  transform?: Matrix4;
}
```

**`GraphData`** (for force-directed graph):
- Each `ComposedObject` becomes a `GraphNode`
- Children become `CONTAINS` edges
- Inherited-from relationships become `INHERITS` edges

**Additional functions:**
- `getIFC5Statistics()`  Entity counts, type distribution, attribute statistics

**Geometry extraction functions** (used by `useIFC5Viewer` to build Three.js objects from `ComposedObject` attributes):

| Function | Returns | Description |
|----------|---------|-------------|
| `extractMeshGeometry(attributes)` | `MeshGeometry \| null` | Extracts vertex positions, normals, and triangle indices from the node's geometry attributes |
| `extractCurveGeometry(attributes)` | `CurveGeometry \| null` | Extracts polyline point arrays for `THREE.Line` rendering |
| `extractPointCloudGeometry(attributes)` | `PointsGeometry \| null` | Extracts point positions and per-point colors; supports raw float arrays and base64-encoded float32 buffers |
| `extractMaterial(attributes, parentPath)` | `IFC5Material` | Reads `baseColorFactor` (RGBA), `metallicFactor`, `roughnessFactor` for PBR; falls back to `diffuseColor` for Lambert shading |
| `extractTransform(attributes)` | `{ matrix: number[][] } \| null` | Reads `usd::usdgeom::xformop:transform` (column-major 4×4); `useIFC5Viewer` transposes it to Three.js row-major via `.transpose()` |

These functions run **on the main thread**, unlike the IFC STEP geometry pipeline which uses `ifcGeometryWorker`. Visibility is controlled separately: nodes with `usd::usdgeom::visibility::visibility === 'invisible'` are skipped in `traverseAndRender()` before any geometry extraction occurs.

### IFC5 Graph Visualization Conversion (`src/lib/ifc5GraphVisualization.ts`)

`convertComposedObjectToGraph(composedObject, options)` adds fine-grained control:

```typescript
interface IFC5GraphOptions {
  showGeometryNodes: boolean;   // Include Mesh/Curve/Points nodes
  showAttributeNodes: boolean;  // Include attribute key-value nodes
  showInheritanceEdges: boolean;// Include INHERITS edges
  filterRelationships: string[];// Only show selected edge types
  clusterByNamespace: boolean;  // Group nodes by attribute namespace
}
```

### IFC5 Fallback Parser (`src/lib/ifc5Parser.ts`)

A simpler alternative parser that converts IFC5 JSON directly to `GraphData` without the composition step:
- Used when the composition engine encounters errors
- `classifyNodeTypeIFC5(ifcClass)` maps IFC5 class names to `NodeType`
- Creates `CHILD` and `INHERITS` edges directly from the raw node structure

---

## Geometry Processing Pipeline

### Geometry Worker: `src/workers/ifcGeometryWorker.ts`

Completely off-thread geometry extraction using web-ifc WASM.

**Message handlers:**

**`parse`** message  Full model geometry extraction:
```typescript
interface MeshPayload {
  expressID: number;
  positions: Float32Array;      // XYZ vertex positions
  normals: Float32Array;        // XYZ normals
  indices: Uint32Array;         // Triangle indices
  transform: Float32Array;      // 4x4 column-major matrix (16 floats)
  color: [r, g, b, a];          // RGBA normalized (0-1)
}
```

Processing:
1. `IfcAPI.Init()` and `OpenModel(buffer)`
2. `IfcAPI.GetAllGeometry(modelID)` iterates all geometric items
3. For each geometry item: extract flat arrays, resolve transform, assign color by IFC type
4. Posts `MeshPayload[]` to main thread (Transferable ArrayBuffers)

**`inspect`** message  Single entity property fetch:
```typescript
{ type: 'inspect', expressID: number }
// returns entity properties for 3D click-to-inspect
```

**`dispose`** message  Free WASM model memory:
```typescript
{ type: 'dispose' }
// calls IfcAPI.CloseModel(modelID)
```

**Type-based color mapping (50+ types):**
```
Walls (IFCWALL, IFCWALLSTANDARDCASE):     #808080 (grey)
Floors/Slabs (IFCSLAB):                  #A0A0A0 (light grey)
Doors (IFCDOOR):                         #8B4513 (brown)
Windows (IFCWINDOW):                     #ADD8E6 (light blue)
Beams (IFCBEAM):                         #4A90D9 (blue)
Columns (IFCCOLUMN):                     #2C5F2E (dark green)
Stairs (IFCSTAIR):                       #D2691E (chocolate)
Roofs (IFCROOF):                         #8B0000 (dark red)
HVAC ducts (IFCDUCTFITTING/SEGMENT):     #4169E1 (royal blue)
Pipes (IFCPIPEFITTING/SEGMENT):          #DC143C (crimson)
Electrical (IFCCABLECARRIERFITTING):     #FFA500 (orange)
Furniture (IFCFURNISHINGELEMENT):        #DEB887 (burlywood)
[others]:                                #9E9E9E (default grey)
```

---

## Graph Construction

### Level of Detail: `src/lib/graphLoD.ts`

`applyLoD(graphData: GraphData, level: LoDLevel): GraphData` filters the node and edge arrays.

The `AUXILIARY_EXCLUDE_TYPES` set (100+ types) is excluded at **all** LoD levels:
- **Geometric primitives**: IFCPOINT, IFCLINE, IFCCURVE, IFCSURFACE, IFCPOLYLOOP, IFCFACE, IFCSHELL, etc.
- **Profile definitions**: IFCRECTANGLEPROFILEDEF, IFCCIRCLEPROFILEDEF, IFCISHAPEPROFILEDEF, IFCLSHAPEPROFILEDEF, etc.
- **Material metadata**: IFCMATERIAL, IFCMATERIALLAYER, IFCMATERIALLAYERSTACK, etc.
- **Style definitions**: IFCSURFACESTYLE, IFCHATCHLINEDISTANCESELECT, IFCTEXTURECOORDINATE, etc.
- **Measurement primitives**: IFCQUANTITYLENGTH, IFCQUANTITYAREA, IFCUNITASSIGNMENT, etc.
- **Window/door detail**: IFCWINDOWLININGPROPERTIES, IFCDOORLININGPROPERTIES, etc.

```
LoD 1 (Spatial):    { IFCPROJECT, IFCSITE, IFCBUILDING, IFCBUILDINGSTOREY, IFCSPACE }
                    + their connecting edges only

LoD 2 (Elements):   LoD 1 + building elements:
                    { IFCWALL, IFCWALLSTANDARDCASE, IFCSLAB, IFCCOLUMN,
                      IFCBEAM, IFCDOOR, IFCWINDOW, IFCROOF, IFCSTAIR,
                      IFCFOOTING, IFCPLATE, IFCMEMBER, ... }

LoD 3 (Properties): LoD 2 + property/classification/type nodes:
                    { IFCPROPERTYSET, IFCELEMENTTYPE, IFCMATERIAL (as node),
                      IFCCLASSIFICATIONREFERENCE, ... }
                    Excludes most auxiliary geometric entities

LoD 4 (Full):       All non-auxiliary entities
                    Only AUXILIARY_EXCLUDE_TYPES excluded
```

Original `parsedData.graphData` is never modified; `applyLoD()` returns a new object.

### Tree Builder: `src/lib/treeBuilder.ts`

`enrichEntitiesForTree(entities, rawStepLines)` adds `_ifcStep` text to entities before they are passed to `IFCBrowser`. This keeps the STEP text lookup out of the render path.

### Schema Layer Mapping: `src/lib/schema-layer-mapping.ts`

```typescript
const SCHEMA_LAYERS = {
  domain:             { name: 'Domain Layer',             color: '#7C3AED' },
  interoperability:   { name: 'Interoperability Layer',   color: '#2563EB' },
  core:               { name: 'Core Layer',               color: '#059669' },
  resource:           { name: 'Resource Layer',           color: '#D97706' },
};

// ENTITY_TO_LAYER_MAP maps 200+ IFC types to their layer:
// IFCWALL -> 'domain'
// IFCRELCONTAINEDINSPATIALSTRUCTURE -> 'core'
// IFCPROPERTYSET -> 'resource'
// ...

function getSchemaLayerForEntity(ifcType: string): SchemaLayer | null
```

Used by `NodeDetailsPanel` to display the schema layer badge alongside the entity definition.

---

## Schema Integration

### Static Schema Catalog: `src/lib/ifcSchema.ts`

```typescript
interface IfcEntityDef {
  name: string;
  displayName: string;
  description: string;
  category: EntityCategory;  // 'building' | 'element' | 'property' | etc.
  icon: string;
  color: string;             // hex color for graph nodes
  properties: PropertyDef[];
  validParentTypes: string[];
  validChildTypes: string[];
  relationships: RelationshipDef[];
  validationRules: ValidationRule[];
}

const IFC_SCHEMA: Map<string, IfcEntityDef> = new Map([
  ['IFCWALL', { ... }],
  ['IFCSLAB', { ... }],
  // 100+ entities
]);

function getEntityDef(ifcType: string): IfcEntityDef | undefined
function getEntityDisplayName(ifcType: string): string
function getEntityColor(ifcType: string): string
```

### Dynamic Schema Loader: `src/lib/ifcSchemaLoader.ts`

Fetches and caches the full IFC JSON schemas from `public/schemas/`:

```typescript
// Schema files:
// public/schemas/schema-ifc2x3.json
// public/schemas/IFC4.json
// public/schemas/IFC4X3.json

async function loadSchemaFile(version: 'IFC2x3' | 'IFC4' | 'IFC4X3'): Promise<IFCSchema>
async function getEntityFromSchemaAsync(ifcType: string, version: string): Promise<SchemaEntity | null>
async function getAllAttributesAsync(ifcType: string, version: string): Promise<Attribute[]>
// getAllAttributesAsync recursively loads supertypes (via ENTITY_SUPERTYPES map)
```

Used by `NodeDetailsPanel` and `PropertyViewer` to show the authoritative schema definition and attribute list for selected entities.

---

## Validation Pipeline

### Overview

```
Parsed IFC Data
    |
    v
+--------------------------------------------------+
| Dual Validation System                           |
+--------------------------------------------------+
| 1. Local Validator (DISABLED - WIP)              |
|    ifcValidatorEnhanced.ts                       |
|    - Client-side, offline                        |
|    - GUID format checks                          |
|    - Schema compliance                           |
|                                                  |
| 2. buildingSMART API Validator (ACTIVE)          |
|    bSValidate/ backend + API                     |
|    - Cloud-based, official                       |
|    - Normative IA/IP + schema checks             |
|    - Entity-level diagnostics                    |
+--------------------------------------------------+
    |
    v
ValidationResult
    |- errors:   ValidationError[]
    |- warnings: ValidationWarning[]
    |- buildingSmart?: BuildingSmartResult[]
    |- statistics: { totalErrors, totalWarnings, ... }
```

### buildingSMART Validator Flow

```
Frontend: Validation.tsx
    |
    | submitValidation(fileBuffer, filename)
    v
Backend: bSValidate/server.js (POST /api/validate)
    |
    | multer parses multipart
    | FormData with file + Authorization header
    v
BuildingSMART API
    "https://dev.validate.buildingsmart.org/api/v1/validationrequest"
    |
    | { jobId, status }
    v
Polling: buildingsmartApi.pollValidationResults(jobId)
    |
    | GET /api/results/:jobId (every 3 seconds)
    | Backend paginates all results (100 per page)
    v
buildingsmartMapper.mapBuildingSmartToValidationResult()
    |
    | - severity mapping (0-4 -> error/warning/info)
    | - task type categorization (NORMATIVE_IA, NORMATIVE_IP, INDUSTRY)
    | - functional part tagging
    v
ValidationReport.tsx
    |- BuildingSmartResults.tsx (normative tab)
    |- SchemaResults.tsx (schema tab)
```

### Local Validator: `src/lib/ifcValidatorEnhanced.ts`

**Status**: Disabled

Infrastructure in place:
```typescript
interface ValidationError {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  entityId?: string;
  entityType?: string;
  expectedValue?: string;
  actualValue?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  statistics: {
    totalChecked: number;
    totalErrors: number;
    totalWarnings: number;
  };
}

// Planned checks:
// - GUID: 22-char Base64 format validation
// - Schema compliance: entity type checking, attribute cardinality
// - Hierarchy: Project -> Site -> Building -> Storey -> Space
// - Relationship validity: valid source/target type combinations
```

---

## Type Definitions

### ParsedIFCData (unified output)
```typescript
interface ParsedIFCData {
  graphData: GraphData;           // Enriched graph with _schemaColor
  allEntities: GraphNode[];       // Semantic entities only (no geometry)
  geometryEntities: GraphNode[];  // Geometry/representation entities only
  metadata: {
    fileName: string;
    fileSize: number;
    entityCount: number;
    parseTime: number;            // milliseconds
    isIFC5: boolean;
    ifcVersion?: string;          // 'IFC2x3' | 'IFC4' | 'IFC4X3'
  };
  validation?: ValidationResult;
  rawData?: {
    composedObject?: ComposedObject;     // IFC5 composed tree
    ifc5File?: IFC5File;                 // IFC5 raw parsed JSON
    rawStepLines?: Map<number, string>;  // STEP expressID -> line text
  };
}
```

### GraphNode
```typescript
interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  ifcType: string;
  properties: Record<string, any>;
  expressId?: number;
  _schemaColor?: string;
  _ifcStep?: string;
  _fileFormat?: 'ifc4' | 'ifc5';
  // Force graph physics fields (set by react-force-graph-2d):
  x?: number; y?: number; vx?: number; vy?: number;
}
```

### GraphEdge
```typescript
interface GraphEdge {
  id: string;            // "sourceId-targetId-type"
  source: string;
  target: string;
  label: string;
  type: string;          // CONTAINS | AGGREGATES | INHERITS | VOIDS | FILLS | ...
  relationshipType?: string;
  category?: string;     // Color category for edge rendering
}
```

### IFC5 Core Types (`src/types/ifc5.ts`)
```typescript
interface IFC5Node {
  path: string;
  children?: Record<string, string>;
  inherits?: Record<string, string>;
  attributes?: Record<string, IFC5AttributeValue>;
}

interface CompositionInputNode {
  path: string;
  attributes: Record<string, IFC5AttributeValue>;
  inherits: string[];    // resolved to absolute paths
  children: string[];    // resolved to absolute paths
}

interface PostCompositionNode {
  path: string;
  ifcClass?: string;
  mergedAttributes: Record<string, IFC5AttributeValue>;
  children: PostCompositionNode[];
}

interface ComposedObject {
  name: string;
  type: string;
  attributes: Record<string, any>;
  children: ComposedObject[];
  geometry?: { mesh?, curve?, points? };
  material?: MaterialDef;
  transform?: Matrix4;
}
```

---

## Performance Characteristics

### Parsing (IFC STEP via web-ifc WASM + Worker)
| Entities | Parse Time |
|----------|-----------|
| 1,000 | < 500 ms |
| 5,000 | 1-2 s |
| 10,000 | 3-5 s |

### Parsing (IFC5 JSON, main thread)
| Entities | Parse Time |
|----------|-----------|
| 1,000 | < 200 ms |
| 5,000 | 500 ms - 1 s |
| 10,000 | 1-2 s |

### Graph Construction Complexity
- Node creation: O(n)  n entities
- Edge creation: O(m)  m relationships
- LoD filtering: O(n + m)  single pass
- `rawStepLines` reconstruction: O(k)  k STEP lines

### 3D Geometry Worker
- `MeshPayload` data is transferred as Transferable `ArrayBuffer`s (zero-copy)
- LRU cache in `useViewer3D` (max 500 items) avoids re-parsing geometry for recently-viewed entities

---

## Extension Points

### Adding a New IFC Version Parser

1. Create `src/lib/ifcParserV6.ts` (or similar)
2. Implement and return `ParsedIFCData`
3. Add format detection in `FileUpload.tsx` or `ifcParserWorker.ts`
4. Add schema JSON to `public/schemas/` and update `ifcSchemaLoader.ts`

### Adding New Relationship Types

In `ifcParser.ts`:
```typescript
const NEW_REL_TYPE = WebIFC.IFCRELNEWTHING;
const rels = ifcApi.GetLineIDsWithType(modelID, NEW_REL_TYPE);
for (const relId of rels) {
  // extract source, target, create GraphEdge with type: 'NEW_THING'
}
```

Add the new type to `RELATIONSHIP_LABELS` in `src/types/ifc.ts` and to the filter drawer in `GraphControls.tsx`.

### Adding New LoD Levels

In `graphLoD.ts`:
1. Add a new `LoDLevel` value (`5`, `6`, etc.)
2. Define which `NodeType` values and `ifcType` strings to include
3. Add the case to `applyLoD()`
4. Add a description in `lodDescriptions.ts`
5. Update the LoD dropdown in `GraphControls.tsx`

### Custom IFC5 Composition Logic

The composition engine in `ifc5Composition.ts` can be extended by modifying `expandFirstRootInInput()` to handle non-standard inheritance patterns. The `PostCompositionNode` interface defines the expected output contract.
