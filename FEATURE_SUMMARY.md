# Comprehensive Feature Implementation Summary

## Overview

Multi-format IFC visualization platform with **dual format support** (IFC STEP + IFC5 JSON), **five visualization modes** (Graph, Tree/Browser, Property Viewer, 3D Viewer, IFC5 Source Viewer), **buildingSMART API validation**, **dynamic educational learning system**, and **graph Level of Detail (LoD) optimization**. All parsing runs in Web Workers; all five IFC5 panels (Graph, Tree, Properties, Source, 3D) are bidirectionally synchronized.

---

## Format Support

### IFC STEP (`.ifc`) - IFC2x3, IFC4, IFC4X3
Parsed using the web-ifc v0.0.74 WASM library in a dedicated Web Worker.

### IFC5 JSON (`.ifcx`)
Parsed using a three-stage pipeline (parse -> compose -> convert) based on the buildingSMART IFC5 specification.

---

## Core Parsing Pipeline

### IFC STEP Parser (`src/lib/ifcParser.ts`)
- **Status**: Active
- Orchestrates web-ifc: `IfcAPI.Init()`, `OpenModel`, entity iteration, relationship extraction
- Defines `GEOMETRY_TYPES` set (100+ types) for geometry exclusion
- Classifies entities into semantic category graph nodes
- Extracts property sets and builds relationship edges
- `isGeometryType()` helper exported for use by graph builder

### Parser Enhancements (`src/lib/ifcParserEnhancements.ts`)
- `normalizePropertyValue()` handles wrapped values, boolean enums, and references
- `PROPERTY_MAPPINGS` per entity type for canonical property name normalization
- `NormalizedEntity` interface for consistent entity shape post-parsing

### STEP Representation Generator (`src/lib/stepRepresentationGenerator.ts`)
- `generateSTEPRepresentation()` called lazily when IFC Browser displays a STEP line
- Priority order: raw line from `rawStepLines` Map -> geometry placeholder -> reconstructed from entity object

### Graph Builder (`src/lib/graphBuilder.ts`)
- `createGraphDataFromEntities()`: assigns `_schemaColor` + `_ifcStep` in a single pass
- `attachPropertySets()`: links property set data to entities via raw STEP string parsing
- Consumes pre-computed parser edges for efficiency

---

## IFC5 Parsing Pipeline

### IFC5 Parser Main (`src/lib/ifc5ParserMain.ts`)
- **Status**: Active
- `isIFC5File()` detection heuristic
- `loadIFC5FromFile()` orchestrator: JSON parse -> compose -> convert -> validate attributes
- `parseIFC5Tree()` validates attributes against `IFC5Schema`
- Returns `ParsedIFCData` with both `graphData` and the `composedObject` tree

### IFC5 Composition Engine (`src/lib/ifc5Composition.ts`)
- **Status**: Active
- Implements the buildingSMART IFC5 inheritance/composition specification
- Key functions: `toInputNodes()`, `flattenCompositionInput()`, `createArtificialRoot()`, `expandFirstRootInInput()`
- Resolves the UUID-path-based inheritance graph into a `PostCompositionNode` tree

### IFC5 Parser (fallback) (`src/lib/ifc5Parser.ts`)
- Alternative simpler parser that creates `GraphData` (nodes/edges) directly from IFC5 JSON
- Extracts `bsi::ifc::class`, creates child/inherits edges
- `classifyNodeTypeIFC5()` maps IFC5 class names to `NodeType`

### IFC5 To Graph (`src/lib/ifc5ToGraph.ts`)
- Converts `PostCompositionNode` -> `ComposedObject` (for 3D rendering)
- Extracts mesh, curve, and point cloud geometry with materials and transforms
- `convertToGraph()` for graph data
- `getIFC5Statistics()` for metadata

### IFC5 Graph Visualization (`src/lib/ifc5GraphVisualization.ts`)
- `convertIFC5ToGraph()` and `convertComposedObjectToGraph()`
- Configurable: show/hide geometry nodes, attribute nodes, inheritance edges
- Clustering by namespace
- Relationship type filtering

---

## Web Workers

### IFC Parser Worker (`src/workers/ifcParserWorker.ts`)
- **Status**: Active
- Receives `{ type: 'parse', fileId, file }` from main thread
- Calls `parseIFCFile()` then `createGraphDataFromEntities()` for full parsing + graph build
- Reports `progress` messages throughout (percentage + message string)
- Serializes `rawStepLines` Map as **parallel arrays** for efficient transfer:
  - `keys: Int32Array` (zero-copy ArrayBuffer Transferable)
  - `values: string[]` (Express ID -> STEP line text)
- Posts `complete` with full `ParsedIFCData`

**Key design decision**: Using parallel arrays instead of a plain Object avoids serializing 300,000+ property keys and enables zero-copy ArrayBuffer transfer for the integer keys.

### IFC Geometry Worker (`src/workers/ifcGeometryWorker.ts`)
- **Status**: Active (used by Viewer3D)
- Loads web-ifc WASM, parses IFC geometry completely off-thread
- Handles three message types:
  - `parse`: loads model, iterates `IfcAPI.GetAllGeometry()`, extracts `MeshPayload[]`
  - `inspect`: fetches properties for one entity by expressID
  - `dispose`: frees the model from WASM memory
- Type-based color mapping for 50+ IFC types (walls grey, doors brown, windows cyan, HVAC blue, structural green, pipes red, electrical orange, etc.)
- Each `MeshPayload` contains: positions, normals, indices (as flat Float32/Uint32 arrays), transform matrix, expressID, color

---

## Level of Detail (LoD) System

### LoD Framework (`src/lib/graphLoD.ts`)
- **Status**: Active (complete rewrite from original)
- `applyLoD(graphData, lodLevel)` filters nodes and edges before rendering
- `AUXILIARY_EXCLUDE_TYPES`: 100+ non-meaningful IFC types excluded at all LoD levels
  (geometric primitives, profile definitions, material metadata, style definitions, measurement primitives)
- `isAuxiliaryType(ifcType)` helper

### LoD Levels (4-Tier System)

| Level | Name | Includes | Use Case |
|-------|------|---------|---------|
| LoD 1 | Spatial Hierarchy | IFCPROJECT, IFCSITE, IFCBUILDING, IFCBUILDINGSTOREY, IFCSPACE | First-pass overview of any model |
| LoD 2 | Elements & Structure | LoD1 + walls, floors, slabs, beams, columns, doors, windows, structural members | General visualization of building geometry |
| LoD 3 | + Properties | LoD2 + property sets, material associations, classification, type objects | Balanced performance and completeness |
| LoD 4 | Full Semantic | All non-auxiliary entities | Comprehensive analysis; may be slow for large models |

### LoD Descriptions (`src/lib/lodDescriptions.ts`)
- `LOD_DESCRIPTIONS` map with human-readable name, description, includes/excludes, bestFor per level
- `getLoDDescription(level)` used by GraphControls LoD dropdown

### Performance Impact (approximate)

| LoD | Typical Node Reduction | Render Speed vs. LoD 4 |
|-----|----------------------|------------------------|
| LoD 4 | Baseline | Baseline |
| LoD 3 | ~30-40% fewer nodes | ~25-50% faster |
| LoD 2 | ~60-70% fewer nodes | ~100-200% faster |
| LoD 1 | ~80-90% fewer nodes | ~300%+ faster |

---

## IFC5 Visualization Components

### IFC5 Graph Visualization (`src/components/IFC5GraphVisualization.tsx`)
- **Status**: Active
- Force-directed graph for `.ifcx` files
- Converts `ComposedObject` to graph via `convertComposedObjectToGraph()`
- Controls panel: geometry nodes toggle, attribute nodes toggle, inheritance edges toggle, relationship type filter, namespace clustering
- Bidirectional cross-panel selection sync via `onNodeSelect` callback

### IFC5 Tree Browser (`src/components/IFC5TreeBrowser.tsx`)
- **Status**: Active
- Hierarchical tree for IFC5 composed objects
- Search with deep attribute matching and text highlight
- Expand/collapse nodes, icons by IFC class, IFC class badges
- Uses `VirtualList` for windowed rendering performance

### IFC5 Property Viewer (`src/components/IFC5PropertyViewer.tsx`)
- **Status**: Active
- Displays composed (post-inheritance) attributes for a selected IFC5 node
- Breadcrumb navigation, IFC class summary
- Attributes grouped by namespace: `bsi::ifc::`, `usd::usdgeom::`, `mesh::`, etc.
- Special rendering: 4x4 matrix display, geometry array summarization, reference links

### IFC5 Source Viewer (`src/components/IFC5SourceViewer.tsx`)
- **Status**: Active
- Shows the raw `.ifcx` JSON content with syntax highlighting
  - Keys: sky blue; strings: green; numbers: purple; booleans: pink
- Inline search with match highlight and jump-to-next-match
- Large geometry arrays (positions, normals, indices) truncated to prevent browser freeze
- Click on a node's JSON block to cross-select it in Tree and Graph panels

### IFC5 3D Viewer (`src/hooks/useIFC5Viewer.ts`)
- **Status**: Active
- Full Three.js 3D scene rendered **inline** from the `ComposedObject` tree — no separate geometry worker
- **Auto-loads** when an `.ifcx` file is parsed (`setViewer3DLoaded(true)` triggered in `handleFileSelect`)
- **Scene setup**: PerspectiveCamera (FOV 75, Z-up `camera.up.set(0,0,1)`), WebGLRenderer with antialias + `logarithmicDepthBuffer`, OrbitControls with 0.25 damping, AmbientLight (0.5) + 3 DirectionalLights (0.8 / 0.5 / 0.3), GridHelper 100×100, AxesHelper
- **Geometry support**:
  - `Mesh` → `THREE.Mesh` with `MeshStandardMaterial` (PBR: `baseColorFactor`, `metallicFactor`, `roughnessFactor`) or `MeshLambertMaterial` (diffuseColor fallback)
  - `Curve` → `THREE.Line` + `LineBasicMaterial`
  - `Points` → `THREE.Points` + `PointsMaterial`; supports base64-encoded float32 position and color buffers
- **Visibility**: Skips nodes where `usd::usdgeom::visibility::visibility === 'invisible'`
- **Transforms**: Column-major 4×4 matrix from `usd::usdgeom::xformop:transform`, transposed to Three.js row-major convention
- **`loadComposedObject(root)`**: Clears scene (preserving lights/grid/axes), disposes old GPU resources, recursively renders the tree, then auto-fits camera/controls to model bounding box
- **`selectObject(path)`**: Highlights selected mesh with emissive `0x4f46e5` (indigo) at intensity 0.3; stores original material in `_origMaterial` for restore on deselect
- **Raycasting**: Mouse click walks `object.parent` chain until a `userData.path` is found, then fires `onObjectClick(path)` for cross-panel sync
- Returns `{ isInitialized, selectedPath, loadComposedObject, selectObject }` to Index page

---

## IFC STEP Visualization Components

### Graph Visualization (`src/components/GraphVisualization.tsx`)
- **Status**: Active
- Force-directed graph using `react-force-graph-2d`
- `applyLoD()` applied before rendering; relationship filters applied server-side in state
- Custom canvas rendering: colored nodes by type, directional colored edges by category, labels at zoom >= 1.5
- Node click (select) / background click (deselect) / hover (tooltip)
- Zoom controls, fit-to-view, center-on-selection
- Reports `onStatsUpdate` with filtered node/edge counts for StatsPanel

### Graph Controls (`src/components/GraphControls.tsx`)
- **Status**: Active
- Floating control bar containing:
  - Text search input (Ctrl+F)
  - LoD level dropdown (1-4) with `getLoDDescription()` tooltip
  - Filter drawer (node type toggles + relationship type toggles with color swatches)
  - Export dropdown (JSON / CSV-nodes / CSV-edges / STEP text / PNG screenshot)

### IFC Browser (`src/components/IFCBrowser.tsx`)
- **Status**: Active
- Split-panel layout: entity list (left) + entity detail (right)
- Left: searchable, sorted entity list; each entry renders with IFC STEP syntax highlighting
- Right: expanded entity properties + IFC schema definition + "Referenced By" algorithm
- Click any `#number` in STEP lines to navigate to that entity
- Copy to clipboard, virtual scrolling, and pagination

### Node Details Panel (`src/components/NodeDetailsPanel.tsx`)
- **Status**: Active
- Slide-in or inline panel for a selected graph node
- IFC type badge, schema layer badge, entity definition
- Related property sets, filtered properties
- "Learn More" educational section
- BuildingSMART docs link (generated by `docsLinkGenerator.ts` per entity and schema version)

---

## 3D Viewer

### Viewer3D Component (`src/components/Viewer3D.tsx`)
- **Status**: Active
- Three.js IFC 3D viewer using `ifcGeometryWorker` for off-thread geometry parsing
- Upon worker `complete`: builds Three.js `BufferGeometry` + `MeshPhongMaterial` for each `MeshPayload`
- Selection highlight: selected mesh gets emissive glow; all other meshes set to 8% opacity
- Zoom-to-selected entity on programmatic selection; orbit controls for manual navigation
- Depth buffer enabled for correct rendering of complex models

### useIFC5Viewer Hook (`src/hooks/useIFC5Viewer.ts`)
- **Status**: Active — see [IFC5 3D Viewer](#ifc5-3d-viewer-srchooksuseIFC5Viewerts) above for full details
- Manages Three.js scene lifetime: creates on mount, disposes renderer/geometries/materials on unmount
- Returns `selectObject(path)` for programmatic highlight from other panels

### useViewer3D Hook (`src/hooks/useViewer3D.ts`)
- **Status**: Active
- State management: `isEnabled`, `isVisible`, `selectedNodeId`, loading progress
- **LRU geometry cache** (max 500 items): avoids re-parsing geometry for recently-viewed entities
- Methods: `enable3DViewer`, `disable3DViewer`, `selectNode3D`, `cacheGeometry`, `getGeometry`, `updateProgress`, `reset`

---

## Validation System

### Validation Page (`src/pages/Validation.tsx`)
- **Status**: Active
- Receives `parsedData` + `ifcFileBuffer` via `useLocation` state
- buildingSMART API polling at the component level
- Entity click: navigates back to Index with entity pre-highlighted

### buildingSMART Validator Backend (`bSValidate/server.js`)
- **Status**: Active (Express on port 5001)
- `POST /api/validate`: receives `.ifc` via multer, forwards to `https://dev.validate.buildingsmart.org/api/v1/validationrequest` with Bearer token from `BUILDINGSMART_TOKEN` env
- `GET /api/results/:jobId`: fetches status + paginates all results (100 per page)
- `DELETE /api/cancel/:jobId`: cancels a job

### buildingSMART API Client (`bSValidate/src/services/buildingsmartApi.ts`)
- `submitValidation(buffer, filename)`: posts file to backend `/api/validate`
- `pollValidationResults(jobId, onStatus, intervalMs, maxAttempts)`: polls `/api/results/:jobId`
- `cancelValidation(jobId)`
- `BuildingSmartApiError` class with `statusCode`

### buildingSMART Result Mapper (`bSValidate/src/services/buildingsmartMapper.ts`)
- `mapBuildingSmartToValidationResult()`: converts raw API response to internal `ValidationResult`
- Maps numeric severity (0-4) to `error` / `warning` / `info`
- Categorizes results into `NORMATIVE_IA`, `NORMATIVE_IP`, `INDUSTRY` task types
- Enriches results with functional part tags from `functionalParts.ts`

### Functional Parts Catalog (`bSValidate/src/lib/functionalParts.ts`)
- Complete catalog of IFC validation functional part codes:
  - PJS = Project, GRF = Georeferencing, BLT = Built elements, SPA = Spaces, etc.
- `mapBuildingSmartFeatureToFunctionalPart()`, `getFunctionalPart()`

### Schema Interpreter (`bSValidate/src/lib/schemaInterpreter.ts`)
- `interpretSchemaError()` -> `InterpretedSchemaError` with human-readable summary, rule type emoji, educational context
- Used by `SchemaResults.tsx` to provide friendly explanations alongside raw schema errors

### Normative Interpreter (`bSValidate/src/lib/normativeInterpreter.ts`)
- `extractNormativeEntityInfo()` parses normative rule descriptions into structured data
- Used by `BuildingSmartResults.tsx`

### Validation Report Components
- **`BuildingSmartResults.tsx`**: Normative validation results grouped by rule code. Collapsible groups, severity icons, STEP ID links, expected/observed columns, entity click navigation, severity checkbox filtering.
- **`SchemaResults.tsx`**: Schema-level errors grouped by schema rule name. Shows rule logic, interpreted explanations, entity STEP ID links.

### Validation Export (`bSValidate/src/lib/exportValidation.ts`)
- `exportToJSON()`, `exportToCSV()`, `exportToText()`, `getDefaultExportFilename()`

### Local Validator (`src/lib/ifcValidatorEnhanced.ts`)
- **Status**: Disabled - Work in Progress
- `ValidationError`, `ValidationResult` interfaces (still used as shared types)
- `validateIFCData()`, `validateIFCFileSyntax()` - not called in current flow
- Will provide offline validation when re-enabled

---

## Schema System

### Static Schema Catalog (`src/lib/ifcSchema.ts`)
- `IFC_SCHEMA` map: full `IfcEntityDef` for 100+ common entities
- Each definition includes: display name, description, category, icon, color, property list, valid parent/child types, relationship definitions, validation rules
- `getEntityDef()`, `getEntityDisplayName()`, `getEntityColor()` helpers

### Dynamic Schema Loader (`src/lib/ifcSchemaLoader.ts`)
- `loadSchemaFile()`: fetches JSON schema from `public/schemas/` with in-memory cache
- Supports `IFC2x3`, `IFC4`, `IFC4X3` schema files
- `loadSpecificEntities()`: loads entity + all supertypes recursively
- `ensureSchemaLoaded()`, `getEntityFromSchemaAsync()`, `getAllAttributesAsync()`

### Schema Layer Mapping (`src/lib/schema-layer-mapping.ts`)
- `SCHEMA_LAYERS`: domain / interoperability / core / resource layers with colors
- `ENTITY_TO_LAYER_MAP`: 200+ entities mapped to their schema layer
- `getSchemaLayerForEntity()` used by NodeDetailsPanel for the schema layer badge

---

## Educational System

### LearningContext (`src/contexts/LearningContext.tsx`)
- Learning mode state machine with 5 layers
- Progress stored in `localStorage` under `ifc-learning-progress`
- Layer unlock progression: project -> spatial -> element -> relationship -> property
- `startWorkedExample()`, `nextExampleStep()`, `startPractice()`, `submitPracticeAnswer()`, `unlockNextLayer()`, `resetProgress()`
- `highlightedEntityTypes` drives graph node highlighting during learning exercises

### Dynamic Learning (`src/lib/dynamicLearning.ts`)
- `LAYER_CONFIG`: configuration for all 5 learning layers
- `classifyEntityLayer()`: assigns entities to learning layers
- `generateDynamicLearningPath()`: analyzes the loaded model and creates a customized path
- `getProgressiveGraphData()`: returns graph data filtered to a subset for step-by-step exploration

### Documentation Link Generator (`src/lib/docsLinkGenerator.ts`)
- `generateDocsUrl(entityName, schemaVersion)`: generates buildingSMART documentation URLs
- Different URL patterns for IFC4, IFC4X3, IFC2x3 documentation sites

### Educational Feature Components (`src/features/educational/`)
- **`Learn.tsx`** (page): Learning landing page with sample file cards. Loads `.ifc` files and navigates to Index with `learningMode: true`
- **`ConsolidatedLearningPanel.tsx`**: In-page learning sidebar for Index. Layer progress, worked examples, practice exercises, dynamic model insights
- **`SampleCard.tsx`**: Educational sample card with description, difficulty, metadata
- **`IFCArchitectureDiagram.tsx`**: Visual SVG diagram of IFC4 architecture layers
- **`LayerProgressMap.tsx`**: 5-step progress visualization
- **`WorkedExamplePlayer.tsx`**: Step-by-step worked example with IFC code snippets and graph highlights
- **`PracticePlayer.tsx`**: Interactive practice (multiple-choice, predict-verify, drag-connect)
- **`GlossaryTerm.tsx`**: Hover tooltip glossary for IFC terms

### Learning Data (`src/features/educational/data/`)
- **`educationalSamples.ts`**: Sample definitions (id, name, description, path, difficulty, IFC version, learning objectives)
- **`ifcConceptReference.ts`**: IFC concept definitions for the learning system
- **`learning.ts`**: `WORKED_EXAMPLES` and `PRACTICE_EXERCISES` data arrays

### Learning Types (`src/types/learning.ts`)
- `IFCLayer` (5 layers), `LearningMode`, `LayerDefinition`
- `WorkedExampleStep`, `WorkedExample`
- `PracticeExercise` (predict-verify, drag-connect, multiple-choice)
- `LayerProgress`, `LearningProgress`

---

## Utility Libraries

### Color Scheme (`src/lib/colorScheme.ts`)
- `NODE_COLORS: Record<NodeType, string>` - single source of truth for all graph node colors
- `getColorForNodeType(type)` used by GraphVisualization and Legend

### Export Utilities (`src/lib/exportUtils.ts`)
- `exportToJSON(graphData)` - exports full graph as JSON file
- `exportNodesToCSV(nodes)` - exports node table as CSV
- `exportEdgesToCSV(edges)` - exports edge table as CSV
- `exportToSTEP(rawStepLines)` - reconstructs and downloads STEP text
- `exportToPNG(canvasElement)` - screenshots the force graph canvas

### Logger (`src/utils/logger.ts`)
- Dev-only (checks `import.meta.env.DEV`) - no production output
- Scoped sub-loggers: `logger.parsing.*`, `logger.validation.*`, `logger.graph.*`

### BuildingSMART Utils (`bSValidate/src/lib/buildingsmartUtils.ts`)
- `groupByRuleCode()`, `formatStepId()` (formats as `#12345`), `formatValue()`, `getSeverityDisplay()`, `isBuildingSmartError()`, `isSchemaRule()`, `extractStepIdsFromMessage()`

---

## Contexts

### UIStateContext (`src/contexts/UIStateContext.tsx`)
Global UI state consumed across multiple components:
- `highlightedTypes[]`, `searchQuery`, `showAttributes`, `showRelatedMetadata`
- `graphLoD` (1-4), `show3DViewer`, `schemaVersion`
- `toggleType()`, `resetFilters()`

---

## Types

### `src/types/graph.ts`
```typescript
type NodeType = 'building' | 'space' | 'element' | 'property' | 'relationship' | 'geometry' | 'other' | 'Mesh' | 'Curve' | 'Points' | 'Group'

interface GraphNode { id, label, type, ifcType, properties, expressId, _ifcStep, _fileFormat, _schemaColor, x, y, vx, vy }
interface GraphEdge { id, source, target, label, type, relationshipType, category }
interface GraphData { nodes: GraphNode[], edges: GraphEdge[] }
interface ParsedIFCData {
  graphData: GraphData
  allEntities: GraphNode[]
  geometryEntities: GraphNode[]
  metadata: { fileName, fileSize, entityCount, parseTime, isIFC5, ifcVersion? }
  validation?: ValidationResult
  rawData?: { composedObject?, ifc5File?, rawStepLines?: Map<number, string> }
}
```

### `src/types/ifc5.ts`
Full IFC5 type system: `IFC5File`, `IFC5Header`, `IFC5Node` (path/children/inherits/attributes), `IFC5Schema`, `DataType` enum, `QuantityKind`. Composition types: `CompositionInputNode`, `PreCompositionNode`, `PostCompositionNode`. `ComposedObject` (name, type, attributes, children) for 3D rendering.

### `src/types/ifc.ts`
`IFCEntity`, `IFCRelationship`, `ParsedIFC`. Entity category sets: `STRUCTURAL_ENTITIES`, `RELATIONSHIP_ENTITIES`, `METADATA_ENTITIES`. `RELATIONSHIP_LABELS` map of IFC relationship names to readable labels.

---

## Cross-Panel Synchronization (IFC5)

The Index page maintains two bidirectional Maps built from the `ComposedObject` tree:

```
rawToComposed: Map<rawNodePath, composedObjectPath>
composedToRaw: Map<composedObjectPath, rawNodePath>
```

When a user selects a node in any IFC5 panel:
1. The panel fires `onNodeSelect(path)`
2. Index resolves the path through the appropriate map
3. `selectedIFC5Node` state is updated
4. All four IFC5 panels React to the state change and highlight the corresponding node

This enables O(1) bidirectional lookup without traversing the composed tree on every selection.

---

## Performance Optimization Summary

| Optimization | Location | Impact |
|-------------|---------|--------|
| Web Worker parsing | `ifcParserWorker.ts` | Prevents UI blocking on large files |
| Zero-copy ArrayBuffer transfer | `ifcParserWorker.ts` | Fast rawStepLines transfer across Worker boundary |
| Web Worker geometry | `ifcGeometryWorker.ts` | 3D geometry off main thread |
| React.lazy() components | `Index.tsx` | Reduces initial load time |
| Manual Vite chunks | `vite.config.ts` | Long-term vendor bundle caching |
| LRU geometry cache | `useViewer3D.ts` | Avoids re-parsing for recent selections |
| VirtualList | `VirtualList.tsx`, `IFC5TreeBrowser.tsx` | Handles 10,000+ node lists |
| Virtual scrolling | `useVirtualScroll.ts`, `IFCBrowser.tsx` | Large entity lists |
| LoD filtering | `graphLoD.ts` | Reduces graph complexity by up to 90% |
| Geometry type exclusion | `ifcParser.ts` | Keeps semantic graph clean and fast |
| 2-minute Worker timeout | `useIFCWorker.ts` | Prevents zombie workers |

---

## Test Files

Located in `public/testFiles/`:

| File | Format | Purpose |
|------|--------|---------|
| `FZK Haus.ifc` | IFC STEP | Multi-storey residential building |
| `Infra-Bridge.ifc` | IFC STEP | Infrastructure / bridge model |
| `Solibri Building.ifc` | IFC STEP | Complex multi-discipline building |
| `Solibri Building Structural.ifc` | IFC STEP | Structural-focused model |
| `wall-with-opening-and-window.ifc` | IFC STEP | Minimal element example |
| `hello-wall.ifcx` | IFC5 JSON | Minimal IFC5 example |
| `esempio_01 edificius (1).ifcx` | IFC5 JSON | Complex IFC5 building |

---

## Implementation Status Summary

| Feature | Status | Notes |
|---------|--------|-------|
| IFC STEP parsing (IFC2x3/IFC4/IFC4X3) | Active | web-ifc WASM, Web Worker |
| IFC5 JSON parsing + composition | Active | buildingSMART spec implementation |
| Force-directed graph (IFC STEP) | Active | react-force-graph-2d, LoD 1-4 |
| IFC5 Graph View | Active | ComposedObject-based |
| IFC5 Tree Browser | Active | VirtualList, deep search |
| IFC5 Property Viewer | Active | Namespace grouping |
| IFC5 Source Viewer | Active | Syntax-highlighted JSON |
| IFC Browser (STEP) | Active | STEP refs, inverse lookup |
| 3D Viewer | Active | Three.js, off-thread geometry |
| Graph LoD system (1-4) | Active | 100+ auxiliary type exclusions |
| BuildingSMART API validation | Active | With functional parts + schema interpreter |
| Validation export (JSON/CSV/text) | Active | All three formats |
| Educational learning mode | Active | 5 layers, worked examples, practice |
| Dynamic documentation links | Active | IFC2x3, IFC4, IFC4X3 patterns |
| Keyboard shortcuts | Active | Ctrl+F, Ctrl+S, Escape, Ctrl+Shift+V, etc. |
| Graph export (JSON/CSV/PNG) | Active | All formats |
| Cross-panel selection sync | Active | Bidirectional Maps (IFC5) |
| Local validator | Disabled | Pending refactoring |
