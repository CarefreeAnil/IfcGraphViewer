
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { NodeType } from '@/types/graph';

const LEGEND_ITEMS: { type: NodeType; label: string; description: string }[] = [
  { type: 'building', label: 'Building', description: 'Projects, Sites, Buildings, Storeys' },
  { type: 'space', label: 'Space', description: 'Rooms, Zones, Areas' },
  { type: 'element', label: 'Element', description: 'Walls, Doors, Windows, etc.' },
  { type: 'property', label: 'Property', description: 'Property Sets' },
  { type: 'relationship', label: 'Relation', description: 'Connections between entities' },
];

export function Legend() {
  const [minimized, setMinimized] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute bottom-4 right-4 p-4 rounded-lg bg-card/95 backdrop-blur-md border-glow"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Node Types
        </h4>
        <button
          onClick={() => setMinimized((m) => !m)}
          className="ml-2 p-1 rounded hover:bg-muted/50 transition-colors"
          title={minimized ? 'Expand legend' : 'Minimize legend'}
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform ${minimized ? '-rotate-90' : 'rotate-0'}`}
          />
        </button>
      </div>
      {!minimized && (
        <div className="space-y-2">
          {LEGEND_ITEMS.map(({ type, label, description }) => (
            <div key={type} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full bg-node-${type}`} />
              <div>
                <span className="text-sm font-medium text-foreground">{label}</span>
                <span className="text-xs text-muted-foreground ml-2">{description}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
