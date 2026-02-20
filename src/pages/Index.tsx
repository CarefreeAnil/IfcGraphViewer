import { useState, useCallback, useRef, lazy, Suspense, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Header } from '@/components/Header';
import {
  LearningLayer,
  LearningProgress,
  generateDynamicLearningPath,
  getInitialProgress,
  calculateProgress,
  getProgressiveGraphData,
} from '@/lib/dynamicLearning';
import { FileUpload } from '@/components/FileUpload';
import { NodeDetailsPanel } from '@/components/NodeDetailsPanel';
import { GraphControls } from '@/components/GraphControls';
import { Legend } from '@/components/Legend';
import { IFCBrowser } from '@/components/IFCBrowser';
import { ValidationDialog } from '@/components/ValidationDialog';
import { IFC5TreeBrowser } from '@/components/IFC5TreeBrowser';
import { IFC5PropertyViewer } from '@/components/IFC5PropertyViewer';
import { ConsolidatedLearningPanel } from '@/features/educational/components/ConsolidatedLearningPanel';
import { createGraphDataFromEntities } from '@/lib/graphBuilder';
import { ParsedIFCData, GraphNode, NodeType } from '@/types/graph';
import { ComposedObject } from '@/types/ifc5';
import { EducationalSample } from '@/features/educational/data/educationalSamples';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useKeyboardShortcuts, DEFAULT_SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { useIFCWorker } from '@/hooks/useIFCWorker';
import { validateIFCData } from '@/lib/ifcValidatorEnhanced';
import { exportToJSON, exportNodesToCSV, exportEdgesToCSV, exportToSTEP, exportToPNG } from '@/lib/exportUtils';
import { logger } from '@/utils/logger';
import { useIFC5Viewer } from '@/hooks/useIFC5Viewer';
import { useUIState } from '@/contexts/UIStateContext';

// Lazy load heavy components
const GraphVisualization = lazy(() => import('@/components/GraphVisualization').then(m => ({ default: m.GraphVisualization })));
const Viewer3D = lazy(() => import('@/components/Viewer3D'));
const IFC5GraphVisualization = lazy(() => import('@/components/IFC5GraphVisualization').then(m => ({ default: m.IFC5GraphVisualization })));

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSchemaVersion } = useUIState();
  const [parsedData, setParsedData] = useState<ParsedIFCData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedIFC5Node, setSelectedIFC5Node] = useState<ComposedObject | null>(null);
  const [highlightedTypes, setHighlightedTypes] = useState<NodeType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [graphLoD, setGraphLoD] = useState<1 | 2 | 3 | 4>(2); // Default to LoD2 (Minimal)
  const [includeAuxiliaryLayer, setIncludeAuxiliaryLayer] = useState(false);
  const [graphLoaded, setGraphLoaded] = useState(false); // Graph unloaded by default
  const [viewer3DLoaded, setViewer3DLoaded] = useState(false); // 3D viewer unloaded by default
  const [ifc5GraphLoaded, setIfc5GraphLoaded] = useState(false); // IFC5 graph unloaded by default
  const [isValidating, setIsValidating] = useState(false); // Validation in progress
  const [relationshipFilters, setRelationshipFilters] = useState({
    showContainment: true,       // Spatial structure
    showAggregation: true,       // Building aggregation
    showProperties: true,        // Property relationships
    showAuxiliary: false,        // Geometric/metadata - only this hidden (too verbose)
    showConnects: true,          // Technical connections
    showAssociates: true,        // Material/classification
    showSpaceBoundary: true,     // Space boundaries
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

  // Learning Mode state
  const [learningMode, setLearningMode] = useState(false);
  const [learningSample, setLearningSample] = useState<EducationalSample | null>(null);
  const [currentLearningLayer, setCurrentLearningLayer] = useState<'project' | 'spatial' | 'element' | 'relationship' | 'property'>('project');

  // Check if current file is IFC5
  const isIFC5 = parsedData?.metadata?.isIFC5 === true;

  // Ref to hold the selectObject function from useIFC5Viewer
  const selectObjectRef = useRef<((path: string) => void) | null>(null);

  // Handle IFC5 node selection (defined early to avoid circular dependency)
  const handleIFC5NodeSelect = useCallback((path: string, node: ComposedObject) => {
    logger.debug('IFC5 node selected', { path, nodeName: node.name });
    setSelectedIFC5Node(node);
    // Also highlight in 3D viewer if loaded
    if (viewer3DLoaded && isIFC5 && selectObjectRef.current) {
      logger.debug('Syncing selection to 3D viewer');
      selectObjectRef.current(path);
    }
  }, [viewer3DLoaded, isIFC5]);

  // Handle 3D object click
  const handleIFC5ObjectClick = useCallback((path: string) => {
    logger.debug('3D object clicked', { path });
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
      if (node) {
        logger.debug('Found node for path', { nodeName: node.name });
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

  // Check for learning mode state from Learn page navigation
  useEffect(() => {
    const state = location.state as {
      sampleFile?: File;
      learningSample?: EducationalSample;
      learningMode?: boolean;
    } | null;

    if (state?.learningMode && state?.learningSample && state?.sampleFile) {
      logger.info('Loading sample in learning mode', { sample: state.learningSample.name });

      // Set learning mode state
      setLearningMode(true);
      setLearningSample(state.learningSample);
      setCurrentLearningLayer('project'); // Reset to project layer

      // Load the sample file
      handleFileSelect(state.sampleFile);

      // Clear the state to prevent reloading on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Auto-enable graph and 3D viewer for guided learning samples
  useEffect(() => {
    if (learningMode && learningSample?.hasGuidedLearning && parsedData) {
      // Auto-enable graph and 3D viewer
      setGraphLoaded(true);

      // Set LoD to 4 (Core) to show all semantic relationships including properties
      setGraphLoD(4);

      // Update relationship filters to show all relationships (nothing hidden by default)
      setRelationshipFilters({
        showContainment: true,
        showAggregation: true,
        showProperties: true,
        showAuxiliary: false,
        showConnects: true,
        showAssociates: true,
        showSpaceBoundary: true,
      });

      if (!isIFC5) {
        // For STEP/IFC4, only auto-enable 3D if it's already initialized
        // IFC5 auto-enables in handleFileSelect
      }
      logger.info('Auto-enabling graph (LoD4) and 3D viewer for guided learning', { sample: learningSample.name });
    }
  }, [learningMode, learningSample?.hasGuidedLearning, parsedData, isIFC5]);

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
      // File size constants
      const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB
      const VERY_LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB

      // Warn user about large files
      if (file.size > VERY_LARGE_FILE_THRESHOLD) {
        toast.warning(`Very large file detected (${(file.size / 1024 / 1024).toFixed(1)} MB)`, {
          description: 'Parsing may take several minutes. Consider using a smaller file or expect delays.',
          duration: 7000,
        });
      } else if (file.size > LARGE_FILE_THRESHOLD) {
        toast.info(`Large file detected (${(file.size / 1024 / 1024).toFixed(1)} MB)`, {
          description: 'Parsing may take some time.',
          duration: 5000,
        });
      }

      logger.parsing.start(file.name);

      // Store the file buffer in a Ref for the 3D viewer (doesn't need state)
      const buffer = await file.arrayBuffer();
      ifcFileBufferRef.current = buffer;
      
      // Parse in Web Worker (non-blocking)
      const data = await parseFile(file);

      // OPTIMIZATION: Create graph data with STEP lines in single pass
      // (adds both _schemaColor AND _ifcStep, eliminates separate enrichEntitiesForTree call)
      const graphData = createGraphDataFromEntities(
        data.allEntities,
        data.graphData.edges,
        data.rawData?.rawStepLines  // Pass STEP lines for tree browser display
      );

      // Update parsedData with enriched graph
      data.graphData = graphData;
      
      // Parser returns parsed data only - no validation.
      // Validation is on-demand via handleValidate().
      
      // Clear unload flag when new file is loaded
      sessionStorage.removeItem('ifcFileUnloaded');
      
      // Extract schema version from header
      const schemaIdentifiers = data.metadata?.ifcHeader?.fileSchema?.schemaIdentifiers || [];
      console.log('[Index] Metadata:', data.metadata);
      console.log('[Index] ifcHeader:', data.metadata?.ifcHeader);
      console.log('[Index] fileSchema:', data.metadata?.ifcHeader?.fileSchema);
      console.log('[Index] schemaIdentifiers:', schemaIdentifiers);
      
      let detectedVersion = 'IFC4'; // Default
      
      if (schemaIdentifiers.length > 0) {
        const schemaStr = schemaIdentifiers[0].toUpperCase();
        console.log('[Index] Raw schema string:', schemaIdentifiers[0], '-> normalized:', schemaStr);
        
        if (schemaStr.includes('IFC4X3') || schemaStr.includes('IFC4_3') || schemaStr.includes('IFC43')) {
          detectedVersion = 'IFC4X3';
        } else if (schemaStr.includes('IFC4')) {
          detectedVersion = 'IFC4';
        } else if (schemaStr.includes('IFC2X3')) {
          detectedVersion = 'IFC2x3';
        } else if (schemaStr.includes('IFC5')) {
          detectedVersion = 'IFC5';
        }
      }
      
      console.log('[Index] Detected schema version:', detectedVersion);
      setSchemaVersion(detectedVersion);
      setParsedData(data);
      
      // Auto-load 3D viewer for IFC5 files
      if (data.metadata?.isIFC5) {
        setViewer3DLoaded(true);
      }
      toast.success(`Parsed ${data.metadata.entityCount} entities and ${data.metadata.relationshipCount} relationships`);
    } catch (error) {
      logger.error('Error parsing IFC file:', error);
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
        logger.error('Failed to load sample file:', error);
        toast.error('Failed to load sample file.');
      }
    })();
  }, [handleFileSelect]);

  // Handle navigation from validation page with highlighted entity
  useEffect(() => {
    const state = location.state as { 
      parsedData?: ParsedIFCData; 
      highlightedEntityId?: string; 
      ifcFileBuffer?: ArrayBuffer; 
      fileName?: string;
      validationResults?: any;
      selectedValidator?: string;
    } | null;
    
    if (state) {
      // Restore parsed data if coming from validation page
      if (state.parsedData && !parsedData) {
        logger.debug('Restoring parsed data from navigation state');
        setParsedData(state.parsedData);

        // Restore IFC file buffer if available
        if (state.ifcFileBuffer) {
          ifcFileBufferRef.current = state.ifcFileBuffer;
        }
      }

      // Highlight the entity if specified
      if (state.highlightedEntityId && (parsedData || state.parsedData)) {
        const data = parsedData || state.parsedData;
        logger.debug('Looking for entity to highlight', { entityId: state.highlightedEntityId });
        
        if (data) {
          // Search in allEntities first (complete dataset)
          const entityToHighlight = data.allEntities?.find(e => 
            e.id === state.highlightedEntityId ||
            `#${e.expressId}` === state.highlightedEntityId ||
            String(e.expressId) === state.highlightedEntityId.replace('#', '')
          ) || data.graphData.nodes.find(n => 
            n.id === state.highlightedEntityId ||
            `#${n.expressId}` === state.highlightedEntityId ||
            String(n.expressId) === state.highlightedEntityId.replace('#', '')
          );

          if (entityToHighlight) {
            logger.debug('Found entity to highlight', { ifcType: entityToHighlight.ifcType, id: entityToHighlight.id });
            setSelectedNode(entityToHighlight);
            toast.success(`Navigated to ${entityToHighlight.ifcType}`, {
              description: `Entity #${entityToHighlight.expressId}`,
            });
          } else {
            logger.warn('Entity not found', { entityId: state.highlightedEntityId });
            toast.warning('Entity not found in current view', {
              description: 'The entity may be filtered out or not loaded.',
            });
          }
        }
      }
      
      // Clear navigation state to prevent re-triggering
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, parsedData, navigate, location.pathname]);

  // ============================================================================
  // DISABLED - Local Validation (Work in Progress)
  // ============================================================================
  // Local validation is currently disabled and needs refactoring.
  // Use the buildingSMART API validation instead (via /validation page).
  // This function is preserved for future development.
  // ============================================================================
  const handleValidate = useCallback(async () => {
    if (!parsedData || isIFC5) return;

    console.warn('[Index] Local validation is currently disabled (WIP)');
    toast.error('Local Validation Disabled', {
      description: 'Local validation needs work. Please use buildingSMART API validation.',
      duration: 5000,
    });
    return;

    /* DISABLED CODE - Preserved for future work
    try {
      setIsValidating(true);
      // Use allEntities (1:1 with file) instead of graphData.nodes (filtered for visualization)
      const entitiesToValidate = parsedData.allEntities || parsedData.graphData.nodes;
      logger.validation.start(entitiesToValidate.length);

      // Run validation against COMPLETE dataset (raw parsed data)
      // NOT against filtered graph visualization data
      const validationResult = await validateIFCData(
        entitiesToValidate,  // Use allEntities: 1:1 with IFC file
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
    */
  }, [parsedData, isIFC5]);

  const handleReset = useCallback(() => {
    // Set flag to prevent stale validation pages from working
    sessionStorage.setItem('ifcFileUnloaded', 'true');
    
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
      showContainment: true,
      showAggregation: true,
      showProperties: true,
      showAuxiliary: false,
      showConnects: true,
      showAssociates: true,
      showSpaceBoundary: true,
    });
    ifcFileBufferRef.current = undefined;
    lastLoadedIFC5Ref.current = null;

    // Clear learning mode state
    setLearningMode(false);
    setLearningSample(null);

    // Clear navigation state completely
    navigate('/', { replace: true, state: null });
    
    toast.success('File unloaded', {
      description: 'All file data has been removed from memory'
    });
    
    // Force a micro-task to allow cleanup
    setTimeout(() => {
      // Try to trigger garbage collection hint (if available)
      if (window.gc) {
        window.gc();
      }
    }, 0);
  }, [navigate]);

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
      action: async () => {
        // DISABLED: Local validation is WIP
        console.warn('[Index] Local validation keyboard shortcut disabled (WIP)');
        toast.error('Local Validation Disabled', {
          description: 'Use buildingSMART API validation instead.',
          duration: 3000,
        });

        /* DISABLED CODE - Preserved for future work
        if (parsedData && !isIFC5) {
          // Use allEntities (1:1 with file) instead of graphData.nodes (filtered for visualization)
          const entitiesToValidate = parsedData.allEntities || parsedData.graphData.nodes;
          const validation = await validateIFCData(
            entitiesToValidate,  // Use allEntities: 1:1 with IFC file
            parsedData.graphData.edges,
            parsedData.metadata.ifcHeader,
            parsedData.validation?.syntaxErrors
          );
          setParsedData({ ...parsedData, validation });
          toast.success('Validation complete');
        }
        */
      },
    },
  ]);

  const handleLearningLayerChange = useCallback((layerId: string) => {
    setCurrentLearningLayer(layerId as 'project' | 'spatial' | 'element' | 'relationship' | 'property');
    logger.debug('Learning layer changed to:', layerId);
  }, []);

  const handleLoDChange = useCallback((lod: 1 | 2 | 3 | 4) => {
    setGraphLoD(lod);
    // NOTE: Do NOT auto-adjust relationship filters based on LoD level
    // Filters should remain independent of LoD - user can manually control them
    setIncludeAuxiliaryLayer(false);
  }, []);

  const handleRelationshipFilterChange = useCallback((filter: 'containment' | 'aggregation' | 'properties' | 'auxiliary' | 'connects' | 'associates' | 'spaceBoundary', value: boolean) => {
    setRelationshipFilters(prev => ({ ...prev, [`show${filter.charAt(0).toUpperCase() + filter.slice(1)}`]: value }));
  }, []);

  // Handle navigation from validation report to entity
  const handleEntityNavigation = useCallback((entityId: string) => {
    if (!parsedData || !parsedData.graphData?.nodes) return;
    
    // Find the node
    const node = parsedData.graphData.nodes.find(n => n.id === entityId);
    if (!node) return;
    
    // Set as selected node (this will sync across all views)
    setSelectedNode(node);
    
    // Switch to IFC Browser tab if not already there
    // You might need to add state management for active tab if needed

    // Optionally scroll to the element in tree view
    // This would require adding a scroll handler in IFCBrowser
    
  }, [parsedData]);

  // OPTIMIZATION: Create minimal enrichment for IFC Browser (just add _ifcStep, no _schemaColor)
  // IFC Browser shows ALL entities (including geometry), graph shows filtered only
  const enrichedEntities = useMemo(() => {
    if (!parsedData?.allEntities) return [];
    if (import.meta.env.DEV) {
      logger.debug('Creating enrichedEntities for IFCBrowser');
    }

    // CRITICAL: Enrich BOTH semantic and geometry entities with _ifcStep
    // IFC Browser must show 1:1 representation - no missing entities
    const enrichedSemantic = (parsedData.allEntities || []).map(entity => ({
      ...entity,
      properties: {
        ...entity.properties,
        _ifcStep: parsedData.rawData?.rawStepLines?.get(entity.expressId) ||
                  `#${entity.expressId}= ${entity.ifcType}(...);`
      }
    }));

    // CRITICAL: Enrich geometry entities with STEP lines (don't return as-is)
    // This was missing geometry STEP content in the display
    const enrichedGeometry = (parsedData.geometryEntities || []).map(entity => ({
      ...entity,
      properties: {
        ...entity.properties,
        _ifcStep: parsedData.rawData?.rawStepLines?.get(entity.expressId) ||
                  `#${entity.expressId}= ${entity.ifcType}(...);`
      }
    }));

    // Combine and sort by expressId for 1:1 IFC file representation (no gaps)
    const combined = [...enrichedSemantic, ...enrichedGeometry];
    combined.sort((a, b) => (a.expressId || 0) - (b.expressId || 0));

    return combined;
  }, [parsedData?.allEntities, parsedData?.geometryEntities, parsedData?.rawData?.rawStepLines]);

  // Memoize filtered graph data for progressive learning
  const filteredGraphDataForLearning = useMemo(() => {
    if (!parsedData?.graphData || !learningMode) {
      return parsedData?.graphData || { nodes: [], edges: [] };
    }
    return getProgressiveGraphData(
      parsedData.graphData.nodes,
      parsedData.graphData.edges,
      currentLearningLayer
    );
  }, [parsedData?.graphData, learningMode, currentLearningLayer]);

  // Use filtered graph data in learning mode, full graph otherwise
  const displayGraphData = learningMode ? filteredGraphDataForLearning : (parsedData?.graphData || { nodes: [], edges: [] });

  return (
    <div className="min-h-screen bg-background">
      <Header
        hasData={!!parsedData}
        onReset={handleReset}
        validation={parsedData?.validation}
        hasErrors={parsedData?.validation?.stats.totalErrors ? parsedData.validation.stats.totalErrors > 0 : false}
        onValidate={handleValidate}
        isValidating={isValidating}
        metadata={parsedData?.metadata}
        nodes={parsedData?.graphData?.nodes}
        onEntityClick={handleEntityNavigation}
        isIFC5={isIFC5}
        parsedData={parsedData}
        ifcFileBuffer={ifcFileBufferRef.current}
        fileName={parsedData?.metadata?.fileName || 'model.ifc'}
        learningMode={learningMode}
        learningSample={learningSample}
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
                  Upload an IFC file to parse its structure into a graph
                  and visualize relationships between building elements.
                </p>
              </div>

              <FileUpload
                onFileSelect={handleFileSelect}
                isLoading={isLoading}
                progress={progress.percentage}
                progressMessage={progress.message}
              />
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
                          data={displayGraphData}
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
                        nodes={enrichedEntities}
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
                              const node = parsedData?.graphData?.nodes?.find(n => n.id === nodeId);
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

      {/* Consolidated Learning Panel - ONLY for samples with hasGuidedLearning flag */}
      <AnimatePresence>
        {learningMode && learningSample?.hasGuidedLearning && parsedData?.graphData?.nodes && (
          <ConsolidatedLearningPanel
            nodes={parsedData.graphData.nodes}
            selectedNode={selectedNode}
            onNodeSelect={handleNodeClick}
            onLayerChange={handleLearningLayerChange}
            onClose={() => {
              setLearningMode(false);
              setLearningSample(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
