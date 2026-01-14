import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { ValidationResult } from '@/lib/ifcValidatorEnhanced';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ValidationReportProps {
  result: ValidationResult;
}

export function ValidationReport({ result }: ValidationReportProps) {
  const getStatusColor = () => {
    if (result.valid) return 'text-green-500';
    if (result.stats.totalErrors > 0) return 'text-red-500';
    return 'text-yellow-500';
  };

  const getStatusIcon = () => {
    if (result.valid) return <CheckCircle className="w-6 h-6 text-green-500" />;
    if (result.stats.totalErrors > 0) return <AlertCircle className="w-6 h-6 text-red-500" />;
    return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
  };

  return (
    <div className="w-full space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <CardTitle className="text-lg">
                  {result.valid ? 'Validation Passed' : 'Validation Failed'}
                </CardTitle>
                <CardDescription>
                  Checked {result.stats.checkedEntities} entities and{' '}
                  {result.stats.checkedRelationships} relationships
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Errors</p>
              <p className="text-2xl font-bold text-red-500">{result.stats.totalErrors}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Warnings</p>
              <p className="text-2xl font-bold text-yellow-500">{result.stats.totalWarnings}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Info</p>
              <p className="text-2xl font-bold text-blue-500">{result.stats.totalInfo}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <Tabs defaultValue="errors" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="errors" className="gap-2">
            <AlertCircle className="w-4 h-4" />
            Errors ({result.stats.totalErrors})
          </TabsTrigger>
          <TabsTrigger value="warnings" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            Warnings ({result.stats.totalWarnings})
          </TabsTrigger>
          <TabsTrigger value="info" className="gap-2">
            <Info className="w-4 h-4" />
            Info ({result.stats.totalInfo})
          </TabsTrigger>
        </TabsList>

        {/* Errors Tab */}
        <TabsContent value="errors" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {result.errors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500 opacity-50" />
                  <p>No validation errors found</p>
                </div>
              ) : (
                <ScrollArea className="h-96 pr-4">
                  <div className="space-y-2">
                    {result.errors.map((error, idx) => (
                      <div key={idx} className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-red-600 border-red-600">
                                {error.type}
                              </Badge>
                              {error.entityType && (
                                <span className="text-xs text-muted-foreground">{error.entityType}</span>
                              )}
                            </div>
                            <p className="text-sm mt-1">{error.message}</p>
                            {error.entityId && (
                              <p className="text-xs text-muted-foreground mt-1">ID: {error.entityId}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Warnings Tab */}
        <TabsContent value="warnings" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {result.warnings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500 opacity-50" />
                  <p>No warnings</p>
                </div>
              ) : (
                <ScrollArea className="h-96 pr-4">
                  <div className="space-y-2">
                    {result.warnings.map((warning, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                {warning.type}
                              </Badge>
                              {warning.entityType && (
                                <span className="text-xs text-muted-foreground">{warning.entityType}</span>
                              )}
                            </div>
                            <p className="text-sm mt-1">{warning.message}</p>
                            {warning.entityId && (
                              <p className="text-xs text-muted-foreground mt-1">ID: {warning.entityId}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {result.info.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Info className="w-12 h-12 mx-auto mb-2 text-blue-500 opacity-50" />
                  <p>No additional information</p>
                </div>
              ) : (
                <ScrollArea className="h-96 pr-4">
                  <div className="space-y-2">
                    {result.info.map((item, idx) => (
                      <div key={idx} className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-blue-600 border-blue-600">
                                {item.type}
                              </Badge>
                            </div>
                            <p className="text-sm mt-1">{item.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
