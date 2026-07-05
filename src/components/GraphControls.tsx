import { motion } from 'framer-motion';
import { Search, Filter, Box, Layers, Building, Hash, Link2, ChevronDown, Download, Gauge, X } from 'lucide-react';
import { NodeType, GraphNode } from '@/types/graph';
import { useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
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
  fullscreenTargetRef?: React.RefObject<HTMLElement>;
}

const TYPE_FILTERS: { type: NodeType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'building',     label: 'Building',  icon: <Building className="w-3.5 h-3.5" />, color: 'bg-node-building' },
  { type: 'space',        label: 'Space',     icon: <Layers className="w-3.5 h-3.5" />,   color: 'bg-node-space' },
  { type: 'element',      label: 'Element',   icon: <Box className="w-3.5 h-3.5" />,      color: 'bg-node-element' },
  { type: 'property',     label: 'Property',  icon: <Hash className="w-3.5 h-3.5" />,     color: 'bg-node-property' },
  { type: 'relationship', label: 'Relation',  icon: <Link2 className="w-3.5 h-3.5" />,    color: 'bg-node-relationship' },
];

// Relationship filter metadata — colors mirror getRelationshipColor() in GraphVisualization.tsx
type RelFilterKey = 'containment' | 'aggregation' | 'connects' | 'properties' | 'associates' | 'spaceBoundary' | 'auxiliary';

const REL_FILTER_META: { key: RelFilterKey; label: string; color: string; description: string }[] = [
  { key: 'containment',   label: 'Containment',    color: '#a78bfa', description: 'IfcRelContainedInSpatialStructure' },
  { key: 'aggregation',   label: 'Aggregation',    color: '#22d3ee', description: 'IfcRelAggregates / Decomposes' },
  { key: 'connects',      label: 'Connects',       color: '#f472b6', description: 'IfcRelConnects* · openings & ports' },
  { key: 'properties',    label: 'Properties',     color: '#4ade80', description: 'IfcRelDefinesByProperties/Type' },
  { key: 'associates',    label: 'Associates',     color: '#fb923c', description: 'Materials · classification' },
  { key: 'spaceBoundary', label: 'Space Boundary', color: '#6b7280', description: 'IfcRelSpaceBoundary*' },
  // 'auxiliary' intentionally omitted — geometric node visibility is controlled by the Auxiliary Layer toggle below
];

export function GraphControls({
  searchQuery,
  onSearchChange,
  highlightedTypes,
  onTypeToggle,
  selectedNode,
  graphLoD = 2,
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
  fullscreenTargetRef,
}: GraphControlsProps) {
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showLoDMenu, setShowLoDMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      const fullscreenTarget = fullscreenTargetRef?.current;
      setIsFullscreen(!!fullscreenTarget && document.fullscreenElement === fullscreenTarget);
      // Close floating menus when fullscreen mode toggles
      setShowLoDMenu(false);
      setShowExportMenu(false);
    };

    onFullscreenChange();
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [fullscreenTargetRef]);

  // Count active filters for badge
  const activeRelFilters = Object.values(relationshipFilters).filter(Boolean).length;
  const activeFilterCount = highlightedTypes.length + activeRelFilters;

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

  const getRelFilterValue = (key: RelFilterKey): boolean => {
    const map: Record<RelFilterKey, boolean> = {
      containment:   relationshipFilters.showContainment,
      aggregation:   relationshipFilters.showAggregation,
      connects:      relationshipFilters.showConnects,
      properties:    relationshipFilters.showProperties,
      associates:    relationshipFilters.showAssociates,
      spaceBoundary: relationshipFilters.showSpaceBoundary,
      auxiliary:     relationshipFilters.showAuxiliary,
    };
    return map[key];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-4 left-4 z-[70] flex flex-col gap-3"
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
        {onLoDChange && !isFullscreen && (
          <TooltipProvider>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-card/95 backdrop-blur-md text-xs">
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

        {onLoDChange && isFullscreen && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowLoDMenu(v => !v);
                setShowExportMenu(false);
              }}
              className="gap-2 bg-card/95 backdrop-blur-md text-xs"
            >
              <Gauge className="w-3.5 h-3.5" />
              {getLoDLabel(graphLoD)}
            </Button>
            {showLoDMenu && (
              <div className="absolute top-full left-0 mt-1 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md z-[80]">
                <div className="px-2 py-1.5 text-sm font-semibold">LoD Level</div>
                <div className="h-px bg-muted my-1" />
                {[4, 3, 2, 1].map((lod) => (
                  <button
                    key={lod}
                    onClick={() => {
                      onLoDChange(lod as 1 | 2 | 3 | 4 | 5);
                      setShowLoDMenu(false);
                    }}
                    className="w-full text-left rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <span className={graphLoD === lod ? 'font-bold' : ''}>{getLoDLabel(lod as 1 | 2 | 3 | 4 | 5)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Export Menu */}
        {onExport && !isFullscreen && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-card/95 backdrop-blur-md text-xs">
                <Download className="w-3.5 h-3.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Export Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onExport('json')}>Export as JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('csv-nodes')}>Export Nodes as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('csv-edges')}>Export Edges as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('png')}>Export Graph as PNG</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {onExport && isFullscreen && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowExportMenu(v => !v);
                setShowLoDMenu(false);
              }}
              className="gap-2 bg-card/95 backdrop-blur-md text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
            {showExportMenu && (
              <div className="absolute top-full left-0 mt-1 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md z-[80]">
                <div className="px-2 py-1.5 text-sm font-semibold">Export Format</div>
                <div className="h-px bg-muted my-1" />
                <button onClick={() => { onExport('json'); setShowExportMenu(false); }} className="w-full text-left rounded-sm px-2 py-1.5 text-sm hover:bg-accent">Export as JSON</button>
                <button onClick={() => { onExport('csv-nodes'); setShowExportMenu(false); }} className="w-full text-left rounded-sm px-2 py-1.5 text-sm hover:bg-accent">Export Nodes as CSV</button>
                <button onClick={() => { onExport('csv-edges'); setShowExportMenu(false); }} className="w-full text-left rounded-sm px-2 py-1.5 text-sm hover:bg-accent">Export Edges as CSV</button>
                <button onClick={() => { onExport('png'); setShowExportMenu(false); }} className="w-full text-left rounded-sm px-2 py-1.5 text-sm hover:bg-accent">Export Graph as PNG</button>
              </div>
            )}
          </div>
        )}

        {/* Filter Button with active count badge */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilterDrawer(!showFilterDrawer)}
                className="relative gap-2 bg-card/95 backdrop-blur-md text-xs"
              >
                <Filter className="w-3.5 h-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {activeFilterCount > 0 ? `${activeFilterCount} active filter${activeFilterCount > 1 ? 's' : ''}` : 'Open filter panel'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Unified Filter Panel */}
      {showFilterDrawer && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-16 left-0 w-[340px] bg-card/98 backdrop-blur-md border border-border rounded-lg shadow-xl z-50"
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <h3 className="text-xs font-semibold text-foreground">Filters</h3>
            {activeFilterCount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {activeFilterCount} active
              </span>
            )}
            <button
              onClick={() => setShowFilterDrawer(false)}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3 space-y-4">
            {/* ── Node Types ── */}
            <div className="space-y-1.5">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                Node Type Highlight
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TYPE_FILTERS.map(({ type, label, icon, color }) => {
                  const isActive = highlightedTypes.length === 0 || highlightedTypes.includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() => onTypeToggle(type)}
                      className={`
                        flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all
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
              {highlightedTypes.length > 0 && (
                <p className="text-[9px] text-muted-foreground">
                  Dimming all other node types. Click an active type to remove it.
                </p>
              )}
            </div>

            {/* ── Edge / Relationship Isolation ── */}
            {onRelationshipFilterChange && (
              <div className="space-y-1.5 border-t border-border pt-3">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Isolate Edge Types
                </p>
                {activeRelFilters === 0 && (
                  <p className="text-[9px] text-muted-foreground">
                    All edges visible. Check a type to isolate it.
                  </p>
                )}
                <div className="space-y-1">
                  {REL_FILTER_META.map(({ key, label, color, description }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer group py-0.5">
                      <input
                        type="checkbox"
                        checked={getRelFilterValue(key)}
                        onChange={(e) => onRelationshipFilterChange(key, e.target.checked)}
                        className="rounded border-border accent-primary"
                      />
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[11px] text-foreground font-medium w-[84px] shrink-0">
                        {label}
                      </span>
                      <span className="text-[9px] text-muted-foreground truncate">
                        {description}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
