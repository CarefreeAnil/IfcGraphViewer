import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Layers,
  Building2,
  GitBranch,
  Boxes,
  ChevronRight,
  Info,
  FileText,
  Box,
  Map
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// IFC Schema Architecture Layers (from BuildingSMART)
interface EntityInfo {
  name: string;
  description: string;
  example?: string;
}

interface ArchitectureLayer {
  id: 'domain' | 'interoperability' | 'core' | 'resource';
  name: string;
  shortName: string;
  description: string;
  detailedDescription: string;
  color: string;
  bgColor: string;
  borderColor: string;
  entities: EntityInfo[];
  icon: React.ReactNode;
  educationalNote: string;
  keyCharacteristics: string[];
  usedBy?: string[];
  uses?: string[];
}

const ARCHITECTURE_LAYERS: ArchitectureLayer[] = [
  {
    id: 'domain',
    name: 'Domain Layer',
    shortName: 'Domain',
    description: 'Industry-specific schemas for specialized disciplines',
    detailedDescription: 'The Domain Layer is the highest layer and includes schemas containing entity definitions that are specializations of products, processes or resources specific to a certain discipline. These definitions are typically utilized for intra-domain exchange and sharing of information. Examples include Structural Analysis Domain, Architecture Domain, Building Controls Domain, Construction Management Domain, Electrical Domain, HVAC Domain, Plumbing Domain, Structural Elements Domain, Ports and Waterways Domain, Rail Domain, and Road Domain.',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-950/30',
    borderColor: 'border-violet-200 dark:border-violet-800',
    entities: [
      { name: 'IfcBeam', description: 'Structural member', example: 'From Structural Analysis Domain' },
      { name: 'IfcColumn', description: 'Structural member', example: 'From Structural Analysis Domain' },
      { name: 'IfcWallElementedCase', description: 'Detailed wall', example: 'From Architecture Domain' },
      { name: 'IfcPipeSegment', description: 'Plumbing element', example: 'From Plumbing Domain' },
      { name: 'IfcDuctSegment', description: 'HVAC element', example: 'From HVAC Domain' },
      { name: 'IfcCableSegment', description: 'Electrical element', example: 'From Electrical Domain' },
    ],
    icon: <Building2 className="w-5 h-5" />,
    educationalNote: 'Domain layer contains discipline-specific specializations. In the official IFC architecture, you can see 12 main domain schemas: Structural, Architecture, Building Controls, Construction Management, Electrical, HVAC, Structural Elements, Plumbing, Ports & Waterways, Rail, Road, and Tunnel.',
    keyCharacteristics: [
      'Industry/discipline-specific specializations',
      'Intra-domain exchange of information',
      'Specialized property sets (Psets)',
      'Domain-specific relationships',
      '12 main domain schemas in IFC 4.3x',
    ],
    uses: ['interoperability', 'core', 'resource'],
  },
  {
    id: 'interoperability',
    name: 'Interoperability Layer',
    shortName: 'Interop',
    description: 'Shared building elements understood across disciplines',
    detailedDescription: 'The Interoperability Layer includes schemas containing entity definitions that are specific to a general product, process or resource specialization used across several disciplines. These definitions are typically utilized for inter-domain exchange and sharing of construction information. The IFC 4.3x diagram shows 6 shared schemas: Shared Building Elements, Shared Building Service Elements, Shared Component Elements, Shared Facilities Elements, Shared Infrastructure Elements, and Shared Management Elements.',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    entities: [
      { name: 'IfcWall', description: 'Building element', example: 'Shared Building Elements' },
      { name: 'IfcDoor', description: 'Building component', example: 'Shared Component Elements' },
      { name: 'IfcWindow', description: 'Building component', example: 'Shared Component Elements' },
      { name: 'IfcSpace', description: 'Spatial element', example: 'Shared Facilities Elements' },
      { name: 'IfcFlowTerminal', description: 'Building service element', example: 'Shared Building Service Elements' },
      { name: 'IfcSlab', description: 'Horizontal structural element', example: 'Shared Building Elements' },
    ],
    icon: <Boxes className="w-5 h-5" />,
    educationalNote: 'The Interoperability layer defines common building elements and services understood across all disciplines. These enable collaborative workflows where architects, engineers, and contractors work with semantically consistent object definitions. This layer ensures semantic meaning that enables intelligent cross-discipline workflows.',
    keyCharacteristics: [
      'Cross-discipline communication',
      'Inter-domain data exchange',
      '6 shared element schemas',
      'Standard element definitions',
      'Shared semantic meaning',
      'Common property definitions',
    ],
    uses: ['core', 'resource'],
    usedBy: ['domain'],
  },
  {
    id: 'core',
    name: 'Core Layer',
    shortName: 'Core',
    description: 'Abstract concepts defining fundamental BIM structures',
    detailedDescription: 'The Core Layer includes the kernel schema and core extension schemas (Control Extension, Product Extension, Process Extension), containing the most general entity definitions. All entities defined at the core layer, or above, carry a globally unique identifier (GUID) and optionally owner and history information. The Kernel provides the foundation, while extensions specialize for different aspects of the schema.',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    entities: [
      { name: 'IfcProject', description: 'Root entity', example: 'Kernel' },
      { name: 'IfcProduct', description: 'Product base class', example: 'Product Extension' },
      { name: 'IfcProcess', description: 'Process base class', example: 'Process Extension' },
      { name: 'IfcControl', description: 'Control base class', example: 'Control Extension' },
      { name: 'IfcObject', description: 'Object base class', example: 'Kernel' },
      { name: 'IfcRelationship', description: 'Relationship base', example: 'Kernel' },
    ],
    icon: <GitBranch className="w-5 h-5" />,
    educationalNote: 'The Core Layer is divided into Kernel (foundation) and three extensions: Product (for physical objects), Process (for methods and tasks), and Control (for controls and constraints). All Core and higher entities carry a GUID for tracking. This is the foundation of IFC\'s object-oriented design.',
    keyCharacteristics: [
      'Kernel + 3 Extensions (Product, Process, Control)',
      'Most general entity definitions',
      'All entities carry GUID',
      'Owner and history tracking',
      'Abstract base classes',
      'Inheritance hierarchy roots',
    ],
    uses: ['resource'],
    usedBy: ['domain', 'interoperability'],
  },
  {
    id: 'resource',
    name: 'Resource Layer',
    shortName: 'Resource',
    description: 'Foundational primitives without independent identity',
    detailedDescription: 'The Resource Layer is the lowest layer and includes all individual schemas containing resource definitions. Those definitions do not include a globally unique identifier and shall not be used independently of a definition declared at a higher layer. The IFC 4.3x diagram shows extensive resource schemas organized into categories: DateTime, Material, External Reference, Geometric Constraint, Geometric Model, Geometry, Actor, Profile, Property, Quantity, Topology, Utility, Measure, and Presentation resources.',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    entities: [
      { name: 'IfcCartesianPoint', description: '3D coordinate', example: 'Geometry Resource' },
      { name: 'IfcMaterial', description: 'Material definition', example: 'Material Resource' },
      { name: 'IfcPropertySet', description: 'Properties collection', example: 'Property Resource' },
      { name: 'IfcGeometricRepresentationItem', description: 'Geometric base', example: 'Geometric Model Resource' },
      { name: 'IfcRepresentation', description: 'Data representation', example: 'Representation Resource' },
      { name: 'IfcMeasureWithUnit', description: 'Quantity with unit', example: 'Quantity Resource' },
    ],
    icon: <Layers className="w-5 h-5" />,
    educationalNote: 'Resources are the building blocks of IFC. Key resources include: Geometric (shapes, coordinates), Material (material definitions), Property (Psets, quantities), Representation (how data is presented), and Measure (units, values). They have no GUID and cannot exist independently - they only have meaning when used by higher-layer entities.',
    keyCharacteristics: [
      'No independent identity (no GUID)',
      'Cannot be used standalone',
      'Multiple resource categories (13+)',
      'Geometric primitives',
      'Property definitions',
      'Representation resources',
      'Measure and unit definitions',
    ],
    usedBy: ['domain', 'interoperability', 'core'],
  },
];

// Connection types between layers
interface LayerConnection {
  from: string;
  to: string;
  type: 'inherits' | 'uses' | 'references';
  description: string;
}

const LAYER_CONNECTIONS: LayerConnection[] = [
  { from: 'domain', to: 'core', type: 'inherits', description: 'Domain entities extend Core abstractions' },
  { from: 'interoperability', to: 'core', type: 'inherits', description: 'Shared elements implement Core interfaces' },
  { from: 'core', to: 'resource', type: 'uses', description: 'Core uses Resource for properties & geometry' },
  { from: 'domain', to: 'resource', type: 'references', description: 'Domain entities reference Resource definitions' },
  { from: 'interoperability', to: 'resource', type: 'references', description: 'Interop elements use Resource types' },
];

interface IFCArchitectureDiagramProps {
  onLayerSelect?: (layer: ArchitectureLayer) => void;
  selectedLayer?: string;
  compact?: boolean;
}

export function IFCArchitectureDiagram({
  onLayerSelect,
  selectedLayer,
  compact = false
}: IFCArchitectureDiagramProps) {
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);

  return (
    <div className={cn("relative", compact ? "space-y-2" : "space-y-3")}>
      {/* Title */}
      {!compact && (
        <div className="flex items-center gap-2 mb-4">
          <Map className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">IFC Schema Architecture</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>The IFC schema is organized in four conceptual layers, each building upon the ones below.</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Layer Stack */}
      <div className="relative">
        {/* Connection Lines (visual) */}
        {!compact && (
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-violet-300 via-blue-300 to-amber-300 dark:from-violet-700 dark:via-blue-700 dark:to-amber-700 -translate-x-1/2 z-0" />
        )}

        {/* Layers */}
        <div className="relative z-10 space-y-2">
          {ARCHITECTURE_LAYERS.map((layer, index) => (
            <Card
              key={layer.id}
              className={cn(
                "cursor-pointer transition-all duration-200 border-2",
                layer.bgColor,
                layer.borderColor,
                hoveredLayer === layer.id && "shadow-lg scale-[1.02]",
                selectedLayer === layer.id && "ring-2 ring-primary ring-offset-2",
                compact ? "p-2" : "p-3"
              )}
              onMouseEnter={() => setHoveredLayer(layer.id)}
              onMouseLeave={() => setHoveredLayer(null)}
              onClick={() => onLayerSelect?.(layer)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", layer.bgColor, layer.color)}>
                    {layer.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={cn("font-semibold", layer.color)}>
                        {compact ? layer.shortName : layer.name}
                      </h4>
                      {!compact && (
                        <Badge variant="secondary" className="text-xs">
                          Layer {4 - index}
                        </Badge>
                      )}
                    </div>
                    {!compact && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {layer.description}
                      </p>
                    )}
                  </div>
                </div>

                <ChevronRight className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform",
                  hoveredLayer === layer.id && "translate-x-1"
                )} />
              </div>

              {/* Entity Examples - Expanded view on hover */}
              {!compact && hoveredLayer === layer.id && (
                <div className="mt-3 pt-3 border-t border-current/10 space-y-3">
                  {/* Key Characteristics */}
                  <div>
                    <h5 className="text-xs font-medium text-foreground mb-1.5">Key Characteristics:</h5>
                    <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                      {layer.keyCharacteristics.map((char, i) => (
                        <li key={i}>{char}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Entity Examples with descriptions */}
                  <div>
                    <h5 className="text-xs font-medium text-foreground mb-1.5">Example Entities:</h5>
                    <div className="grid grid-cols-2 gap-2">
                      {layer.entities.slice(0, 4).map((entity) => (
                        <Tooltip key={entity.name}>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className={cn("text-xs cursor-help justify-start", layer.color, layer.borderColor)}
                            >
                              <Box className="w-3 h-3 mr-1" />
                              {entity.name}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p className="font-medium">{entity.name}</p>
                            <p className="text-xs text-muted-foreground">{entity.description}</p>
                            {entity.example && (
                              <p className="text-xs mt-1 italic">Example: {entity.example}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>

                  {/* Layer connections */}
                  {(layer.uses || layer.usedBy) && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {layer.uses && (
                        <span className="text-muted-foreground">
                          <strong>Uses:</strong> {layer.uses.map(l => ARCHITECTURE_LAYERS.find(a => a.id === l)?.shortName).join(', ')}
                        </span>
                      )}
                      {layer.usedBy && (
                        <span className="text-muted-foreground">
                          <strong>Used by:</strong> {layer.usedBy.map(l => ARCHITECTURE_LAYERS.find(a => a.id === l)?.shortName).join(', ')}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground italic border-l-2 border-current/20 pl-2">
                    {layer.educationalNote}
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Legend / How They Connect */}
      {!compact && (
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <h5 className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
            <GitBranch className="w-3 h-3" />
            How Layers Connect
          </h5>
          <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span><strong>Inherits:</strong> Upper layers extend lower layer classes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-chart-2" />
              <span><strong>Uses:</strong> Layers utilize resources for data</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-chart-3" />
              <span><strong>References:</strong> Cross-layer entity relationships</span>
            </div>
          </div>
        </div>
      )}

      {/* BuildingSMART Reference */}
      {!compact && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            For the official IFC 4.3 Architecture specification, visit{' '}
            <a
              href="https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/content/introduction.htm#Architecture"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 underline transition-colors"
            >
              BuildingSMART Standards
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

// Mapping from architecture layers to learning layers
export const ARCHITECTURE_TO_LEARNING_MAP: Record<string, string[]> = {
  domain: ['element'],
  interoperability: ['spatial', 'element'],
  core: ['project', 'relationship'],
  resource: ['property'],
};

export { ARCHITECTURE_LAYERS, LAYER_CONNECTIONS };
export type { ArchitectureLayer, LayerConnection, EntityInfo };
