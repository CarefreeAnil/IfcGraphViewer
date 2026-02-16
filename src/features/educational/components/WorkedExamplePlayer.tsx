/**
 * Worked Example Player Component
 * Step-by-step guided walkthrough with graph highlighting
 */

import { useLearning } from '@/contexts/LearningContext';
import { LAYER_DEFINITIONS } from '@/types/learning';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, X, BookOpen, Lightbulb, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export function WorkedExamplePlayer() {
  const {
    currentExample,
    currentExampleStep,
    nextExampleStep,
    prevExampleStep,
    completeWorkedExample,
    setMode,
  } = useLearning();

  if (!currentExample) return null;

  const step = currentExample.steps[currentExampleStep];
  const progress = ((currentExampleStep + 1) / currentExample.steps.length) * 100;
  const isLastStep = currentExampleStep === currentExample.steps.length - 1;
  const layerDef = LAYER_DEFINITIONS[currentExample.layer];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="w-96"
    >
      <Card className="shadow-2xl border-2" style={{ borderColor: layerDef.color + '40' }}>
        <CardHeader className="pb-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: layerDef.color + '20' }}
              >
                <BookOpen className="w-4 h-4" style={{ color: layerDef.color }} />
              </div>
              <div>
                <CardTitle className="text-sm">{currentExample.title}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Step {currentExampleStep + 1} of {currentExample.steps.length}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                completeWorkedExample();
                setMode('overview');
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Progress Bar */}
          <Progress value={progress} className="h-1.5" />
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Step Title */}
          <div>
            <Badge variant="outline" className="mb-2">
              {layerDef.name}
            </Badge>
            <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
          </div>

          {/* Explanation */}
          <div className="space-y-2">
            <p className="text-sm text-foreground leading-relaxed">{step.explanation}</p>
          </div>

          {/* Hint Box */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">{step.hint}</p>
          </div>

          {/* Highlighted Entity Types */}
          {step.highlightEntityTypes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Looking for:</p>
              <div className="flex flex-wrap gap-1.5">
                {step.highlightEntityTypes.map((type) => (
                  <Badge
                    key={type}
                    variant="secondary"
                    className="text-xs font-mono"
                    style={{ backgroundColor: layerDef.color + '15' }}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Code Example (if available) */}
          {step.code && (
            <div className="rounded-lg bg-slate-900 p-3 overflow-x-auto">
              <code className="text-xs text-slate-100 font-mono">
                <pre className="whitespace-pre-wrap">{step.code.ifc4 || step.code.ifc5}</pre>
              </code>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={prevExampleStep}
              disabled={currentExampleStep === 0}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </Button>

            {isLastStep ? (
              <Button
                size="sm"
                className="gap-1.5"
                style={{ backgroundColor: layerDef.color }}
                onClick={completeWorkedExample}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Complete
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5"
                style={{ backgroundColor: layerDef.color }}
                onClick={nextExampleStep}
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
