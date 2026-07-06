import { SlidersHorizontal, Network, Layers, Box, Code2, Waypoints } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type PanelId = 'properties' | 'graph' | 'tree' | 'viewer3d' | 'source' | 'topology';

interface PanelConfig {
  id: PanelId;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  ifc5Only?: boolean;
  stepOnly?: boolean;
}

const PANEL_CONFIGS: PanelConfig[] = [
  { id: 'properties', label: 'Properties',  Icon: SlidersHorizontal },
  { id: 'graph',      label: 'Graph',        Icon: Network },
  { id: 'tree',       label: 'Tree Browser', Icon: Layers },
  { id: 'viewer3d',   label: '3D Viewer',    Icon: Box },
  { id: 'source',     label: 'Source',       Icon: Code2, ifc5Only: true },
  { id: 'topology',   label: 'Topology',     Icon: Waypoints, stepOnly: true },
];

export interface PanelVisibility {
  properties: boolean;
  graph: boolean;
  tree: boolean;
  viewer3d: boolean;
  source: boolean;
  topology: boolean;
}

interface PanelTaskbarProps {
  panelVisibility: PanelVisibility;
  onTogglePanel: (panelId: PanelId) => void;
  isIFC5: boolean;
}

export function PanelTaskbar({ panelVisibility, onTogglePanel, isIFC5 }: PanelTaskbarProps) {
  const panels = PANEL_CONFIGS.filter(p => {
    if (p.ifc5Only && !isIFC5) return false;
    if (p.stepOnly && isIFC5) return false;
    return true;
  });

  return (
    <TooltipProvider delayDuration={400}>
      <div
        className="w-11 flex-shrink-0 h-full flex flex-col items-center pt-3 pb-4 gap-1 bg-card/80 backdrop-blur-sm border-r border-border z-10"
        aria-label="Panel controls"
      >
        {/* Section label */}
        <span className="text-[7px] uppercase tracking-[0.18em] text-muted-foreground/40 mb-2 select-none">
          Panels
        </span>

        {panels.map(({ id, label: baseLabel, Icon }) => {
          const label = id === 'tree' && !isIFC5 ? 'IFC Browser' : baseLabel;
          const isVisible = panelVisibility[id];
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onTogglePanel(id)}
                  aria-label={`${isVisible ? 'Hide' : 'Show'} ${label}`}
                  className={cn(
                    'relative w-9 h-9 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all duration-150',
                    isVisible
                      ? 'bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 shadow-sm'
                      : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted border border-transparent'
                  )}
                >
                  <Icon className="w-[15px] h-[15px]" />
                  {/* Active indicator dot */}
                  {isVisible && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary/60" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="text-xs font-medium">
                <span className="text-muted-foreground mr-1">{isVisible ? 'Hide' : 'Show'}</span>
                {label}
              </TooltipContent>
            </Tooltip>
          );
        })}

        {/* Bottom spacer / visual separator */}
        <div className="mt-auto w-6 h-px bg-border/50" />
      </div>
    </TooltipProvider>
  );
}
