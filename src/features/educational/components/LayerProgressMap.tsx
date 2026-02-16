/**
 * Layer Progress Map Component
 * Shows the 5-layer learning progression with unlock/completion status
 */

import { useLearning } from '@/contexts/LearningContext';
import { IFCLayer, LAYER_DEFINITIONS } from '@/types/learning';
import { cn } from '@/lib/utils';
import { Lock, Unlock, CheckCircle2, Circle, BookOpen, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

const LAYER_ORDER: IFCLayer[] = ['project', 'spatial', 'element', 'relationship', 'property'];

export function LayerProgressMap() {
  const {
    progress,
    isLayerUnlocked,
    startWorkedExample,
    startPractice,
    unlockNextLayer,
    mode,
  } = useLearning();

  const handleUnlock = () => {
    const success = unlockNextLayer();
    if (!success) {
      // Could show toast: "Complete worked example and practice first"
    }
  };

  return (
    <div className="space-y-3">
      {/* Overall Progress */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">Learning Progress</span>
        <span className="text-muted-foreground">{progress.totalScore}%</span>
      </div>
      <Progress value={progress.totalScore} className="h-1.5" />

      {/* Layer Cards */}
      <div className="space-y-2 mt-4">
        {LAYER_ORDER.map((layer, index) => {
          const definition = LAYER_DEFINITIONS[layer];
          const layerProgress = progress.layers[layer];
          const isUnlocked = isLayerUnlocked(layer);
          const isCurrent = progress.currentLayer === layer;
          const isCompleted = layerProgress.workedExampleCompleted && layerProgress.practiceCompleted;
          const canUnlock = isCurrent && isCompleted && index < LAYER_ORDER.length - 1;

          return (
            <div
              key={layer}
              className={cn(
                "rounded-lg border p-3 transition-all",
                isUnlocked
                  ? isCurrent
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                  : "border-dashed border-muted bg-muted/20 opacity-60"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isUnlocked ? (
                    isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Unlock className="w-4 h-4 text-primary" />
                    )
                  ) : (
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span
                    className={cn(
                      "text-sm font-medium",
                      !isUnlocked && "text-muted-foreground"
                    )}
                    style={{ color: isUnlocked ? definition.color : undefined }}
                  >
                    {definition.name}
                  </span>
                </div>
                {isCurrent && !isCompleted && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                    Current
                  </Badge>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                {definition.description}
              </p>

              {/* Actions */}
              {isUnlocked && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={layerProgress.workedExampleCompleted ? "outline" : "default"}
                    className="h-7 text-xs gap-1.5 flex-1"
                    onClick={() => startWorkedExample(layer)}
                    disabled={mode !== 'overview'}
                  >
                    <BookOpen className="w-3 h-3" />
                    Example
                    {layerProgress.workedExampleCompleted && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant={layerProgress.practiceCompleted ? "outline" : "secondary"}
                    className="h-7 text-xs gap-1.5 flex-1"
                    onClick={() => startPractice(layer)}
                    disabled={mode !== 'overview' || !layerProgress.workedExampleCompleted}
                  >
                    <Dumbbell className="w-3 h-3" />
                    Practice
                    {layerProgress.practiceCompleted && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    )}
                  </Button>
                </div>
              )}

              {/* Unlock Next Button */}
              {canUnlock && (
                <Button
                  size="sm"
                  className="w-full mt-2 h-7 text-xs gap-1.5"
                  onClick={handleUnlock}
                >
                  <Unlock className="w-3 h-3" />
                  Unlock {LAYER_DEFINITIONS[LAYER_ORDER[index + 1]].name}
                </Button>
              )}

              {/* Progress indicators */}
              {isUnlocked && !isCompleted && (
                <div className="flex items-center gap-3 mt-2 pt-2 border-t">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    {layerProgress.workedExampleCompleted ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Circle className="w-3 h-3" />
                    )}
                    Example
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    {layerProgress.practiceCompleted ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Circle className="w-3 h-3" />
                    )}
                    Practice
                  </div>
                  {layerProgress.score > 0 && (
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {layerProgress.score}% score
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
