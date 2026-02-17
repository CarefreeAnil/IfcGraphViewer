import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertCircle, Zap, Download, FileJson, FileText, Sheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/Header';
import { ValidationReport } from '@/components/ValidationReport';
import { validateIFCData } from '@/lib/ifcValidatorEnhanced';
import { ParsedIFCData } from '@/types/graph';
import { toast } from 'sonner';
import { submitValidation, pollValidationResults, BuildingSmartApiError, cancelValidation } from '../../bSValidate/src/services/buildingsmartApi';
import { mapBuildingSmartToValidationResult } from '../../bSValidate/src/services/buildingsmartMapper';
import { exportToJSON, exportToCSV, exportToText, getDefaultExportFilename } from '../../bSValidate/src/lib/exportValidation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ValidatorType = 'local' | 'buildingsmart' | null;

const Validation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedValidator, setSelectedValidator] = useState<ValidatorType>(null);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationComplete, setValidationComplete] = useState(false);
  const [bsValidationStatus, setBsValidationStatus] = useState<string>('');
  const [bsJobId, setBsJobId] = useState<string | null>(null);

  // Get parsed data from location state (passed from Index page)
  const parsedData = (location.state?.parsedData as ParsedIFCData) || null;
  const ifcFileBufferRef = useRef<ArrayBuffer | undefined>(
    location.state?.ifcFileBuffer as ArrayBuffer | undefined
  );
  const ifcFileNameRef = useRef<string>(
    location.state?.fileName || parsedData?.metadata?.fileName || 'model.ifc'
  );

  // Redirect to Index if no data or if file was unloaded
  useEffect(() => {
    const fileUnloaded = sessionStorage.getItem('ifcFileUnloaded') === 'true';
    if (!parsedData || fileUnloaded) {
      console.log('[Validation] No parsed data or file unloaded, redirecting to Index');
      navigate('/', { replace: true });
    }
  }, [parsedData, navigate]);

  // Restore validation results from navigation state if available
  useEffect(() => {
    const state = location.state as any;
    if (state?.validationResults) {
      console.log('[Validation] Restoring validation results from navigation state');
      setValidationResults(state.validationResults);
      setValidationComplete(true);
      if (state.selectedValidator) {
        setSelectedValidator(state.selectedValidator);
      }
    }
  }, [location.state]);

  // ============================================================================
  // DISABLED - Local Validation (Work in Progress)
  // ============================================================================
  // Local validation is currently disabled and needs refactoring.
  // Use buildingSMART API validation instead for now.
  // This function is preserved for future development.
  // ============================================================================
  const handleLocalValidator = async () => {
    console.warn('[Validation] Local validation is currently disabled (WIP)');
    toast.error('Local Validation Disabled', {
      description: 'Local validation needs work. Please use buildingSMART API validation.',
      duration: 5000,
    });
    return;

    /* DISABLED CODE - Preserved for future work
    if (!parsedData) {
      console.error('[Validation] No parsed data available');
      toast.error('No file loaded', {
        description: 'Please load an IFC file first',
      });
      return;
    }

    // Prevent concurrent validation
    if (isValidating) {
      console.log('Validation already in progress, ignoring request');
      return;
    }

    console.log('[Validation] Starting local validation...');
    console.log('[Validation] Parsed data:', {
      hasAllEntities: !!parsedData.allEntities,
      hasGraphNodes: !!parsedData.graphData?.nodes,
      nodeCount: parsedData.allEntities?.length || parsedData.graphData?.nodes?.length || 0,
      edgeCount: parsedData.graphData?.edges?.length || 0,
      hasHeader: !!parsedData.metadata?.ifcHeader,
      hasRawLines: !!parsedData.rawData?.rawStepLines,
    });

    setSelectedValidator('local');
    setIsValidating(true);
    setValidationComplete(false);

    try {
      // Run local validation with correct parameters
      console.log('[Validation] Calling validateIFCData...');
      const results = await validateIFCData(
        parsedData.allEntities || parsedData.graphData.nodes,
        parsedData.graphData.edges,
        parsedData.metadata?.ifcHeader,
        [],
        parsedData.rawData?.rawStepLines
      );

      console.log('[Validation] Validation complete!', {
        valid: results.valid,
        errors: results.stats.totalErrors,
        warnings: results.stats.totalWarnings,
        info: results.stats.totalInfo,
      });

      setValidationResults(results);
      setValidationComplete(true);

      // Update parsedData with validation results for persistence
      if (parsedData) {
        parsedData.validation = results;
      }

      toast.success('Local validation complete', {
        description: `Found ${results.stats.totalErrors} errors and ${results.stats.totalWarnings} warnings`,
      });

    } catch (error) {
      console.error('[Validation] Validation error:', error);
      console.error('[Validation] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

      const errorMessage = error instanceof Error ? error.message : String(error);

      setValidationResults({
        status: 'error',
        message: 'Validation failed: ' + errorMessage,
      });
      setValidationComplete(true);

      toast.error('Validation failed', {
        description: errorMessage,
      });
    } finally {
      setIsValidating(false);
      console.log('[Validation] Validation process finished');
    }
    */
  };

  const handleBuildingSmartValidator = async () => {
    // Prevent concurrent validation
    if (isValidating) {
      console.log('Validation already in progress, ignoring request');
      return;
    }

    // Check if we have the IFC file buffer
    const buffer = ifcFileBufferRef.current;
    if (!buffer) {
      setValidationResults({
        status: 'error',
        message: 'No IFC file loaded. Please load a file first.',
      });
      setValidationComplete(true);
      return;
    }

    setSelectedValidator('buildingsmart');
    setIsValidating(true);
    setValidationComplete(false);
    setBsValidationStatus('Submitting file...');
    setBsJobId(null);

    try {
      // Step 1: Submit the file
      const { jobId, status } = await submitValidation(
        buffer,
        ifcFileNameRef.current
      );

      console.log('BuildingSmart validation submitted:', { jobId, status });
      setBsJobId(jobId);
      setBsValidationStatus('Validation in progress...');

      // Step 2: Poll for results
      const results = await pollValidationResults(
        jobId,
        (status) => {
          // Update status during polling (case-insensitive)
          const statusLower = status?.toLowerCase();
          const statusMessages: Record<string, string> = {
            pending: 'Validation queued...',
            processing: 'Processing file...',
            completed: 'Validation complete',
            failed: 'Validation failed',
          };
          setBsValidationStatus(statusMessages[statusLower] || `Status: ${status}`);
        },
        3000, // Poll every 3 seconds
        120   // Max 120 attempts (6 minutes)
      );

      console.log('\n=== FRONTEND RECEIVED BUILDINGSMART RESULTS ===');
      console.log('Raw response:', results);
      console.log('Job ID:', results.jobId);
      console.log('Status:', results.status);
      console.log('Results count:', results.outcome?.results?.length || 0);
      console.log('Total from metadata:', results.outcome?.metadata?.result_set?.total || 0);

      // Log first few results for debugging structure
      if (results.outcome?.results && results.outcome.results.length > 0) {
        console.log('\n=== SAMPLE RESULTS (First 3) ===');
        results.outcome.results.slice(0, 3).forEach((result, idx) => {
          console.log(`Result ${idx + 1}:`, {
            public_id: result.public_id,
            feature: result.feature,
            severity: result.severity,
            outcome_code: result.outcome_code,
            instance_public_id: result.instance_public_id,
            expected: result.expected,
            observed: result.observed,
            allFields: Object.keys(result)
          });
        });
      }
      console.log('===============================================\n');

      // Step 3: Map results to ValidationResult format
      console.log('Mapping BuildingSmart results to ValidationResult format...');
      const mappedResults = mapBuildingSmartToValidationResult(results);

      console.log('\n=== MAPPED VALIDATION RESULTS ===');
      console.log('Valid:', mappedResults.valid);
      console.log('Total Errors:', mappedResults.stats.totalErrors);
      console.log('Total Warnings:', mappedResults.stats.totalWarnings);
      console.log('Total Info:', mappedResults.stats.totalInfo);
      console.log('Header Errors:', mappedResults.headerErrors.length);
      console.log('Syntax Errors:', mappedResults.syntaxErrors.length);
      console.log('Schema Errors:', mappedResults.schemaErrors.length);
      console.log('\nSample mapped error:', mappedResults.errors[0]);
      console.log('====================================\n');
      setValidationResults(mappedResults);
      setValidationComplete(true);
      setBsValidationStatus('');
      
      // Update parsedData with validation results for persistence
      if (parsedData) {
        parsedData.validation = mappedResults;
      }

      toast.success('Validation complete', {
        description: `Found ${mappedResults.stats.totalErrors} errors and ${mappedResults.stats.totalWarnings} warnings`,
      });

    } catch (error) {
      console.error('BuildingSmart validation error:', error);

      let errorMessage = 'Validation failed: ';
      if (error instanceof BuildingSmartApiError) {
        errorMessage += error.message;
        if (error.statusCode === 413) {
          errorMessage = 'File too large. Maximum size is 30MB.';
        }
      } else if (error instanceof Error) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Unknown error occurred';
      }

      setValidationResults({
        status: 'error',
        message: errorMessage,
      });
      setValidationComplete(true);
      setBsValidationStatus('');

      toast.error('Validation failed', {
        description: errorMessage,
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleEntityClick = (entityId: string) => {
    // Navigate back to the main viewer with the entity to highlight
    // Include validation results so they persist when coming back
    navigate('/', { 
      state: { 
        parsedData,
        ifcFileBuffer: ifcFileBufferRef.current,
        fileName: ifcFileNameRef.current,
        highlightedEntityId: entityId,
        validationResults,
        selectedValidator
      } 
    });
  };

  const handleCancelValidation = async () => {
    if (!bsJobId) return;

    try {
      await cancelValidation(bsJobId);
      toast.success('Validation cancelled');

      setIsValidating(false);
      setValidationComplete(false);
      setBsValidationStatus('');
      setBsJobId(null);
      setSelectedValidator(null);
    } catch (error) {
      console.error('Failed to cancel validation:', error);
      toast.error('Failed to cancel validation', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleExport = (format: 'json' | 'csv' | 'txt') => {
    if (!validationResults) return;

    const filename = getDefaultExportFilename(
      `${selectedValidator}-validation`
    );

    try {
      switch (format) {
        case 'json':
          exportToJSON(validationResults, filename);
          toast.success('Exported to JSON');
          break;
        case 'csv':
          exportToCSV(validationResults, filename);
          toast.success('Exported to CSV');
          break;
        case 'txt':
          exportToText(validationResults, filename);
          toast.success('Exported to TXT');
          break;
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Header 
        hasData={!!parsedData}
        onReset={() => navigate('/')}
        onLoadSample={() => navigate('/')}
        parsedData={parsedData}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => validationComplete ? setValidationComplete(false) : navigate('/')}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {validationComplete ? 'Back to Validators' : 'Back to Viewer'}
        </Button>

        {!validationComplete ? (
          <>
            {/* Page Header */}
            <div className="mb-12">
              <h1 className="text-4xl font-bold tracking-tight mb-2">IFC Validation</h1>
              <p className="text-lg text-muted-foreground">
                Choose a validator to check your IFC file for errors and compliance
              </p>
            </div>

            {!parsedData && (
              <div className="mb-8 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-blue-700 dark:text-blue-400">
                  No IFC file loaded. Please upload or load a sample file first.
                </p>
              </div>
            )}

            {/* Validators Grid */}
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Local Validator Card - DISABLED (WIP) */}
              <Card className="hover:shadow-lg transition-shadow opacity-60 border-amber-500/50">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-6 w-6 text-gray-400" />
                      Local Validator
                    </CardTitle>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">Work In Progress</Badge>
                  </div>
                  <CardDescription>
                    Fast, offline validation using built-in rules (currently disabled)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                    <p className="font-semibold mb-1">⚠️ Temporarily Disabled</p>
                    <p className="text-xs">
                      Local validation needs refactoring and improvements.
                      Please use buildingSMART API validation for now.
                    </p>
                  </div>

                  <div className="pt-4 border-t opacity-50">
                    <h4 className="font-semibold mb-2 text-sm">Planned Features:</h4>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>• Real-time analysis</li>
                      <li>• No data upload required</li>
                      <li>• Instant results</li>
                      <li>• Detailed error reporting</li>
                    </ul>
                  </div>

                  <Button
                    className="w-full mt-4"
                    disabled={true}
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLocalValidator();
                    }}
                  >
                    Disabled (WIP)
                  </Button>
                </CardContent>
              </Card>

              {/* buildingSMART Validator Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-6 w-6 text-amber-600" />
                      buildingSMART Validator
                    </CardTitle>
                    <Badge variant="secondary">Online</Badge>
                  </div>
                  <CardDescription>
                    Official buildingSMART API-based validation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>✓ Official compliance checking</p>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-semibold mb-2 text-sm">Validate your IFC files against the following checks:</h4>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>• STEP Syntax</li>
                      <li>• IFC Schema</li>
                      <li>• Normative IFC Rules</li>
                      <li>• Industry Practices</li>
                    </ul>
                  </div>

                  <Button
                    className="w-full mt-4"
                    disabled={!parsedData || isValidating}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuildingSmartValidator();
                    }}
                  >
                    {isValidating && selectedValidator === 'buildingsmart'
                      ? bsValidationStatus || 'Validating...'
                      : isValidating
                      ? 'Another validation in progress'
                      : !parsedData
                      ? 'Load a file first'
                      : 'Start Validation'}
                  </Button>

                  {/* Show job ID and status below button when validating */}
                  {isValidating && selectedValidator === 'buildingsmart' && bsJobId && (
                    <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse"></div>
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                              Validating with buildingSMART
                            </p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                              {bsValidationStatus === 'Status: INITIATED' || bsValidationStatus?.includes('INITIATED')
                                ? 'Processing your IFC file against official buildingSMART standards...'
                                : bsValidationStatus === 'Status: COMPLETED' || bsValidationStatus?.includes('COMPLETED')
                                ? 'Validation complete! Fetching detailed results...'
                                : bsValidationStatus || 'Processing validation request...'}
                            </p>
                            <p className="font-mono text-xs text-blue-600 dark:text-blue-400">
                              Job: {bsJobId}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                            <div className="h-1 flex-1 bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                            </div>
                            <span className="text-xs">Running checks...</span>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelValidation();
                          }}
                          className="h-8 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Info Section */}
            <div className="mt-12 max-w-3xl mx-auto">
              <Card className="bg-muted/30 border-muted">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Validation Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <p>
                    <strong>Local Validator (Disabled - WIP):</strong> Currently under development and needs
                    refactoring. This validator will perform comprehensive checks on IFC structure,
                    relationships, and data integrity using built-in rules. When complete, results will be
                    immediate and no file data will leave your computer.
                  </p>
                  <p>
                    <strong>buildingSMART Validator (Active):</strong> Validates your IFC file against official
                    buildingSMART standards and ViewDefinition requirements.
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <>
            {/* Results Section */}
            <div className="mb-12">
              <h1 className="text-4xl font-bold tracking-tight mb-2">Validation Results</h1>
              <p className="text-lg text-muted-foreground">
                {selectedValidator === 'local'
                  ? 'Complete analysis of your IFC file structure, relationships, and data integrity'
                  : 'buildingSMART validation results'}
              </p>
            </div>

            {/* Results Display */}
            {validationResults?.status === 'placeholder' ? (
              <Card className="max-w-4xl mx-auto">
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Zap className="h-12 w-12 text-amber-600 mx-auto mb-4" />
                    <p className="text-lg font-semibold">{validationResults.message}</p>
                  </div>
                </CardContent>
              </Card>
            ) : validationResults?.status === 'error' ? (
              <Card className="max-w-4xl mx-auto border-destructive">
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                    <p className="text-lg font-semibold text-destructive mb-4">{validationResults.message}</p>

                    {/* Show backend server instructions if the error is about connection */}
                    {validationResults.message?.toLowerCase().includes('backend') && (
                      <div className="mt-6 text-left bg-muted p-6 rounded-lg max-w-2xl mx-auto">
                        <h4 className="font-semibold mb-3 text-sm">How to start the backend server:</h4>
                        <div className="space-y-2 text-xs text-muted-foreground font-mono">
                          <p className="bg-background p-2 rounded border">1. Open a terminal/command prompt</p>
                          <p className="bg-background p-2 rounded border">2. cd bSValidate</p>
                          <p className="bg-background p-2 rounded border">3. npm start</p>
                        </div>
                        <p className="mt-4 text-xs text-muted-foreground">
                          Or on Windows, double-click <code className="bg-background px-1 py-0.5 rounded">bSValidate/START_SERVER.bat</code>
                        </p>
                        <p className="mt-4 text-xs text-muted-foreground">
                          The server should start on <code className="bg-background px-1 py-0.5 rounded">http://localhost:5001</code>
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="max-w-6xl mx-auto">
                {/* Action Buttons (Export) */}
                <div className="flex justify-end mb-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Download className="h-4 w-4" />
                        Export Results
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExport('json')}>
                        <FileJson className="h-4 w-4 mr-2" />
                        Export as JSON
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('csv')}>
                        <Sheet className="h-4 w-4 mr-2" />
                        Export as CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('txt')}>
                        <FileText className="h-4 w-4 mr-2" />
                        Export as Text
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Full Validation Report */}
                <ValidationReport 
                  result={validationResults}
                  nodes={parsedData?.allEntities || parsedData?.graphData?.nodes}
                  onEntityClick={handleEntityClick}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Validation;
