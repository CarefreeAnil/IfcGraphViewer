import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Search, Tag, ChevronRight, ChevronDown, Hash, Box,
  BookOpen, ExternalLink, Info, GitBranch, List, 
  FileText, CheckCircle, AlertCircle, Lightbulb 
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { GraphNode, NodeType } from '@/types/graph';
import { IFCEntity } from '@/types/ifc';
import { getEntityDef } from '@/lib/ifcSchema';
import { 
  getEntityDefinition, 
  getRelatedPropertySets,
  getDocsUrl,
} from '@/data/ifc-schema';
import { useUIState } from '@/contexts/UIStateContext';

interface PropertyViewerProps {
  nodes: GraphNode[];
  onNodeSelect: (node: GraphNode) => void;
  selectedNodeId: string | null;
}

const TYPE_COLORS: Record<NodeType, string> = {
  building: 'bg-node-building/20 text-node-building border-node-building/30',
  space: 'bg-node-space/20 text-node-space border-node-space/30',
  element: 'bg-node-element/20 text-node-element border-node-element/30',
  property: 'bg-node-property/20 text-node-property border-node-property/30',
  relationship: 'bg-node-relationship/20 text-node-relationship border-node-relationship/30',
  geometry: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
  other: 'bg-gray-600/20 text-gray-600 border-gray-600/30',
};

const categoryColors: Record<string, string> = {
  spatial: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
  element: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
  relationship: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
  property: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
  resource: 'bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500/30',
  context: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30',
};

interface GroupedNodes {
  [ifcType: string]: GraphNode[];
}

export function PropertyViewer({ nodes, onNodeSelect, selectedNodeId }: PropertyViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showEducationFor, setShowEducationFor] = useState<string | null>(null);

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const query = searchQuery.toLowerCase();
    return nodes.filter(node => 
      node.label.toLowerCase().includes(query) ||
      node.ifcType.toLowerCase().includes(query) ||
      Object.entries(node.properties).some(([key, value]) => 
        key.toLowerCase().includes(query) || 
        String(value).toLowerCase().includes(query)
      )
    );
  }, [nodes, searchQuery]);

  const groupedNodes = useMemo(() => {
    const groups: GroupedNodes = {};
    filteredNodes.forEach(node => {
      if (!groups[node.ifcType]) {
        groups[node.ifcType] = [];
      }
      groups[node.ifcType].push(node);
    });
    return groups;
  }, [filteredNodes]);

  const toggleType = (ifcType: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(ifcType)) {
        next.delete(ifcType);
      } else {
        next.add(ifcType);
      }
      return next;
    });
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
        setShowEducationFor(null); // Close education when collapsing
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const formatPropertyValue = (value: any): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-card/95 backdrop-blur-md">
        {/* Search Header */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search entities, types, or properties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50 border-border"
            />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {filteredNodes.length} entities in {Object.keys(groupedNodes).length} types
          </div>
        </div>

        {/* Entity List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {Object.entries(groupedNodes)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([ifcType, typeNodes]) => {
                const schemaDef = getEntityDef(ifcType);
                const displayName = schemaDef?.displayName || ifcType;
                const schemaColor = schemaDef?.color || '#888';
                
                return (
                  <div key={ifcType} className="mb-1">
                    {/* Type Header */}
                    <button
                      onClick={() => toggleType(ifcType)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                    >
                      {expandedTypes.has(ifcType) ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: schemaColor }}
                        title={schemaDef?.description}
                      />
                      <div className="flex-1">
                        <span className="font-mono text-sm text-foreground">{ifcType}</span>
                        {displayName !== ifcType && (
                          <span className="text-xs text-muted-foreground ml-2">({displayName})</span>
                        )}
                      </div>
                      <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {typeNodes.length}
                      </span>
                    </button>

                    {/* Nodes in Type */}
                    {expandedTypes.has(ifcType) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="ml-4 border-l border-border pl-2"
                      >
                        {typeNodes.map(node => (
                          <div key={node.id} className="mb-1">
                            {/* Node Header */}
                            <button
                              onClick={() => {
                                toggleNode(node.id);
                                onNodeSelect(node);
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-left ${
                                selectedNodeId === node.id 
                                  ? 'bg-primary/20 border border-primary/30' 
                                  : 'hover:bg-muted/50'
                              }`}
                            >
                              {expandedNodes.has(node.id) ? (
                                <ChevronDown className="w-3 h-3 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                              )}
                              <div className={`p-1 rounded border ${TYPE_COLORS[node.type]}`}>
                                <Box className="w-3 h-3" />
                              </div>
                              <span className="text-sm text-foreground truncate flex-1">
                                {node.label}
                              </span>
                              {node.expressId && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  #{node.expressId}
                                </span>
                              )}
                            </button>

                            {/* Node Details (Properties + Education) */}
                            {expandedNodes.has(node.id) && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="ml-6 mt-1 mb-2 space-y-2"
                              >
                                {/* Toggle Education Button */}
                                <button
                                  onClick={() => setShowEducationFor(
                                    showEducationFor === node.id ? null : node.id
                                  )}
                                  className="w-full px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 rounded-md transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                                >
                                  <BookOpen className="w-3.5 h-3.5" />
                                  {showEducationFor === node.id ? 'Hide' : 'Learn About'} {node.ifcType}
                                </button>

                                {/* Education Panel Content (Inline) */}
                                <AnimatePresence>
                                  {showEducationFor === node.id && (
                                    <EducationContent node={node} />
                                  )}
                                </AnimatePresence>

                                {/* Properties Section */}
                                {Object.keys(node.properties).length > 0 && (
                                  <div className="bg-muted/30 rounded-md p-2 space-y-1">
                                    <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
                                      <Tag className="w-3 h-3" />
                                      <span>Actual Properties</span>
                                    </div>
                                    {Object.entries(node.properties).map(([key, value]) => (
                                      <div
                                        key={key}
                                        className="flex items-start justify-between gap-2 px-2 py-1 rounded bg-background/50 text-xs"
                                      >
                                        <span className="text-muted-foreground font-medium min-w-0 break-words">
                                          {key}
                                        </span>
                                        <span className="text-foreground font-mono text-right min-w-0 break-all">
                                          {formatPropertyValue(value)}
                                        </span>
                                      </div>
                                    ))}
                                    
                                    {/* Express ID */}
                                    {node.expressId && (
                                      <div className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-background/50 text-xs mt-2 border-t border-border pt-2">
                                        <span className="flex items-center gap-1 text-muted-foreground">
                                          <Hash className="w-3 h-3" />
                                          Express ID
                                        </span>
                                        <span className="text-foreground font-mono">#{node.expressId}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                );
              })}

            {Object.keys(groupedNodes).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No entities found</p>
                {searchQuery && (
                  <p className="text-xs mt-1">Try adjusting your search</p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}

// Education Content Component (Inline)
function EducationContent({ node }: { node: GraphNode }) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview'])
  );
  const { schemaVersion } = useUIState();

  const entity: IFCEntity = {
    id: node.id,
    type: node.ifcType,
    name: node.label,
    attributes: node.properties || {},
    isMetadata: node.type === 'property' || node.type === 'other',
    category: node.type === 'relationship' ? 'relationship' : 
              (node.type === 'property' || node.type === 'other') ? 'metadata' : 
              'structural',
  };

  const definition = getEntityDefinition(entity.type);
  const relatedPsets = getRelatedPropertySets(entity.type);

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

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 space-y-2"
    >
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
            <div className="flex gap-2">
              <Badge variant="outline" className="text-[10px] h-5">
                Since {definition.introducedIn}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="h-5 text-[10px] gap-1 px-2"
                onClick={() => window.open(getDocsUrl(node.ifcType, schemaVersion), '_blank')}
              >
                <ExternalLink className="w-2.5 h-2.5" />
                Docs
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground italic">
              No detailed schema documentation available
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-5 text-[10px] gap-1 px-2"
              onClick={() => window.open(getDocsUrl(node.ifcType, schemaVersion), '_blank')}
            >
              <ExternalLink className="w-2.5 h-2.5" />
              View Official Schema Docs
            </Button>
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
            {definition.properties.slice(0, 5).map((prop) => {
              const hasValue = entity.attributes[prop.name] !== undefined;
              return (
                <div 
                  key={prop.name}
                  className={`rounded p-1.5 text-[11px] ${
                    hasValue ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {hasValue ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />
                    )}
                    <span className="font-medium">{prop.name}</span>
                    <code className="text-[9px] text-muted-foreground ml-auto">
                      {prop.dataType}
                    </code>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{prop.description}</p>
                </div>
              );
            })}
            {definition.properties.length > 5 && (
              <p className="text-[10px] text-muted-foreground italic">
                + {definition.properties.length - 5} more properties
              </p>
            )}
          </div>
        </EducationSection>
      )}

      {/* Related Property Sets */}
      {relatedPsets && relatedPsets.length > 0 && (
        <EducationSection
          title={`Property Sets (${relatedPsets.length})`}
          icon={<FileText className="w-3.5 h-3.5" />}
          isOpen={expandedSections.has('psets')}
          onToggle={() => toggleSection('psets')}
        >
          <div className="space-y-1">
            {relatedPsets.slice(0, 3).map((pset) => (
              <div key={pset.name} className="bg-muted/50 rounded p-1.5">
                <code className="text-[10px] font-mono text-primary">{pset.name}</code>
                <p className="text-[10px] text-muted-foreground mt-0.5">{pset.description}</p>
              </div>
            ))}
            {relatedPsets.length > 3 && (
              <p className="text-[10px] text-muted-foreground italic">
                + {relatedPsets.length - 3} more property sets
              </p>
            )}
          </div>
        </EducationSection>
      )}
    </motion.div>
  );
}

// Mini collapsible section for education content
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
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getPropertyDescription(definition: any, key: string): string | undefined {
  if (!definition) return undefined;
  const prop = definition.properties?.find((p: any) => p.name === key);
  return prop?.description;
}
