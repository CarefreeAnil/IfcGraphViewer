/**
 * Simplified Learning Panel - Matches Reference Image
 * Dynamic 5-layer system that analyzes actual model content
 */

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Lock, Unlock, Circle, CheckCircle2, BookOpen, Dumbbell } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { GraphNode } from '@/types/graph';
import {
  LearningLayer,
  LearningProgress,
  generateDynamicLearningPath,
  getInitialProgress,
  calculateProgress,
  LAYER_CONFIG,
} from '@/lib/dynamicLearning';

interface SimpleLearningPanelProps {
  nodes: GraphNode[]; // Model graph nodes to analyze
  onClose?: () => void;
}

export function SimpleLearningPanel({ nodes, onClose }: SimpleLearningPanelProps) {
  const [layers, setLayers] = useState<LearningLayer[]>([]);
  const [progress, setProgress] = useState<LearningProgress>(getInitialProgress());
  const [expandedLayer, setExpandedLayer] = useState<string | null>('project');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Generate dynamic learning path when nodes change
  useEffect(() => {
    if (nodes && nodes.length > 0) {
      const dynamicLayers = generateDynamicLearningPath(nodes);
      setLayers(dynamicLayers);

      // Load progress from localStorage
      const stored = localStorage.getItem('learning-progress');
      if (stored) {
        try {
          setProgress(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to load progress:', e);
        }
      }
    }
  }, [nodes]);

  // Save progress to localStorage
  useEffect(() => {
    localStorage.setItem('learning-progress', JSON.stringify(progress));
  }, [progress]);

  const handleExampleClick = (layerId: string) => {
    console.log('Start example for:', layerId);
    // TODO: Integrate with your existing guided exploration
  };

  const handlePracticeClick = (layerId: string) => {
    console.log('Start practice for:', layerId);
    // TODO: Add practice exercises
  };

  const handleUnlockNext = () => {
    const currentIndex = layers.findIndex(l => l.id === progress.currentLayer);
    if (currentIndex < layers.length - 1) {
      const nextLayer = layers[currentIndex + 1];
      setProgress(prev => ({
        ...prev,
        currentLayer: nextLayer.id,
        layers: {
          ...prev.layers,
          [nextLayer.id]: { ...prev.layers[nextLayer.id], unlocked: true },
        },
      }));
      setExpandedLayer(nextLayer.id);
    }
  };

  const totalProgress = calculateProgress(progress);

  if (isCollapsed) {
    return (
      <div className="fixed bottom-4 left-4 z-40">
        <Button
          onClick={() => setIsCollapsed(false)}
          className="shadow-2xl gap-2"
        >
          <BookOpen className="w-4 h-4" />
          Learning Path
        </Button>
      </div>
    );
  }

  return (
    <Card className="fixed bottom-4 left-4 z-40 w-80 shadow-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
              Learning Path
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsCollapsed(true)}
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Learning Progress</span>
            <span className="text-muted-foreground">{totalProgress}%</span>
          </div>
          <Progress value={totalProgress} className="h-1.5" />
        </div>
      </CardHeader>

      <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
        {layers.map((layer, index) => {
          const layerProgress = progress.layers[layer.id];
          const isUnlocked = layerProgress.unlocked;
          const isCurrent = progress.currentLayer === layer.id;
          const isExpanded = expandedLayer === layer.id;
          const isCompleted = layerProgress.exampleCompleted && layerProgress.practiceCompleted;
          const canUnlock = isCurrent && isCompleted && index < layers.length - 1;

          return (
            <div
              key={layer.id}
              className={cn(
                'rounded-lg border transition-all',
                isUnlocked
                  ? isCurrent
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card'
                  : 'border-dashed border-muted-foreground/30 bg-muted/20 opacity-60'
              )}
            >
              {/* Layer Header */}
              <button
                onClick={() => isUnlocked && setExpandedLayer(isExpanded ? null : layer.id)}
                disabled={!isUnlocked}
                className={cn(
                  'w-full p-3 text-left transition-colors',
                  isUnlocked && 'hover:bg-accent/50'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="mt-0.5">
                      {isUnlocked ? (
                        isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Unlock className="w-4 h-4 text-primary" />
                        )
                      ) : (
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4
                          className={cn(
                            'text-sm font-semibold',
                            !isUnlocked && 'text-muted-foreground'
                          )}
                          style={{ color: isUnlocked ? layer.color : undefined }}
                        >
                          {layer.name}
                        </h4>
                        {isCurrent && !isCompleted && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 h-4">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {layer.description}
                      </p>
                    </div>
                  </div>
                  {isUnlocked && (
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-muted-foreground transition-transform flex-shrink-0',
                        isExpanded && 'rotate-180'
                      )}
                    />
                  )}
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && isUnlocked && (
                <div className="px-3 pb-3 space-y-2 border-t">
                  {/* Entity Types Found */}
                  {layer.entities.length > 0 && (
                    <div className="pt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        Found in this model:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {layer.entities.slice(0, 4).map((entity) => (
                          <Badge
                            key={entity}
                            variant="outline"
                            className="text-[10px] font-mono px-1.5 py-0"
                            style={{
                              borderColor: layer.color + '40',
                              backgroundColor: layer.color + '10',
                            }}
                          >
                            {entity}
                          </Badge>
                        ))}
                        {layer.entities.length > 4 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            +{layer.entities.length - 4} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant={layerProgress.exampleCompleted ? 'outline' : 'default'}
                      className="h-7 text-xs gap-1.5 flex-1"
                      onClick={() => handleExampleClick(layer.id)}
                    >
                      <BookOpen className="w-3 h-3" />
                      Example
                      {layerProgress.exampleCompleted && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant={layerProgress.practiceCompleted ? 'outline' : 'secondary'}
                      className="h-7 text-xs gap-1.5 flex-1"
                      onClick={() => handlePracticeClick(layer.id)}
                      disabled={!layerProgress.exampleCompleted}
                    >
                      <Dumbbell className="w-3 h-3" />
                      Practice
                      {layerProgress.practiceCompleted && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      )}
                    </Button>
                  </div>

                  {/* Progress Indicators */}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
                    <div className="flex items-center gap-1">
                      {layerProgress.exampleCompleted ? (
                        <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
                      ) : (
                        <Circle className="w-2 h-2" />
                      )}
                      Example
                    </div>
                    <div className="flex items-center gap-1">
                      {layerProgress.practiceCompleted ? (
                        <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
                      ) : (
                        <Circle className="w-2 h-2" />
                      )}
                      Practice
                    </div>
                  </div>
                </div>
              )}

              {/* Unlock Next Button */}
              {canUnlock && !isExpanded && (
                <div className="px-3 pb-3">
                  <Button
                    size="sm"
                    className="w-full h-7 text-xs gap-1.5"
                    onClick={handleUnlockNext}
                  >
                    <Unlock className="w-3 h-3" />
                    Unlock {layers[index + 1]?.name}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
