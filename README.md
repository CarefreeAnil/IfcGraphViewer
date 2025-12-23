# IFC File Browser & Graph Visualization - Thesis POC

A comprehensive web application for parsing, visualizing, and exploring IFC (Industry Foundation Classes) files through multiple interactive views.

## Features

### 📊 Multiple Visualization Modes

1. **Graph View** - Force-directed graph visualization of IFC entities and relationships
2. **Tree Browser** - Hierarchical tree structure with inverse reference explorer
3. **Property Viewer** - Tabular view of entities with detailed property inspection

### 🌳 Tree Browser (NEW)

Browse IFC files in a hierarchical tree structure with:
- Expandable/collapsible entity hierarchy
- Full-text search across labels, types, and IDs
- Entity selection with instant property display
- Real-time inverse references panel

### 🔗 Inverse References Panel

Automatically displays:
- **Referenced By** - All entities that reference the selected entity
- **References** - All entities referenced by the selected entity
- Property values with full details
- One-click navigation between related entities

### 📈 Graph Visualization

- Interactive node-and-link diagram
- Color-coded entity types
- Type filtering and highlighting
- Search with instant filtering
- Drag-to-explore interface

### 📋 Property Inspector

- Searchable entity list
- Detailed property view for selected entities
- Support for complex property values
- Side panel for quick reference

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd "Thesis - POC"

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at `http://localhost:8080/`

### Building for Production

```sh
# Build the application
npm run build

# Preview the production build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── IFCTreeBrowser.tsx      # New tree browsing component
│   ├── GraphVisualization.tsx  # Graph rendering
│   ├── NodeDetailsPanel.tsx    # Entity details
│   ├── PropertyViewer.tsx      # Properties table
│   ├── FileUpload.tsx          # File upload handler
│   ├── GraphControls.tsx       # Controls and search
│   ├── StatsPanel.tsx          # Statistics display
│   ├── Header.tsx              # App header
│   ├── Legend.tsx              # Legend for entity types
│   └── ui/                     # shadcn/ui components
├── lib/
│   ├── ifcParser.ts            # IFC parsing logic
│   └── utils.ts                # Utility functions
├── types/
│   └── graph.ts                # TypeScript interfaces
├── pages/
│   ├── Index.tsx               # Main page (updated)
│   └── NotFound.tsx            # 404 page
└── App.tsx                     # Root component
```

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

## IFC Parsing

The parser (`lib/ifcParser.ts`) implements:
- Web-IFC library integration
- Automatic geometry filtering (focuses on semantic data)
- Entity and relationship extraction
- Graph generation from IFC structure
- Support for sample data generation

### Supported Entity Types

- **Building** - IFCPROJECT, IFCSITE, IFCBUILDING, IFCBUILDINGSTOREY
- **Spaces** - IFCSPACE, IFCZONE
- **Elements** - IFCWALL, IFCDOOR, IFCWINDOW, IFCSLAB, IFCCOLUMN, IFCBEAM, IFCSTAIR, IFCROOF
- **Properties** - IFCPROPERTYSET, IFCSINGLEVALUEPROPERTIES
- **Relationships** - IFCRELAGGREGATES, IFCRELCONTAINEDINSPATIALSTRUCTURE, IFCRELVOIDSELEMENT, IFCRELDEFINESBYPROPERTIES

### Excluded Data

The parser filters out geometry-related entities to focus on semantic relationships:
- Shapes and representations
- Geometric primitives
- Materials and textures
- Visual styles

## API Reference

### IFCTreeBrowser Component

```tsx
<IFCTreeBrowser
  nodes={GraphNode[]}           // All parsed entities
  edges={GraphEdge[]}           // All relationships
  selectedNodeId={string | null} // Currently selected entity
  onNodeSelect={(node) => void}  // Selection callback
/>
```

### Types

```typescript
interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  ifcType: string;
  properties: Record<string, any>;
  expressId?: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
}

type NodeType = 'building' | 'space' | 'element' | 'property' | 'relationship';
```

## Performance Notes

- Parser optimized for files up to 10,000+ entities
- Tree rendering uses virtual scrolling for large datasets
- Graph visualization scales well with 1,000+ nodes
- Search is instant with debouncing on large datasets

## Troubleshooting

### Large Files

For very large IFC files (10,000+ entities):
- Use the Tree Browser for better performance
- Disable visual highlights in Graph View
- Filter by entity type to reduce complexity

### Missing Entities

Some IFC entities may be excluded:
- Geometry-related entities (shapes, representations)
- Coordinate system definitions
- Presentation styling
- This is intentional to focus on semantic relationships

### File Upload Issues

Ensure the IFC file:
- Is a valid IFC file ('.ifc' and '.ifcx' extension)
- Is not corrupted
- Uses a supported IFC version (IFC2x3, IFC4, etc.)

## Documentation

### Architecture & Design

- **[PARSER_ARCHITECTURE.md](PARSER_ARCHITECTURE.md)** - Detailed parser design and data flow

### Core Modules

**Parser** (`src/lib/ifcParser.ts`):
- Parses IFC STEP format files
- Integrates schema definitions for entity classification
- Stores schema-derived metadata (colors, icons, display names)

**Validator** (`src/lib/ifcValidator.ts`):
- Uses schema-based validation rules
- Checks project hierarchy (Project → Site → Building → Storey)
- Collects statistics on entity and relationship types
- Provides comprehensive error/warning reporting

**Schema** (`src/lib/ifcSchema.ts`):
- Single source of truth for 40+ IFC entity types
- Defines properties (required/optional), relationships, and validation rules
- Provides color coding and icon associations for UI
- Organized by category (spatial, structural, elements, properties, relationships)

**UI Components**:
- **GraphVisualization**: Force-directed graph with schema-based colors
- **IFCTreeBrowser**: Hierarchical tree with inverse reference explorer
- **PropertyViewer**: Tabular entity view with schema display information

## Development

### Project Setup

The project uses:
- ESLint for code quality
- TypeScript for type safety
- Tailwind CSS with PostCSS

### Running in Development

```sh
npm run dev      # Start dev server
npm run lint     # Run ESLint
npm run build    # Build for production
```

## Future Enhancements

- [ ] Export to JSON/CSV
- [ ] Advanced filtering and queries
- [ ] 3D model visualization integration
- [ ] Real-time collaboration features
- [ ] Custom property mappings
- [ ] Performance profiling tools

## License

This project is part of a thesis POC and copyright to Anil at the moment.

## Support

For issues or questions, please refer to the project's issue tracker or contact Anil @ bhattarai.theanil@gmail.com.

