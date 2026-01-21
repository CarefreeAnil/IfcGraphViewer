# IFC Graph Viewer - Thesis POC

A comprehensive web-based platform for parsing, visualizing, and exploring IFC (Industry Foundation Classes) files in multiple formats (IFC4 and IFC5) through interactive visualization modes.

## 🎯 Key Features

### 📊 Three Interactive Visualization Modes

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

4. **3D Viewer** - Three-dimensional visualization (NEW)
   - Color-coded 3D representation by entity type
   - Interactive 3D navigation (zoom, pan, rotate)
   - Real-time entity selection and highlighting
   - Cross-modal synchronized selection
   - Lazy loading (loads on-demand to save resources)

### 🌳 Advanced Tree Browser Features

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
- Virtual scrolling for large entity lists
- Force graph physics optimization
- Debounced search (500ms)
- Memory-efficient geometry filtering
- Scales to 10,000+ entities

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

### Using Tree Browser

1. Navigate to the **Tree Browser** tab
2. **Expand**: Click arrows to expand/collapse nodes
3. **Search**: Use the search box for full-text filtering
4. **Select**: Click entities to select them
5. **View Relations**: Right panel shows inverse references automatically
   - "Referenced By": Entities that reference the selected entity
   - "References": Entities referenced by the selected entity
6. **Navigate**: Click any reference in the right panel to jump to it

### Using Property Viewer

1. Navigate to the **Properties** tab
2. **Browse**: Scroll through the searchable entity list
3. **Search**: Filter entities by name/type
4. **Inspect**: Click any entity to view its detailed properties
5. **Explore**: Right panel shows all properties with values

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
│   │   ├── IFCTreeBrowser.tsx        # Tree browser component
│   │   ├── IFC5TreeBrowser.tsx       # IFC5-specific tree browser
│   │   ├── PropertyViewer.tsx        # Properties table view
│   │   ├── IFC5PropertyViewer.tsx    # IFC5-specific properties
│   │   ├── NodeDetailsPanel.tsx      # Entity details display
│   │   ├── FileUpload.tsx            # File upload handler
│   │   ├── GraphControls.tsx         # Controls and filters
│   │   ├── Header.tsx                # Application header
│   │   ├── Legend.tsx                # Entity type legend
│   │   ├── StatsPanel.tsx            # Statistics display
│   │   ├── ValidationDialog.tsx      # Validation UI
│   │   ├── ValidationReport.tsx      # Validation results
│   │   ├── Viewer3D.tsx              # 3D viewer component
│   │   ├── ErrorBoundary.tsx         # Error handling
│   │   ├── VirtualList.tsx           # Virtual scrolling
│   │   └── ui/                       # shadcn/ui components
│   ├── contexts/
│   │   ├── IFCDataContext.tsx        # IFC data state
│   │   └── UIStateContext.tsx        # UI state management
│   ├── hooks/
│   │   ├── useIFC5Viewer.ts          # IFC5 viewer logic
│   │   ├── useIFCWorker.ts           # Worker communication
│   │   ├── useViewer3D.ts            # 3D viewer setup
│   │   ├── usePagination.ts          # Pagination logic
│   │   ├── useVirtualScroll.ts       # Virtual scrolling
│   │   └── useKeyboardShortcuts.ts   # Keyboard navigation
│   ├── lib/
│   │   ├── ifcParser.ts              # IFC4 STEP format parser
│   │   ├── ifcParserEnhancements.ts  # Parser improvements
│   │   ├── ifc5Parser.ts             # IFC5 JSON parser
│   │   ├── ifc5ParserMain.ts         # IFC5 main parsing logic
│   │   ├── ifc5Composition.ts        # IFC5 composition extraction
│   │   ├── ifc5ToGraph.ts            # IFC5 to graph conversion
│   │   ├── ifcValidator.ts           # Validation logic
│   │   ├── ifcValidatorEnhanced.ts   # Enhanced validation
│   │   ├── ifcSchema.ts              # Entity schema definitions
│   │   ├── graphLoD.ts               # Level of Detail system
│   │   ├── exportUtils.ts            # Export functionality
│   │   └── utils.ts                  # Utility functions
│   ├── types/
│   │   ├── graph.ts                  # Graph data structures
│   │   ├── ifc.ts                    # IFC4 type definitions
│   │   └── ifc5.ts                   # IFC5 type definitions
│   ├── utils/
│   │   └── logger.ts                 # Logging utilities
│   ├── workers/
│   │   ├── ifcParserWorker.ts        # Parser worker thread
│   │   └── ifcGeometryWorker.ts      # Geometry processing worker
│   ├── data/
│   │   └── ifc-schema.ts             # Schema data
│   ├── pages/
│   │   ├── Index.tsx                 # Main page
│   │   └── NotFound.tsx              # 404 page
│   ├── App.tsx                       # Root component
│   ├── App.css                       # Global styles
│   ├── main.tsx                      # Entry point
│   └── index.css                     # CSS imports
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

## Usage Guide

### Uploading an IFC File

1. Click on the upload area on the home screen
2. Drag and drop an `.ifc` or `.ifcx` file or click to browse
3. Wait for parsing to complete
4. Select a view mode to explore the data

### Tree Browser View

1. Navigate to the **Tree Browser** tab
2. Expand entities to see their hierarchy
3. Click any entity to select it
4. Right panel automatically shows:
   - Entity properties
   - All entities referencing this entity
   - All entities referenced by this entity
5. Click on any reference to navigate

### Graph View

1. Navigate to the **Graph View** tab
2. Use mouse to pan and scroll to zoom
3. Click nodes to select entities
4. Use **Filter by Type** to highlight specific entity types
5. Use **Search** to find and highlight entities
6. Right panel shows entity details

### Property Viewer

1. Navigate to the **Property Viewer** tab
2. Browse the searchable entity list
3. Click any entity to view detailed properties
4. Right panel shows properties (on desktop)

## Technologies Used

- **Vite** - Fast build tool and dev server
- **React 18** - UI framework
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - High-quality React components
- **web-ifc** - IFC file parsing library
- **react-force-graph-2d** - Graph visualization
- **React Router** - Client-side routing
- **React Query** - Data fetching and caching
- **Framer Motion** - Smooth animations
- **Sonner** - Toast notifications

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
- No data is sent to external servers
- Files are processed locally using Web Workers
- Suitable for processing confidential BIM models

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
4. Consider disabling physics on very large graphs

## 🚀 Deployment

### Static Hosting (Recommended)
Deploy the `dist/` folder to any static host:
- Vercel
- Netlify
- GitHub Pages
- AWS S3 + CloudFront
- Any web server

### Docker Support (Coming Soon)
- Containerized build environment
- Production-ready Dockerfile
- Environment variable configuration

## 🔄 Roadmap

### Short Term (Next Release)
- [ ] 3D Visualization Integration
- [ ] Export to Multiple Formats (JSON, CSV, OBJ)
- [ ] Advanced Filtering UI
- [ ] Performance Monitoring Tools

### Medium Term
- [ ] Real-time Collaboration
- [ ] Custom Entity Filtering
- [ ] Entity Comparison View
- [ ] Full Keyboard Navigation

### Long Term
- [ ] Machine Learning Entity Classification
- [ ] Automated Relationship Discovery
- [ ] Model Optimization Suggestions
- [ ] Enterprise BIM Tool Integration

