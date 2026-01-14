/**
 * Floating Nodes Panel
 * Displays isolated nodes and suggests connections
 */

import { useState, useMemo } from 'react';
import { AlertCircle, Link2, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { GraphNode, GraphEdge } from '@/types/graph';
import { findFloatingNodes, createBindingEdges, FloatingNode } from '@/lib/floatingNodeAnalyzer';
import { toast } from 'sonner';

interface FloatingNodesPanelProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onApplyBindings: (newEdges: GraphEdge[]) => void;
  onNodeSelect: (node: GraphNode) => void;
}

export function FloatingNodesPanel({
  nodes,
  edges,
  onApplyBindings,
  onNodeSelect,
}: FloatingNodesPanelProps) {
  const [selectedBindings, setSelectedBindings] = useState<Map<string, string[]>>(new Map());

  // Performance: Only process first 5000 nodes for large datasets
  const safeNodes = nodes.slice(0, 5000);
  const safeEdges = edges.filter(e => 
    safeNodes.some(n => n.id === e.source) && 
    safeNodes.some(n => n.id === e.target)
  );

  // Find floating nodes
  const floatingNodes = useMemo(() => {
    return findFloatingNodes(safeNodes, safeEdges);
  }, [safeNodes, safeEdges]);

  const handleToggleSuggestion = (nodeId: string, targetId: string) => {
    setSelectedBindings(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(nodeId) || [];
      
      if (current.includes(targetId)) {
        // Remove
        newMap.set(nodeId, current.filter(id => id !== targetId));
      } else {
        // Add
        newMap.set(nodeId, [...current, targetId]);
      }
      
      return newMap;
    });
  };

  const handleApplyBindings = () => {
    const newEdges: GraphEdge[] = [];
    
    floatingNodes.forEach(floatingNode => {
      const selectedTargets = selectedBindings.get(floatingNode.node.id) || [];
      
      selectedTargets.forEach(targetId => {
        const suggestion = floatingNode.suggestedConnections.find(
          s => s.targetNode.id === targetId
        );
        
        if (suggestion) {
          newEdges.push({
            id: `suggested-${floatingNode.node.id}-${targetId}`,
            source: floatingNode.node.id,
            target: targetId,
            type: suggestion.relationshipType || 'SUGGESTED_CONNECTION',
            label: `Suggested (${Math.round(suggestion.confidence * 100)}%)`,
          });
        }
      });
    });
    
    if (newEdges.length > 0) {
      onApplyBindings(newEdges);
      toast.success(`Applied ${newEdges.length} suggested connection(s)`);
      setSelectedBindings(new Map());
    } else {
      toast.warning('No connections selected');
    }
  };

  const totalSelected = Array.from(selectedBindings.values()).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  if (floatingNodes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-green-500" />
            Floating Nodes
          </CardTitle>
          <CardDescription>All nodes are properly connected</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Check className="h-12 w-12 mx-auto mb-2 text-green-500 opacity-50" />
            <p>No isolated nodes found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Floating Nodes ({floatingNodes.length})
            </CardTitle>
            <CardDescription>
              Isolated nodes with suggested connections
            </CardDescription>
          </div>
          {totalSelected > 0 && (
            <Button onClick={handleApplyBindings} size="sm">
              Apply {totalSelected} Connection{totalSelected !== 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <Accordion type="multiple" className="space-y-2">
            {floatingNodes.map((floating, idx) => {
              const selectedForNode = selectedBindings.get(floating.node.id) || [];
              
              return (
                <AccordionItem
                  key={floating.node.id}
                  value={floating.node.id}
                  className="border rounded-lg px-3"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <Badge variant={
                        floating.reason === 'no_connections' ? 'destructive' :
                        floating.reason === 'spatial_orphan' ? 'default' :
                        'secondary'
                      }>
                        {floating.reason === 'no_connections' ? 'Isolated' :
                         floating.reason === 'spatial_orphan' ? 'Spatial' :
                         'Property'}
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">
                          {floating.node.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {floating.node.ifcType} #{floating.node.expressId}
                        </p>
                      </div>
                      {selectedForNode.length > 0 && (
                        <Badge variant="outline" className="ml-auto">
                          {selectedForNode.length} selected
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          Suggested Connections ({floating.suggestedConnections.length})
                        </p>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => onNodeSelect(floating.node)}
                          className="h-auto p-0 text-xs"
                        >
                          View in Graph
                        </Button>
                      </div>
                      
                      {floating.suggestedConnections.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No automatic suggestions available
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {floating.suggestedConnections.map((suggestion, sidx) => {
                            const isSelected = selectedForNode.includes(suggestion.targetNode.id);
                            
                            return (
                              <div
                                key={suggestion.targetNode.id}
                                className={`p-2 rounded border transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'border-primary bg-primary/10'
                                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                }`}
                                onClick={() => handleToggleSuggestion(
                                  floating.node.id,
                                  suggestion.targetNode.id
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="outline" className="text-xs">
                                        {Math.round(suggestion.confidence * 100)}% match
                                      </Badge>
                                      {isSelected && (
                                        <Check className="h-3 w-3 text-primary" />
                                      )}
                                    </div>
                                    <p className="text-sm font-medium truncate">
                                      {suggestion.targetNode.label}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {suggestion.targetNode.ifcType}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {suggestion.reason}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
