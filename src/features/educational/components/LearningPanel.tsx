/**
 * Learning Panel - Main Orchestrator
 * Routes between overview, worked-example, practice, and free-explore modes
 */

import { useState } from 'react';
import { useLearning } from '@/contexts/LearningContext';
import { LayerProgressMap } from './LayerProgressMap';
import { WorkedExamplePlayer } from './WorkedExamplePlayer';
import { PracticePlayer } from './PracticePlayer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  GraduationCap,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function LearningPanel() {
  const { mode, setMode, resetProgress, progress } = useLearning();
  const [isExpanded, setIsExpanded] = useState(true);

  // Show appropriate player based on mode
  if (mode === 'worked-example') {
    return (
      <div className="absolute bottom-4 left-4 z-50">
        <WorkedExamplePlayer />
      </div>
    );
  }

  if (mode === 'practice') {
    return (
      <div className="absolute bottom-4 left-4 z-50">
        <PracticePlayer />
      </div>
    );
  }

  // Overview mode - show progress map
  return (
    <div className="absolute bottom-4 left-4 z-50">
      <Card
        className={cn(
          'w-72 shadow-xl transition-all duration-200',
          !isExpanded && 'w-auto'
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm">Learning Path</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              {isExpanded && mode === 'overview' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setMode('free-explore')}
                  title="Free explore mode"
                >
                  <Compass className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-4">
            {mode === 'free-explore' ? (
              <div className="space-y-3">
                <div className="text-center py-4">
                  <Compass className="w-8 h-8 text-primary mx-auto mb-2" />
                  <h3 className="text-sm font-medium">Free Exploration Mode</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Explore the model freely. Click entities, change levels, discover connections!
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => setMode('overview')}
                >
                  <GraduationCap className="w-3 h-3" />
                  Back to Guided Learning
                </Button>
              </div>
            ) : (
              <>
                <LayerProgressMap />

                {/* Reset button (only show if some progress made) */}
                {progress.totalScore > 0 && (
                  <div className="pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground hover:text-destructive"
                      onClick={resetProgress}
                    >
                      <RotateCcw className="w-3 h-3 mr-1.5" />
                      Reset Progress
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
