# IFC Graph Viewer - System Architecture

## Overview

The IFC Graph Viewer is a comprehensive web-based application designed to parse, visualize, and explore IFC (Industry Foundation Classes) files in multiple formats (IFC4, IFC5). The system is built with a modern React stack and supports three complementary visualization modes: Graph, Tree Browser, and Property Viewer.

## System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE LAYER                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│ │ Graph View   │ │ Tree Browser │ │ Property     │ │ 3D Viewer    │     │
│ │ Force-dir    │ │ Hierarchical │ │ Viewer       │ │ Three.js     │     │
│ │ Graph        │ │ Structure    │ │ IFC5-aware   │ │ (Lazy-load)  │     │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘     │
│        │                │                │                │              │
│        └────────────────┴────────────────┴────────────────┘              │
│           Cross-Modal Selection Synchronization (UIStateContext)        │
│                                                                            │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │               Validation Page (Pages/Validation.tsx)                 │ │
│ │  ┌────────────────────────┐      ┌────────────────────────────────┐ │ │
│ │  │ buildingSMART Validator│      │ Local Validator (WIP)          │ │ │
│ │  │ - Live Submission      │      │ - Client-side validation       │ │ │
│ │  │ - Real-time Polling    │      │ - GUID Validation              │ │ │
│ │  │ - Export Results       │      │ - Schema Compliance            │ │ │
│ │  └────────────────────────┘      └────────────────────────────────┘ │ │
│ │                    ValidationReport Component                         │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
├──────────────────────────────────────────────────────────────────────────┤
│                   STATE MANAGEMENT & CONTEXTS (SHARED)                   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌──────────────────────────┐ ┌──────────────────────┐                    │
│ │ UIStateContext           │ │ LearningContext      │                    │
│ │ - selectedNode (sync)    │ │ - learning progress  │                    │
│ │ - viewMode (graph/tree)  │ │ - content state      │                    │
│ │ - filters/search         │ │ - help integration   │                    │
│ │ - show3DViewer           │ │ - localStorage store │                    │
│ │ - schema version         │ │ - user preferences   │                    │
│ └──────────────────────────┘ └──────────────────────┘                    │
│                                                                            │
├──────────────────────────────────────────────────────────────────────────┤
│                   PARSING & DATA PROCESSING LAYER                        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌──────────────────┐ ┌──────────────────┐ ┌────────────────────────┐   │
│ │ IFC4 Parser      │ │ IFC5 Parser      │ │ Validators & Utils     │   │
│ │ (ifcParser.ts)   │ │ (ifc5Parser.ts)  │ │ - ifcValidatorEnhanced │   │
│ │ web-ifc WASM     │ │ JSON-based       │ │ - export utilities     │   │
│ │ support          │ │ UUID system      │ │ - schema mapping       │   │
│ └──────────────────┘ └──────────────────┘ └────────────────────────┘   │
│         │                    │                                           │
│         └────────┬───────────┘                                           │
│                  │                                                       │
│         ┌────────▼──────────┐                                            │
│         │ Graph Conversion  │                                            │
│         │ (ifc5ToGraph.ts)  │                                            │
│         │ (ifc5Composition) │                                            │
│         └────────┬──────────┘                                            │
│                  │                                                       │
├──────────────────┼───────────────────────────────────────────────────────┤
│                  │          WORKER THREADS (Background)                  │
│      ┌───────────┴──────────────┐                                        │
│      │                          │                                        │
│  ┌───▼──────────────┐   ┌──────▼──────────────┐                        │
│  │ Parser Worker    │   │ Geometry Worker    │                        │
│  │ - Parse IFC      │   │ - Geometry process │                        │
│  │ - Extract ents   │   │ - WASM details     │                        │
│  │ - Relationships  │   │ - 3D data prep     │                        │
│  └──────────────────┘   └─────────────────────┘                        │
│                                                                            │
├──────────────────────────────────────────────────────────────────────────┤
│                   EXTERNAL SERVICES & APIs (NEW)                         │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ bSValidate Backend Module (NEW)                                      │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌───────────────────────────────┐ │ │
│ │ │ Express      │ │ buildingSmart│ │ Export Utilities             │ │ │
│ │ │ Server       │ │ API Client   │ │ - JSON, CSV, Text           │ │ │
│ │ │ (port 5001)  │ │ - Submit     │ │ - Result mapping            │ │ │
│ │ │ - Proxy      │ │ - Poll       │ │ - Schema alignment          │ │ │
│ │ └──────────────┘ └──────────────┘ └───────────────────────────────┘ │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                              │                                            │
│                  ┌───────────▼────────────┐                              │
│                  │ buildingSmart API      │                              │
│                  │ https://dev.validate.. │                              │
│                  └────────────────────────┘                              │
│                                                                            │
├──────────────────────────────────────────────────────────────────────────┤
│                        EXTERNAL DEPENDENCIES                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌──────────────────────┐ ┌─────────────────────┐ ┌──────────────────┐  │
│ │ web-ifc (WASM)       │ │ Graph Visualization │ │ 3D Rendering     │  │
│ │ IFC parsing support  │ │ - react-force-graph │ │ - Three.js       │  │
│ │                      │ │ - D3.js             │ │ - React Three    │  │
│ │                      │ │ - Framer Motion     │ │ - drei helpers   │  │
│ └──────────────────────┘ └─────────────────────┘ └──────────────────┘  │
│                                                                            │
│ ┌──────────────────────┐ ┌─────────────────────┐                        │
│ │ UI Framework         │ │ Learning System     │                        │
│ │ - React 18           │ │ - Dynamic docs      │                        │
│ │ - React Router       │ │ - Context API       │                        │
│ │ - TypeScript         │ │ - Educational UI    │                        │
│ └──────────────────────┘ └─────────────────────┘                        │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. File Upload & Processing

**Component**: `FileUpload.tsx`
- Accepts `.ifc` and `.ifcx` files
- Routes to appropriate parser based on file extension
- Handles file validation and error reporting
- Provides progress feedback

```
User File Upload
    ↓
File Extension Check & Validation
    ├→ .ifc → IFC4 Parser (WASM-based, web-ifc)
    └→ .ifcx → IFC5 Parser (JSON-based)
    ↓
Background Processing (Web Worker)
    ↓
Entities & Relationships Extraction
    ↓
Graph Conversion (Unified Format)
    ↓
Store in Component State (Local React)
    ↓
Render in Active Visualization Mode
```

*For detailed parsing logic, see [PARSER_ARCHITECTURE.md](PARSER_ARCHITECTURE.md)*

### 2. Parsing & Processing Layer

The system supports two IFC file formats, each with a specialized parser:

**IFC4 (.ifc files)**
- WASM-based parsing using web-ifc library
- Optimized for traditional STEP format
- Tracks STEP lines for validation

**IFC5 (.ifcx files)**
- JSON-based format with UUID paths
- Composition extraction and hierarchy analysis
- Schema-aware property mapping

Both deliver a **unified graph model** for consistent visualization. Processing happens in a **Web Worker** to keep the UI responsive.

*For detailed parser architecture, see [PARSER_ARCHITECTURE.md](PARSER_ARCHITECTURE.md)*

### 3. Data Model

Both IFC4 and IFC5 are converted to a **unified graph representation**:

**GraphNode** - Represents IFC entities:
- Unique identifiers (Express ID for IFC4, UUID for IFC5)
- Type classification (building, space, element, property, etc.)
- Complete property sets for inspection
- Parent-child relationships for hierarchy

**GraphEdge** - Represents IFC relationships:
- Source → Target connections showing entity relationships
- Typed relationships (CONTAINS, AGGREGATES, INHERITS, etc.)
- Optional metadata for validation and display

*See [PARSER_ARCHITECTURE.md](PARSER_ARCHITECTURE.md) for detailed type definitions and structure*

## Core Components

### 1. Visualization Layer (4 Integrated Views)

#### Graph Visualization (`GraphVisualization.tsx`)
- Force-directed graph using **react-force-graph-2d**
- Node coloring by entity type
- Type-based filtering
- Interactive drag-to-explore
- Search highlighting
- Performance optimized for 1000+ nodes

#### Tree Browser (`IFCBrowser.tsx`)
- Hierarchical tree rendering  
- Full-text search (labels, types, IDs)
- Expandable/collapsible nodes
- Inverse reference explorer with references to other entities
- One-click entity navigation
- Virtual scrolling for performance
- STEP line display for IFC4 files

#### Property Viewer (`PropertyViewer.tsx` + `IFC5PropertyViewer.tsx`)
- Searchable entity list
- Detailed property inspection
- Complex property value handling
- Schema-based property display
- IFC5-specific property formatting

#### 3D Viewer (`Viewer3D.tsx`) - NEW
- Three.js-based 3D visualization
- Color-coded by entity type
- Lightweight geometric representations
- Interactive raycasting for selection
- OrbitControls for navigation (zoom, pan, rotate)
- Real-time selection highlighting (yellow emissive glow)
- Lazy loading (disabled by default, loads on-demand)
- Cross-modal selection synchronization

### 2. Cross-Modal Selection System

All four visualization modes are synchronized through a centralized selection system:

```
User selects entity in any view
    ↓
Update UIStateContext.selectedNode
    ↓
All views reactively update
    ├→ Graph: Node highlights + grows
    ├→ Tree: Scrolls to node + highlights row
    ├→ Properties: Auto-populates with entity data
    └→ 3D: Yellow emissive glow + 1.2x scale
```

**Benefits**:
- Explore same data from multiple perspectives
- Seamless navigation between modes
- Consistent visual feedback across all views

### 5. State Management

#### UIStateContext
- **Cross-Modal Selection**: Synchronized entity selection across all visualizations
- **View State**: Tracks active view mode (graph|tree|properties|3d)
- **UI Preferences**: Stores user preferences (3D viewer state, schema version)
- **Filters & Search**: Manages active filters and search queries
- **Performance**: Minimal re-renders through efficient updates

#### LearningContext
- **Progress Tracking**: Educational content completion and advancement
- **Content State**: Current learning mode and selected layer
- **Contextual Help**: Dynamic documentation links matched to user exploration
- **Persistence**: localStorage integration for progress continuity
- **Integration**: Seamlessly integrated with visualizations for inline help

### 6. Validation System (New Core Feature)

#### Overview
The application integrates **dual validation approach** with two validators:

**buildingSMART Validator (Production-Ready)**
- Official cloud-based validation service
- Backend proxy (`bSValidate/` module) on port 5001
- Real-time status polling with live updates
- Entity-level error diagnostics
- Multi-format export (JSON, CSV, text)

**Local Validator (Work-in-Progress)**
- Planned client-side validation for offline use
- Schema compliance and GUID validation
- Currently disabled, pending refactoring

*Detailed validation system architecture documented in [PARSER_ARCHITECTURE.md](PARSER_ARCHITECTURE.md#validation-pipeline)*

## Data Flow

### Upload → Visualization
```
1. User uploads .ifc or .ifcx file
2. FileUpload validates file type
3. Dispatch to Web Worker (ifcParserWorker)
4. Format-specific parser processes
5. Convert to unified graph (nodes + edges)
6. Return to main thread + store in state
7. Render in active visualization mode
   ├→ Graph: GraphVisualization
   ├→ Tree: IFCTreeBrowser
   ├→ Properties: PropertyViewer
   └→ 3D: Viewer3D (lazy-loaded on demand)
```

### Validation Workflow
```
1. User navigates to Validation page
2. Submit IFC file for validation
3. Frontend sends to backend proxy (bSValidate)
4. Backend forwards to buildingSmart API
5. Frontend polls status every 3 seconds
6. Results mapped to ValidationResult format
7. Display ValidationReport with entity links
8. Click entity to navigate and inspect in graph/tree
```

### Cross-Modal Selection
```
User selects entity in any view
   ↓
Update UIStateContext.selectedNode
   ↓
All components synchronize
   ├→ Graph: Highlights + scales selected node
   ├→ Tree: Scrolls to node, highlights row
   ├→ Properties: Auto-populates entity data
   └→ 3D: Shows emissive glow + scaling
```

### Learning Integration
```
User explores IFC file
   ↓
LearningContext tracks exploration
   ↓
At each step, provide:
   ├→ Contextual documentation
   ├→ Entity type explanations
   ├→ Validation error interpretations
   └→ Progress tracking for analytics
```
   ├→ Properties: Auto-populate entity data
   └→ 3D: Yellow glow + 1.2x scale
   ↓
NodeDetailsPanel shows entity properties
   ↓
Inverse references panel updates
   └→ Shows "Referenced By" and "References"
```

### Learning Integration Flow (NEW)
```
User explores IFC file
   ├→ View entity properties
   ├→ Explore relationships
   ├→ Run validation
   │
   ↓ At each step:
   │
   ├→ LearningContext provides contextual help
   ├→ Dynamic documentation links available
   ├→ Validation errors explained
   └→ Progress tracked for learning analytics
```

## Component Hierarchy

```
App.tsx
  ├── UIStateProvider
  ├── LearningProvider
  ├── ErrorBoundary
  ├── Header
  └── Routes
      ├── Index Page (pages/Index.tsx)
      │   ├── FileUpload
      │   ├── Visualization (Conditional)
      │   │   ├── GraphVisualization + Controls
      │   │   ├── IFCTreeBrowser
      │   │   ├── PropertyViewer
      │   │   └── Viewer3D (Lazy-loaded)
      │   └── Learning Panel (Conditional)
      │
      ├── Validation Page (pages/Validation.tsx)
      │   ├── buildingSMART Validator
      │   ├── Local Validator (WIP)
      │   └── ValidationReport
      │
      └── NotFound (404)
```

## Key Hooks & Utilities

The application provides specialized hooks for different concerns:

**Parsing & IFC Handling**
- `useIFCWorker` - Parser communication and async operations
- `useIFC5Viewer` - IFC5-specific parsing workflow

**Visualization**
- `useViewer3D` - 3D viewer state, caching, raycasting (45-55 FPS)

**UI & Performance**
- `usePagination` - Large entity list pagination
- `useVirtualScroll` - Virtual scrolling optimization
- `useKeyboardShortcuts` - Keyboard navigation

*For detailed implementation, see source files in `src/hooks/`*

## Build, Test & Deployment

For detailed information on setup, building, testing, and deployment, refer to **[README.md](README.md)**.

Key sections:
- Installation and setup
- Development workflow  
- Production build process
- Deployment options
- Troubleshooting common issues
- Verify IFC file integrity

**WASM Loading Issues**
- Ensure `public/ifc-wasm/` contains necessary files
- Check browser console for loading errors
- Try refreshing the page

**Parsing Errors**
- Verify file format (.ifc or .ifcx)
- Check file size and integrity
- Review validation report for details

## Key Dependencies

For the complete dependency list and version information, see **[README.md - Technologies Used](README.md#-technologies-used)**.

Key libraries:
- **React 18** - UI framework with Context API
- **web-ifc** - WASM-based IFC4 parsing
- **Three.js** - 3D visualization
- **react-force-graph-2d** - Force-directed graph visualization
- **shadcn/ui** - Accessible component library
- **Tailwind CSS 4** - Utility-first styling

## Architecture Decisions

### Why Multiple Parsers?
- IFC4 and IFC5 are fundamentally different formats
- Separate parsers allow optimization per format
- Easier maintenance and testing

### Why Dual Validation?
- buildingSMART Validator: Official compliance, comprehensive checking
- Local Validator: Instant feedback, offline capability
- Flexibility for different user needs and workflows

### Why React Contexts?
- Lightweight state management
- Minimal dependencies
- Sufficient for this application scope
- Easy to add/extend contexts (like LearningContext)

### Why Web Workers?
- Prevent UI blocking during parsing
- Support for large files
- Better user experience with responsive UI

### Why Separate Backend Module?
- bSValidate backend separation for modularity
- Independent startup/configuration
- Easier to deploy validator separately
- Clear service boundaries

### Why Lazy-Loading for 3D?
- Reduces initial load time significantly
- Users who don't need 3D aren't penalized
- Memory efficient
- Smooth progressive enhancement

### Why Learning System Integration?
- Educational focus aligned with thesis goals
- Context-aware help improves user experience
- Learning data can inform future improvements
- Supports novice user onboarding

## Documentation Structure

This documentation is organized into focused, non-overlapping documents:

- **README.md** - Quick start, feature overview, setup, troubleshooting
- **FEATURE_SUMMARY.md** - Implementation status, file-by-file breakdown
- **PARSER_ARCHITECTURE.md** - Parser design and validation pipeline details
- **SYSTEM_ARCHITECTURE.md** (this file) - System overview and data flows

## Architecture

The IFC Graph Viewer is designed with the following principles:

- **Modular** - Decoupled components with clear responsibilities
- **Scalable** - Handles files with 1000+ entities efficiently
- **Extensible** - Easy to add new parsers, validators, or visualization modes
- **Maintainable** - Clear data flow and separation of concerns
- **Responsive** - Quick UI feedback with background Web Worker processing
- **Educational** - Learning features integrated throughout user experience
- **Professional** - Enterprise-grade validation capabilities through buildingSmart integration

The system successfully balances feature richness with performance, supporting both novice learners and advanced practitioners through multiple exploration modes, professional validation, and contextual educational support.
