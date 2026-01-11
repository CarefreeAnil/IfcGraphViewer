import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Header } from '@/components/Header';
import { FileUpload } from '@/components/FileUpload';
import { GraphVisualization } from '@/components/GraphVisualization';
import { NodeDetailsPanel } from '@/components/NodeDetailsPanel';
import { GraphControls } from '@/components/GraphControls';
import { StatsPanel } from '@/components/StatsPanel';
import { Legend } from '@/components/Legend';
import { PropertyViewer } from '@/components/PropertyViewer';
import { IFCTreeBrowser } from '@/components/IFCTreeBrowser';
import { ValidationDialog } from '@/components/ValidationDialog';
import { parseIFCFile, generateSampleData, ParseProgressCallback } from '@/lib/ifcParser';
import { parseIFC5File } from '@/lib/ifc5Parser';
import { ParsedIFCData, GraphNode, NodeType } from '@/types/graph';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

const Index = () => {
  const [parsedData, setParsedData] = useState<ParsedIFCData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseMessage, setParseMessage] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedTypes, setHighlightedTypes] = useState<NodeType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAttributes, setShowAttributes] = useState(false);
  const [showRelatedMetadata, setShowRelatedMetadata] = useState(false);


  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true);
    setParseProgress(0);
    setParseMessage('');
    
    const progressHandler: ParseProgressCallback = (progress) => {
      setParseProgress(progress.percentage);
      setParseMessage(progress.message);
    };
    
    try {
      let data: ParsedIFCData;
      
      if (file.name.toLowerCase().endsWith('.ifcx')) {
        data = await parseIFC5File(file);
      } else {
        data = await parseIFCFile(file, progressHandler);
      }
      
      setParsedData(data);
      toast.success(`Parsed ${data.metadata.entityCount} entities and ${data.metadata.relationshipCount} relationships`);
    } catch (error) {
      console.error('Error parsing IFC file:', error);
      toast.error('Failed to parse IFC file. Please try a valid IFC file.');
    } finally {
      setIsLoading(false);
      setParseProgress(0);
      setParseMessage('');
    }
  }, []);

  const handleLoadSample = useCallback(() => {
    const sampleData = generateSampleData();
    setParsedData(sampleData);
    toast.success('Sample building data loaded');
  }, []);

  const handleReset = useCallback(() => {
    setParsedData(null);
    setSelectedNode(null);
    setHighlightedTypes([]);
    setSearchQuery('');
    setShowAttributes(false);
    setShowRelatedMetadata(false);
  }, []);

  const handleNodeClick = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);
    setShowRelatedMetadata(false); // Reset metadata visibility when selecting new node
  }, []);

  const handleTypeToggle = useCallback((type: NodeType) => {
    setHighlightedTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header 
        hasData={!!parsedData} 
        onReset={handleReset}
        onLoadSample={handleLoadSample}
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
                progress={parseProgress}
                progressMessage={parseMessage}
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
                  <div className="h-full overflow-y-auto bg-card/50 backdrop-blur-sm">
                    {selectedNode ? (
                      <NodeDetailsPanel
                        node={selectedNode}
                        onClose={() => setSelectedNode(null)}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground p-4">
                        <div className="text-center">
                          <p className="text-sm">Select an entity to view details</p>
                        </div>
                      </div>
                    )}
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
                      showAttributes={showAttributes}
                      showRelatedMetadata={showRelatedMetadata}
                    />

                    <GraphControls
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      highlightedTypes={highlightedTypes}
                      onTypeToggle={handleTypeToggle}
                      showAttributes={showAttributes}
                      onAttributesToggle={setShowAttributes}
                      showRelatedMetadata={showRelatedMetadata}
                      onRelatedMetadataToggle={setShowRelatedMetadata}
                      selectedNode={selectedNode}
                    />

                    <StatsPanel metadata={parsedData.metadata} />
                    <Legend />
                  </div>
                </ResizablePanel>

                <ResizableHandle />

                {/* Tree Browser Panel - 30% (Right) */}
                <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
                  <div className="h-full overflow-hidden border-r border-border">
                    <IFCTreeBrowser
                      nodes={parsedData.allEntities || parsedData.graphData.nodes}
                      edges={parsedData.graphData.edges}
                      selectedNodeId={selectedNode?.id || null}
                      onNodeSelect={handleNodeClick}
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
