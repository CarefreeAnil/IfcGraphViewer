# IFC Graph Viewer - Master's Thesis POC

**Proof of Concept: Developing a Unified Web-Based Platform for IFC Graph Visualization, Exploration, and Validation**

## About This Thesis Work

### Thesis Overview
The Industry Foundation Classes (IFC) schema underpins openBIM workflows, but tooling for schema exploration and validation is fragmented. Learners and practitioners lack a unified, accessible interface for understanding IFC structures across versions and for validating models efficiently. This thesis proposes a **client-side, web-based platform** that consolidates:

- **Graph Visualization** - Interactive force-directed graphs showing entity relationships
- **Hierarchical Browsing** - Tree-based exploration of IFC structures
- **Property Inspection** - Detailed entity property
- **3D Visualization** - Spatial representation of building models
- **Validation** - IFC standards compliance checking

### Target Audience
Learners, students, and novice BIM practitioners who struggle to understand IFC entities, relationships, and properties across versions without heavy desktop tools or steep onboarding.

### Goals and Significance
This research aims to democratize IFC education and exploration by providing a zero-install, browser-based tool that:
- Eliminates software installation barriers
- Provides visual, interactive learning experiences
- Supports both IFC (STEP and JSON) formats
- Enables self-paced exploration of IFC concepts
- Validates models against schema definitions in real-time

## 🎯 Key Features

### 📊 Four Interactive Visualization Modes

1. **Graph View** - Force-directed graph visualization with physics simulation
   - Interactive node-and-link diagram
   - Color-coded by entity type
   - Type filtering and entity search
   - Drag-to-explore interface with zoom/pan
   - Optimized for 1000+ entity relationships

2. **Tree Browser** - Hierarchical structural exploration
   - Expandable/collapsible entity hierarchy
   - Full-text search across labels, types, IDs
   - Inverse reference explorer
   - One-click entity navigation
   - Virtual scrolling for performance

3. **Property Viewer** - Tabular entity inspection
   - Searchable entity list
   - Detailed property inspection
   - Support for complex property values
   - IFC5-specific property formatting
   - Schema-based value display

4. **3D Viewer** - Three-dimensional visualization
   - Color-coded 3D representation by entity type
   - Interactive 3D navigation (zoom, pan, rotate)
   - Real-time entity selection and highlighting
   - Cross-modal synchronized selection
   - Lazy loading (loads on-demand to save resources)

5. **Learning & Educational Features** (NEW)
   - Dynamic documentation links for IFC entities
   - Interactive learning context system
   - Educational content generation

### 🌳 Advanced IFC Browser Features

- **Hierarchical Navigation** - Expandable/collapsible tree with parent-child relationships
- **Smart Search** - Real-time filtering across labels, types, and IDs
- **Entity Selection** - Instant property display on selection
- **Inverse References** - Automatic relationship tracking

### 🔗 Inverse References System

Automatically tracks and displays:
- **Referenced By** - All entities that reference the selected entity
- **References** - All entities referenced by the selected entity
- Bidirectional relationship exploration
- One-click navigation between related entities
- Full property value inspection

### 💾 Multi-Format Support

- **IFC4** - Traditional STEP format (.ifc files)
- **IFC5** - JSON-based format (.ifcx files)
- **Smart Routing** - Automatic parser selection based on file extension
- Format-specific optimizations for each IFC version

### ⚡ Performance Optimizations

- Web Worker-based parsing (non-blocking UI)
- Geometry worker for 3D processing
- Virtual scrolling for large entity lists
- Force graph physics optimization
- Debounced search (500ms)
- Memory-efficient geometry filtering
- Scales to 10,000+ entities
- Optimized Level of Detail (LoD) system

### ✅ IFC Validation System

#### **buildingSMART Validator** (Current/Active)
A comprehensive validation system that integrates with the official **buildingSMART Validation API** to validate IFC files against official standards:

- **Live API Integration** - Submits files to buildingSmart official validation service
- **Comprehensive Checking** - Validates against syntax, schema, Normative rules and Industry practices specifications
- **Entity-Level Diagnostics** - Links validation issues to specific IFC entities (For Schema)
- **Export Results** - Export validation reports in JSON, CSV, or plain text formats
- **Real-time Polling** - Live status updates during validation processing
- **Backend Proxy** - Express.js server in `bSValidate/` module handles API communication

**Components:**
- `src/pages/Validation.tsx` - Validation interface
- `bSValidate/server.js` - Backend proxy to buildingSmart API
- `bSValidate/src/services/buildingsmartApi.ts` - API integration
- `bSValidate/src/services/buildingsmartMapper.ts` - Result mapping
- `bSValidate/src/lib/exportValidation.ts` - Export functionality

#### **Local Validator** (Work in Progress - Disabled)
A planned client-side IFC validator for offline validation:
- Currently disabled pending refactoring
- Will provide instant validation without external API calls
- Supports schema compliance checking
- Integrated into `ifcValidatorEnhanced.ts` for future activation

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd "Thesis - POC"

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will open at `http://localhost:5173/`

### Setting Up buildingSMART Validation (Optional)

To enable the **buildingSMART Validator**, you need to set up the validation backend:

```bash
# Navigate to validation backend
cd bSValidate

# Install backend dependencies
npm install

# Create .env file with your buildingSMART API token
echo BUILDINGSMART_TOKEN=your_token_here > .env

# Start the validation backend server (runs on port 5001)
npm start
```

The validation backend proxies requests to `https://dev.validate.buildingsmart.org/api/v1`. You'll need a valid buildingSMART API token from their developer portal.

**Note:** The frontend expects the validation backend to be running on `http://localhost:5001`. If using a different port, update the API endpoint in `src/pages/Validation.tsx`.

### Building for Production

```bash
# Build the application
npm run build

# Preview the production build
npm run preview

# Deploy the dist/ folder to your hosting service
```


## 📋 Usage Guide

### Uploading an IFC File

1. Open the application in your browser
2. Click the upload area or drag-and-drop an `.ifc` or `.ifcx` file
3. Wait for the parsing to complete (progress indicator shown)
4. Select a visualization mode to explore the data

### Using Graph View

1. Navigate to the **Graph** tab
2. **Pan**: Click and drag to move around
3. **Zoom**: Scroll wheel to zoom in/out
4. **Select**: Click nodes to select entities
5. **Filter**: Use "Filter by Type" to highlight specific entity types
6. **Search**: Use the search box to find and highlight entities
7. **Details**: Right panel shows selected entity properties and relationships

### Using IFC Browser

1. Navigate to the **IFC Browser** tab
2. **Expand**: Click arrows to expand/collapse nodes
3. **Search**: Use the search box for full-text filtering
4. **Select**: Click entities to select them
5. **View Relations**: Split panel shows inverse references automatically
   - "Referenced By": Entities that reference the selected entity
   - "References": Entities referenced by the selected entity
6. **Navigate**: Click any reference in the split panel to jump to it

### Using 3D Viewer

1. Navigate to the **3D** tab
2. Click **Load 3D** to initialize the 3D visualization (loads on-demand)
3. **Navigate**: 
   - Scroll to zoom in/out
   - Left-click drag to rotate
   - Right-click drag to pan
4. **Select**: Click on 3D objects to select entities
5. **Sync**: Selection automatically updates in Graph, Tree, and Properties views
6. Click **Unload 3D** to free memory when done

### Using IFC Validation

1. Click the **Validation** button in the toolbar after uploading a file
2. Choose a validation method:
   
   **buildingSMART Validator (Recommended):**
   - Click "Validate with buildingSMART"
   - File is submitted to official buildingSmart validation service
   - Wait for validation to complete (status shown in real-time)
   - Review results categorized by severity (errors, warnings, info)
   - **Export Results**: Click the download button to export in JSON, CSV, or text format
   - Click on entities in the report to navigate to them in the graph/tree
   
   **Local Validator (Currently Disabled):**
   - Work-in-progress validator for offline validation
   - Will be enabled in future releases

## 📁 Project Structure

```
.
├── public/
│   ├── ifc-wasm/              # WASM binaries for IFC parsing
│   ├── testFiles/             # Sample IFC files for testing
│   └── robots.txt
├── src/
│   ├── components/
│   │   ├── GraphVisualization.tsx    # Graph rendering component
│   │   ├── GraphControls.tsx         # Graph controls and filters (enhanced)
│   │   ├── IFCBrowser.tsx            # IFC STEP file browser with references
│   │   ├── IFC5TreeBrowser.tsx       # IFC5-specific tree browser
│   │   ├── IFC5PropertyViewer.tsx    # IFC5-specific properties
│   │   ├── PropertyViewer.tsx        # Properties table view
│   │   ├── NodeDetailsPanel.tsx      # Entity details display (enhanced)
│   │   ├── FileUpload.tsx            # File upload handler
│   │   ├── Header.tsx                # Application header (enhanced)
│   │   ├── Legend.tsx                # Entity type legend
│   │   ├── ValidationDialog.tsx      # Validation UI
│   │   ├── ValidationReport.tsx      # Validation results (enhanced)
│   │   ├── Viewer3D.tsx              # 3D viewer component (significantly expanded)
│   │   ├── ErrorBoundary.tsx         # Error handling
│   │   ├── VirtualList.tsx           # Virtual scrolling
│   │   └── ui/                       # shadcn/ui components
│   ├── contexts/
│   │   ├── LearningContext.tsx       # Learning state management (NEW)
│   │   └── UIStateContext.tsx        # UI state management (enhanced)
│   ├── hooks/
│   │   ├── useIFC5Viewer.ts          # IFC5 viewer logic
│   │   ├── useIFCWorker.ts           # Worker communication
│   │   ├── useViewer3D.ts            # 3D viewer setup
│   │   ├── usePagination.ts          # Pagination logic
│   │   ├── useVirtualScroll.ts       # Virtual scrolling
│   │   └── useKeyboardShortcuts.ts   # Keyboard navigation
│   ├── lib/
│   │   ├── ifcParser.ts              # IFC4 STEP format parser (refactored)
│   │   ├── ifcParserEnhancements.ts  # Parser improvements
│   │   ├── ifc5Parser.ts             # IFC5 JSON parser
│   │   ├── ifc5ParserMain.ts         # IFC5 main parsing logic
│   │   ├── ifc5Composition.ts        # IFC5 composition extraction
│   │   ├── ifc5ToGraph.ts            # IFC5 to graph conversion
│   │   ├── ifcValidatorEnhanced.ts   # Enhanced validation (strict GUID checks)
│   │   ├── ifcSchema.ts              # Entity schema definitions (enhanced)
│   │   ├── ifcSchemaLoader.ts        # Dynamic schema loading (NEW)
│   │   ├── graphLoD.ts               # Level of Detail system (rewritten)
│   │   ├── graphBuilder.ts           # Graph construction utilities (NEW)
│   │   ├── treeBuilder.ts            # Tree structure building (NEW)
│   │   ├── colorScheme.ts            # UI color scheme management (NEW)
│   │   ├── docsLinkGenerator.ts      # Documentation link generation (NEW)
│   │   ├── dynamicLearning.ts        # Dynamic learning system (NEW)
│   │   ├── schema-layer-mapping.ts   # Layer mapping utilities (NEW)
│   │   ├── stepRepresentationGenerator.ts # STEP format generation (NEW)
│   │   ├── exportUtils.ts            # Export functionality
│   │   └── utils.ts                  # Utility functions
│   ├── types/
│   │   ├── graph.ts                  # Graph data structures (enhanced with categories)
│   │   ├── ifc.ts                    # IFC4 type definitions
│   │   ├── ifc5.ts                   # IFC5 type definitions
│   │   └── learning.ts               # Learning type definitions (NEW)
│   ├── utils/
│   │   └── logger.ts                 # Logging utilities
│   ├── workers/
│   │   ├── ifcParserWorker.ts        # Parser worker thread (improved)
│   │   └── ifcGeometryWorker.ts      # Geometry processing worker (massively expanded)
│   ├── data/
│   │   └── ifc-schema.ts             # Schema data
│   ├── pages/
│   │   ├── Index.tsx                 # Main page (major refactoring)
│   │   ├── Validation.tsx            # Dedicated validation page (NEW)
│   │   └── NotFound.tsx              # 404 page
│   ├── App.tsx                       # Root component
│   ├── App.css                       # Global styles
│   ├── main.tsx                      # Entry point
│   └── index.css                     # CSS imports
├── features/                         # Feature-specific modules (NEW)
├── services/                         # Service layer modules
├── bSValidate/                       # buildingSMART Validation Backend (NEW)
│   ├── src/
│   │   ├── services/
│   │   │   ├── buildingsmartApi.ts   # API client for buildingSmart service
│   │   │   └── buildingsmartMapper.ts # Result mapping and transformation
│   │   └── lib/
│   │       └── exportValidation.ts   # Export in JSON, CSV, text formats
│   ├── server.js                     # Express proxy server
│   ├── package.json                  # Backend dependencies
│   └── .env                          # Environment (BUILDINGSMART_TOKEN)
├── SYSTEM_ARCHITECTURE.md            # System architecture documentation
├── PARSER_ARCHITECTURE.md            # Parser design details
├── FEATURE_SUMMARY.md                # Recent features and changes
├── README.md                         # This file
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript config
├── tailwind.config.ts                # Tailwind CSS config
├── postcss.config.js                 # PostCSS config
└── vite.config.ts                    # Vite build config
```

## 🔧 Technologies Used

### Core Framework
- **React 18** - UI library with hooks and concurrent features
- **TypeScript** - Type-safe JavaScript
- **Vite** - Ultra-fast build tool and dev server

### IFC Parsing
- **web-ifc** - WASM-based IFC file parser
- **Web Workers** - Background processing for large files
- **JSON parsing** - Built-in for IFC5 JSON format

### Visualization
- **react-force-graph-2d** - 2D force-directed graph rendering
- **D3.js** - Physics simulation and utilities
- **Framer Motion** - Smooth animations and transitions
- **Three.js** - 3D rendering
- **@react-three/fiber** - React integration for Three.js
- **@react-three/drei** - Useful Three.js helpers

### UI & Styling
- **Tailwind CSS 4** - Utility-first CSS framework
- **shadcn/ui** - Accessible React component library
- **Lucide React** - Beautiful icon library
- **Sonner** - Toast notifications

### State Management & Data
- **React Context API** - Built-in state management
- **React Router** - Client-side routing
- **React Query** - Data fetching and caching

### Development
- **ESLint** - Code quality and standards
- **PostCSS** - CSS processing
- **TypeScript Compiler** - Type checking

## 📚 Documentation

### Architecture & System Design
- **[SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)** - Complete system architecture with diagrams
  - Component hierarchy
  - Data flow and state management
  - Performance optimizations
  - Integration patterns

### Parser Implementation
- **[PARSER_ARCHITECTURE.md](PARSER_ARCHITECTURE.md)** - Detailed parser design
  - IFC4 (STEP format) parsing
  - IFC5 (JSON format) parsing
  - Graph conversion algorithms
  - Relationship handling

### Recent Changes
- **[FEATURE_SUMMARY.md](FEATURE_SUMMARY.md)** - Latest features and enhancements
  - IFC5 support implementation
  - Tree browser features
  - UI improvements
  - Performance metrics

## 🎨 IFC File Parsing

### Supported Formats

**IFC4 (.ifc files)**
- STEP textual format
- Uses web-ifc WASM library
- Supports IFC2x3 and IFC4 standards
- Automatic geometry filtering

**IFC5 (.ifcx files)**
- JSON-based format
- UUID-based path system
- Composition extraction
- Enhanced property support

### Relationship Types Extracted

- **CONTAINS** - Parent-child containment relationships
- **AGGREGATES** - Hierarchical aggregation
- **INHERITS** - Inheritance relationships
- **SPACE_BOUNDARY** - Space boundary definitions
- **VOIDS** - Openings in building elements
- **FILLS** - Fillings in openings
- **PROPERTY_REFERENCE** - Property set associations

### Entity Categories

- **Building** - IFCPROJECT, IFCSITE, IFCBUILDING, IFCBUILDINGSTOREY
- **Spaces** - IFCSPACE, IFCZONE
- **Elements** - IFCWALL, IFCDOOR, IFCWINDOW, IFCSLAB, IFCCOLUMN, IFCBEAM, IFCSTAIR, IFCROOF
- **Properties** - IFCPROPERTYSET, properties with values
- **Relationships** - Relationship entities between other objects

## ⚙️ Configuration

### TypeScript (`tsconfig.json`)
- Strict mode for type safety
- ES2020 target
- Module resolution: bundler

### Tailwind CSS (`tailwind.config.ts`)
- Custom color schemes
- Dark mode support
- Responsive design system
- Custom animations

### Vite (`vite.config.ts`)
- React plugin with SWC compilation
- WASM static file copying
- Optimized build output

## 📊 Performance Characteristics

### Parsing Performance
- **IFC4 files** (1-5K entities): < 2 seconds
- **IFC5 files** (1-10K entities): < 3 seconds
- **Web Worker** prevents UI blocking

### Rendering Performance
- **Graph View** (1000+ nodes): 60 FPS
- **Tree Browser** (10K+ entities): Virtual scrolling
- **Search** (debounced): 500ms response time

### Memory Usage
- Geometry entities filtered out (not stored)
- Efficient node/edge representation
- Memoization of expensive components

## 🐛 Troubleshooting

### Common Issues

**File Upload Fails**
- Ensure file format is .ifc or .ifcx
- Verify file integrity
- Check browser console for errors

**Slow Performance on Large Files**
- Use Tree Browser instead of Graph View
- Filter by entity type
- Reduce graph physics iterations

**Missing Entities in Output**
- Geometry entities are intentionally filtered
- Check validation report for warnings
- Verify IFC file integrity

**WASM Module Loading Error**
- Ensure `public/ifc-wasm/` folder exists
- Check browser DevTools for 404 errors
- Verify static file serving in Vite config

### Debug Mode
Enable detailed logging by checking the browser console for debug information.

## 🔐 Data Privacy

- All processing happens in the browser
- No data is sent to external servers (except when using buildingSMART Validator, which submits files to buildingSmart's official validation service)
- Files are processed locally using Web Workers

## 📈 Performance Optimization Tips

### For Large IFC Files
1. Use Tree Browser for navigation
2. Filter to specific entity types
3. Disable real-time search updates
4. Use property viewer for inspection

### For Graph Visualization
1. Limit to < 5000 nodes for full interactivity
2. Use type filtering to reduce complexity
3. Adjust zoom levels for overview/detail

## 🚀 Deployment

### Static Hosting (Recommended)
Deploy the `dist/` folder to any static host:
- Vercel
- Netlify
- GitHub Pages
- AWS S3 + CloudFront
- Any web server


## 🔄 Roadmap

### ✅ Completed
- [x] 3D Visualization with geometry worker
- [x] Educational/Learning features
- [x] Building smart API validation
- [x] Dynamic documentation linking
- [x] Dedicated validation page
- [x] Geometry processing optimization
- [x] Export to Multiple Formats (JSON, CSV, OBJ)


