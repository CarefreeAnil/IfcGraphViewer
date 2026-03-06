/**
 * IFC5 Property Viewer Component
 * Displays composed (post-inheritance) properties for a selected IFC5 node.
 * Shows breadcrumb navigation, semantic summary, and attribute sections.
 */

import React, { useMemo, useState } from 'react';
import { ComposedObject } from '@/types/ifc5';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Box,
  Minus,
  Circle,
  Database,
  Info,
  Boxes,
  Palette,
  Ruler,
  ChevronDown,
  ChevronRight,
  Home,
  Layers,
  Building2,
  Globe,
  Folder,
  Link2,
} from 'lucide-react';

interface IFC5PropertyViewerProps {
  node: ComposedObject | null;
  /** Root composed object — used to build ancestry map for breadcrumb navigation */
  composedObject?: ComposedObject | null;
  /** Callback to select another node (used by breadcrumb navigation) */
  onNodeSelect?: (path: string, node: ComposedObject) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getIfcClass = (node: ComposedObject): string | null => {
  const flatCode = node.attributes?.['bsi::ifc::class::code'];
  if (typeof flatCode === 'string') return flatCode;
  const cls = node.attributes?.['bsi::ifc::class'];
  if (typeof cls === 'string') return cls;
  if (cls && typeof cls === 'object' && 'code' in cls) return (cls as any).code as string;
  return null;
};

const formatKey = (key: string): string => {
  let displayKey = key;
  const namespaces = [
    'bsi::ifc::', 'usd::usdgeom::', 'xformop::', 'points::base64::',
    'points::array::', 'mesh::', 'basiscurves::', 'material::',
    'presentation::', 'ifc::'
  ];
  for (const ns of namespaces) {
    if (displayKey.startsWith(ns)) {
      displayKey = displayKey.substring(ns.length);
      break;
    }
  }
  return displayKey.charAt(0).toUpperCase() + displayKey.slice(1);
};

const formatValue = (value: any, key: string = ''): React.ReactNode => {
  if (value === null || value === undefined) return <span className="text-muted-foreground">null</span>;
  if (Array.isArray(value)) {
    if (value.length === 16 && typeof value[0] === 'number') {
      return (
        <div className="grid grid-cols-4 gap-1 mt-1 font-mono text-[10px] bg-muted/30 p-2 rounded">
          {value.map((v, i) => (
            <div key={i} className="text-right">{v.toFixed(3)}</div>
          ))}
        </div>
      );
    }
    if (value.length > 10) {
      if (key.includes('mesh::points')) return <span className="italic text-muted-foreground">Geometry Vertices · {value.length} points (XYZ coordinates)</span>;
      if (key.includes('mesh::faceVertexIndices')) return <span className="italic text-muted-foreground">Surface Faces · {value.length} indices (triangle connectivity)</span>;
      if (key.includes('basiscurves::points')) return <span className="italic text-muted-foreground">Curve Points · {value.length} points (3D path)</span>;
      if (key.includes('normals')) return <span className="italic text-muted-foreground">Surface Normals · {value.length} vectors</span>;
      return <span className="italic text-muted-foreground">Array · {value.length} items</span>;
    }
    return `[${value.join(', ')}]`;
  }
  if (typeof value === 'object') {
    if ('ref' in value) return <span className="text-blue-400 font-mono">→ {value.ref}</span>;
    if (Object.keys(value).length <= 3) {
      if (value.name && value.code && value.name !== '$') return `${value.name} (${value.code})`;
      if (value.name && value.name !== '$') return value.name;
      if (value.code && value.code !== '$') return value.code;
    }
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(4);
  return String(value);
};

// ─── IFC class hint map ───────────────────────────────────────────────────────

const IFC_HINTS: Record<string, { color: string; text: string }> = {
  ifcproject:          { color: 'sky',    text: 'Root of the spatial hierarchy. Defines units, coordinate system, and overall project context.' },
  ifcsite:             { color: 'sky',    text: 'The land area on which a building or facility is located, including geographic and topographic data.' },
  ifcbuilding:         { color: 'sky',    text: 'A main structure containing storeys and spaces. Carries overall building metadata such as address and elevation.' },
  ifcbuildingstorey:   { color: 'sky',    text: 'A single floor level within a building, containing spaces and building elements at that level.' },
  ifcspace:            { color: 'sky',    text: 'An enclosed or semi-enclosed area within a building (e.g. room, corridor). Can have space boundaries linking it to adjacent elements.' },
  ifcwall:             { color: 'orange', text: 'A vertical building element that encloses or divides spaces. May have openings for windows or doors.' },
  ifcwallelementedcase:{ color: 'orange', text: 'A layered wall composed of multiple material layers, each with a defined thickness and function.' },
  ifcslab:             { color: 'orange', text: 'A horizontal structural element (floor, roof slab, landing) that spans between supports.' },
  ifccolumn:           { color: 'orange', text: 'A vertical structural compression member that transfers loads from beams or slabs to foundations.' },
  ifcbeam:             { color: 'orange', text: 'A horizontal or inclined structural element that bears bending loads along its longitudinal axis.' },
  ifcwindow:           { color: 'amber',  text: 'A glazed opening element placed within a wall or roof. May inherit type geometry from a shared IfcWindowType.' },
  ifcdoor:             { color: 'amber',  text: 'A door element placed within a wall or floor opening, providing access between spaces.' },
  ifcplate:            { color: 'orange', text: 'A thin, planar structural element such as a steel plate or gusset.' },
  ifcmember:           { color: 'orange', text: 'A structural linear element, typically a steel section (HSS, I-beam, angle) forming part of a frame or truss.' },
  ifcroof:             { color: 'orange', text: 'The uppermost element of a building, comprising a roof covering and its supporting structure.' },
};

function getHint(ifcClass: string | null): { color: string; text: string } | null {
  if (!ifcClass) return null;
  const lower = ifcClass.toLowerCase();
  return IFC_HINTS[lower] ?? null;
}

// ─── Section card with collapse support ──────────────────────────────────────

const AttributeSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  attributes: [string, any][];
  bgColor: string;
  defaultOpen?: boolean;
}> = ({ title, icon, attributes, bgColor, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);

  if (attributes.length === 0) return null;

  return (
    <Card className="border-2">
      <CardHeader
        className={`py-2.5 px-3 ${bgColor} cursor-pointer`}
        onClick={() => setOpen(o => !o)}
      >
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {icon}
          {title}
          <Badge variant="secondary" className="ml-auto text-xs mr-1">{attributes.length}</Badge>
          {open
            ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          }
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="p-0">
          <div className="divide-y">
            {attributes.map(([key, value], index) => (
              <div key={index} className="px-3 py-2 hover:bg-muted/50 transition-colors group">
                <div className="font-medium text-xs text-muted-foreground mb-0.5 flex justify-between items-center relative">
                  <span title={key}>{formatKey(key)}</span>
                  {key.includes('::') && (
                    <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 absolute right-0 bg-card pl-2 font-mono">
                      {key}
                    </span>
                  )}
                </div>
                <div className="text-sm font-mono break-words text-foreground">
                  {formatValue(value, key)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

const Breadcrumb: React.FC<{
  path: string;
  nodeMap: Map<string, ComposedObject>;
  onSelect: (path: string, node: ComposedObject) => void;
  currentPath: string;
}> = ({ path, nodeMap, onSelect, currentPath }) => {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <div className="flex items-center flex-wrap gap-0.5 text-[11px]">
      {segments.map((seg, i) => {
        const ancestorPath = '/' + segments.slice(0, i + 1).join('/');
        const isLast = i === segments.length - 1;
        const ancestorNode = nodeMap.get(ancestorPath);
        return (
          <React.Fragment key={ancestorPath}>
            {i > 0 && <span className="text-muted-foreground/50">/</span>}
            {isLast ? (
              <span className="font-medium text-foreground truncate max-w-[120px]" title={seg}>{seg}</span>
            ) : ancestorNode ? (
              <button
                className="text-blue-500 hover:text-blue-400 hover:underline truncate max-w-[80px] text-left"
                title={`Navigate to ${ancestorPath}`}
                onClick={() => onSelect(ancestorPath, ancestorNode)}
              >
                {seg}
              </button>
            ) : (
              <span className="text-muted-foreground truncate max-w-[80px]">{seg}</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const IFC5PropertyViewer: React.FC<IFC5PropertyViewerProps> = ({
  node,
  composedObject,
  onNodeSelect,
}) => {
  // Build a flat path → ComposedObject map from the root for breadcrumb navigation
  const nodeMap = useMemo(() => {
    const map = new Map<string, ComposedObject>();
    if (!composedObject) return map;
    const traverse = (obj: ComposedObject) => {
      map.set(obj.name, obj);
      obj.children?.forEach(traverse);
    };
    traverse(composedObject);
    return map;
  }, [composedObject]);

  if (!node) {
    return (
      <div className="flex flex-col h-full bg-card">
        {/* Panel identity header */}
        <div className="p-4 border-b bg-card">
          <h2 className="text-lg font-semibold text-foreground">Properties</h2>
          <p className="text-xs text-muted-foreground mt-1">Composed attributes · post-inheritance</p>
        </div>

        {/* Empty state: guide for new users */}
        <div className="flex-1 flex items-start justify-center pt-8 px-4">
          <div className="space-y-4 text-sm text-muted-foreground max-w-[240px]">
            <div className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-sky-500/20 text-sky-500 flex items-center justify-center text-[10px] font-bold">1</span>
              <p><strong className="text-foreground">Model Tree</strong> — navigate the spatial hierarchy and click any node to select it.</p>
            </div>
            <div className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-sky-500/20 text-sky-500 flex items-center justify-center text-[10px] font-bold">2</span>
              <p><strong className="text-foreground">Graph</strong> — visualise relationships as a force-directed network.</p>
            </div>
            <div className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-sky-500/20 text-sky-500 flex items-center justify-center text-[10px] font-bold">3</span>
              <p><strong className="text-foreground">3D Viewer</strong> — click geometry to select the underlying IFC node.</p>
            </div>
            <div className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-sky-500/20 text-sky-500 flex items-center justify-center text-[10px] font-bold">4</span>
              <p><strong className="text-foreground">Source</strong> — click any raw JSON block to select that node across all panels.</p>
            </div>
            <Separator />
            <p className="text-xs">All panels stay in sync — selecting a node in any panel highlights it in every other panel.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Resolve display values ──────────────────────────────────────────────────
  const rawName = node.attributes?.['bsi::ifc::name'];
  const displayName =
    (rawName && typeof rawName === 'string' && rawName !== '$')
      ? rawName
      : node.name.split('/').pop() || node.name || 'root';

  const ifcClass = getIfcClass(node);
  const hint = getHint(ifcClass);

  // Extract key metadata for the summary card
  const materialName: string | null =
    node.attributes?.['bsi::ifc::material::name'] ??
    (node.attributes?.['bsi::ifc::material'] as any)?.name ?? null;

  const classificationCode: string | null =
    node.attributes?.['nlsfb::code'] ?? null;

  // ── Categorize attributes ───────────────────────────────────────────────────
  const geometryAttrs: [string, any][] = [];
  const materialAttrs: [string, any][] = [];
  const transformAttrs: [string, any][] = [];
  const metadataAttrs: [string, any][] = [];
  const otherAttrs: [string, any][] = [];

  if (node.attributes) {
    Object.entries(node.attributes).forEach(([key, value]) => {
      if (key.startsWith('__internal_')) return;
      if (key.includes('mesh::') || key.includes('basiscurves::') || key.includes('points::') || key.includes('usdgeom::')) {
        geometryAttrs.push([key, value]);
      } else if (key.toLowerCase().includes('material') || key.toLowerCase().includes('presentation') || key.toLowerCase().includes('color')) {
        materialAttrs.push([key, value]);
      } else if (key.includes('xformop::')) {
        transformAttrs.push([key, value]);
      } else if (key.includes('bsi::') || key.includes('ifc::') || key.includes('nlsfb::')) {
        metadataAttrs.push([key, value]);
      } else {
        otherAttrs.push([key, value]);
      }
    });
  }

  const getNodeIcon = () => {
    if (node.type === 'Mesh')   return <Box className="w-5 h-5 text-blue-500" />;
    if (node.type === 'Curve')  return <Minus className="w-5 h-5 text-green-500" />;
    if (node.type === 'Points') return <Circle className="w-5 h-5 text-purple-500" />;
    const cls = ifcClass?.toLowerCase() || '';
    if (cls.includes('ifcproject')) return <Folder className="w-5 h-5 text-sky-500" />;
    if (cls.includes('ifcsite')) return <Globe className="w-5 h-5 text-sky-500" />;
    if (cls.includes('ifcbuilding') && !cls.includes('storey')) return <Building2 className="w-5 h-5 text-sky-500" />;
    if (cls.includes('ifcbuildingstorey')) return <Layers className="w-5 h-5 text-sky-400" />;
    if (cls.includes('ifcspace') && !cls.includes('zone')) return <Home className="w-5 h-5 text-sky-400" />;
    if (['ifcwindow', 'ifcdoor', 'ifcopeningelement'].some(c => cls.includes(c))) return <Box className="w-5 h-5 text-amber-500" />;
    if (['ifcwall', 'ifcslab', 'ifcbeam', 'ifccolumn', 'ifcroof', 'ifcstair',
         'ifccurtainwall', 'ifcmember', 'ifcplate', 'ifcfooting',
         'ifcbuildingelement'].some(c => cls.includes(c))) return <Box className="w-5 h-5 text-orange-500" />;
    if (['ifcflow', 'ifcdistribution', 'ifcpipe', 'ifcduct', 'ifccable'].some(c => cls.includes(c))) return <Circle className="w-5 h-5 text-teal-500" />;
    if (cls.includes('material')) return <Palette className="w-5 h-5 text-fuchsia-500" />;
    return <Database className="w-5 h-5 text-gray-500" />;
  };

  const hintColorClass = hint
    ? { sky: 'bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-300', orange: 'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-300', amber: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300' }[hint.color] ?? 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300'
    : '';

  const hasAnyAttributes =
    geometryAttrs.length > 0 || materialAttrs.length > 0 ||
    transformAttrs.length > 0 || metadataAttrs.length > 0 || otherAttrs.length > 0;

  return (
    <div className="flex flex-col h-full bg-card">

      {/* ── Panel header ─────────────────────────────────────────────────────── */}
      <div className="p-4 border-b space-y-3 bg-card">

        {/* Identity row */}
        <div className="flex items-center gap-3">
          {getNodeIcon()}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold truncate text-foreground leading-tight" title={node.name}>
              {displayName}
            </h2>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              {ifcClass && (
                <Badge className="text-xs font-mono bg-primary/10 text-primary border-primary/20">
                  {ifcClass}
                </Badge>
              )}
              {node.type && node.type !== 'Group' && (
                <Badge variant="outline" className="text-xs">
                  {node.type}
                </Badge>
              )}
              {materialName && (
                <Badge variant="secondary" className="text-xs">
                  <Palette className="w-2.5 h-2.5 mr-1 inline" />{materialName}
                </Badge>
              )}
              {classificationCode && (
                <Badge variant="outline" className="text-xs font-mono text-fuchsia-600 border-fuchsia-400/30">
                  {classificationCode}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Breadcrumb navigation */}
        {onNodeSelect && node.name.includes('/') && (
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Location</span>
            <Breadcrumb
              path={node.name}
              nodeMap={nodeMap}
              onSelect={onNodeSelect}
              currentPath={node.name}
            />
          </div>
        )}

        {/* Child count */}
        {node.children && node.children.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link2 className="w-3 h-3" />
            <span>{node.children.length} child node{node.children.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* IFC / geometry contextual hint */}
        {hint ? (
          <div className={`text-xs border p-2 rounded flex items-start gap-2 ${hintColorClass}`}>
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <p><strong>{ifcClass}:</strong> {hint.text}</p>
          </div>
        ) : node.type === 'Group' && !ifcClass ? (
          <div className="text-xs bg-slate-500/10 border border-slate-500/20 text-slate-700 dark:text-slate-300 p-2 rounded flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <p><strong>Group:</strong> An organisational container that links IFC properties, geometry, and material data for a single element.</p>
          </div>
        ) : node.type === 'Mesh' ? (
          <div className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 p-2 rounded flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <p><strong>Mesh:</strong> The physical 3D representation — vertices (XYZ points) connected by faces (triangles/polygons).</p>
          </div>
        ) : node.type === 'Curve' ? (
          <div className="text-xs bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-300 p-2 rounded flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <p><strong>Curve:</strong> A 3D path or line used for alignment axes, sweeps, or linear representations.</p>
          </div>
        ) : null}

        {/* Path-name contextual hints */}
        {(() => {
          const tail = (node.name.split('/').pop() ?? '').toLowerCase();
          if (tail.includes('directrix')) return (
            <div className="text-xs bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 p-2 rounded flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <p><strong>Directrix:</strong> The driving curve or path along which the element's geometry is swept or extruded.</p>
            </div>
          );
          if (tail.includes('axis')) return (
            <div className="text-xs bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 p-2 rounded flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <p><strong>Axis:</strong> The reference line used for the element's correct position and layout in space.</p>
            </div>
          );
          if (tail.includes('body') && !tail.includes('everybody')) return (
            <div className="text-xs bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 p-2 rounded flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <p><strong>Body:</strong> The primary 3D physical boundary and geometric volume of the building element.</p>
            </div>
          );
          return null;
        })()}

        {/* Panel role note */}
        <p className="text-[10px] text-muted-foreground/50 italic">
          Composed view — attributes merged from inherited nodes
        </p>
      </div>

      {/* ── Attribute sections (scrollable) ──────────────────────────────────── */}
      <ScrollArea className="flex-1 bg-card">
        <div className="p-3 space-y-2.5">
          {!hasAnyAttributes && (
            <Card className="border-dashed bg-card">
              <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
                <div className="text-center">
                  <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No attributes</p>
                  <p className="text-xs mt-1 opacity-60">This node contains no attribute data</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* IFC Metadata first — most semantically relevant for learners */}
          <AttributeSection
            title="IFC Metadata"
            icon={<Info className="w-4 h-4" />}
            attributes={metadataAttrs}
            bgColor="bg-orange-500/10"
            defaultOpen={true}
          />

          {/* Material */}
          <AttributeSection
            title="Material"
            icon={<Palette className="w-4 h-4" />}
            attributes={materialAttrs}
            bgColor="bg-purple-500/10"
            defaultOpen={true}
          />

          {/* Transform */}
          <AttributeSection
            title="Transform"
            icon={<Ruler className="w-4 h-4" />}
            attributes={transformAttrs}
            bgColor="bg-green-500/10"
            defaultOpen={true}
          />

          {/* Other */}
          <AttributeSection
            title="Other Properties"
            icon={<Database className="w-4 h-4" />}
            attributes={otherAttrs}
            bgColor="bg-gray-500/10"
            defaultOpen={true}
          />

          {/* Geometry — collapsed by default (verbose, less useful for learning) */}
          <AttributeSection
            title="Geometry Data"
            icon={<Boxes className="w-4 h-4" />}
            attributes={geometryAttrs}
            bgColor="bg-blue-500/10"
            defaultOpen={false}
          />
        </div>
      </ScrollArea>
    </div>
  );
};
