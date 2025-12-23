import { motion } from 'framer-motion';
import { Search, Filter, Box, Layers, Building, Hash, Link2 } from 'lucide-react';
import { NodeType } from '@/types/graph';

interface GraphControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  highlightedTypes: NodeType[];
  onTypeToggle: (type: NodeType) => void;
}

const TYPE_FILTERS: { type: NodeType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'building', label: 'Building', icon: <Building className="w-4 h-4" />, color: 'bg-node-building' },
  { type: 'space', label: 'Space', icon: <Layers className="w-4 h-4" />, color: 'bg-node-space' },
  { type: 'element', label: 'Element', icon: <Box className="w-4 h-4" />, color: 'bg-node-element' },
  { type: 'property', label: 'Property', icon: <Hash className="w-4 h-4" />, color: 'bg-node-property' },
  { type: 'relationship', label: 'Relation', icon: <Link2 className="w-4 h-4" />, color: 'bg-node-relationship' },
];

export function GraphControls({
  searchQuery,
  onSearchChange,
  highlightedTypes,
  onTypeToggle,
}: GraphControlsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-4 left-4 flex flex-col gap-3"
    >
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-64 pl-10 pr-4 py-2.5 rounded-lg bg-card/95 backdrop-blur-md border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
        />
      </div>

      {/* Type Filters */}
      <div className="flex flex-col gap-2 p-3 rounded-lg bg-card/95 backdrop-blur-md border-glow">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
          <Filter className="w-3.5 h-3.5" />
          Filter by Type
        </div>
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map(({ type, label, icon, color }) => {
            const isActive = highlightedTypes.length === 0 || highlightedTypes.includes(type);
            return (
              <button
                key={type}
                onClick={() => onTypeToggle(type)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                  ${isActive 
                    ? `${color} text-background` 
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }
                `}
              >
                {icon}
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
