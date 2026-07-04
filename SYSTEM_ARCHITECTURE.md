# IFC Graph Viewer - System Architecture

## Overview

The IFC Graph Viewer is a thesis proof-of-concept web application that transforms IFC (Industry Foundation Classes) BIM files into interactive visualizations for education, exploration, and validation. It is built with React 18, TypeScript, and Vite, and supports two IFC formats:

- **IFC STEP** (`.ifc`) - Traditional ISO-10303-21 text format (IFC2x3, IFC4, IFC4X3)
- **IFC5 JSON** (`.ifcx`) - Next-generation buildingSMART JSON-based format

The application routes each format through a dedicated parsing pipeline and presents data in a multi-panel workspace (STEP: graph/tree/properties/3D, IFC5: properties/graph/tree/3D/source) with on-demand panel loading.

---

## High-Level Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                              USER INTERFACE LAYER                                 |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  IFC STEP (.ifc) panels          IFC5 JSON (.ifcx) panels                        |
|  +--------------+ +----------+   +----------+ +----------+ +--------+ +--------+ |
|  | Graph View   | | IFC      |   | IFC5     | | IFC5     | | IFC5   | | IFC5   | |
|  | Force-dir.   | | Browser  |   | Graph    | | Tree     | | Props  | | Source | |
|  | LoD 1-4      | | STEP     |   | View     | | Browser  | | Viewer | | Viewer | |
|  |              | | refs     |   |          | |          | |        | |        | |
|  +--------------+ +----------+   +----------+ +----------+ +--------+ +--------+ |
|         |                |              |           |           |          |      |
|         +----------------+              +-----------+-----------+----------+      |
|                  |                        Bidirectional cross-panel sync          |
|                  |                        (rawToComposed / composedToRaw maps)    |
|                                                                                   |
|  +-----------------------------------------------------------------------+       |
|  | Property Viewer | NodeDetailsPanel | StatsPanel | 3D Viewer (lazy)    |       |
|  +-----------------------------------------------------------------------+       |
|                                                                                   |
|  +-----------------------------------------------------------------------+       |
|  |         Validation Page (pages/Validation.tsx)                        |       |
|  |  +------------------------------+  +--------------------------------+ |       |
|  |  | buildingSMART Validator      |  | Local Validator (WIP-disabled) | |       |
|  |  | - File submission + polling  |  | - Client-side schema checks    | |       |
|  |  | - Normative IA/IP + Schema   |  |                                | |       |
|  |  | - Entity-level diagnostics   |  |                                | |       |
|  |  | - JSON/CSV/text export       |  |                                | |       |
|  |  +------------------------------+  +--------------------------------+ |       |
|  +-----------------------------------------------------------------------+       |
|                                                                                   |
+-----------------------------------------------------------------------------------+
                                        |
+-----------------------------------------------------------------------------------+
|                        STATE MANAGEMENT LAYER                                     |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  +------------------------------+    +------------------------------+             |
|  | UIStateContext               |    | LearningContext              |             |
|  | - highlightedTypes[]         |    | - layer progress (5 layers)  |             |
|  | - searchQuery               |    | - worked example state       |             |
|  | - graphLoD (1-4)            |    | - practice exercise state    |             |
|  | - show3DViewer              |    | - localStorage persistence   |             |
|  | - schemaVersion             |    | - highlightedEntityTypes[]   |             |
|  | - showAttributes            |    +------------------------------+             |
|  +------------------------------+                                                |
|                                                                                   |
|  Index.tsx local state (primary):                                                 |
|  parsedData, selectedNode, selectedIFC5Node, rawToComposed, composedToRaw,        |
|  graphLoD, relationshipFilters, viewerLoaded flags, learningMode                  |
|                                                                                   |
+-----------------------------------------------------------------------------------+
                                        |
+-----------------------------------------------------------------------------------+
|                     PARSING & DATA PROCESSING LAYER                               |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  IFC STEP Pipeline                        IFC5 JSON Pipeline                     |
|  +---------------------------+            +---------------------------+           |
|  | ifcParserWorker.ts (Web   |            | ifc5ParserMain.ts         |           |
|  | Worker)                   |            | + ifc5Composition.ts      |           |
|  | - web-ifc WASM parsing   |            | + ifc5ToGraph.ts          |           |
|  | - Entity classification   |            | + ifc5GraphVisualization  |           |
|  | - Relationship extraction |            |                           |           |
|  | - rawStepLines Map        |            | Composition engine based  |           |
|  |   (Int32Array + string[]) |            | on buildingSMART spec     |           |
|  +---------------------------+            +---------------------------+           |
|             |                                          |                          |
|             v                                          v                          |
|  graphBuilder.ts                           ComposedObject tree                   |
|  + graphLoD.ts                             -> graph data                         |
|  -> ParsedIFCData                          -> 3D geometry                        |
|                                                                                   |
|  +-----------------------------+                                                  |
|  | ifcGeometryWorker.ts (Web   |                                                  |
|  | Worker)                     |                                                  |
|  | - web-ifc WASM geometry    |                                                  |
|  | - MeshPayload extraction    |                                                  |
|  | - Type-based color mapping  |                                                  |
|  +-----------------------------+                                                  |
|                                                                                   |
+-----------------------------------------------------------------------------------+
                                        |
+-----------------------------------------------------------------------------------+
|                    EXTERNAL SERVICES & BACKEND                                    |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  bSValidate/ (Express, port 5001)                                                 |
|  +------------------+  +----------------------+  +---------------------------+   |
|  | POST /api/validate | | GET /api/results/:id  | | DELETE /api/cancel/:id   |   |
|  | (multer upload)    | | (paginated polling)   | |                          |   |
|  +------------------+  +----------------------+  +---------------------------+   |
|                                  |                                               |
|                    +-------------v-------------------+                           |
|                    | https://dev.validate.           |                           |
|                    |   buildingsmart.org/api/v1      |                           |
|                    +---------------------------------+                           |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

---

## Component Hierarchy

```
App.tsx
  |- ErrorBoundary
  |- QueryClientProvider (@tanstack/react-query)
  |- UIStateProvider
  |- TooltipProvider (Radix)
  |- BrowserRouter
  |   |- Routes
  |       |- / -> Index.tsx
  |       |       |- Header
  |       |       |- FileUpload  (pre-load)
  |       |       |- ResizablePanelGroup  (post-load)
  |       |           |- Sidebar panel
  |       |           |   [IFC STEP] IFCBrowser
  |       |           |   [IFC5]     IFC5TreeBrowser
  |       |           |- Main panel (tab: graph | 3d | source)
  |       |               [IFC STEP, graph tab] GraphVisualization (React.lazy)
  |       |               [IFC STEP, graph tab] GraphControls
  |       |               [IFC STEP, graph tab] Legend
  |       |               [IFC STEP, graph tab] NodeDetailsPanel
  |       |               [IFC STEP, 3d tab]    Viewer3D (React.lazy)
  |       |               [IFC5, graph tab]     IFC5GraphVisualization (React.lazy)
  |       |               [IFC5, source tab]    IFC5SourceViewer (React.lazy)
  |       |               [IFC5]                IFC5PropertyViewer
  |       |               PropertyViewer (IFC STEP only)
  |       |               StatsPanel
  |       |
  |       |- /validation -> Validation.tsx
  |       |       |- ValidationReport
  |       |           |- BuildingSmartResults (bSValidate/src/components)
  |       |           |- SchemaResults        (bSValidate/src/components)
  |       |
  |       |- /learn -> features/educational/pages/Learn.tsx
  |       |       |- SampleCard
  |       |       |- IFCArchitectureDiagram
  |       |       |- LayerProgressMap
  |       |
  |       |- * -> NotFound.tsx
  |- Toaster (Radix)
  |- Sonner (toast notifications)
```

---

## Pages

### Index Page (`src/pages/Index.tsx`)

The main viewer page (~700+ LOC). Manages:

- **Primary state**: `parsedData`, `selectedNode`, `selectedIFC5Node`, `graphLoD` (1-4), `relationshipFilters`, `viewerLoaded` flags, `learningMode`
- **Format routing**: Detects `parsedData.metadata.isIFC5` and renders the appropriate panel set
- **Cross-panel sync (IFC5)**: Maintains `rawToComposed` and `composedToRaw` bidirectional Maps so that selecting a node in the Graph, Tree, Source, Property, or 3D panel synchronizes the selection in all others
- **Worker integration**: Uses `useIFCWorker` for off-thread IFC STEP parsing; `useIFC5Viewer` for IFC5 Three.js 3D scene
- **Lazy loading**: `GraphVisualization`, `Viewer3D`, `IFC5GraphVisualization`, `IFC5SourceViewer` are all `React.lazy()`

### Validation Page (`src/pages/Validation.tsx`)

- Receives `parsedData` and `ifcFileBuffer` via `useLocation` state (from Header navigate)
- Submits the file to `/api/validate` (backend proxy), polls `/api/results/:jobId`
- Maps results with `mapBuildingSmartToValidationResult()`
- Displays results in `ValidationReport` with `BuildingSmartResults` and `SchemaResults` sub-components
- Entity clicks navigate back to Index with the entity ID pre-highlighted
- Exports as JSON, CSV, or plain text

---

## Components

### File & Layout
| Component | Purpose |
|-----------|---------|
| `FileUpload.tsx` | Drag-and-drop + click file picker. Animated progress bar during parsing. |
| `Header.tsx` | Fixed top bar: app logo, learning mode badge, file metadata, Learn/Validate/Unload actions. |
| `ErrorBoundary.tsx` | Class-based React error boundary with stack trace display in dev. |
| `PaginationControls.tsx` | Reusable pagination bar (first/prev/next/last + page input + item count). |
| `VirtualList.tsx` | Windowed list renderer using translate offsets. Falls back to full render for small lists. |

### IFC STEP Visualization
| Component | Purpose |
|-----------|---------|
| `GraphVisualization.tsx` | Force-directed graph via react-force-graph-2d. LoD filtering, custom canvas rendering (colored nodes + directional edges), zoom controls, fit-to-view. |
| `GraphControls.tsx` | Floating control bar: search, LoD dropdown, filter drawer (node + relationship toggles with color swatches), export dropdown. |
| `IFCBrowser.tsx` | Split-panel STEP entity browser: searchable entity list with STEP syntax highlighting + detail panel with referenced-by algorithm. |
| `NodeDetailsPanel.tsx` | Slide-in/inline panel for a selected graph node: IFC type, schema layer badge, entity definition, property sets, docs link, educational content. |
| `PropertyViewer.tsx` | Grouped entity list by IFC type. Searchable, expandable. Schema definition + educational content per entity. |
| `Legend.tsx` | Collapsible legend: node color/type + edge color/type, mirroring GraphVisualization colors. |
| `StatsPanel.tsx` | Bottom stats bar: file name, size, entity count, relationship count, parse time. |

### IFC5 Visualization
| Component | Purpose |
|-----------|---------|
| `IFC5GraphVisualization.tsx` | Force-directed graph for IFC5. Converts ComposedObject to graph via convertComposedObjectToGraph(). Configurable: geometry nodes, attribute nodes, inheritance edges, clustering. |
| `IFC5TreeBrowser.tsx` | Hierarchical tree for IFC5 composed objects. Deep attribute search, expand/collapse, VirtualList rendering, IFC class badges. |
| `IFC5PropertyViewer.tsx` | Namespace-grouped attribute display. Special handling for matrices, geometry arrays, references. Breadcrumb navigation. |
| `IFC5SourceViewer.tsx` | Syntax-highlighted raw .ifcx JSON viewer. Search + jump, geometry truncation, click-to-cross-select. |
| `useIFC5Viewer` (hook, `ifc5ViewerContainerRef` div) | Full Three.js 3D scene for IFC5. Auto-loads when an `.ifcx` file is parsed; no separate worker. Supports Mesh (PBR + Lambert fallback), Curve, and Points geometry extracted directly from the `ComposedObject` tree. Z-up convention, bounding-box camera fit, raycasting selection with indigo emissive highlight, cross-panel sync. |

### Validation
| Component | Purpose |
|-----------|---------|
| `ValidationReport.tsx` | Tabbed validation display: Normative IA/IP tab using BuildingSmartResults, Schema tab using SchemaResults. Summary stats and progress bars. |
| `ValidationDialog.tsx` | Legacy inline dialog wrapper (pre-Validation page). Still present but superseded by the dedicated Validation page. |

### 3D Viewer
| Component | Purpose |
|-----------|---------|
| `Viewer3D.tsx` | Three.js IFC 3D viewer. Uses ifcGeometryWorker for off-thread geometry. Selection highlights via emissive glow + other meshes dimmed to 8% opacity. Orbit controls, depth buffer. |

---

## Hooks

| Hook | Purpose |
|------|---------|
| `useIFCWorker` | Spawns/terminates the `ifcParserWorker` Web Worker. Sends `parse` messages, handles `progress`/`complete`/`error`. Reconstructs `rawStepLines` Map from transferred parallel arrays. 2-minute timeout guard. |
| `useIFC5Viewer` | Initializes and manages a Three.js scene for IFC5. Handles scene/camera/renderer/controls setup, lighting (3 directional + ambient), grid/axes helpers, Z-up convention, raycasting, geometry loading from ComposedObject trees. |
| `useViewer3D` | 3D viewer state management: `isEnabled`, `isVisible`, `selectedNodeId`, LRU geometry cache (max 500), loading progress. Methods: `enable3DViewer`, `selectNode3D`, `cacheGeometry`, `reset`. |
| `useKeyboardShortcuts` | `window.addEventListener` keyboard handler. Predefined shortcuts: Ctrl+F (search), Ctrl+S (export), Escape (clear), Ctrl+=/- (zoom), Ctrl+0 (fit), Ctrl+Shift+V (validate), Shift+? (help). |
| `usePagination` | Generic paginated list hook: items array + pageSize (default 50). Returns currentItems, page numbers, navigation functions. |
| `useVirtualScroll` | Calculates virtual scroll window: startIndex, endIndex, offsetY, visibleItems from scrollTop + itemHeight + containerHeight. |

---

## State Management

### UIStateContext (`src/contexts/UIStateContext.tsx`)
Global UI state consumed by multiple components:
- `highlightedTypes[]`  Entity types currently highlighted
- `searchQuery`  Active graph search string
- `showAttributes`, `showRelatedMetadata`  Display toggles
- `graphLoD`  Active LoD level (1-4)
- `show3DViewer`  3D viewer enabled flag
- `schemaVersion`  Active IFC schema version (IFC2x3 / IFC4 / IFC4X3)

### LearningContext (`src/contexts/LearningContext.tsx`)
Learning mode state machine with localStorage persistence under `ifc-learning-progress`:
- 5 layers: project -> spatial -> element -> relationship -> property
- Methods: `startWorkedExample()`, `nextExampleStep()`, `startPractice()`, `submitPracticeAnswer()`, `unlockNextLayer()`, `resetProgress()`
- `highlightedEntityTypes` drives graph highlighting during learning exercises

### Index Page Local State
The Index page owns the primary application state:
- `parsedData: ParsedIFCData | null`  Full parsing result including graphData, allEntities, geometryEntities, metadata, rawData
- `selectedNode / selectedIFC5Node`  Currently selected entity in STEP or IFC5 mode
- `rawToComposed / composedToRaw`  Bidirectional Maps for IFC5 cross-panel selection sync
- `graphLoD` (1-4)  Current Level of Detail
- `relationshipFilters`  Active relationship type filter set

---

## Data Model

### ParsedIFCData (unified output of both parsers)
```typescript
interface ParsedIFCData {
  graphData: GraphData;           // Enriched graph (has _schemaColor)
  allEntities: GraphNode[];       // Semantic entities only (no geometry)
  geometryEntities: GraphNode[];  // Geometry/representation entities only
  metadata: {
    fileName: string;
    fileSize: number;
    entityCount: number;
    parseTime: number;
    isIFC5: boolean;
    ifcVersion?: string;
  };
  validation?: ValidationResult;
  rawData?: {
    composedObject?: ComposedObject;     // IFC5 composed tree
    ifc5File?: IFC5File;                 // IFC5 raw JSON
    rawStepLines?: Map<number, string>;  // IFC STEP raw line map
  };
}
```

### GraphNode
```typescript
interface GraphNode {
  id: string;                      // Unique ID (Express ID str or UUID)
  label: string;                   // Display name
  type: NodeType;                  // building|space|element|property|relationship|geometry|other|Mesh|Curve|Points|Group
  ifcType: string;                 // IFC entity type string
  properties: Record<string, any>; // All entity properties
  expressId?: number;              // IFC4 Express ID
  _schemaColor?: string;           // Assigned graph color
  _ifcStep?: string;               // Raw STEP line
  _fileFormat?: 'ifc4' | 'ifc5';
}
```

### GraphEdge
```typescript
interface GraphEdge {
  id: string;              // "source-target-type"
  source: string;          // Source node ID
  target: string;          // Target node ID
  label: string;           // Display label
  type: string;            // CONTAINS | AGGREGATES | INHERITS | VOIDS | FILLS | etc.
  relationshipType?: string;
  category?: string;       // Edge color category for visualization
}
```

---

## Data Flows

### Upload to Visualization (IFC STEP)
```
1. User drops .ifc file onto FileUpload
2. FileUpload reads file as ArrayBuffer
3. useIFCWorker spawns ifcParserWorker Web Worker
4. Worker: web-ifc WASM parses all entities and relationships
5. Worker: graphBuilder.createGraphDataFromEntities() enriches nodes
6. Worker: rawStepLines serialized as Int32Array + string[] parallel arrays (zero-copy)
7. Worker posts 'complete' message to main thread
8. useIFCWorker reconstructs rawStepLines Map and sets parsedData
9. Index.tsx renders IFC STEP panels (Graph + Browser + Property + 3D)
```

### Upload to Visualization (IFC5)
```
1. User drops .ifcx file onto FileUpload
2. ifc5ParserMain.loadIFC5FromFile() reads and JSON-parses the file
3. ifc5Composition engine resolves inheritance/composition per buildingSMART spec
4. ifc5ToGraph converts PostCompositionNode tree to ComposedObject + GraphData
5. parsedData set with isIFC5: true
6. Index.tsx renders IFC5 panels (IFC5Graph + IFC5Tree + IFC5Property + IFC5Source)
7. rawToComposed / composedToRaw maps built for cross-panel sync
```

### 3D Viewer (IFC STEP)
```
1. User clicks "Load 3D" in Header or 3D tab
2. useViewer3D.enable3DViewer() called
3. Viewer3D component mounts, spawns ifcGeometryWorker
4. Worker: web-ifc WASM loads model, iterates all geometry
5. Worker: MeshPayload[] (positions, normals, indices, transforms, expressIDs, colors)
6. Viewer3D builds Three.js BufferGeometry meshes
7. Click on mesh: raycasting resolves expressID -> selectedNode
8. Selection propagates across all panels via Index state
```

### Validation Workflow
```
1. User clicks Validate in Header (navigates with file buffer in location state)
2. Validation page: user clicks "Validate with buildingSMART"
3. buildingsmartApi.submitValidation() -> POST /api/validate (backend proxy)
4. Backend forwards with multipart FormData + Authorization token to buildingSMART API
5. Returns { jobId, status }
6. buildingsmartApi.pollValidationResults() polls GET /api/results/:jobId every 3s
7. Backend paginates all results (100 per page) and returns full response
8. mapBuildingSmartToValidationResult() normalizes to internal ValidationResult format
9. ValidationReport renders BuildingSmartResults (normative) + SchemaResults (schema)
10. Click entity ID -> navigate(-1) to Index with entity highlighted
```

### Learning Mode Flow
```
1. User navigates to /learn (Learn page)
2. Selects an educational sample file
3. Navigate to Index with { learningMode: true, sampleFile }
4. Index loads sample file through worker pipeline
5. LearningContext.generateDynamicLearningPath() analyzes model content
6. ConsolidatedLearningPanel shows layer progress + worked examples
7. WorkedExamplePlayer steps through guided example with graph highlights
8. PracticePlayer runs interactive exercises
9. Progress persisted to localStorage
```

---

## Performance Architecture

### Web Worker Strategy
- **ifcParserWorker**: All IFC STEP parsing, entity extraction, graph building happens off-thread
- **ifcGeometryWorker**: 3D geometry extraction off-thread; mesh data transferred via Transferable ArrayBuffers
- **rawStepLines transfer**: `Int32Array` keys transferred as zero-copy ArrayBuffer; values remain as `string[]`; both passed as parallel arrays and reconstructed as a Map in the main thread

### Lazy Loading
`React.lazy()` is applied to four heavy components:
- `GraphVisualization` (react-force-graph-2d + D3 physics)
- `Viewer3D` (Three.js scene + geometry)
- `IFC5GraphVisualization` (force-directed graph)
- `IFC5SourceViewer` (large JSON rendering)

### Vite Chunk Splitting
Manual chunks in `vite.config.ts`:
| Chunk | Contents |
|-------|---------|
| `vendor-react` | react, react-dom, react-router-dom |
| `vendor-three` | three (Three.js) |
| `vendor-ifc` | web-ifc |
| `vendor-graph` | react-force-graph-2d |
| `vendor-ui` | @radix-ui/*, shadcn components |
| `vendor-animation` | framer-motion |
| `vendor-utils` | @tanstack/react-query, lucide-react, zod |

### LRU Geometry Cache
`useViewer3D` maintains an LRU cache of up to 500 geometry items to avoid re-parsing geometry for recently selected IFC STEP entities.

### LoD System
`graphLoD.ts` filters the node and edge arrays before passing them to `GraphVisualization`. Original parsed data is always retained in `parsedData.graphData`.

---

## Build System

### Scripts (`package.json`)
| Script | Command |
|--------|---------|
| `dev` | `vite` (frontend at port 5173) |
| `dev:backend` | `node bSValidate/server.js` (backend at port 5001) |
| `dev:all` | `concurrently` running both |
| `build` | `tsc && vite build` |
| `preview` | `vite preview` |
| `lint` | `eslint` |

### Key Build Configuration
- WASM files copied from `node_modules/web-ifc/*.wasm` to `public/ifc-wasm/`
- `web-ifc` excluded from Vite dep optimization to prevent WASM bundle issues
- `@` path alias resolves to `./src`

---

## External Dependencies Summary

| Dependency | Version | Role |
|------------|---------|------|
| react, react-dom | 18 | UI framework |
| react-router-dom | v6 | Client-side routing |
| @tanstack/react-query | v5 | Data fetching |
| web-ifc | 0.0.74 | IFC STEP WASM parser |
| three | latest | 3D rendering |
| react-force-graph-2d | latest | Force-directed graph |
| framer-motion | latest | Animations |
| @radix-ui/* | latest | Accessible UI primitives |
| lucide-react | latest | Icons |
| sonner | latest | Toast notifications |
| tailwindcss | v3 | Utility CSS |
| zod | latest | Schema validation |
| concurrently | latest | Run multiple dev scripts |

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Web Worker for STEP parsing | Prevents UI blocking; supports files with 10,000+ entities |
| Separate ifcGeometryWorker | 3D geometry is large and slow; must not block the UI |
| rawStepLines as parallel arrays | Zero-copy Int32Array transfer across Worker boundary (vs. 300K-property Object) |
| IFC5 vs IFC4 routing at Index level | The formats differ enough to warrant completely separate rendering pipelines |
| Geometry entities separate from graph | 100+ geometry types clutter the semantic graph; kept in geometryEntities for IFC Browser |
| Local validation disabled | BuildingSMART API provides more accurate and comprehensive validation for POC phase |
| React.lazy() for heavy components | Reduces initial bundle parse time; users who don't use 3D or IFC5 source pay no cost |
| Manual Vite chunks | Enables long-term caching of stable vendor bundles independent of app code changes |
| LRU geometry cache | Avoids re-parsing geometry on repeated selection of recently viewed entities |
| Cross-panel sync via bidirectional Maps | O(1) lookup in both directions; avoids traversing the composed tree on every selection |
| Backend proxy for buildingSMART | API token cannot be safely exposed in the browser; proxy keeps it server-side |
| LearningContext with localStorage | Preserves learning progress across browser sessions without a backend |

---

## Documentation Structure

| Document | Scope |
|----------|-------|
| [README.md](README.md) | Quick start, feature overview, setup, troubleshooting |
| [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) | System overview, component hierarchy, data flows (this file) |
| [PARSER_ARCHITECTURE.md](PARSER_ARCHITECTURE.md) | Parser pipelines, IFC5 composition engine, graph conversion |
| [FEATURE_SUMMARY.md](FEATURE_SUMMARY.md) | File-by-file implementation status and feature breakdown |
