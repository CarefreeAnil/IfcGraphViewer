import { useState, useCallback, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Header } from '@/components/Header';
import { FileUpload } from '@/components/FileUpload';
import { NodeDetailsPanel } from '@/components/NodeDetailsPanel';
import { GraphControls } from '@/components/GraphControls';
import { StatsPanel } from '@/components/StatsPanel';
import { Legend } from '@/components/Legend';
import { IFCBrowser } from '@/components/IFCBrowser';
import { ValidationDialog } from '@/components/ValidationDialog';
import { generateSampleData } from '@/lib/ifcParser';
import { ParsedIFCData, GraphNode, GraphEdge, NodeType } from '@/types/graph';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useKeyboardShortcuts, DEFAULT_SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { useIFCWorker } from '@/hooks/useIFCWorker';
import { validateIFCData } from '@/lib/ifcValidatorEnhanced';
import { exportToJSON, exportNodesToCSV, exportEdgesToCSV, exportToSTEP, exportToPNG } from '@/lib/exportUtils';
import { logger } from '@/utils/logger';

// Lazy load heavy components
const GraphVisualization = lazy(() => import('@/components/GraphVisualization').then(m => ({ default: m.GraphVisualization })));
const Viewer3D = lazy(() => import('@/components/Viewer3D'));

const Index = () => {
  const [parsedData, setParsedData] = useState<ParsedIFCData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedTypes, setHighlightedTypes] = useState<NodeType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [graphLoD, setGraphLoD] = useState<1 | 2 | 3 | 4 | 5>(2); // Default to LoD2 (Minimal)
  const [includeAuxiliaryLayer, setIncludeAuxiliaryLayer] = useState(false);
  const [graphLoaded, setGraphLoaded] = useState(false); // Graph unloaded by default
  const [viewer3DLoaded, setViewer3DLoaded] = useState(false); // 3D viewer unloaded by default
  const [isValidating, setIsValidating] = useState(false); // Validation in progress
  const [relationshipFilters, setRelationshipFilters] = useState({
    showContainment: true,
    showAggregation: true,
    showProperties: true,
    showAuxiliary: false,
  });
  const [graphStats, setGraphStats] = useState({
    totalNodes: 0,
    totalEdges: 0,
    filteredNodes: 0,
    filteredEdges: 0,
  });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const graphCanvasRef = useRef<HTMLCanvasElement>(null);
  const ifcFileBufferRef = useRef<ArrayBuffer | undefined>(undefined);

  // Use Web Worker for parsing
  const { parseFile, isLoading, progress, error: workerError } = useIFCWorker();

  const handleFileSelect = useCallback(async (file: File) => {
    try {
      logger.parsing.start(file.name);
      
      // Store the file buffer in a Ref for the 3D viewer (doesn't need state)
      const buffer = await file.arrayBuffer();
      ifcFileBufferRef.current = buffer;
      
      // Parse in Web Worker (non-blocking)
      const data = await parseFile(file);
      
      // Initialize without validation (validation is on-demand)
      data.validation = undefined;
      
      setParsedData(data);
      toast.success(`Parsed ${data.metadata.entityCount} entities and ${data.metadata.relationshipCount} relationships`);
    } catch (error) {
      logger.error('Error parsing IFC file:', error);
      console.error('Error parsing IFC file:', error);
      toast.error('Failed to parse IFC file. Please try a valid IFC file.');
    }
  }, [parseFile]);

  const handleValidate = useCallback(async () => {
    if (!parsedData) return;
    
    try {
      setIsValidating(true);
      logger.validation.start(parsedData.graphData.nodes.length);
      
      // Run validation (can be expensive for large files)
      const validationResult = validateIFCData(parsedData.graphData.nodes, parsedData.graphData.edges);
      logger.validation.complete(validationResult.stats.totalErrors, validationResult.stats.totalWarnings);
      
      // Update parsed data with validation results
      setParsedData(prev => prev ? { ...prev, validation: validationResult } : null);
      
      toast.success(`Validation complete: ${validationResult.stats.totalErrors} errors, ${validationResult.stats.totalWarnings} warnings`);
      
      if (validationResult.stats.totalErrors > 0) {
        toast.warning(`Found ${validationResult.stats.totalErrors} validation errors`);
      }
    } catch (error) {
      logger.error('Validation error:', error);
      toast.error('Validation failed. Please try again.');
    } finally {
      setIsValidating(false);
    }
  }, [parsedData]);

  const handleReset = useCallback(() => {
    setParsedData(null);
    setSelectedNode(null);
    setHighlightedTypes([]);
    setSearchQuery('');
    setGraphLoD(2);
    setIncludeAuxiliaryLayer(false);
    ifcFileBufferRef.current = undefined;
    setGraphLoaded(false);
    setViewer3DLoaded(false);
    setIsValidating(false);
    setRelationshipFilters({ showContainment: true, showAggregation: true, showProperties: true, showAuxiliary: false });
  }, []);

  const handleNodeClick = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);
  }, []);

  const handleTypeToggle = useCallback((type: NodeType) => {
    setHighlightedTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      ...DEFAULT_SHORTCUTS.SEARCH,
      action: () => {
        searchInputRef.current?.focus();
      },
    },
    {
      ...DEFAULT_SHORTCUTS.SAVE,
      action: () => {
        if (parsedData) {
          exportToJSON(parsedData.graphData.nodes, parsedData.graphData.edges);
        }
      },
    },
    {
      ...DEFAULT_SHORTCUTS.CLEAR,
      action: () => {
        setSelectedNode(null);
        setSearchQuery('');
      },
    },
    {
      ...DEFAULT_SHORTCUTS.VALIDATE,
      action: () => {
        if (parsedData) {
          const validation = validateIFCData(parsedData.graphData.nodes, parsedData.graphData.edges);
          setParsedData({ ...parsedData, validation });
          toast.success('Validation complete');
        }
      },
    },
  ]);

  const handleLoadSample = useCallback(() => {
    const sampleData = generateSampleData();
    setParsedData(sampleData);
    toast.success('Sample building data loaded');
  }, []);

  const handleLoDChange = useCallback((lod: 1 | 2 | 3 | 4 | 5) => {
    setGraphLoD(lod);
    if (lod !== 5) {
      setIncludeAuxiliaryLayer(false);
    }
  }, []);

  const handleRelationshipFilterChange = useCallback((filter: 'containment' | 'aggregation' | 'properties' | 'auxiliary', value: boolean) => {
    setRelationshipFilters(prev => ({ ...prev, [`show${filter.charAt(0).toUpperCase() + filter.slice(1)}`]: value }));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header 
        hasData={!!parsedData} 
        onReset={handleReset}
        onLoadSample={handleLoadSample}
        validation={parsedData?.validation}
        hasErrors={parsedData?.validation?.stats.totalErrors ? parsedData.validation.stats.totalErrors > 0 : false}
        onValidate={handleValidate}
        isValidating={isValidating}
      />

      <main className="pt-20 h-screen">
        <AnimatePresence mode="wait">
          {!parsedData ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full gap-8 px-4"
            >
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold text-foreground">
                  Transform IFC to <span className="text-gradient">Graph</span>
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Upload an IFC file to parse its structure into a graph database
                  and visualize relationships between building elements.
                </p>
              </div>

              <FileUpload 
                onFileSelect={handleFileSelect} 
                isLoading={isLoading}
                progress={progress.percentage}
                progressMessage={progress.message}
              />

              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <span>or</span>
                <button
                  onClick={handleLoadSample}
                  className="text-primary hover:underline underline-offset-4"
                >
                  Load sample building data
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              {/* Four-Panel Horizontal Layout: Properties (15%) | Graph (35%) | Tree (25%) | 3D Viewer (25%) */}
              <ResizablePanelGroup direction="horizontal" className="h-full">
                {/* Properties Panel - 15% (Left) */}
                <ResizablePanel defaultSize={15} minSize={10} maxSize={30}>
                  <div className="h-full w-full bg-card/50 backdrop-blur-sm overflow-y-auto">
                    <div className="space-y-4 p-4">
                      {/* Node Details */}
                      <div>
                        {selectedNode ? (
                          <NodeDetailsPanel
                            node={selectedNode}
                            onClose={() => setSelectedNode(null)}
                            inline={true}
                          />
                        ) : (
                          <div className="text-center text-muted-foreground p-4">
                            <p className="text-sm">Select an entity to view details</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle />

                {/* Graph Panel - 35% (Middle-Left) */}
                <ResizablePanel defaultSize={35} minSize={25} maxSize={60}>
                  {!graphLoaded ? (
                    <div className="h-full w-full bg-background/50 flex items-center justify-center">
                      <div className="text-center space-y-4">
                        <p className="text-muted-foreground text-sm">Graph visualization not loaded</p>
                        <button
                          onClick={() => setGraphLoaded(true)}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                        >
                          Load Graph
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full relative flex flex-col">
                      <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading graph visualization...</div>}>
                        <GraphVisualization
                          data={parsedData.graphData}
                          onNodeClick={handleNodeClick}
                          selectedNodeId={selectedNode?.id || null}
                          highlightedTypes={highlightedTypes}
                          searchQuery={searchQuery}
                          graphLoD={graphLoD}
                          includeAuxiliaryLayer={includeAuxiliaryLayer}
                          relationshipFilters={relationshipFilters}
                          onStatsUpdate={setGraphStats}
                        />
                      </Suspense>

                      <GraphControls
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        highlightedTypes={highlightedTypes}
                        onTypeToggle={handleTypeToggle}
                        selectedNode={selectedNode}
                        graphLoD={graphLoD}
                        onLoDChange={handleLoDChange}
                        includeAuxiliaryLayer={includeAuxiliaryLayer}
                        onIncludeAuxiliaryToggle={setIncludeAuxiliaryLayer}
                        relationshipFilters={relationshipFilters}
                        onRelationshipFilterChange={handleRelationshipFilterChange}
                        searchInputRef={searchInputRef}
                        onExport={(format) => {
                          const { nodes, edges } = parsedData.graphData;
                          switch (format) {
                            case 'json':
                              exportToJSON(nodes, edges);
                              break;
                            case 'csv-nodes':
                              exportNodesToCSV(nodes);
                              break;
                            case 'csv-edges':
                              exportEdgesToCSV(edges);
                              break;
                            case 'step':
                              exportToSTEP(nodes);
                              break;
                            case 'png':
                              // Get canvas from graph visualization
                              const canvasElement = document.querySelector('canvas') as HTMLCanvasElement;
                              if (canvasElement) {
                                exportToPNG(canvasElement);
                              } else {
                                toast.error('Could not access graph canvas');
                              }
                              break;
                          }
                        }}
                      />

                      <StatsPanel metadata={parsedData.metadata} />
                      <Legend />

                      {/* Unload Graph Button */}
                      <div className="absolute bottom-2 right-2 z-20">
                        <button
                          onClick={() => setGraphLoaded(false)}
                          className="px-3 py-1 bg-destructive/20 text-destructive rounded text-xs hover:bg-destructive/30 transition-colors"
                        >
                          Unload Graph
                        </button>
                      </div>
                    </div>
                  )}
                </ResizablePanel>

                <ResizableHandle />

                {/* Tree Browser Panel - 25% (Middle-Right) */}
                <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
                  <div className="h-full overflow-hidden border-r border-border">
                    <IFCBrowser
                      nodes={parsedData.allEntities || parsedData.graphData.nodes}
                      edges={parsedData.graphData.edges}
                      selectedNodeId={selectedNode?.id || null}
                      onNodeSelect={handleNodeClick}
                      metadata={parsedData.metadata}
                    />
                  </div>
                </ResizablePanel>

                <ResizableHandle />

                {/* 3D Viewer Panel - 25% (Right) */}
                <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
                  {!viewer3DLoaded ? (
                    <div className="h-full w-full bg-background/50 flex items-center justify-center border-l border-border">
                      <div className="text-center space-y-4">
                        <p className="text-muted-foreground text-sm">3D Viewer not loaded</p>
                        <button
                          onClick={() => setViewer3DLoaded(true)}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                        >
                          Load 3D Viewer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full w-full bg-background border-l border-border overflow-hidden relative">
                      <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading 3D viewer...</div>}>
                        <Viewer3D 
                          selectedNodeId={selectedNode?.id}
                          onSelectNode={(nodeId) => {
                            const node = parsedData?.graphData.nodes.find(n => n.id === nodeId);
                            if (node) {
                              handleNodeClick(node);
                            }
                          }}
                          ifcFileBuffer={ifcFileBufferRef.current}
                        />
                      </Suspense>
                      
                      {/* Unload 3D Viewer Button */}
                      <div className="absolute bottom-2 right-2 z-20">
                        <button
                          onClick={() => setViewer3DLoaded(false)}
                          className="px-3 py-1 bg-destructive/20 text-destructive rounded text-xs hover:bg-destructive/30 transition-colors"
                        >
                          Unload 3D
                        </button>
                      </div>
                    </div>
                  )}
                </ResizablePanel>
              </ResizablePanelGroup>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Index;
