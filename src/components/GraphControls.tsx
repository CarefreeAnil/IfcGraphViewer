import { motion } from 'framer-motion';
import { Search, Filter, Box, Layers, Building, Hash, Link2, Eye, EyeOff, ChevronDown, Database } from 'lucide-react';
import { NodeType, GraphNode } from '@/types/graph';
import { useState } from 'react';

interface GraphControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  highlightedTypes: NodeType[];
  onTypeToggle: (type: NodeType) => void;
  showAttributes: boolean;
  onAttributesToggle: (show: boolean) => void;
  showRelatedMetadata?: boolean;
  onRelatedMetadataToggle?: (show: boolean) => void;
  selectedNode?: GraphNode | null;
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
  showAttributes,
  onAttributesToggle,
  showRelatedMetadata = false,
  onRelatedMetadataToggle,
  selectedNode,
}: GraphControlsProps) {
  // Always minimized by default
  const [showFilters, setShowFilters] = useState(false);
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

      {/* Type Filters - Collapsible */}
      <motion.div 
        className="flex flex-col gap-2 p-3 rounded-lg bg-card/95 backdrop-blur-md border-glow"
        animate={{ height: showFilters ? 'auto' : 50 }}
        transition={{ duration: 0.2 }}
      >
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
        >
          <Filter className="w-3.5 h-3.5" />
          Filter by Type
          <ChevronDown 
            className="w-3.5 h-3.5 ml-auto transition-transform" 
            style={{ transform: showFilters ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          />
        </button>
        
        <motion.div
          initial={false}
          animate={{ opacity: showFilters ? 1 : 0, height: showFilters ? 'auto' : 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
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
        </motion.div>
      </motion.div>

      {/* Attributes Toggle */}
      <button
        onClick={() => onAttributesToggle(!showAttributes)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all
          ${showAttributes
            ? 'bg-primary text-primary-foreground'
            : 'bg-card/95 text-muted-foreground border border-border hover:bg-card'
          }
        `}
      >
        {showAttributes ? (
          <Eye className="w-3.5 h-3.5" />
        ) : (
          <EyeOff className="w-3.5 h-3.5" />
        )}
        {showAttributes ? 'Hide Attributes' : 'Show Attributes'}
      </button>

      {/* Related Metadata Toggle - Only show if node is selected */}
      {selectedNode && onRelatedMetadataToggle && (
        <button
          onClick={() => onRelatedMetadataToggle(!showRelatedMetadata)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all
            ${showRelatedMetadata
              ? 'bg-amber-600 text-amber-50'
              : 'bg-card/95 text-muted-foreground border border-border hover:bg-card'
            }
          `}
          title="Show metadata entities related to this element (properties, units, types)"
        >
          {showRelatedMetadata ? (
            <Database className="w-3.5 h-3.5" />
          ) : (
            <Database className="w-3.5 h-3.5" />
          )}
          {showRelatedMetadata ? 'Hide Metadata' : 'Show Metadata'}
        </button>
      )}
    </motion.div>
  );
}
