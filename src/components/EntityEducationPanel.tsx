import { useState } from 'react';
import { IFCEntity } from '@/types/ifc';
import { 
  getEntityDefinition, 
  getRelatedPropertySets, 
  formatInheritanceChain,
  IFCEntityDefinition,
  IFCPropertySetDefinition,
} from '@/data/ifc-schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  X, 
  ChevronDown, 
  ChevronRight, 
  ExternalLink, 
  Info, 
  BookOpen,
  GitBranch,
  List,
  FileText,
  HelpCircle,
  Lightbulb,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface EntityEducationPanelProps {
  entity: IFCEntity | null;
  onClose: () => void;
}

export function EntityEducationPanel({ entity, onClose }: EntityEducationPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview', 'properties', 'inheritance'])
  );

  if (!entity) return null;

  const definition = getEntityDefinition(entity.type);
  const relatedPsets = getRelatedPropertySets(entity.type);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const categoryColors: Record<string, string> = {
    spatial: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
    element: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
    relationship: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
    property: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
    resource: 'bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500/30',
    context: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30',
  };

  return (
    <TooltipProvider>
      <Card className="w-96 shadow-xl max-h-[calc(100vh-100px)] border-2">
        <CardHeader className="pb-3 flex flex-row items-start justify-between bg-muted/30">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-xs">
                {entity.id}
              </Badge>
              {definition && (
                <Badge className={categoryColors[definition.category] || 'bg-muted'}>
                  {definition.category}
                </Badge>
              )}
              {definition?.deprecatedIn && (
                <Badge variant="destructive" className="text-xs">
                  Deprecated in {definition.deprecatedIn}
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <span>{definition?.displayName || entity.type.replace('IFC', '')}</span>
              {definition && (
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-xs">{definition.description}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </CardTitle>
            <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {entity.type}
            </code>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <Separator />
        
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="p-4 space-y-3">
              
              {/* Overview Section */}
              <CollapsibleSection
                title="Overview"
                icon={<BookOpen className="w-4 h-4" />}
                isOpen={expandedSections.has('overview')}
                onToggle={() => toggleSection('overview')}
              >
                {definition ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {definition.description}
                    </p>
                    
                    {definition.usageNotes && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            {definition.usageNotes}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">
                        Since {definition.introducedIn}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={() => window.open(definition.docsUrl, '_blank')}
                      >
                        <ExternalLink className="w-3 h-3" />
                        BuildingSMART Docs
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <AlertCircle className="w-4 h-4 mt-0.5" />
                    <p className="text-sm">
                      No BuildingSMART documentation available for this entity type. 
                      It may be a custom or vendor-specific type.
                    </p>
                  </div>
                )}
              </CollapsibleSection>

              {/* Inheritance Hierarchy */}
              {definition && definition.inheritance.length > 0 && (
                <CollapsibleSection
                  title="Inheritance Hierarchy"
                  icon={<GitBranch className="w-4 h-4" />}
                  isOpen={expandedSections.has('inheritance')}
                  onToggle={() => toggleSection('inheritance')}
                >
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-2">
                      This entity inherits from these parent types:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {[entity.type, ...definition.inheritance].map((type, index) => (
                        <div key={type} className="flex items-center">
                          <Badge 
                            variant={index === 0 ? 'default' : 'outline'} 
                            className={`text-xs font-mono ${index === 0 ? '' : 'opacity-70'}`}
                          >
                            {type}
                          </Badge>
                          {index < definition.inheritance.length && (
                            <ChevronRight className="w-3 h-3 mx-0.5 text-muted-foreground" />
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground italic mt-2">
                      Child entities inherit properties from all parent types in the chain.
                    </p>
                  </div>
                </CollapsibleSection>
              )}

              {/* Entity Attributes */}
              <CollapsibleSection
                title="Actual Values"
                icon={<FileText className="w-4 h-4" />}
                isOpen={expandedSections.has('values')}
                onToggle={() => toggleSection('values')}
                badge={Object.keys(entity.attributes).length}
              >
                <div className="space-y-2">
                  {entity.name && (
                    <AttributeRow
                      name="Name"
                      value={entity.name}
                      description="Human-readable identifier for this instance"
                    />
                  )}
                  {Object.entries(entity.attributes)
                    .filter(([key]) => !key.startsWith('attr'))
                    .slice(0, 10)
                    .map(([key, value]) => (
                      <AttributeRow
                        key={key}
                        name={key}
                        value={formatValue(value)}
                        description={getPropertyDescription(definition, key)}
                      />
                    ))}
                  {Object.keys(entity.attributes).filter(k => !k.startsWith('attr')).length > 10 && (
                    <p className="text-xs text-muted-foreground italic">
                      + {Object.keys(entity.attributes).filter(k => !k.startsWith('attr')).length - 10} more attributes
                    </p>
                  )}
                </div>
              </CollapsibleSection>

              {/* Standard Properties (from definition) */}
              {definition && definition.properties.length > 0 && (
                <CollapsibleSection
                  title="Standard Properties"
                  icon={<List className="w-4 h-4" />}
                  isOpen={expandedSections.has('properties')}
                  onToggle={() => toggleSection('properties')}
                  badge={definition.properties.length}
                >
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-2">
                      Properties defined by BuildingSMART for {entity.type}:
                    </p>
                    {definition.properties.map((prop) => (
                      <PropertyDefinitionRow
                        key={prop.name}
                        property={prop}
                        actualValue={entity.attributes[prop.name]}
                      />
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Related Property Sets */}
              {relatedPsets.length > 0 && (
                <CollapsibleSection
                  title="Related Property Sets"
                  icon={<List className="w-4 h-4" />}
                  isOpen={expandedSections.has('psets')}
                  onToggle={() => toggleSection('psets')}
                  badge={relatedPsets.length}
                >
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Standard property sets that can be attached to this entity:
                    </p>
                    {relatedPsets.map((pset) => (
                      <PropertySetCard key={pset.name} pset={pset} />
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Examples */}
              {definition?.examples && definition.examples.length > 0 && (
                <CollapsibleSection
                  title="Common Examples"
                  icon={<HelpCircle className="w-4 h-4" />}
                  isOpen={expandedSections.has('examples')}
                  onToggle={() => toggleSection('examples')}
                >
                  <ul className="list-disc list-inside space-y-1">
                    {definition.examples.map((example, i) => (
                      <li key={i} className="text-sm text-muted-foreground">{example}</li>
                    ))}
                  </ul>
                </CollapsibleSection>
              )}

            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

// Collapsible Section Component
interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  badge?: number;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon, isOpen, onToggle, badge, children }: CollapsibleSectionProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
          {badge !== undefined && (
            <Badge variant="secondary" className="text-xs h-5 px-1.5">
              {badge}
            </Badge>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pl-6 pr-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Attribute Row Component
interface AttributeRowProps {
  name: string;
  value: string;
  description?: string;
}

function AttributeRow({ name, value, description }: AttributeRowProps) {
  return (
    <div className="bg-muted/30 rounded-lg p-2 border border-border/50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium">{name}</span>
          {description && (
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3 h-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">{description}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <code className="text-xs text-foreground break-all block mt-1">
        {value || '(not set)'}
      </code>
    </div>
  );
}

// Property Definition Row
interface PropertyDefinitionRowProps {
  property: {
    name: string;
    description: string;
    dataType: string;
    isRequired: boolean;
    example?: string;
  };
  actualValue?: unknown;
}

function PropertyDefinitionRow({ property, actualValue }: PropertyDefinitionRowProps) {
  const hasValue = actualValue !== undefined && actualValue !== null;
  
  return (
    <div className={`rounded-lg p-2 border ${hasValue ? 'bg-green-500/5 border-green-500/20' : 'bg-muted/30 border-border/50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1">
          {hasValue ? (
            <CheckCircle className="w-3 h-3 text-green-500" />
          ) : (
            <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />
          )}
          <span className="text-xs font-medium">{property.name}</span>
          {property.isRequired && (
            <Badge variant="outline" className="text-[10px] h-4 px-1 text-amber-600 border-amber-500/30">
              Required
            </Badge>
          )}
        </div>
        <code className="text-[10px] text-muted-foreground">{property.dataType}</code>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">{property.description}</p>
      {hasValue && (
        <div className="mt-1 pt-1 border-t border-border/50">
          <code className="text-xs text-green-700 dark:text-green-300">
            = {formatValue(actualValue)}
          </code>
        </div>
      )}
      {!hasValue && property.example && (
        <div className="mt-1">
          <span className="text-[10px] text-muted-foreground">Example: </span>
          <code className="text-[10px] text-muted-foreground italic">{property.example}</code>
        </div>
      )}
    </div>
  );
}

// Property Set Card
interface PropertySetCardProps {
  pset: IFCPropertySetDefinition;
}

function PropertySetCard({ pset }: PropertySetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono text-primary">{pset.name}</code>
          <Badge variant="secondary" className="text-[10px] h-4">
            {pset.properties.length} props
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isExpanded && (
        <div className="p-2 pt-0 space-y-1 border-t bg-muted/20">
          <p className="text-[11px] text-muted-foreground mb-2">{pset.description}</p>
          {pset.properties.map((prop) => (
            <div key={prop.name} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-1">
                <span className="text-xs">{prop.name}</span>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3 h-3 text-muted-foreground" />
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
              <code className="text-[10px] text-muted-foreground">{prop.dataType}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper functions
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getPropertyDescription(definition: IFCEntityDefinition | undefined, key: string): string | undefined {
  if (!definition) return undefined;
  const prop = definition.properties.find(p => p.name === key);
  return prop?.description;
}
