import { AlertCircle, CheckCircle, Info, AlertTriangle, FileText, Layout, Database, BookOpen, ExternalLink } from 'lucide-react';
import { ValidationResult, ValidationError } from '@/lib/ifcValidatorEnhanced';
import { GraphNode } from '@/types/graph';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

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
  'VAL002': 'Required properties are non-negotiable data points defined by the IFC standard. Missing these is like submitting a form with blank mandatory fields.',
  'VAL003': 'Data Type Mismatch means putting text in a number field (or vice versa). This confuses calculation and analysis tools.',
  'VAL004': 'A Broken Reference is a link pointing to nothing. It\'s like a "Page Not Found" error in your model.',
  'VAL005': 'A Broken Reference is a link pointing to nothing. It\'s like a "Page Not Found" error in your model.',
  'VAL007': 'Circular References create infinite loops, which can crash software trying to read your model.',
  'SYN001': 'The file format must be ISO-10303-21 (STEP). This error means the file structure itself is corrupt.',
  'SYN004': 'Every line in an IFC file must end with a semicolon (;). Missing one breaks the parser.',
  'SYN005': 'This entity failed to parse completely. This usually happens when you use text without quotes (like UK instead of \'UK\') or skip commas. The parser simply skipped this line.',
};

export function ValidationReport({ result, nodes, onEntityClick }: ValidationReportProps) {
  // Helper to format entity display
  const formatEntityDisplay = (entityId: string): string => {
    if (!nodes) return entityId;
    
    const node = nodes.find(n => n.id === entityId);
    if (!node) return entityId;
    
    const globalId = node.properties?.GlobalId || node.properties?.globalId;
    const name = node.label || node.properties?.Name || node.properties?.name;
    
    // Format: IfcWall: GlobalId (or Name if no GlobalId)
    if (globalId && globalId !== '') {
      return `${node.ifcType}: ${globalId}`;
    } else if (name) {
      return `${node.ifcType}: ${name}`;
    } else {
      return `${node.ifcType}: #${node.properties?._expressID || entityId}`;
    }
  };
  
  // Calculate a "Health Score" for the student
  const calculateScore = () => {
    let score = 100;
    score -= (result.stats.totalErrors * 5); // Errors penalize heavily
    score -= (result.stats.totalWarnings * 2); // Warnings penalize lightly
    return Math.max(0, Math.round(score));
  };
  
  const healthScore = calculateScore();
  
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Needs Improvement';
    return 'Critical Issues';
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

  return (
    <div className="w-full space-y-6">
      {/* Student Health Score Card */}
      <Card className="border-t-4 border-t-primary">
        <CardHeader className="pb-2">
          <CardTitle>Model Health Score</CardTitle>
          <CardDescription>
            An overall grade for your IFC model based on validation rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-2">
            <span className="text-4xl font-bold">{healthScore}/100</span>
            <span className={`px-2 py-1 rounded text-sm font-medium ${
                healthScore >= 90 ? 'bg-green-100 text-green-800' : 
                healthScore >= 70 ? 'bg-yellow-100 text-yellow-800' : 
                'bg-red-100 text-red-800'
            }`}>
                {getScoreLabel(healthScore)}
            </span>
          </div>
          <Progress value={healthScore} className={`h-3 [&>div]:${getScoreColor(healthScore)}`} />
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
             <div className="p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{result.stats.totalErrors}</div>
                <div className="text-xs text-red-800 font-medium uppercase tracking-wide">Errors</div>
             </div>
             <div className="p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{result.stats.totalWarnings}</div>
                <div className="text-xs text-yellow-800 font-medium uppercase tracking-wide">Warnings</div>
             </div>
             <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{result.stats.totalInfo}</div>
                <div className="text-xs text-blue-800 font-medium uppercase tracking-wide">Suggestions</div>
             </div>
          </div>
        </CardContent>
      </Card>

      {/* Categorized Tabs */}
      <Tabs defaultValue="header" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
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
          <TabsTrigger value="legacy" className="flex gap-2">
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">All</span>
          </TabsTrigger>
        </TabsList>

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

          {groupedSchemaErrors.length === 0 ? (
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
                                    {EDUCATIONAL_CONTEXT[group.code]}
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
                                                    {formatEntityDisplay(item.entityId || 'N/A')}
                                                </div>
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

        {/* 4. LEGACY/ALL TAB */}
        <TabsContent value="legacy">
            <Card>
                <CardHeader>
                    <CardTitle>Raw Validation Log</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-96 pr-4">
                        <div className="space-y-2">
                            {result.errors.map((error, idx) => <ValidationCard key={`err-${idx}`} error={error} />)}
                            {result.warnings.map((error, idx) => <ValidationCard key={`warn-${idx}`} error={error} />)}
                            {result.info.map((error, idx) => <ValidationCard key={`info-${idx}`} error={error} />)}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
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
                    <div className="flex items-center gap-2 mb-1">
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
                            <span>{EDUCATIONAL_CONTEXT[error.code]}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
