**Web-Based Platform for IFC Graph Visualization, Exploration, and Validation: Proof of Concept**
 
<img width="1339" height="218" alt="image" src="https://github.com/user-attachments/assets/f0bcc0ce-828a-4dc2-b8d3-c10ee07644cf" />

Currently live at : https://ifcgraphviewer.onrender.com/

## About This Thesis Work

### POC Overview
The Industry Foundation Classes (IFC) schema underpins openBIM workflows, but tooling for schema exploration and validation is fragmented. Learners and practitioners lack a unified, accessible interface for understanding IFC structures across versions and for validating models efficiently. This thesis proposes a **client-side, web-based platform** that consolidates:

- **Graph Visualization** - Interactive force-directed graphs showing entity relationships
- **Hierarchical Browsing** - Tree-based exploration of IFC structures
- **Property Inspection** - Detailed entity property display with namespace-aware formatting
- **3D Visualization** - Spatial representation of building models
- **Validation** - IFC standards compliance checking via buildingSMART API

### Target Audience
Learners, students, and novice BIM practitioners who struggle to understand IFC entities, relationships, and properties across versions without heavy desktop tools or steep onboarding.

### Goals and Significance
This research aims to democratize IFC education and exploration by providing a zero-install, browser-based tool that:
- Eliminates software installation barriers
- Provides visual, interactive learning experiences
- Supports both IFC STEP (`.ifc`) and IFC5 JSON (`.ifcx`) formats
- Enables self-paced exploration of IFC concepts
- Validates models against official buildingSMART standards

---

## Key Features

### Visualization Modes

**For IFC STEP files (`.ifc`)**

1. **Graph View** - Force-directed graph with physics simulation
   - Color-coded nodes by IFC entity type
   - Level of Detail (LoD 1-4) filtering for graph complexity management
   - Relationship type filtering with color-coded directional edge categories
   - Node search, zoom/pan, fit-to-view, center-on-selection controls
   - Custom canvas rendering with labels at zoom >= 1.5

2. **IFC Browser (Tree)** - Hierarchical STEP file explorer
   - Expandable/collapsible entity hierarchy
   - Full-text search across labels, types, and Express IDs
   - IFC STEP syntax-highlighted entity display
   - "Referenced By" inverse relationship algorithm
   - One-click cross-entity navigation by clicking STEP references
   - Virtual scrolling and pagination for large models

3. **Property Viewer** - Grouped entity inspector
   - Searchable entity list grouped by IFC type
   - Full property display with IFC schema definitions
   - Educational content and buildingSMART documentation links

4. **3D Viewer** - Three.js geometry visualization
   - Off-thread geometry parsing via `ifcGeometryWorker`
   - Color-coded by IFC type (50+ type-specific colors)
   - Orbit controls (zoom, pan, rotate)
   - Click-to-select with emissive highlight and opacity dimming on other meshes
   - Lazy-loaded on demand to conserve memory

**For IFCX JSON files (`.ifcx`)**

1. **Graph View** - Composed-object force-directed graph
   - Converts post-composition tree to graph via `convertComposedObjectToGraph()`
   - Configurable: show/hide geometry nodes, attribute nodes, inheritance edges, clustering by namespace
   - Relationship type filtering and cross-panel selection sync

2. **Tree Browser** - Hierarchical composed-object browser
   - Deep attribute search with match highlighting
   - IFC class badges and icons per node type
   - VirtualList rendering for performance

3. **Property Viewer** - Namespace-aware attribute inspector
   - Attributes grouped by namespace (`bsi::ifc::`, `usd::usdgeom::`, `mesh::`, etc.)
   - 4x4 matrix display, geometry array summarization
   - Breadcrumb navigation and IFC class summary

4. **Source Viewer** - Raw `.ifcx` JSON source display
   - Syntax-highlighted JSON (keys, strings, numbers, booleans in distinct colors)
   - Inline search with jump-to-match navigation
   - Large geometry array truncation to prevent browser freeze
   - Click-to-cross-select between source blocks and tree/graph

5. **3D Viewer** - Interactive Three.js 3D scene rendered directly from the `ComposedObject` tree
   - Supports `Mesh` (PBR: base color, metalness, roughness; fallback Lambert diffuse), `Curve` (line geometry), and `Points` (including base64-encoded position/color buffers)
   - Z-up coordinate convention matching the IFC5/USD specification
   - Camera auto-fits to model bounding box on load
   - OrbitControls (rotate, pan, zoom) with inertia damping
   - Click a 3D object to select it — selection syncs to all other IFC5 panels
   - Selected object highlighted with indigo emissive glow; original material restored on deselect

All five IFC5 panels are bidirectionally synchronized via `rawToComposed` / `composedToRaw` maps maintained in the Index page.

---

### Graph Level of Detail (LoD) System

Research-based 4-tier LoD framework for managing graph complexity at scale:

| LoD | Name | Includes |
|-----|------|---------|
| LoD 1 | Spatial Hierarchy | Spatial structure only (Project, Site, Building, Storey, Space) |
| LoD 2 | Elements & Structure | + Building elements (walls, doors, windows, slabs, beams, columns) |
| LoD 3 | + Properties | + Property sets, material associations, classification references |
| LoD 4 | Full Semantic | All meaningful entities; excludes only geometric/mathematical primitives |

Auxiliary types (100+ geometric primitives, profile definitions, style entities, measurement helpers) are automatically filtered at all LoD levels. Original data is always preserved; filtering is view-only.

---

### IFC Validation System

#### buildingSMART Validator (Active)
Integrates with the official buildingSMART Validation API:

- Submits files via backend proxy (`bSValidate/` module, port 5001)
- Real-time polling for job status with live UI updates
- Results categorized as Normative IA, Normative IP, and Schema errors
- Entity-level diagnostics with Express ID links that navigate back to the graph/tree
- Functional part tagging (PJS, GRF, BLT, SPA, etc.)
- Schema error human-readable interpretation via `schemaInterpreter.ts`
- Export validation reports as JSON, CSV, or plain text

**Components:**
- `src/pages/Validation.tsx` - Validation interface
- `bSValidate/server.js` - Express proxy to buildingSMART API (port 5001)
- `bSValidate/src/services/buildingsmartApi.ts` - API client with polling
- `bSValidate/src/services/buildingsmartMapper.ts` - Result normalization
- `bSValidate/src/lib/functionalParts.ts` - Functional part catalog
- `bSValidate/src/lib/exportValidation.ts` - Export utilities
- `bSValidate/src/components/BuildingSmartResults.tsx` - Normative results UI
- `bSValidate/src/components/SchemaResults.tsx` - Schema results UI

#### Local Validator (Work in Progress - Disabled)
Planned client-side validation for offline use. Infrastructure exists in `src/lib/ifcValidatorEnhanced.ts` but is currently disabled pending refactoring.

---

### Educational / Learning Features

- **Learning Mode** - Navigate to `/learn`, select a sample file, and explore with guided content
- **Dynamic Learning Path** - `dynamicLearning.ts` analyzes model content and generates a customized 5-layer learning path (project -> spatial -> element -> relationship -> property)
- **Worked Examples & Practice** - Step-by-step guided examples and interactive practice exercises (multiple-choice, predict-verify, drag-connect)
- **Layer Progress Map** - 5-layer progress visualization stored in localStorage
- **BuildingSMART Docs Links** - `docsLinkGenerator.ts` generates context-aware documentation URLs per entity and schema version (IFC2x3, IFC4, IFC4X3)
- **Glossary Terms** - Hover tooltips for IFC terminology throughout the UI
- **LearningContext** - localStorage-persisted learning progress tracking across sessions

---

## Quick Start

### Prerequisites
- Node.js v16 or higher
- npm
- A modern browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Install frontend dependencies
npm install

# Start the frontend development server
npm run dev
# Opens at http://localhost:5173
```

### Running Both Frontend and Backend Together

```bash
npm run dev:all
```

This runs concurrently:
- **Frontend** at `http://localhost:5173` (Vite)
- **Backend** at `http://localhost:5001` (Express proxy for buildingSMART API)

### Setting Up buildingSMART Validation (Optional)

```bash
cd bSValidate
npm install

# Create environment file with your buildingSMART API token
echo BUILDINGSMART_TOKEN=your_token_here > .env

# Start the backend server
npm start
```

The backend proxies requests to `https://dev.validate.buildingsmart.org/api/v1`. A valid buildingSMART API token is required.

### Building for Production

```bash
npm run build      # Outputs to dist/
npm run preview    # Preview the production build locally
```

Deploy the `dist/` folder to any static host (Onrender, Vercel, Netlify, GitHub Pages, AWS S3, etc.).

---

## Usage Guide

### Uploading an IFC File
1. Open the application in your browser
2. Drag-and-drop or click to upload an `.ifc` or `.ifcx` file
3. A progress bar shows parsing status (parsing runs in a background Web Worker)
4. On completion, all visualization panels become available

### Using the Graph View
- **Pan**: Click and drag the background
- **Zoom**: Scroll wheel; use the zoom buttons or Ctrl+=/- shortcuts
- **Select**: Click a node to open the Node Details panel
- **Search**: Type in the search box (Ctrl+F) to highlight matching nodes
- **LoD**: Use the LoD dropdown to reduce graph complexity (LoD 1 is most reduced)
- **Filter**: Open the filter drawer to toggle node types and relationship categories
- **Export**: Graph as JSON, node/edge CSVs, or PNG screenshot (Ctrl+S)

### Using the IFC Browser
- **Expand/Collapse**: Click the arrow icons on tree nodes
- **Search**: Full-text search filters the entity list in real time
- **Select**: Click any entity to view its STEP representation and properties
- **Navigate via references**: Click any `#number` reference inside a STEP line to jump to that entity
- **Inverse refs**: The right panel shows all entities that reference the currently selected entity

### Using the 3D Viewer
1. Click **Load 3D** to initialize (geometry is parsed on demand in a background worker)
2. **Rotate**: Left-click drag; **Pan**: Right-click drag; **Zoom**: Scroll wheel
3. Click a 3D mesh to select its entity (selection syncs across all panels)
4. Click **Unload 3D** to free GPU memory when done

### Using IFC5 Panels
When an `.ifcx` file is loaded, five panels appear:
- **Graph** - Composed-object force graph
- **Tree** - Hierarchical browser with attribute search
- **Properties** - Namespace-grouped attribute viewer
- **Source** - Raw JSON source with syntax highlighting
- **3D Viewer** - Automatically initializes and renders the model in 3D
  - No action needed — the 3D scene loads automatically when the file is parsed
  - Navigate with OrbitControls: left-drag to rotate, right-drag to pan, scroll to zoom
  - Click any mesh to select it; the selected node is highlighted in indigo and the selection propagates to all other panels
  - Handles mesh, curve, and point-cloud geometry with PBR materials derived from IFC5 attributes

Selecting a node in any panel synchronizes the selection across all others.

### Running Validation
1. Load an IFC file, then click **Validate** in the header
2. On the Validation page, click **Validate with buildingSMART**
3. The file is submitted and results appear as the API job is polled
4. Click any entity ID in the report to navigate to it in the main viewer
5. Export the report via the download button (JSON, CSV, or text)

---

## Project Structure

```
.
 public/
    ifc-wasm/              # web-ifc WASM binaries
    schemas/               # IFC JSON schema files (IFC2x3, IFC4, IFC4X3)
    testFiles/             # Sample IFC files for testing
 src/
    App.tsx                # Root component and router setup
    main.tsx               # Entry point
    pages/
       Index.tsx          # Main viewer page (IFC STEP + IFC5)
       Validation.tsx     # Dedicated validation page
       NotFound.tsx       # 404 page
    components/
       FileUpload.tsx              # Drag-and-drop file input
       Header.tsx                  # Top bar with file metadata and actions
       GraphVisualization.tsx      # Force-directed graph (IFC STEP)
       GraphControls.tsx           # Search, LoD, filter drawer, export
       IFCBrowser.tsx              # IFC STEP entity browser with references
       IFC5GraphVisualization.tsx  # Force-directed graph (IFC5)
       IFC5TreeBrowser.tsx         # IFC5 hierarchical tree browser
       IFC5PropertyViewer.tsx      # IFC5 namespace-grouped attributes
       IFC5SourceViewer.tsx        # IFC5 raw JSON source viewer
       NodeDetailsPanel.tsx        # Selected entity detail panel
       PropertyViewer.tsx          # Entity property viewer (IFC STEP)
       StatsPanel.tsx              # File statistics bar
       ValidationDialog.tsx        # Inline validation dialog (legacy)
       ValidationReport.tsx        # Full validation report display
       Viewer3D.tsx                # Three.js 3D viewer component
       Legend.tsx                  # Graph color legend
       ErrorBoundary.tsx           # React class-based error boundary
       PaginationControls.tsx      # Reusable pagination bar
       VirtualList.tsx             # Windowed virtual list renderer
       ui/                         # shadcn/ui components (Radix-based)
    contexts/
       UIStateContext.tsx   # Global UI state (filters, search, LoD, schema version)
       LearningContext.tsx  # Learning mode state + localStorage persistence
    hooks/
       useIFC5Viewer.ts         # IFC5 Three.js scene init and geometry loading
       useIFCWorker.ts          # IFC parser worker lifecycle management
       useViewer3D.ts           # 3D viewer state + LRU geometry cache (max 500)
       useKeyboardShortcuts.ts  # Global keyboard shortcut handler
       usePagination.ts         # Generic paginated list hook
       useVirtualScroll.ts      # Virtual scroll window calculator
    lib/
       ifc5ParserMain.ts           # IFC5 entry point and parsing orchestrator
       ifc5Composition.ts          # IFC5 inheritance/composition engine
       ifc5Parser.ts               # IFC5 direct-to-graph parser (fallback)
       ifc5ToGraph.ts              # PostCompositionNode -> ComposedObject + graph
       ifc5GraphVisualization.ts   # ComposedObject -> graph data conversion
       ifcParser.ts                # IFC STEP parser using web-ifc WASM
       ifcParserEnhancements.ts    # Property normalization + STEP type mappings
       stepRepresentationGenerator.ts # STEP text reconstruction (lazy)
       graphBuilder.ts             # Graph enrichment and property set linking
       graphLoD.ts                 # Level of Detail framework (LoD 1-4)
       treeBuilder.ts              # Entity enrichment for tree display
       ifcSchema.ts                # Static entity schema catalog (100+ types)
       ifcSchemaLoader.ts          # Dynamic JSON schema fetching + caching
       ifcValidatorEnhanced.ts     # Local validator (WIP - disabled)
       schema-layer-mapping.ts     # Entity -> schema layer mapping (200+ entities)
       colorScheme.ts              # Canonical graph node color definitions
       exportUtils.ts              # JSON, CSV, STEP, PNG export utilities
       docsLinkGenerator.ts        # BuildingSMART docs URL generation per entity
       dynamicLearning.ts          # Dynamic 5-layer learning path generation
       lodDescriptions.ts          # LoD level human-readable descriptions
       utils.ts                    # cn() Tailwind merge utility
    types/
       graph.ts      # GraphNode, GraphEdge, GraphData, ParsedIFCData
       ifc.ts        # IFCEntity, IFCRelationship, entity category sets
       ifc5.ts       # Full IFC5 type system (ComposedObject, composition types)
       learning.ts   # Learning layer, progress, exercise type definitions
    workers/
       ifcParserWorker.ts    # Web Worker: parse IFC + build graph
       ifcGeometryWorker.ts  # Web Worker: extract and color-code IFC geometry
    utils/
       logger.ts    # Dev-only scoped logger (parsing, graph, validation)
    features/
       educational/ # Educational mode pages and components
    data/
        ifc-schema.ts  # Additional schema data
 bSValidate/                      # BuildingSMART validation backend (Express)
    server.js                    # Express proxy server (port 5001)
    package.json                 # Backend dependencies (express, multer, axios)
    src/
        services/
           buildingsmartApi.ts      # API client with polling
           buildingsmartMapper.ts   # API response -> ValidationResult
        lib/
           functionalParts.ts       # Functional part catalog (PJS, GRF, BLT...)
           exportValidation.ts      # Export to JSON/CSV/text
           buildingsmartUtils.ts    # Grouping and formatting helpers
           normativeInterpreter.ts  # Normative rule description parser
           schemaInterpreter.ts     # Schema error human-readable interpretation
        components/
            BuildingSmartResults.tsx # Normative results display component
            SchemaResults.tsx        # Schema results display component
 profile-parser.ts                # Developer performance profiling script (Node.js)
 SYSTEM_ARCHITECTURE.md
 PARSER_ARCHITECTURE.md
 FEATURE_SUMMARY.md
 README.md
 package.json
 tsconfig.json
 tailwind.config.ts
 postcss.config.js
 vite.config.ts
```

---

## Technologies Used

### Core Framework
| Library | Version | Purpose |
|---------|---------|---------|
| React | 18 | UI library with hooks and concurrent features |
| TypeScript | latest | Static type safety |
| Vite | 5 | Build tool and dev server |
| @vitejs/plugin-react-swc | - | Rust-based fast SWC compilation |

### IFC Parsing
| Library | Version | Purpose |
|---------|---------|---------|
| web-ifc | 0.0.74 | WASM-based IFC STEP parsing |
| Web Workers (native) | - | Background parsing and geometry processing |

### Visualization
| Library | Purpose |
|---------|---------|
| react-force-graph-2d | Force-directed graph rendering on HTML canvas |
| Three.js + OrbitControls | 3D rendering and camera navigation |
| framer-motion | UI animations and transitions |

### UI & Styling
| Library | Purpose |
|---------|---------|
| Tailwind CSS v3 | Utility-first CSS framework |
| @radix-ui/* | Accessible headless UI primitives |
| shadcn/ui | Pre-built Radix-based component library |
| lucide-react | Icon set |
| sonner | Toast notifications |
| react-hook-form + zod | Form handling and schema validation |

### State & Data
| Library | Purpose |
|---------|---------|
| React Context API | UIStateContext and LearningContext |
| react-router-dom v6 | Client-side routing |
| @tanstack/react-query v5 | Data fetching and caching |

### Backend (bSValidate)
| Library | Purpose |
|---------|---------|
| Express | HTTP server and routing |
| multer | Multipart file upload handling |
| axios | HTTP client for buildingSMART API calls |
| cors | Cross-origin resource sharing |
| dotenv | Environment variable loading |

---

## Supported IFC Formats

### IFC STEP (`.ifc`)
- Traditional ISO-10303-21 text format
- Standards supported: IFC2x3, IFC4, IFC4X3
- Parsed with web-ifc WASM library in a dedicated Web Worker
- 100+ geometry entity types filtered from graph view (preserved in `geometryEntities` for IFC Browser)
- Raw STEP lines preserved in a `Map<expressId, stepLine>` and displayed in IFC Browser

### IFC5 JSON (`.ifcx`)
- Next-generation buildingSMART JSON format
- UUID-based path system for entity identification
- Inheritance and composition resolved by `ifc5Composition.ts` per buildingSMART specification
- Rendered in four specialized synchronized panels (Graph, Tree, 3D, Properties, Source)
- Cross-panel selection synchronized via `rawToComposed` / `composedToRaw` bidirectional maps

### Relationship Types

| Type | Description |
|------|-------------|
| CONTAINS | Parent-child spatial containment |
| AGGREGATES | Hierarchical aggregation |
| VOIDS | Openings in building elements |
| FILLS | Fillings in openings |
| PROPERTY_REFERENCE | Property set associations |
| SPACE_BOUNDARY | Space boundary definitions |

---

## Configuration

### Vite (`vite.config.ts`)
- SWC-based React compilation for fast builds
- `viteStaticCopy` copies `web-ifc/*.wasm` to build output
- Path alias: `@` -> `./src`
- `optimizeDeps.exclude: ['web-ifc']` prevents Vite from pre-bundling the WASM library
- Manual chunk splitting for optimal caching: `vendor-react`, `vendor-three`, `vendor-ifc`, `vendor-graph`, `vendor-ui`, `vendor-animation`, `vendor-utils`

### TypeScript (`tsconfig.json`)
- Strict mode enabled, ES2020 target, ESNext modules, bundler module resolution

### Tailwind (`tailwind.config.ts`)
- Typography plugin and custom animation plugin
- Custom color scheme matching IFC entity type classification

---

## Troubleshooting

### File Upload Fails
- Confirm the file extension is `.ifc` or `.ifcx`
- Check the browser console for detailed error messages

### WASM Module Not Loading
- Ensure `public/ifc-wasm/` exists and contains `web-ifc.wasm`
- Check DevTools > Network tab for 404 errors on the `.wasm` file
- Verify the Vite static copy plugin is configured in `vite.config.ts`

### Slow Performance on Large Files
- Reduce LoD level (try LoD 2 or LoD 1 for very large files)
- Switch to Tree Browser for navigation instead of Graph View
- Apply entity type filters via the filter drawer to reduce visible nodes

### Validation Backend Not Responding
- Confirm the backend is running: `cd bSValidate && npm start`
- Verify `BUILDINGSMART_TOKEN` is set in `bSValidate/.env`
- Check that port 5001 is not in use by another process

### Missing Entities in Graph
- Geometry-only entities are intentionally excluded from the graph view
- Use the IFC Browser tab to see all entities from the raw STEP file

---

## Data Privacy

All file processing happens locally in the browser via Web Workers. Files are not sent to any external server unless the user explicitly clicks **Validate with buildingSMART**, which submits the file to `dev.validate.buildingsmart.org`.

---

## Sample Files

Located in `public/testFiles/`:

| File | Format | Description |
|------|--------|-------------|
| `FZK Haus.ifc` | IFC STEP | Multi-storey residential building |
| `Infra-Bridge.ifc` | IFC STEP | Infrastructure / bridge model |
| `Solibri Building Structural.ifc` | IFC STEP | Structural-focused model |
| `wall-with-opening-and-window.ifc` | IFC STEP | Minimal element example |
| `hello-wall.ifcx` | IFC5 JSON | Minimal IFC5 example |

---

## Documentation

| File | Contents |
|------|----------|
| [README.md](README.md) | Quick start, features, setup, troubleshooting (this file) |
| [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) | Component hierarchy, data flows, state management design |
| [PARSER_ARCHITECTURE.md](PARSER_ARCHITECTURE.md) | Parser pipeline, IFC5 composition engine, graph conversion details |
| [FEATURE_SUMMARY.md](FEATURE_SUMMARY.md) | File-by-file feature breakdown and implementation status |

---

## Roadmap

### Completed
- [x] IFC STEP parsing with web-ifc (IFC2x3, IFC4, IFC4X3)
- [x] IFC5 JSON parsing with full composition and inheritance resolution
- [x] Force-directed graph visualization with LoD 1-4 system
- [x] IFC5 Graph, Tree, Property, and Source panels with bidirectional cross-panel sync
- [x] 3D Viewer with off-thread geometry processing and type-based color coding
- [x] BuildingSMART API validation integration with functional part tagging
- [x] Schema error human-readable interpretation
- [x] Educational / learning mode with worked examples and practice exercises
- [x] Dynamic documentation links per IFC entity and schema version
- [x] Export: graph as JSON/CSV/PNG, validation as JSON/CSV/text
- [x] Keyboard shortcuts (Ctrl+F, Ctrl+S, Escape, Ctrl+Shift+V, etc.)
- [x] Virtual scrolling and pagination for large entity lists
