import { useState, useCallback, useRef, lazy, Suspense, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Header } from '@/components/Header';
import { FileUpload } from '@/components/FileUpload';
import { NodeDetailsPanel } from '@/components/NodeDetailsPanel';
import { GraphControls } from '@/components/GraphControls';
import { Legend } from '@/components/Legend';
import { IFCBrowser } from '@/components/IFCBrowser';
import { ValidationDialog } from '@/components/ValidationDialog';
import { IFC5TreeBrowser } from '@/components/IFC5TreeBrowser';
import { IFC5PropertyViewer } from '@/components/IFC5PropertyViewer';
import { generateSampleData } from '@/lib/ifcParser';
import { ParsedIFCData, GraphNode, GraphEdge, NodeType } from '@/types/graph';
import { ComposedObject } from '@/types/ifc5';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useKeyboardShortcuts, DEFAULT_SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { useIFCWorker } from '@/hooks/useIFCWorker';
import { validateIFCData } from '@/lib/ifcValidatorEnhanced';
import { exportToJSON, exportNodesToCSV, exportEdgesToCSV, exportToSTEP, exportToPNG } from '@/lib/exportUtils';
import { logger } from '@/utils/logger';
import { useIFC5Viewer } from '@/hooks/useIFC5Viewer';

// Lazy load heavy components
const GraphVisualization = lazy(() => import('@/components/GraphVisualization').then(m => ({ default: m.GraphVisualization })));
const Viewer3D = lazy(() => import('@/components/Viewer3D'));
const IFC5GraphVisualization = lazy(() => import('@/components/IFC5GraphVisualization').then(m => ({ default: m.IFC5GraphVisualization })));

const Index = () => {
  const [parsedData, setParsedData] = useState<ParsedIFCData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedIFC5Node, setSelectedIFC5Node] = useState<ComposedObject | null>(null);
  const [highlightedTypes, setHighlightedTypes] = useState<NodeType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [graphLoD, setGraphLoD] = useState<1 | 2 | 3 | 4 | 5>(2); // Default to LoD2 (Minimal)
  const [includeAuxiliaryLayer, setIncludeAuxiliaryLayer] = useState(false);
  const [graphLoaded, setGraphLoaded] = useState(false); // Graph unloaded by default
  const [viewer3DLoaded, setViewer3DLoaded] = useState(false); // 3D viewer unloaded by default
  const [ifc5GraphLoaded, setIfc5GraphLoaded] = useState(false); // IFC5 graph unloaded by default
  const [isValidating, setIsValidating] = useState(false); // Validation in progress
  const [relationshipFilters, setRelationshipFilters] = useState({
    showContainment: false,
    showAggregation: false,
    showProperties: false,
    showAuxiliary: false,
    showConnects: false,
    showAssociates: false,
    showSpaceBoundary: false,
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
  const ifc5ViewerContainerRef = useRef<HTMLDivElement>(null);
  const lastLoadedIFC5Ref = useRef<ComposedObject | null>(null);
  const sampleLoadedRef = useRef(false);
  
  // Check if current file is IFC5
  const isIFC5 = parsedData?.metadata?.isIFC5 === true;

  // Ref to hold the selectObject function from useIFC5Viewer
  const selectObjectRef = useRef<((path: string) => void) | null>(null);

  // Handle IFC5 node selection (defined early to avoid circular dependency)
  const handleIFC5NodeSelect = useCallback((path: string, node: ComposedObject) => {
    console.log('[Index] handleIFC5NodeSelect called:', { path, nodeName: node.name });
    setSelectedIFC5Node(node);
    // Also highlight in 3D viewer if loaded
    if (viewer3DLoaded && isIFC5 && selectObjectRef.current) {
      console.log('[Index] Syncing selection to 3D viewer');
      selectObjectRef.current(path);
    }
  }, [viewer3DLoaded, isIFC5]);

  // Handle 3D object click
  const handleIFC5ObjectClick = useCallback((path: string) => {
    console.log('[Index] 3D object clicked:', path);
    // Find the node with this path in the composed object
    if (parsedData?.rawData?.composedObject) {
      const findNodeByPath = (node: ComposedObject, targetPath: string): ComposedObject | null => {
        if (node.name === targetPath) return node;
        if (node.children) {
          for (const child of node.children) {
            const found = findNodeByPath(child, targetPath);
            if (found) return found;
          }
        }
        return null;
      };
      const node = findNodeByPath(parsedData.rawData.composedObject, path);
      console.log('[Index] Found node for path:', node?.name);
      if (node) {
        console.log('[Index] Calling handleIFC5NodeSelect from 3D click');
        handleIFC5NodeSelect(path, node);
      }
    }
  }, [parsedData, handleIFC5NodeSelect]);

  // IFC5 3D Viewer hook
  const { 
    loadComposedObject, 
    selectObject,
    isInitialized: viewer3DInitialized
  } = useIFC5Viewer(ifc5ViewerContainerRef, viewer3DLoaded, handleIFC5ObjectClick);

  // Store selectObject in ref for use in handleIFC5NodeSelect
  useEffect(() => {
    selectObjectRef.current = selectObject;
  }, [selectObject]);

  // Use Web Worker for parsing
  const { parseFile, isLoading, progress, error: workerError } = useIFCWorker();

  // Load composed object once viewer is initialized (avoid repeated re-fit)
  useEffect(() => {
    if (!isIFC5 || !viewer3DInitialized || !parsedData?.rawData?.composedObject) {
      return;
    }

    if (lastLoadedIFC5Ref.current !== parsedData.rawData.composedObject) {
      lastLoadedIFC5Ref.current = parsedData.rawData.composedObject;
      loadComposedObject(parsedData.rawData.composedObject);
    }
  }, [isIFC5, viewer3DInitialized, parsedData?.rawData?.composedObject, loadComposedObject]);

  const handleFileSelect = useCallback(async (file: File) => {
    try {
      logger.parsing.start(file.name);
      
      // Store the file buffer in a Ref for the 3D viewer (doesn't need state)
      const buffer = await file.arrayBuffer();
      ifcFileBufferRef.current = buffer;
      
      // Parse in Web Worker (non-blocking)
      const data = await parseFile(file);
      
      // Parser returns parsed data only - no validation.
      // Validation is on-demand via handleValidate().
      
      setParsedData(data);
      // Auto-load 3D viewer for IFC5 files
      if (data.metadata?.isIFC5) {
        setViewer3DLoaded(true);
      }
      toast.success(`Parsed ${data.metadata.entityCount} entities and ${data.metadata.relationshipCount} relationships`);
    } catch (error) {
      logger.error('Error parsing IFC file:', error);
      console.error('Error parsing IFC file:', error);
      toast.error('Failed to parse IFC file. Please try a valid IFC file.');
    }
  }, [parseFile]);

  useEffect(() => {
    if (sampleLoadedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const samplePath = params.get('sample');
    if (!samplePath) return;

    sampleLoadedRef.current = true;
    (async () => {
      try {
        const response = await fetch(samplePath);
        const blob = await response.blob();
        const fileName = samplePath.split('/').pop() || 'sample.ifc';
        const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
        await handleFileSelect(file);
      } catch (error) {
        console.error('Failed to load sample file:', error);
        toast.error('Failed to load sample file.');
      }
    })();
  }, [handleFileSelect]);

  const handleValidate = useCallback(async () => {
    if (!parsedData) return;
    
    try {
      setIsValidating(true);
      logger.validation.start(parsedData.graphData.nodes.length);
      
      // Run validation (can be expensive for large files)
      const validationResult = validateIFCData(
        parsedData.graphData.nodes, 
        parsedData.graphData.edges, 
        parsedData.metadata.ifcHeader,
        [],
        parsedData.rawData?.rawStepLines
      );
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
    // Clear all state explicitly
    setParsedData(null);
    setSelectedNode(null);
    setSelectedIFC5Node(null);
    setHighlightedTypes([]);
    setSearchQuery('');
    setGraphLoD(2);
    setIncludeAuxiliaryLayer(false);
    setGraphLoaded(false);
    setViewer3DLoaded(false);
    setIsValidating(false);
    setRelationshipFilters({
      showContainment: false,
      showAggregation: false,
      showProperties: false,
      showAuxiliary: false,
      showConnects: false,
      showAssociates: false,
      showSpaceBoundary: false,
    });
    ifcFileBufferRef.current = undefined;
    lastLoadedIFC5Ref.current = null;
    
    // Force a micro-task to allow cleanup
    setTimeout(() => {
      // Try to trigger garbage collection hint (if available)
      if (window.gc) {
        window.gc();
      }
    }, 0);
  }, []);

  const handleNodeClick = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);
  }, []);

  // Keep 3D selection in sync when selection changes in panels
  useEffect(() => {
    if (viewer3DLoaded && isIFC5 && selectedIFC5Node?.name && selectObjectRef.current) {
      selectObjectRef.current(selectedIFC5Node.name);
    }
  }, [viewer3DLoaded, isIFC5, selectedIFC5Node?.name]);

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
          const validation = validateIFCData(
            parsedData.graphData.nodes, 
            parsedData.graphData.edges, 
            parsedData.metadata.ifcHeader,
            parsedData.validation?.syntaxErrors
          );
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

  const handleRelationshipFilterChange = useCallback((filter: 'containment' | 'aggregation' | 'properties' | 'auxiliary' | 'connects' | 'associates' | 'spaceBoundary', value: boolean) => {
    setRelationshipFilters(prev => ({ ...prev, [`show${filter.charAt(0).toUpperCase() + filter.slice(1)}`]: value }));
  }, []);

  // Handle navigation from validation report to entity
  const handleEntityNavigation = useCallback((entityId: string) => {
    if (!parsedData) return;
    
    // Find the node
    const node = parsedData.graphData.nodes.find(n => n.id === entityId);
    if (!node) return;
    
    // Set as selected node (this will sync across all views)
    setSelectedNode(node);
    
    // Switch to IFC Browser tab if not already there
    // You might need to add state management for active tab if needed
    
    // Optionally scroll to the element in tree view
    // This would require adding a scroll handler in IFCTreeBrowser
    
  }, [parsedData]);

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
        metadata={parsedData?.metadata}
        nodes={parsedData?.graphData?.nodes}
        onEntityClick={handleEntityNavigation}
        isIFC5={isIFC5}
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
                    {isIFC5 ? (
                      <IFC5PropertyViewer node={selectedIFC5Node} />
                    ) : (
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
                    )}
                  </div>
                </ResizablePanel>

                <ResizableHandle />

                {/* Graph Panel - 35% (Middle-Left) */}
                <ResizablePanel defaultSize={35} minSize={25} maxSize={60}>
                  {isIFC5 ? (
                    !ifc5GraphLoaded ? (
                      <div className="h-full w-full bg-background/50 flex items-center justify-center">
                        <div className="text-center space-y-4">
                          <div className="text-4xl mb-2">🕸️</div>
                          <p className="text-lg font-medium">IFC5 Graph View</p>
                          <p className="text-muted-foreground text-sm max-w-md">
                            Visualize IFC5 JSON structure as an interactive graph with
                            data nodes, attributes, geometry, and inheritance relationships.
                          </p>
                          <button
                            onClick={() => setIfc5GraphLoaded(true)}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                          >
                            Load IFC5 Graph
                          </button>
                        </div>
                      </div>
                    ) : (
                      <Suspense fallback={
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          Loading IFC5 graph visualization...
                        </div>
                      }>
                        <IFC5GraphVisualization
                          composedObject={parsedData.rawData?.composedObject!}
                          ifc5File={parsedData.rawData?.ifc5File}
                          onNodeSelect={handleIFC5NodeSelect}
                          selectedNodePath={selectedIFC5Node?.name || null}
                        />
                      </Suspense>
                    )
                  ) : !graphLoaded ? (
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

                      {/* Compact entity/relations counter */}
                      <div className="absolute bottom-4 left-4 flex gap-4 p-2 rounded-lg bg-card/90 backdrop-blur-md border border-border">
                        <div className="flex flex-col">
                          <span className="text-[7px] uppercase tracking-wider text-muted-foreground">Entities/Nodes</span>
                          <span className="text-[10px] font-mono text-foreground">{graphStats.filteredNodes.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[7px] uppercase tracking-wider text-muted-foreground">Relations/Edges</span>
                          <span className="text-[10px] font-mono text-foreground">{graphStats.filteredEdges.toLocaleString()}</span>
                        </div>
                      </div>

                      <Legend />

                      {/* Unload Graph Button - Middle Bottom */}
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
                        <button
                          onClick={() => setGraphLoaded(false)}
                          className="px-3 py-1.5 bg-destructive/20 text-destructive text-xs font-medium rounded hover:bg-destructive/30 transition-colors border border-destructive/30"
                          title="Unload the current graph visualization"
                        >
                          Unload
                        </button>
                      </div>
                    </div>
                  )}
                </ResizablePanel>

                <ResizableHandle />

                {/* Tree Browser Panel - 25% (Middle-Right) */}
                <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
                  <div className="h-full overflow-hidden border-r border-border">
                    {isIFC5 ? (
                      <IFC5TreeBrowser
                        composedObject={parsedData.rawData?.composedObject}
                        onNodeSelect={handleIFC5NodeSelect}
                        selectedPath={selectedIFC5Node?.name}
                      />
                    ) : (
                      <IFCBrowser
                        nodes={parsedData.allEntities || parsedData.graphData.nodes}
                        edges={parsedData.graphData.edges}
                        selectedNodeId={selectedNode?.id || null}
                        onNodeSelect={handleNodeClick}
                        metadata={parsedData.metadata}
                      />
                    )}
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
                      {isIFC5 ? (
                        <div ref={ifc5ViewerContainerRef} className="h-full w-full" />
                      ) : (
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
                      )}
                      
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
