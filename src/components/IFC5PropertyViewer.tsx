/**
 * IFC5 Property Viewer Component
 * Displays properties and attributes for selected IFC5 nodes
 */

import React from 'react';
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
  Ruler
} from 'lucide-react';

interface IFC5PropertyViewerProps {
  node: ComposedObject | null;
}

export const IFC5PropertyViewer: React.FC<IFC5PropertyViewerProps> = ({ node }) => {
  if (!node) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center space-y-2">
          <Info className="w-12 h-12 mx-auto opacity-50" />
          <p>Select a node to view its properties</p>
        </div>
      </div>
    );
  }

  const displayName = node.name.split('/').pop() || node.name || 'root';

  // Categorize attributes
  const geometryAttrs: [string, any][] = [];
  const materialAttrs: [string, any][] = [];
  const transformAttrs: [string, any][] = [];
  const metadataAttrs: [string, any][] = [];
  const otherAttrs: [string, any][] = [];

  if (node.attributes) {
    Object.entries(node.attributes).forEach(([key, value]) => {
      // Skip internal attributes
      if (key.startsWith('__internal_')) return;

      if (key.includes('mesh::') || key.includes('basiscurves::') || key.includes('points::')) {
        geometryAttrs.push([key, value]);
      } else if (key.includes('material::') || key.includes('presentation::')) {
        materialAttrs.push([key, value]);
      } else if (key.includes('xformop::')) {
        transformAttrs.push([key, value]);
      } else if (key.includes('bsi::') || key.includes('ifc::')) {
        metadataAttrs.push([key, value]);
      } else {
        otherAttrs.push([key, value]);
      }
    });
  }

  const getNodeIcon = () => {
    switch (node.type) {
      case 'Mesh':
        return <Box className="w-5 h-5 text-blue-500" />;
      case 'Curve':
        return <Minus className="w-5 h-5 text-green-500" />;
      case 'Points':
        return <Circle className="w-5 h-5 text-purple-500" />;
      default:
        return <Database className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (Array.isArray(value)) {
      if (value.length > 10) {
        return `Array[${value.length}] (${value.slice(0, 3).join(', ')}, ...)`;
      }
      return `[${value.join(', ')}]`;
    }
    if (typeof value === 'object') {
      if ('ref' in value) {
        return `→ ${value.ref}`;
      }
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'number') {
      return value.toFixed(4);
    }
    return String(value);
  };

  const renderAttributeSection = (
    title: string,
    icon: React.ReactNode,
    attributes: [string, any][],
    bgColor: string
  ) => {
    if (attributes.length === 0) return null;

    return (
      <Card className="border-2">
        <CardHeader className={`py-3 ${bgColor}`}>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {icon}
            {title}
            <Badge variant="secondary" className="ml-auto">
              {attributes.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {attributes.map(([key, value], index) => (
              <div key={index} className="p-3 hover:bg-muted/50 transition-colors">
                <div className="font-medium text-xs text-muted-foreground mb-1">
                  {key}
                </div>
                <div className="text-sm font-mono break-all text-foreground">
                  {formatValue(value)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-4 border-b space-y-3 bg-card">
        <div className="flex items-center gap-3">
          {getNodeIcon()}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate text-foreground" title={node.name}>
              {displayName}
            </h2>
            {node.type && (
              <Badge variant="outline" className="text-xs mt-1">
                {node.type}
              </Badge>
            )}
          </div>
        </div>

        <div className="text-xs space-y-1 text-foreground">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Full Path:</span>
            <span className="font-mono text-right truncate max-w-[200px] text-foreground" title={node.name}>
              {node.name}
            </span>
          </div>
          {node.children && node.children.length > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Children:</span>
              <span className="font-semibold text-foreground">{node.children.length}</span>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 bg-card">
        <div className="p-4 space-y-3">
          {geometryAttrs.length === 0 && 
           materialAttrs.length === 0 && 
           transformAttrs.length === 0 && 
           metadataAttrs.length === 0 && 
           otherAttrs.length === 0 && (
            <Card className="border-dashed bg-card">
              <CardContent className="flex items-center justify-center py-8 text-muted-foreground text-foreground">
                <div className="text-center">
                  <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No attributes found</p>
                </div>
              </CardContent>
            </Card>
          )}

          {renderAttributeSection(
            'Geometry',
            <Boxes className="w-4 h-4" />,
            geometryAttrs,
            'bg-blue-500/10'
          )}

          {renderAttributeSection(
            'Material',
            <Palette className="w-4 h-4" />,
            materialAttrs,
            'bg-purple-500/10'
          )}

          {renderAttributeSection(
            'Transform',
            <Ruler className="w-4 h-4" />,
            transformAttrs,
            'bg-green-500/10'
          )}

          {renderAttributeSection(
            'Metadata',
            <Info className="w-4 h-4" />,
            metadataAttrs,
            'bg-orange-500/10'
          )}

          {renderAttributeSection(
            'Other Properties',
            <Database className="w-4 h-4" />,
            otherAttrs,
            'bg-gray-500/10'
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
