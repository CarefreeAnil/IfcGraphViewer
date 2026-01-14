import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Header } from '@/components/Header';
import { FileUpload } from '@/components/FileUpload';
import { GraphVisualization } from '@/components/GraphVisualization';
import { NodeDetailsPanel } from '@/components/NodeDetailsPanel';
import { GraphControls } from '@/components/GraphControls';
import { StatsPanel } from '@/components/StatsPanel';
import { Legend } from '@/components/Legend';
import { IFCBrowser } from '@/components/IFCBrowser';
import { ValidationDialog } from '@/components/ValidationDialog';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { generateSampleData } from '@/lib/ifcParser';
import { ParsedIFCData, GraphNode, GraphEdge, NodeType } from '@/types/graph';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useKeyboardShortcuts, DEFAULT_SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { useIFCWorker } from '@/hooks/useIFCWorker';
import { validateIFCData } from '@/lib/ifcValidatorEnhanced';
import { exportToJSON, exportNodesToCSV, exportEdgesToCSV, exportToSTEP, exportToPNG } from '@/lib/exportUtils';
import { logger } from '@/utils/logger';

const Index = () => {
  const [parsedData, setParsedData] = useState<ParsedIFCData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedTypes, setHighlightedTypes] = useState<NodeType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [graphLoD, setGraphLoD] = useState<1 | 2 | 3 | 4 | 5>(2); // Default to LoD2 (Minimal)
  const [includeAuxiliaryLayer, setIncludeAuxiliaryLayer] = useState(false);
  const [relationshipFilters, setRelationshipFilters] = useState({
    showContainment: true,
    showAggregation: true,
    showProperties: true,
    showAuxiliary: false,
  });
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [graphStats, setGraphStats] = useState({
    totalNodes: 0,
    totalEdges: 0,
    filteredNodes: 0,
    filteredEdges: 0,
  });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const graphCanvasRef = useRef<HTMLCanvasElement>(null);

  // Use Web Worker for parsing
  const { parseFile, isLoading, progress, error: workerError } = useIFCWorker();

  const handleFileSelect = useCallback(async (file: File) => {
    try {
      logger.parsing.start(file.name);
      
      // Parse in Web Worker (non-blocking)
      const data = await parseFile(file);
      
      // Run enhanced validation
      logger.validation.start(data.graphData.nodes.length);
      const validationResult = validateIFCData(data.graphData.nodes, data.graphData.edges);
      data.validation = validationResult;
      logger.validation.complete(validationResult.stats.totalErrors, validationResult.stats.totalWarnings);
      
      setParsedData(data);
      toast.success(`Parsed ${data.metadata.entityCount} entities and ${data.metadata.relationshipCount} relationships`);
      
      if (validationResult.stats.totalErrors > 0) {
        toast.warning(`Found ${validationResult.stats.totalErrors} validation errors`);
      }
    } catch (error) {
      logger.error('Error parsing IFC file:', error);
      console.error('Error parsing IFC file:', error);
      toast.error('Failed to parse IFC file. Please try a valid IFC file.');
    }
  }, [parseFile]);

  const handleReset = useCallback(() => {
    setParsedData(null);
    setSelectedNode(null);
    setHighlightedTypes([]);
    setSearchQuery('');
    setGraphLoD(2);
    setIncludeAuxiliaryLayer(false);
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
        onShowAnalytics={() => setShowAnalytics(true)}
      />

      {/* Analytics Modal */}
      {parsedData && (
        <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Analytics Dashboard</DialogTitle>
            </DialogHeader>
            <AnalyticsDashboard 
              nodes={parsedData.graphData.nodes}
              edges={parsedData.graphData.edges}
              graphLoD={graphLoD}
              onNodeSelect={(node) => {
                setSelectedNode(node);
                setShowAnalytics(false);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

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
              {/* Three-Panel Layout: Properties (20%) | Graph (50%) | Tree (30%) */}
              <ResizablePanelGroup direction="horizontal" className="h-full">
                {/* Properties Panel - 20% (Left) */}
                <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
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

                {/* Graph Panel - 50% (Middle) */}
                <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
                  <div className="h-full relative flex flex-col">
                    <div className="absolute top-2 right-2 z-20">
                      <ValidationDialog 
                        validation={parsedData.validation}
                        hasErrors={parsedData.validation?.stats.totalErrors ? parsedData.validation.stats.totalErrors > 0 : false}
                      />
                    </div>
                    
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
                  </div>
                </ResizablePanel>

                <ResizableHandle />

                {/* Tree Browser Panel - 30% (Right) */}
                <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
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
              </ResizablePanelGroup>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Index;
