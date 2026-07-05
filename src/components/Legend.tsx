import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { NodeType } from '@/types/graph';

// Colors mirror NODE_COLORS in GraphVisualization.tsx
const NODE_LEGEND: { type: string; label: string; color: string; description: string }[] = [
  { type: 'building',      label: 'Building',  color: '#22d3ee', description: 'Project · Site · Storey' },
  { type: 'space',         label: 'Space',     color: '#a78bfa', description: 'Room · Zone · Area' },
  { type: 'element',       label: 'Element',   color: '#fbbf24', description: 'Wall · Door · Slab…' },
  { type: 'property',      label: 'Property',  color: '#4ade80', description: 'PropertySet · QuantitySet' },
  { type: 'material',      label: 'Material',  color: '#8b5a2b', description: 'IfcMaterial* chain nodes' },
  { type: 'relationship',  label: 'Relation',  color: '#f472b6', description: 'IFC relationship entity' },
];

// Colors mirror getRelationshipColor() in GraphVisualization.tsx
const EDGE_LEGEND: { label: string; color: string; description: string }[] = [
  { label: 'Aggregation', color: '#22d3ee', description: 'IfcRelAggregates · hierarchy' },
  { label: 'Containment', color: '#a78bfa', description: 'IfcRelContainedInSpatialStructure' },
  { label: 'Properties',  color: '#4ade80', description: 'IfcRelDefinesByProperties/Type' },
  { label: 'Connects',    color: '#f472b6', description: 'Openings · voids · port links' },
  { label: 'Associates',  color: '#fb923c', description: 'Materials · classification' },
  { label: 'Boundary',    color: '#6b7280', description: 'IfcRelSpaceBoundary' },
];

export function Legend() {
  const [minimized, setMinimized] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute bottom-4 right-4 rounded-lg bg-card/90 backdrop-blur-md border border-border shadow-md min-w-[196px]"
    >
      <button
        onClick={() => setMinimized((m) => !m)}
        className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
        title={minimized ? 'Expand legend' : 'Collapse legend'}
      >
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
          Legend
        </span>
        <ChevronDown
          className={`w-3 h-3 text-muted-foreground ml-2 transition-transform ${
            minimized ? '-rotate-90' : 'rotate-0'
          }`}
        />
      </button>

      {!minimized && (
        <div className="px-2.5 pb-2.5 border-t border-border space-y-2.5">
          {/* Node Types */}
          <div className="pt-2">
            <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Nodes
            </p>
            <div className="space-y-1">
              {NODE_LEGEND.map(({ type, label, color, description }) => (
                <div key={type} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[10px] font-medium text-foreground w-[54px] shrink-0">
                    {label}
                  </span>
                  <span className="text-[8px] text-muted-foreground leading-tight">
                    {description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Edge Types */}
          <div className="border-t border-border pt-2">
            <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Edges
            </p>
            <div className="space-y-1">
              {EDGE_LEGEND.map(({ label, color, description }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <ArrowRight className="w-3 h-3 shrink-0" style={{ color }} />
                  <span className="text-[10px] font-medium text-foreground w-[54px] shrink-0">
                    {label}
                  </span>
                  <span className="text-[8px] text-muted-foreground leading-tight">
                    {description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
