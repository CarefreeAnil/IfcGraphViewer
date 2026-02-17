import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { NodeType } from '@/types/graph';

const LEGEND_ITEMS: { type: NodeType; label: string; description: string }[] = [
  { type: 'building', label: 'Building', description: 'Projects, Sites, Buildings, Storeys (Cyan)' },
  { type: 'space', label: 'Space', description: 'Rooms, Zones, Areas (Purple)' },
  { type: 'element', label: 'Element', description: 'Walls, Doors, Windows, etc. (Amber)' },
  { type: 'property', label: 'Property', description: 'Property Sets (Green)' },
  { type: 'relationship', label: 'Relation', description: 'Connections between entities (Pink)' },
  { type: 'geometry', label: 'Geometry', description: 'Geometric representations (Gray)' },
];

// Relationship types for educational legend - updated with current colors
const RELATIONSHIP_ITEMS: { label: string; description: string; color: string }[] = [
  { label: 'Aggregates', description: 'Hierarchy/decomposition', color: '#22d3ee' },
  { label: 'Contains', description: 'Spatial containment', color: '#a78bfa' },
  { label: 'Properties', description: 'Element properties', color: '#4ade80' },
  { label: 'Voids', description: 'Openings in elements', color: '#f472b6' },
  { label: 'Fills', description: 'Fills openings', color: '#fbbf24' },
  { label: 'Materials', description: 'Material associations', color: '#fb923c' },
];

export function Legend() {
  const [minimized, setMinimized] = useState(true);
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute bottom-4 right-4 rounded-lg bg-card/90 backdrop-blur-md border border-border"
    >
      <div className="flex items-center justify-between p-2">
        <h4 className="text-[7px] font-medium text-muted-foreground uppercase tracking-wider">
          Legend
        </h4>
        <button
          onClick={() => setMinimized((m) => !m)}
          className="ml-1 p-0.5 rounded hover:bg-muted/50 transition-colors"
          title={minimized ? 'Expand legend' : 'Minimize legend'}
        >
          <ChevronDown
            className={`w-3 h-3 transition-transform ${minimized ? '-rotate-90' : 'rotate-0'}`}
          />
        </button>
      </div>
      {!minimized && (
        <div className="space-y-2 p-2 pt-0 border-t border-border">
          {/* Node Types */}
          <div className="space-y-1">
            {LEGEND_ITEMS.map(({ type, label, description }) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full bg-node-${type} flex-shrink-0`} />
                <div className="min-w-0">
                  <span className="text-[9px] font-medium text-foreground">{label}</span>
                  <span className="text-[7px] text-muted-foreground ml-1 truncate">{description}</span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Relationship Types */}
          <div className="border-t border-border pt-1">
            <h5 className="text-[7px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Relations
            </h5>
            <div className="space-y-0.5">
              {RELATIONSHIP_ITEMS.map(({ label, description, color }) => (
                <div key={label} className="flex items-center gap-1">
                  <ArrowRight className="w-2 h-2 flex-shrink-0" style={{ color }} />
                  <div className="min-w-0">
                    <span className="text-[9px] font-medium text-foreground">{label}</span>
                    <span className="text-[7px] text-muted-foreground ml-1 truncate">{description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
