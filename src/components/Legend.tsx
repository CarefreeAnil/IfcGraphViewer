import { motion } from 'framer-motion';
import { NodeType } from '@/types/graph';

const LEGEND_ITEMS: { type: NodeType; label: string; description: string }[] = [
  { type: 'building', label: 'Building', description: 'Projects, Sites, Buildings, Storeys' },
  { type: 'space', label: 'Space', description: 'Rooms, Zones, Areas' },
  { type: 'element', label: 'Element', description: 'Walls, Doors, Windows, etc.' },
  { type: 'property', label: 'Property', description: 'Property Sets' },
  { type: 'relationship', label: 'Relation', description: 'Connections between entities' },
];

export function Legend() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute bottom-4 right-4 p-4 rounded-lg bg-card/95 backdrop-blur-md border-glow"
    >
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Node Types
      </h4>
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
    </motion.div>
  );
}
