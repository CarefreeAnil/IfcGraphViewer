import { AlertCircle, CheckCircle, Info, AlertTriangle, FileText, Layout, Database, BookOpen, ExternalLink, Shield, HelpCircle, Briefcase } from 'lucide-react';
import { ValidationResult, ValidationError } from '@/lib/ifcValidatorEnhanced';
import { GraphNode } from '@/types/graph';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { glossaryHighlight } from '@/features/educational/components/GlossaryTerm';
import { BuildingSmartResults } from '../../bSValidate/src/components/BuildingSmartResults';
import { SchemaResults } from '../../bSValidate/src/components/SchemaResults';

interface ValidationReportProps {
  result: ValidationResult;
  nodes?: GraphNode[];
  onEntityClick?: (entityId: string) => void;
}

const EDUCATIONAL_CONTEXT: Record<string, string> = {
  'HDR001': 'The Header is the "ID Card" of your digital file. It must exist so software knows who created the file and when.',
  'HDR002': 'Giving your file a proper name in the header helps tracking versions and history.',
  'HDR003': 'Dates must be in ISO 8601 format (e.g., 2023-10-27T10:00:00) to be readable by computers worldwide.',
  'HDR007': 'The Schema Identifier (e.g., IFC2X3, IFC4) is like telling someone which language you are speaking. Without it, the "grammar" of your file is unknown.',
  'HDR008': 'Model View Definitions (MVD) define the purpose of a file (e.g., Coordination vs. Structural Analysis). Specifying this helps others know how to use your model.',
  'HDR009': 'Implementation Level 2;1 is the standard structure for IFC files. Deviating from this often means the file was not exported correctly.',
  'HDR010': 'Using a standard Schema version ensures your file works in other software.',
  'HDR011': 'ViewDefinition must be properly formatted with valid MVD names in brackets. Malformed patterns like "[," or "[]" indicate the export software did not specify which MVD was used.',
  'VAL002': 'Required properties are non-negotiable data points defined by the IFC standard. Missing these is like submitting a form with blank mandatory fields.',
  'VAL002C': 'OwnerHistory tracks authorship metadata (who created/modified the entity and when). Required in IFC2x3, but became optional in IFC4+. Many modern IFC files omit it for brevity, and most software handles this gracefully.',
  'VAL003': 'Data Type Mismatch means putting text in a number field (or vice versa). This confuses calculation and analysis tools.',
  'VAL004': 'A Broken Reference is a link pointing to nothing. It\'s like a "Page Not Found" error in your model.',
  'VAL005': 'A Broken Reference is a link pointing to nothing. It\'s like a "Page Not Found" error in your model.',
  'VAL007': 'Circular References create infinite loops, which can crash software trying to read your model.',
  'SYN001': 'The file format must be ISO-10303-21 (STEP). This error means the file structure itself is corrupt.',
  'SYN004': 'Every line in an IFC file must end with a semicolon (;). Missing one breaks the parser.',
  'SYN005': 'This entity failed to parse completely. This usually happens when you use text without quotes (like UK instead of \'UK\') or skip commas. The parser simply skipped this line.',
};

export function ValidationReport({ result, nodes, onEntityClick }: ValidationReportProps) {
  // DEBUG: Log result structure and task types
  console.log('\n=== VALIDATION REPORT DEBUG ===');
  console.log('Total errors:', result.errors.length);
  console.log('Total warnings:', result.warnings.length);
  console.log('Total info:', result.info.length);

  const allResults = [...result.errors, ...result.warnings, ...result.info];
  const taskTypeCounts: Record<string, number> = {};
  allResults.forEach((e: any) => {
    const taskType = e.taskType || 'NONE';
    taskTypeCounts[taskType] = (taskTypeCounts[taskType] || 0) + 1;
  });
  console.log('Task type distribution in results:', taskTypeCounts);

  const normativeResults = allResults.filter((e: any) =>
    ['NORMATIVE_IA', 'NORMATIVE_IP'].includes(e.taskType)
  );
  const industryResults = allResults.filter((e: any) =>
    e.taskType === 'INDUSTRY'
  );
  console.log('Normative results count:', normativeResults.length);
  console.log('Industry results count:', industryResults.length);
  console.log('Sample normative:', normativeResults.slice(0, 2).map((e: any) => ({
    code: e.code,
    taskType: e.taskType,
    feature: e.feature
  })));
  console.log('Sample industry:', industryResults.slice(0, 2).map((e: any) => ({
    code: e.code,
    taskType: e.taskType,
    feature: e.feature
  })));
  console.log('===============================\n');

  // Helper to format entity display
  const formatEntityDisplay = (entityId?: string, entityType?: string): string => {
    if (!entityId) return 'N/A';
    
    // If we have nodes, try to find the entity in the graph
    if (nodes) {
      const node = nodes.find(n => 
        n.id === entityId || 
        `#${n.expressId}` === entityId ||
        String(n.expressId) === entityId.replace('#', '')
      );
      
      if (node) {
        const globalId = node.properties?.GlobalId || node.properties?.globalId;
        const name = node.label || node.properties?.Name || node.properties?.name;
        
        // Format: IfcWall: GlobalId (or Name if no GlobalId)
        if (globalId && globalId !== '') {
          return `${node.ifcType}: ${globalId}`;
        } else if (name) {
          return `${node.ifcType}: ${name}`;
        } else {
          return `${node.ifcType}: ${entityId}`;
        }
      }
    }
    
    // Fallback: show entityType and ID if available
    if (entityType) {
      return `${entityType} ${entityId}`;
    }
    
    return entityId;
  };
  
  // Group schema errors by type to avoid list explosion
  const groupErrors = (errors: ValidationError[]) => {
    const groups: Record<string, ValidationError[]> = {};
    errors.forEach(err => {
      const key = `${err.code}-${err.entityType || 'General'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(err);
    });
    return Object.entries(groups).map(([key, items]) => ({
      key,
      title: items[0].message,
      type: items[0].type,
      code: items[0].code,
      count: items.length,
      example: items[0],
      items
    }));
  };

  const groupedSchemaErrors = groupErrors(result.schemaErrors);

  // Calculate category statuses
  const categoryStatuses = {
    syntax: result.syntaxErrors.length === 0,
    schema: result.schemaErrors.length === 0,
    normative: [...result.errors, ...result.warnings, ...result.info].filter((e: any) =>
      ['NORMATIVE_IA', 'NORMATIVE_IP'].includes(e.taskType) && e.severity === 'error'
    ).length === 0,
    industry: [...result.errors, ...result.warnings, ...result.info].filter((e: any) =>
      e.taskType === 'INDUSTRY' && e.severity === 'error'
    ).length === 0,
  };

  // Check if entity context is available (only relevant for BuildingSmart results)
  const isBuildingSmartResult = result.schemaVersion === 'BuildingSMART API';
  const allErrors = [...result.errors, ...result.warnings, ...result.info];
  const errorsWithEntity = allErrors.filter(e => e.entityId || e.entityType).length;
  const hasLimitedEntityContext = isBuildingSmartResult && allErrors.length > 0 && errorsWithEntity < allErrors.length * 0.3;

  return (
    <div className="w-full space-y-6">
      {/* Result Classification Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* STEP Syntax */}
            <div className="flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Layout className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium">STEP Syntax</span>
                <HelpCircle className="w-3 h-3 text-muted-foreground" title="File structure validation (ISO-10303-21)" />
              </div>
              <div>
                {categoryStatuses.syntax ? (
                  <CheckCircle className="w-8 h-8 text-green-500" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-red-500" />
                )}
              </div>
            </div>

            {/* IFC Schema */}
            <div className="flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium">IFC Schema</span>
                <HelpCircle className="w-3 h-3 text-muted-foreground" title="Entity rules and data types" />
              </div>
              <div>
                {categoryStatuses.schema ? (
                  <CheckCircle className="w-8 h-8 text-green-500" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-red-500" />
                )}
              </div>
            </div>

            {/* Normative IFC Rules */}
            <div className="flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">Normative Rules</span>
                <HelpCircle className="w-3 h-3 text-muted-foreground" title="buildingSMART Gherkin rules" />
              </div>
              <div>
                {categoryStatuses.normative ? (
                  <CheckCircle className="w-8 h-8 text-green-500" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-red-500" />
                )}
              </div>
            </div>

            {/* Industry Practices */}
            <div className="flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium">Industry Practices</span>
                <HelpCircle className="w-3 h-3 text-muted-foreground" title="Additional best practices" />
              </div>
              <div>
                {categoryStatuses.industry ? (
                  <CheckCircle className="w-8 h-8 text-green-500" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-yellow-500" />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entity Context Warning */}
      {hasLimitedEntityContext && (
        <Card className="border-l-4 border-l-blue-500 bg-blue-50/50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 mb-1">Limited Entity Context Available</p>
                <p className="text-blue-700">
                  BuildingSmart validation results do not include entity references for some issues. 
                  You can still see the validation rules that were violated and their details, but navigation 
                  to specific entities may not be available for all items.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categorized Tabs */}
      <Tabs defaultValue="header" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 lg:w-[850px]">
          <TabsTrigger value="header" className="flex gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Header</span>
          </TabsTrigger>
          <TabsTrigger value="syntax" className="flex gap-2">
            <Layout className="w-4 h-4" />
            <span className="hidden sm:inline">Syntax</span>
          </TabsTrigger>
          <TabsTrigger value="schema" className="flex gap-2">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Schema</span>
          </TabsTrigger>
          {isBuildingSmartResult && (
            <>
              <TabsTrigger value="normative" className="flex gap-2">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Normative Rules</span>
                <span className="sm:hidden">Rules</span>
              </TabsTrigger>
              <TabsTrigger value="industry" className="flex gap-2">
                <Briefcase className="w-4 h-4" />
                <span className="hidden sm:inline">Industry Practices</span>
                <span className="sm:hidden">Industry</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* BUILDINGSMART NORMATIVE RULES TAB */}
        {isBuildingSmartResult && (
          <TabsContent value="normative" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                Normative IFC Rules
              </h3>
              <Badge variant={(() => {
                const normativeErrors = [...result.errors, ...result.warnings, ...result.info].filter((e: any) =>
                  ['NORMATIVE_IA', 'NORMATIVE_IP'].includes(e.taskType)
                );
                return normativeErrors.filter(e => e.severity === 'error').length === 0 ? "outline" : "destructive";
              })()}>
                {(() => {
                  const normativeErrors = [...result.errors, ...result.warnings, ...result.info].filter((e: any) =>
                    ['NORMATIVE_IA', 'NORMATIVE_IP'].includes(e.taskType) && e.severity === 'error'
                  );
                  return normativeErrors.length;
                })()} Errors
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Validation against buildingSMART's official Gherkin rules (Implementer Agreements and Informal Propositions).
            </p>

            <BuildingSmartResults
              errors={result.errors.filter((e: any) => ['NORMATIVE_IA', 'NORMATIVE_IP'].includes(e.taskType))}
              warnings={result.warnings.filter((e: any) => ['NORMATIVE_IA', 'NORMATIVE_IP'].includes(e.taskType))}
              info={result.info.filter((e: any) => ['NORMATIVE_IA', 'NORMATIVE_IP'].includes(e.taskType))}
              nodes={nodes}
              onEntityClick={onEntityClick}
            />
          </TabsContent>
        )}

        {/* INDUSTRY PRACTICES TAB */}
        {isBuildingSmartResult && (
          <TabsContent value="industry" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-purple-600" />
                Industry Practices
              </h3>
              <Badge variant={(() => {
                const industryErrors = [...result.errors, ...result.warnings, ...result.info].filter((e: any) =>
                  e.taskType === 'INDUSTRY'
                );
                return industryErrors.filter(e => e.severity === 'error').length === 0 ? "outline" : "default";
              })()}>
                {(() => {
                  const industryErrors = [...result.errors, ...result.warnings, ...result.info].filter((e: any) =>
                    e.taskType === 'INDUSTRY' && e.severity === 'error'
                  );
                  return industryErrors.length;
                })()} Errors
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Industry best practices and recommendations for IFC implementation beyond normative requirements.
            </p>

            <BuildingSmartResults
              errors={result.errors.filter((e: any) => e.taskType === 'INDUSTRY')}
              warnings={result.warnings.filter((e: any) => e.taskType === 'INDUSTRY')}
              info={result.info.filter((e: any) => e.taskType === 'INDUSTRY')}
              nodes={nodes}
              onEntityClick={onEntityClick}
            />
          </TabsContent>
        )}

        {/* 1. HEADER TAB */}
        <TabsContent value="header" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              File Header Policy
            </h3>
            <Badge variant={result.headerErrors.length === 0 ? "outline" : "destructive"}>
                {result.headerErrors.length} Issues
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            The header contains metadata about the file's authors, schema, and history. 
            BuildingSMART has strict policies for this section to ensure traceability.
          </p>
          
          {result.headerErrors.length === 0 ? (
             <div className="p-8 border rounded-lg bg-green-50 flex flex-col items-center text-center">
                 <CheckCircle className="w-10 h-10 text-green-500 mb-2" />
                 <h4 className="font-medium text-green-800">Header Compliant</h4>
                 <p className="text-green-600 text-sm">Your file header meets all BuildingSMART requirements.</p>
             </div>
          ) : (
             <div className="space-y-3">
               {result.headerErrors.map((err, i) => (
                 <ValidationCard key={i} error={err} showContext={true} />
               ))}
             </div>
          )}
        </TabsContent>

        {/* 2. SYNTAX TAB */}
        <TabsContent value="syntax" className="mt-4 space-y-4">
           <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Layout className="w-5 h-5 text-purple-500" />
              STEP File Syntax
            </h3>
            <Badge variant={result.syntaxErrors.length === 0 ? "outline" : "destructive"}>
                {result.syntaxErrors.length} Issues
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
             Checks if the file follows the ISO-10303-21 text structure (semicolons, DATA block, etc.).
          </p>
          
          {result.syntaxErrors.length === 0 ? (
             <div className="p-8 border rounded-lg bg-green-50 flex flex-col items-center text-center">
                 <CheckCircle className="w-10 h-10 text-green-500 mb-2" />
                 <h4 className="font-medium text-green-800">Syntax Valid</h4>
                 <p className="text-green-600 text-sm">The file structure is intact and parsable.</p>
             </div>
          ) : (
             <div className="space-y-3">
               {result.syntaxErrors.map((err, i) => (
                 <ValidationCard key={i} error={err} showContext={true} />
               ))}
             </div>
          )}
        </TabsContent>

        {/* 3. SCHEMA TAB (Grouped) */}
        <TabsContent value="schema" className="mt-4 space-y-4">
           <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Database className="w-5 h-5 text-orange-500" />
              IFC Schema Compliance
            </h3>
            <Badge variant={result.schemaErrors.length === 0 ? "outline" : "destructive"}>
                {result.schemaErrors.length} Issues
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
             Ensures entities have required properties and valid data types according to the IFC specification.
          </p>

          {/* Show BuildingSMART Schema Results if available */}
          {isBuildingSmartResult && result.schemaErrors.length > 0 ? (
            <SchemaResults
              errors={result.schemaErrors}
              warnings={[]}
              info={[]}
              nodes={nodes}
              onEntityClick={onEntityClick}
            />
          ) : groupedSchemaErrors.length === 0 ? (
             <div className="p-8 border rounded-lg bg-green-50 flex flex-col items-center text-center">
                 <CheckCircle className="w-10 h-10 text-green-500 mb-2" />
                 <h4 className="font-medium text-green-800">Schema Valid</h4>
                 <p className="text-green-600 text-sm">All entities conform to the declared schema schema.</p>
             </div>
          ) : (
            <Accordion type="single" collapsible className="w-full space-y-2">
              {groupedSchemaErrors.map((group, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border rounded-lg px-2">
                  <AccordionTrigger className="hover:no-underline hover:bg-muted/50 px-2 rounded">
                     <div className="flex items-center gap-3 text-left">
                        {group.example.severity === 'error' ? (
                           <AlertCircle className="w-4 h-4 text-red-500" />
                        ) : (
                           <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className="font-medium">{group.title}</span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                           {group.count} {group.count === 1 ? 'Object' : 'Objects'}
                        </Badge>
                     </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-2 pt-2 pb-4">
                     <div className="space-y-4">
                        {/* Educational Content for this group */}
                        {EDUCATIONAL_CONTEXT[group.code] && (
                            <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm flex gap-2 items-start">
                                <BookOpen className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div>
                                    <span className="font-bold block mb-1">Why this matters:</span>
                                    {glossaryHighlight(EDUCATIONAL_CONTEXT[group.code])}
                                </div>
                            </div>
                        )}
                        
                        <div className="border rounded-md overflow-hidden">
                            <div className="bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                                Affected Entities
                            </div>
                            <ScrollArea className="h-40">
                                {group.items.map((item, idx) => (
                                    <div key={idx} className="p-2 border-b last:border-0 text-sm hover:bg-muted/50 transition-colors">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                                <div className="font-mono text-xs text-muted-foreground mb-1">
                                                    {formatEntityDisplay(item.entityId, item.entityType)}
                                                </div>
                                                {item.propertyName && (
                                                    <div className="text-xs font-medium text-foreground mb-1">
                                                        Property: {item.propertyName}
                                                    </div>
                                                )}
                                                {item.suggestion && (
                                                    <div className="text-xs text-muted-foreground italic">
                                                        {item.suggestion}
                                                    </div>
                                                )}
                                            </div>
                                            {onEntityClick && item.entityId && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 px-2 gap-1 flex-shrink-0"
                                                    onClick={() => onEntityClick(item.entityId!)}
                                                    title="Navigate to entity"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    <span className="text-xs">View</span>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </ScrollArea>
                        </div>
                     </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

        </TabsContent>

      </Tabs>
    </div>
  );
}

function ValidationCard({ error, showContext = false }: { error: ValidationError, showContext?: boolean }) {
    const isError = error.severity === 'error';
    const isWarning = error.severity === 'warning';

    return (
        <div className={`p-3 border rounded-lg ${
            isError ? 'bg-red-50 border-red-200' :
            isWarning ? 'bg-yellow-50 border-yellow-200' :
            'bg-blue-50 border-blue-200'
        }`}>
            <div className="flex items-start gap-3">
                {isError ? <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" /> :
                 isWarning ? <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" /> :
                 <Info className="w-5 h-5 text-blue-500 mt-0.5" />}

                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-sm font-bold ${
                            isError ? 'text-red-800' :
                            isWarning ? 'text-yellow-800' :
                            'text-blue-800'
                        }`}>
                            {error.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-white/50 rounded border">
                            {error.code}
                        </span>
                        {error.functionalPart && (
                            <span
                                className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded border border-blue-300 font-medium"
                                title={error.functionalPartName || `Functional Part: ${error.functionalPart}`}
                            >
                                {error.functionalPart}
                            </span>
                        )}
                    </div>
                    <p className={`text-sm ${
                        isError ? 'text-red-700' :
                        isWarning ? 'text-yellow-700' :
                        'text-blue-700'
                    }`}>
                        {error.message}
                    </p>
                    {error.suggestion && (
                        <p className="text-xs mt-2 text-muted-foreground border-t pt-1 border-black/5">
                            <span className="font-semibold">Fix: </span> {error.suggestion}
                        </p>
                    )}

                    {showContext && EDUCATIONAL_CONTEXT[error.code] && (
                        <div className="mt-2 pt-2 text-xs flex gap-1.5 items-start text-muted-foreground border-t border-black/5">
                            <BookOpen className="w-3 h-3 mt-0.5" />
                            <span>{glossaryHighlight(EDUCATIONAL_CONTEXT[error.code])}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
