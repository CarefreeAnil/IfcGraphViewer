import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Box, Hash, Tag, FileCode, BookOpen, ExternalLink, 
  Info, GitBranch, List, ChevronDown, ChevronRight,
  CheckCircle, Lightbulb, AlertCircle, AlertTriangle
} from 'lucide-react';
import { GraphNode, NodeType } from '@/types/graph';
import { IFCEntity } from '@/types/ifc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  getEntityDefinition, 
  getRelatedPropertySets,
} from '@/data/ifc-schema';

interface NodeDetailsPanelProps {
  node: GraphNode | null;
  onClose: () => void;
  inline?: boolean;
}

const TYPE_ICONS: Record<NodeType, React.ReactNode> = {
  building: <Box className="w-5 h-5" />,
  space: <Box className="w-5 h-5" />,
  element: <Box className="w-5 h-5" />,
  property: <Tag className="w-5 h-5" />,
  relationship: <Box className="w-5 h-5" />,
  geometry: <Box className="w-5 h-5" />,
  other: <Box className="w-5 h-5" />,
};

const TYPE_LABELS: Record<NodeType, string> = {
  building: 'Building Structure',
  space: 'Space',
  element: 'Building Element',
  property: 'Property Set',
  relationship: 'Relationship',
  geometry: 'Geometry',
  other: 'Other',
};

const categoryColors: Record<string, string> = {
  spatial: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
  element: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
  relationship: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
  property: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
  resource: 'bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500/30',
  context: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30',
};

export function NodeDetailsPanel({ node, onClose, inline = false }: NodeDetailsPanelProps) {
  const [showEducation, setShowEducation] = useState(false);

  if (!node) return null;

  // For space entities, prioritize LongName over Name
  const displayName = node.type === 'space' 
    ? (node.properties.LongName || node.properties.Name || node.label)
    : node.label;

  const entity: IFCEntity = {
    id: node.id,
    type: node.ifcType,
    name: displayName,
    attributes: node.properties || {},
    isMetadata: node.type === 'property' || node.type === 'other',
    category: node.type === 'relationship' ? 'relationship' : 
              (node.type === 'property' || node.type === 'other') ? 'metadata' : 
              'structural',
  };

  const definition = getEntityDefinition(entity.type);
  const relatedPsets = getRelatedPropertySets(entity.type);

  const excludedKeys = new Set([
    'id', 'nodeId', 'expressId', '_schemaColor', '_schemaIcon', '_ifcStep',
    'schemaColor', 'schemaIcon', 'type', 'ifcType', '_entityType', '_expressID', 'label'
  ]);
  const filteredProps = Object.entries(node.properties).filter(
    ([key]) => !excludedKeys.has(key) && !key.startsWith('_')
  );

  const content = (
    <TooltipProvider>
      <div className="h-full w-full flex flex-col">
        {/* Header - Fixed, no scrolling */}
        <div className="p-4 border-b border-border bg-muted/50 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`p-2 rounded-lg bg-node-${node.type}/20 text-node-${node.type} shrink-0`}>
                {TYPE_ICONS[node.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-semibold text-foreground truncate">
                    {displayName}
                  </h3>
                  {node.expressId && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      #{node.expressId}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">{TYPE_LABELS[node.type]}</p>
                  {definition && (
                    <Badge className={`text-[10px] ${categoryColors[definition.category] || 'bg-muted'}`}>
                      {definition.category}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content - FIXED: overflow-y-scroll to always show scrollbar */}
        <div className="flex-1 overflow-y-scroll">
          <div className="p-4 space-y-4">
            {/* IFC Type */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <FileCode className="w-3.5 h-3.5" />
                IFC Type
              </label>
              <div className="px-3 py-2 rounded-md bg-muted font-mono text-sm text-primary">
                {node.ifcType}
              </div>
            </div>

            {/* Express ID */}
            {node.expressId && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Hash className="w-3.5 h-3.5" />
                  Express ID
                </label>
                <div className="px-3 py-2 rounded-md bg-muted font-mono text-xs text-muted-foreground">
                  #{node.expressId}
                </div>
              </div>
            )}

            {/* Education Toggle Button */}
            <button
              onClick={() => setShowEducation(!showEducation)}
              className="w-full px-3 py-2 bg-gradient-to-r from-blue-500/10 to-blue-600/10 hover:from-blue-500/20 hover:to-blue-600/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 rounded-md transition-colors flex items-center justify-center gap-2 text-sm font-medium"
            >
              <BookOpen className="w-4 h-4" />
              {showEducation ? 'Hide' : 'Learn About'} This Entity
            </button>

            {/* Education Content */}
            <AnimatePresence>
              {showEducation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3"
                >
                  <EducationContent 
                    entity={entity} 
                    definition={definition} 
                    relatedPsets={relatedPsets} 
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actual Properties */}
            {filteredProps.length > 0 && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Tag className="w-3.5 h-3.5" />
                  Actual Properties
                </label>
                <div className="space-y-1">
                  {filteredProps.map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50">
                      <span className="text-xs text-muted-foreground capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <span className="text-xs font-mono text-foreground">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );

  if (inline) {
    return content;
  }

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="absolute top-4 right-4 w-80 bg-card/95 backdrop-blur-md rounded-xl border-glow overflow-hidden max-h-[90vh] flex flex-col"
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EducationContent({ 
  entity, 
  definition, 
  relatedPsets 
}: { 
  entity: IFCEntity;
  definition: any;
  relatedPsets: any[];
}) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));
  const [expandedPsets, setExpandedPsets] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const togglePset = (psetName: string) => {
    setExpandedPsets(prev => {
      const next = new Set(prev);
      if (next.has(psetName)) {
        next.delete(psetName);
      } else {
        next.add(psetName);
      }
      return next;
    });
  };

  return (
    <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 space-y-2">
      {/* DEPRECATION WARNING - ONLY PLACE IT APPEARS */}
      {definition?.deprecatedIn && (
        <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                Deprecated in {definition.deprecatedIn}
              </p>
              {definition.replacedBy && (
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
                  Use {definition.replacedBy} instead.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overview */}
      <EducationSection
        title="Overview"
        icon={<Info className="w-3.5 h-3.5" />}
        isOpen={expandedSections.has('overview')}
        onToggle={() => toggleSection('overview')}
      >
        {definition ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {definition.description}
            </p>
            {definition.usageNotes && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2">
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-blue-700 dark:text-blue-300">
                    {definition.usageNotes}
                  </p>
                </div>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px] h-5">
                Since {definition.introducedIn}
              </Badge>
              {definition.docsUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-5 text-[10px] gap-1 px-2"
                  onClick={() => window.open(definition.docsUrl, '_blank')}
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  Docs
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-muted-foreground">
            <AlertCircle className="w-3 h-3 mt-0.5" />
            <p className="text-xs">No schema documentation available</p>
          </div>
        )}
      </EducationSection>

      {/* Inheritance */}
      {definition && definition.inheritance && definition.inheritance.length > 0 && (
        <EducationSection
          title="Inheritance"
          icon={<GitBranch className="w-3.5 h-3.5" />}
          isOpen={expandedSections.has('inheritance')}
          onToggle={() => toggleSection('inheritance')}
        >
          <div className="flex flex-wrap gap-1">
            {[entity.type, ...definition.inheritance].map((type, index) => (
              <div key={type} className="flex items-center">
                <Badge 
                  variant={index === 0 ? 'default' : 'outline'} 
                  className="text-[10px] font-mono"
                >
                  {type}
                </Badge>
                {index < definition.inheritance.length && (
                  <ChevronRight className="w-2.5 h-2.5 mx-0.5 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </EducationSection>
      )}

      {/* Standard Properties */}
      {definition && definition.properties && definition.properties.length > 0 && (
        <EducationSection
          title={`Standard Properties (${definition.properties.length})`}
          icon={<List className="w-3.5 h-3.5" />}
          isOpen={expandedSections.has('properties')}
          onToggle={() => toggleSection('properties')}
        >
          <div className="space-y-1">
            {definition.properties.map((prop: any) => {
              const hasValue = entity.attributes[prop.name] !== undefined;
              const actualValue = entity.attributes[prop.name];
              return (
                <div 
                  key={prop.name}
                  className={`rounded p-1.5 text-[11px] ${
                    hasValue ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-1 justify-between">
                    <div className="flex items-center gap-1">
                      {hasValue ? (
                        <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                      ) : (
                        <div className="w-3 h-3 rounded-full border border-muted-foreground/30 shrink-0" />
                      )}
                      <span className="font-medium">{prop.name}</span>
                    </div>
                    <code className="text-[9px] text-muted-foreground">
                      {prop.dataType}
                    </code>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 ml-4">{prop.description}</p>
                  {hasValue && (
                    <div className="mt-1 ml-4 pt-1 border-t border-green-500/20">
                      <span className="text-[10px] text-green-700 dark:text-green-300 font-mono">
                        = {formatValue(actualValue)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </EducationSection>
      )}

      {/* Related Property Sets */}
      {relatedPsets && relatedPsets.length > 0 && (
        <EducationSection
          title={`Property Sets (${relatedPsets.length})`}
          icon={<FileCode className="w-3.5 h-3.5" />}
          isOpen={expandedSections.has('psets')}
          onToggle={() => toggleSection('psets')}
        >
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Standard property sets that can be attached to this entity:
            </p>
            {relatedPsets.map((pset) => (
              <div key={pset.name} className="border border-border rounded overflow-hidden">
                <button
                  onClick={() => togglePset(pset.name)}
                  className="w-full p-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] font-mono text-primary">{pset.name}</code>
                    <Badge variant="secondary" className="text-[9px] h-4 px-1">
                      {pset.properties?.length || 0} props
                    </Badge>
                  </div>
                  {expandedPsets.has(pset.name) ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
                {expandedPsets.has(pset.name) && (
                  <div className="p-2 pt-0 space-y-1 bg-muted/20">
                    <p className="text-[10px] text-muted-foreground mb-2">{pset.description}</p>
                    {pset.properties?.map((prop: any) => (
                      <div 
                        key={prop.name} 
                        className="flex items-start justify-between py-1 px-2 rounded bg-background/50"
                      >
                        <div className="flex items-start gap-1 flex-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 cursor-help">
                                <span className="text-[11px] font-medium">{prop.name}</span>
                                <Info className="w-2.5 h-2.5 text-muted-foreground" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <p className="text-xs">{prop.description}</p>
                              {prop.example && (
                                <p className="text-xs mt-1 text-muted-foreground">
                                  Example: {prop.example}
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <code className="text-[9px] text-muted-foreground ml-2">
                          {prop.dataType}
                        </code>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </EducationSection>
      )}
    </div>
  );
}

function EducationSection({ 
  title, 
  icon, 
  isOpen, 
  onToggle, 
  children 
}: { 
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full p-1.5 rounded hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="font-medium text-xs">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="pl-5 pr-1 pt-1"
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
