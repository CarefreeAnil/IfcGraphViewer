import { motion } from 'framer-motion';
import { Search, Filter, Box, Layers, Building, Hash, Link2, Eye, EyeOff, ChevronDown, Database, Download, Gauge } from 'lucide-react';
import { NodeType, GraphNode } from '@/types/graph';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GraphControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  highlightedTypes: NodeType[];
  onTypeToggle: (type: NodeType) => void;
  selectedNode?: GraphNode | null;
  graphLoD?: 1 | 2 | 3 | 4 | 5;
  onLoDChange?: (lod: 1 | 2 | 3 | 4 | 5) => void;
  includeAuxiliaryLayer?: boolean;
  onIncludeAuxiliaryToggle?: (value: boolean) => void;
  onExport?: (format: 'json' | 'csv-nodes' | 'csv-edges' | 'step' | 'png') => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
  relationshipFilters?: {
    showContainment: boolean;
    showAggregation: boolean;
    showProperties: boolean;
    showAuxiliary: boolean;
  };
  onRelationshipFilterChange?: (filter: 'containment' | 'aggregation' | 'properties' | 'auxiliary', value: boolean) => void;
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
  selectedNode,
  graphLoD = 4,
  onLoDChange,
  includeAuxiliaryLayer = false,
  onIncludeAuxiliaryToggle,
  onExport,
  searchInputRef,
  relationshipFilters = { showContainment: true, showAggregation: true, showProperties: true, showAuxiliary: false },
  onRelationshipFilterChange,
}: GraphControlsProps) {
  // Always minimized by default
  const [showFilters, setShowFilters] = useState(false);

  const getLoDLabel = (lod: 1 | 2 | 3 | 4 | 5): string => {
    const labels = {
      1: 'LoD1: Utility',
      2: 'LoD2: Least (Uni)',
      3: 'LoD3: Essential (Bi)',
      4: 'LoD4: Core',
      5: 'LoD5: Full',
    };
    return labels[lod];
  };

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
          ref={searchInputRef}
          type="text"
          placeholder="Search nodes... (Ctrl+F)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-64 pl-10 pr-4 py-2.5 rounded-lg bg-card/95 backdrop-blur-md border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
        />
      </div>

      {/* Action Buttons Row */}
      <div className="flex gap-2">
        {/* LoD Control */}
        {onLoDChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-card/95 backdrop-blur-md text-xs"
              >
                <Gauge className="w-3.5 h-3.5" />
                {getLoDLabel(graphLoD)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Graph Level of Detail</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onLoDChange(5)}>
                <span className={graphLoD === 5 ? 'font-bold' : ''}>LoD5: Full Graph</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLoDChange(4)}>
                <span className={graphLoD === 4 ? 'font-bold' : ''}>LoD4: Core Graph (No Geometry)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLoDChange(3)}>
                <span className={graphLoD === 3 ? 'font-bold' : ''}>LoD3: Essential (Bidirectional rel↔obj)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLoDChange(2)}>
                <span className={graphLoD === 2 ? 'font-bold' : ''}>LoD2: Least (Rel→Obj only)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLoDChange(1)}>
                <span className={graphLoD === 1 ? 'font-bold' : ''}>LoD1: Utility (Spatial Only)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Export Menu */}
        {onExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-card/95 backdrop-blur-md text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Export Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onExport('json')}>
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('csv-nodes')}>
                Export Nodes as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('csv-edges')}>
                Export Edges as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('step')}>
                Export as IFC STEP
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('png')}>
                Export Graph as PNG
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Auxiliary Layer Toggle - Only for LoD5 */}
      {graphLoD === 5 && onIncludeAuxiliaryToggle && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card/95 backdrop-blur-md border border-border cursor-help">
                <div className="w-9 h-9 rounded-md border border-dashed border-border bg-muted/60 flex items-center justify-center">
                  <Layers className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-foreground">Auxiliary layer (LoD5)</span>
                  <span className="text-[11px] text-muted-foreground">Include metadata and secondary relationships</span>
                </div>
                <Switch
                  checked={includeAuxiliaryLayer}
                  onCheckedChange={onIncludeAuxiliaryToggle}
                  className="ml-auto"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">
                <strong>Deep-dive exploration:</strong> Shows auxiliary entities like geometric primitives, 
                material definitions, and metadata. Increases graph density—intended for advanced users 
                investigating complete IFC structure at LoD5.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Relationship Type Filters */}
      {onRelationshipFilterChange && (
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-card/95 backdrop-blur-md border border-border">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Link2 className="w-3.5 h-3.5" />
            Relationship Filters
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={relationshipFilters.showContainment}
                onChange={(e) => onRelationshipFilterChange('containment', e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-foreground">Containment</span>
              <span className="text-muted-foreground text-[10px]">(IfcRelContainedInSpatialStructure)</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={relationshipFilters.showAggregation}
                onChange={(e) => onRelationshipFilterChange('aggregation', e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-foreground">Aggregation</span>
              <span className="text-muted-foreground text-[10px]">(IfcRelAggregates / Decomposes)</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={relationshipFilters.showProperties}
                onChange={(e) => onRelationshipFilterChange('properties', e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-foreground">Properties</span>
              <span className="text-muted-foreground text-[10px]">(IfcRelDefinesByProperties/Type)</span>
            </label>
            {graphLoD === 5 && (
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={relationshipFilters.showAuxiliary}
                  onChange={(e) => onRelationshipFilterChange('auxiliary', e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-foreground">Auxiliary (LoD5)</span>
                <span className="text-muted-foreground text-[10px]">(Geometry, Materials)</span>
              </label>
            )}
          </div>
        </div>
      )}

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
    </motion.div>
  );
}
