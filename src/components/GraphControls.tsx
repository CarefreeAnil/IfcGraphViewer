import { motion } from 'framer-motion';
import { Search, Filter, Box, Layers, Building, Hash, Link2, ChevronDown, Download, Gauge, X } from 'lucide-react';
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
import { getLoDDescription } from '@/lib/lodDescriptions';

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
    showConnects: boolean;
    showAssociates: boolean;
    showSpaceBoundary: boolean;
  };
  onRelationshipFilterChange?: (filter: 'containment' | 'aggregation' | 'properties' | 'auxiliary' | 'connects' | 'associates' | 'spaceBoundary', value: boolean) => void;
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
  relationshipFilters = {
    showContainment: false,
    showAggregation: false,
    showProperties: false,
    showAuxiliary: false,
    showConnects: false,
    showAssociates: false,
    showSpaceBoundary: false,
  },
  onRelationshipFilterChange,
}: GraphControlsProps) {
  // Drawer state
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showNodeTypes, setShowNodeTypes] = useState(false);

  const getLoDLabel = (lod: 1 | 2 | 3 | 4 | 5): string => {
    const labels = {
      1: 'LoD1: Utility',
      2: 'LoD2: Least (Uni)',
      3: 'LoD3: Essential (Bi)',
      4: 'LoD4: Core',
      5: 'LoD5: Full Detail',
    };
    return labels[lod];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-4 left-4 flex flex-col gap-3"
    >
      {/* Top Bar: Search, LoD, Export, Filter Button */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search nodes... (Ctrl+F)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-56 pl-10 pr-4 py-2.5 rounded-lg bg-card/95 backdrop-blur-md border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>

        {/* LoD Control */}
        {onLoDChange && (
          <TooltipProvider>
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
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs">LoD Level</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* LoD4: Core Graph */}
                <div className="px-1 py-1 mb-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        onClick={() => onLoDChange(4)}
                        className="px-2 py-1 rounded-md cursor-pointer hover:bg-muted/50 transition-colors flex items-start justify-between group"
                      >
                        <span className={graphLoD === 4 ? 'font-bold text-foreground text-xs' : 'text-foreground/90 text-xs'}>
                          LoD4: Core
                        </span>
                        <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">▶</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="w-48 p-2">
                      <div className="space-y-1">
                        <div>
                          <p className="font-semibold text-xs">{getLoDDescription(4).name}</p>
                          <p className="text-xs text-muted-foreground">{getLoDDescription(4).description}</p>
                        </div>
                        <div className="pt-1 border-t border-muted-foreground/20">
                          <p className="text-xs font-medium mb-0.5">Use Case:</p>
                          <p className="text-xs text-muted-foreground">{getLoDDescription(4).useCase}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium mb-0.5">Reduction: <span className="text-primary">{getLoDDescription(4).nodeReductionEstimate}</span></p>
                          <p className="text-xs text-muted-foreground">of geometry filtered</p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* LoD3: Essential Graph */}
                <div className="px-1 py-1 mb-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        onClick={() => onLoDChange(3)}
                        className="px-2 py-1 rounded-md cursor-pointer hover:bg-muted/50 transition-colors flex items-start justify-between group"
                      >
                        <span className={graphLoD === 3 ? 'font-bold text-foreground text-xs' : 'text-foreground/90 text-xs'}>
                          LoD3: Essential
                        </span>
                        <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">▶</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="w-48 p-2">
                      <div className="space-y-1">
                        <div>
                          <p className="font-semibold text-xs">{getLoDDescription(3).name}</p>
                          <p className="text-xs text-muted-foreground">{getLoDDescription(3).description}</p>
                        </div>
                        <div className="pt-1 border-t border-muted-foreground/20">
                          <p className="text-xs font-medium mb-0.5">Use Case:</p>
                          <p className="text-xs text-muted-foreground">{getLoDDescription(3).useCase}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium mb-0.5">Reduction: <span className="text-primary">{getLoDDescription(3).nodeReductionEstimate}</span></p>
                          <p className="text-xs text-muted-foreground">of non-essential filtered</p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* LoD2: Least Graph */}
                <div className="px-1 py-1 mb-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        onClick={() => onLoDChange(2)}
                        className="px-2 py-1 rounded-md cursor-pointer hover:bg-muted/50 transition-colors flex items-start justify-between group"
                      >
                        <span className={graphLoD === 2 ? 'font-bold text-foreground text-xs' : 'text-foreground/90 text-xs'}>
                          LoD2: Least
                        </span>
                        <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">▶</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="w-48 p-2">
                      <div className="space-y-1">
                        <div>
                          <p className="font-semibold text-xs">{getLoDDescription(2).name}</p>
                          <p className="text-xs text-muted-foreground">{getLoDDescription(2).description}</p>
                        </div>
                        <div className="pt-1 border-t border-muted-foreground/20">
                          <p className="text-xs font-medium mb-0.5">Use Case:</p>
                          <p className="text-xs text-muted-foreground">{getLoDDescription(2).useCase}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium mb-0.5">Reduction: <span className="text-primary">{getLoDDescription(2).nodeReductionEstimate}</span></p>
                          <p className="text-xs text-muted-foreground">of non-core filtered</p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* LoD1: Utility */}
                <div className="px-1 py-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        onClick={() => onLoDChange(1)}
                        className="px-2 py-1 rounded-md cursor-pointer hover:bg-muted/50 transition-colors flex items-start justify-between group"
                      >
                        <span className={graphLoD === 1 ? 'font-bold text-foreground text-xs' : 'text-foreground/90 text-xs'}>
                          LoD1: Utility
                        </span>
                        <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">▶</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="w-48 p-2">
                      <div className="space-y-1">
                        <div>
                          <p className="font-semibold text-xs">{getLoDDescription(1).name}</p>
                          <p className="text-xs text-muted-foreground">{getLoDDescription(1).description}</p>
                        </div>
                        <div className="pt-1 border-t border-muted-foreground/20">
                          <p className="text-xs font-medium mb-0.5">Use Case:</p>
                          <p className="text-xs text-muted-foreground">{getLoDDescription(1).useCase}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium mb-0.5">Reduction: <span className="text-primary">{getLoDDescription(1).nodeReductionEstimate}</span></p>
                          <p className="text-xs text-muted-foreground">of non-spatial filtered</p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>
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

        {/* Filter Drawer Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilterDrawer(!showFilterDrawer)}
                className="gap-2 bg-card/95 backdrop-blur-md text-xs"
              >
                <Filter className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open filter panel</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Filter Drawer Panel */}
      {showFilterDrawer && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-16 left-0 w-96 bg-card/98 backdrop-blur-md border border-border rounded-lg p-4 space-y-4 shadow-xl z-50"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Filters</h3>
            <button
              onClick={() => setShowFilterDrawer(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Relationship Filters Section */}
          {onRelationshipFilterChange && (
            <div className="space-y-3 pb-3 border-b border-border">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Relationship Filters</h4>
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
                    checked={relationshipFilters.showConnects}
                    onChange={(e) => onRelationshipFilterChange('connects', e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-foreground">Connects</span>
                  <span className="text-muted-foreground text-[10px]">(IfcRelConnects*, ConnectionGeometry)</span>
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
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={relationshipFilters.showAssociates}
                    onChange={(e) => onRelationshipFilterChange('associates', e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-foreground">Associates</span>
                  <span className="text-muted-foreground text-[10px]">(IfcRelAssociates*, Materials/Classification)</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={relationshipFilters.showSpaceBoundary}
                    onChange={(e) => onRelationshipFilterChange('spaceBoundary', e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-foreground">Space Boundary</span>
                  <span className="text-muted-foreground text-[10px]">(IfcRelSpaceBoundary*)</span>
                </label>
              </div>
            </div>
          )}

          {/* Node Type Filters Section */}
          <div className="space-y-3">
            <button
              onClick={() => setShowNodeTypes(!showNodeTypes)}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors w-full"
            >
              <Filter className="w-3.5 h-3.5" />
              Node Types
              <ChevronDown 
                className="w-3.5 h-3.5 ml-auto transition-transform" 
                style={{ transform: showNodeTypes ? 'rotate(0deg)' : 'rotate(-90deg)' }}
              />
            </button>
            
            {showNodeTypes && (
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
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
