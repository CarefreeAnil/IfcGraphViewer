/**
 * Consolidated Learning System
 * Compact side panel at bottom-left with step-by-step guidance and graph node highlighting
 */

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, ChevronRight, Lock, Unlock, CheckCircle2, BookOpen, Lightbulb, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { GraphNode } from '@/types/graph';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LearningLayer,
  LearningProgress,
  generateDynamicLearningPath,
  getInitialProgress,
  calculateProgress,
} from '@/lib/dynamicLearning';
import { WORKED_EXAMPLES } from '@/features/educational/data/learning';
import { PRACTICE_EXERCISES } from '@/features/educational/data/learning';

interface ConsolidatedLearningPanelProps {
  nodes: GraphNode[];
  selectedNode?: GraphNode | null;
  onNodeSelect?: (node: GraphNode) => void;
  onLayerChange?: (layerId: string) => void;
  onClose?: () => void;
}

interface GuidanceStep {
  title: string;
  explanation: string;
  action: string;
  lookFor: string;
  hint: string;
  ifcCode?: {
    ifc4?: string;
    ifc5?: string;
  };
  verifyQuestion?: string;
}

export function ConsolidatedLearningPanel({ nodes, selectedNode, onNodeSelect, onLayerChange, onClose }: ConsolidatedLearningPanelProps) {
  const [layers, setLayers] = useState<LearningLayer[]>([]);
  const [progress, setProgress] = useState<LearningProgress>(getInitialProgress());
  const [expandedLayer, setExpandedLayer] = useState<string | null>('project');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Guided example mode
  const [showingExample, setShowingExample] = useState(false);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Practice mode
  const [showingPractice, setShowingPractice] = useState(false);
  const [practiceLayerId, setPracticeLayerId] = useState<string | null>(null);
  const [practiceExerciseIndex, setPracticeExerciseIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState<string | string[] | null>(null);
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);

  useEffect(() => {
    console.log('[Learning Panel] Mounted with nodes:', nodes?.length ?? 0);
  }, []);

  // Generate dynamic learning path when nodes change
  useEffect(() => {
    if (nodes && nodes.length > 0) {
      console.log('[Learning Path] Generating from', nodes.length, 'nodes');
      const dynamicLayers = generateDynamicLearningPath(nodes);
      console.log('[Learning Path] Generated layers:', dynamicLayers.map(l => ({ id: l.id, entities: l.entities })));
      setLayers(dynamicLayers);

      const stored = localStorage.getItem('learning-progress');
      if (stored) {
        try {
          const loadedProgress = JSON.parse(stored);
          setProgress(loadedProgress);
          setExpandedLayer(loadedProgress.currentLayer);
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

  // Auto-highlight nodes when a step is shown
  useEffect(() => {
    if (!showingExample || !activeLayerId || !onNodeSelect) return;

    // Use intelligent node selection based on layer type (same logic as selectNodeForLayer)
    const layerEntityPriorities: Record<string, string[]> = {
      element: ['IfcWall', 'IfcSlab', 'IfcDoor', 'IfcWindow', 'IfcBeam', 'IfcColumn', 'IfcStair'],
      property: ['IfcPropertySet', 'IfcElementQuantity', 'IfcMaterial', 'IfcMaterialLayerSet'],
      project: ['IfcProject'],
      spatial: ['IfcBuilding', 'IfcBuildingStorey', 'IfcSpace'],
      relationship: [],
    };

    const priorities = layerEntityPriorities[activeLayerId] || [];

    // Try to find node matching priority list
    for (const priority of priorities) {
      const node = nodes.find(n =>
        (n.ifcType || n.type || '').includes(priority)
      );
      if (node) {
        onNodeSelect(node);
        return;
      }
    }

    // Fallback: find any node matching the layer
    const layer = layers.find(l => l.id === activeLayerId);
    if (layer && layer.entities.length > 0) {
      const matchingNode = nodes.find(n => {
        const entityType = n.ifcType || n.type || '';
        return layer.entities.some(e => entityType.includes(e));
      });
      if (matchingNode) {
        onNodeSelect(matchingNode);
      }
    }
  }, [showingExample, activeLayerId, currentStepIndex, layers, nodes, onNodeSelect]);

  const generateGuidanceForLayer = (layer: LearningLayer): GuidanceStep[] => {
    console.log('[Guidance] Generating for layer:', layer.id);
    const example = WORKED_EXAMPLES.find(ex => ex.id === layer.id);
    console.log('[Guidance] Found example:', !!example, example?.title);
    if (!example) {
      console.warn('[Guidance] No example found for layer:', layer.id);
      return [];
    }

    const steps = example.steps.map(step => ({
      title: step.title,
      explanation: step.explanation,
      action: step.action,
      lookFor: step.lookFor,
      hint: step.hint,
      ifcCode: step.ifcCode,
      verifyQuestion: step.verifyQuestion,
    }));
    console.log('[Guidance] Generated steps:', steps.length);
    return steps;
  };

  const selectNodeForLayer = (layerId: string) => {
    if (!onNodeSelect || nodes.length === 0) return;

    // Define priority entity types for each layer
    const layerEntityPriorities: Record<string, string[]> = {
      element: ['IfcWall', 'IfcSlab', 'IfcDoor', 'IfcWindow', 'IfcBeam', 'IfcColumn', 'IfcStair'],
      property: ['IfcPropertySet', 'IfcElementQuantity', 'IfcMaterial', 'IfcMaterialLayerSet'],
      project: ['IfcProject'],
      spatial: ['IfcBuilding', 'IfcBuildingStorey', 'IfcSpace'],
      relationship: [],
    };

    const priorities = layerEntityPriorities[layerId] || [];

    // Try to find node matching priority list
    for (const priority of priorities) {
      const node = nodes.find(n =>
        (n.ifcType || n.type || '').includes(priority)
      );
      if (node) {
        onNodeSelect(node);
        // Notify parent about layer change
        onLayerChange?.(layerId);
        return;
      }
    }

    // Fallback: find any node matching the layer
    const layer = layers.find(l => l.id === layerId);
    if (layer && layer.entities.length > 0) {
      const matchingNode = nodes.find(n => {
        const entityType = n.ifcType || n.type || '';
        return layer.entities.some(e => entityType.includes(e));
      });
      if (matchingNode) {
        onNodeSelect(matchingNode);
        // Notify parent about layer change
        onLayerChange?.(layerId);
      }
    }
  };

  const handleExampleClick = (layerId: string) => {
    console.log('[Example Click] Layer:', layerId);
    const layer = layers.find(l => l.id === layerId);
    console.log('[Example Click] Found layer:', !!layer);
    if (!layer) return;

    const steps = generateGuidanceForLayer(layer);
    console.log('[Example Click] Steps:', steps.length);
    if (steps.length === 0) return;

    console.log('[Example Click] Starting example...');
    setActiveLayerId(layerId);
    setCurrentStepIndex(0);
    setShowingExample(true);
    setExpandedLayer(null);
  };

  const handleNextStep = () => {
    const layer = layers.find(l => l.id === activeLayerId);
    if (!layer) return;

    const steps = generateGuidanceForLayer(layer);
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      // Completed example - mark as done and show Practice button
      const completedLayerId = activeLayerId;
      setProgress(prev => ({
        ...prev,
        layers: {
          ...prev.layers,
          [completedLayerId!]: { ...prev.layers[completedLayerId!], exampleCompleted: true },
        },
      }));
      setShowingExample(false);
      setCurrentStepIndex(0);
      // Expand the layer so user can see Practice button
      setExpandedLayer(completedLayerId);
      setActiveLayerId(null);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleCloseExample = () => {
    setShowingExample(false);
    setActiveLayerId(null);
    setCurrentStepIndex(0);
  };

  const handlePracticeClick = (layerId: string) => {
    console.log('[Practice Click] Layer:', layerId);
    const exercises = PRACTICE_EXERCISES.filter(ex => ex.id.startsWith(layerId + '-'));
    console.log('[Practice Click] Found exercises:', exercises.length);

    if (exercises.length === 0) {
      console.warn('[Practice] No exercises for layer:', layerId);
      return;
    }

    setPracticeLayerId(layerId);
    setPracticeExerciseIndex(0);
    setUserAnswer(null);
    setPracticeSubmitted(false);
    setShowingPractice(true);
    setExpandedLayer(null);
  };

  const getPracticeExercisesForLayer = (layerId: string) => {
    return PRACTICE_EXERCISES.filter(ex => ex.id.startsWith(layerId + '-'));
  };

  const handlePracticeSubmit = () => {
    if (!practiceLayerId) return;
    const exercises = getPracticeExercisesForLayer(practiceLayerId);
    const currentExercise = exercises[practiceExerciseIndex];

    if (!currentExercise) return;

    console.log('[Practice Submit] Answer:', userAnswer, 'Correct:', currentExercise.answer);
    setPracticeSubmitted(true);
  };

  const handlePracticeNext = () => {
    if (!practiceLayerId) return;
    const exercises = getPracticeExercisesForLayer(practiceLayerId);

    if (practiceExerciseIndex < exercises.length - 1) {
      setPracticeExerciseIndex(practiceExerciseIndex + 1);
      setUserAnswer(null);
      setPracticeSubmitted(false);
    } else {
      // All exercises done - mark practice as completed
      setProgress(prev => ({
        ...prev,
        layers: {
          ...prev.layers,
          [practiceLayerId!]: { ...prev.layers[practiceLayerId!], practiceCompleted: true },
        },
      }));

      // Unlock next layer
      const currentIndex = layers.findIndex(l => l.id === practiceLayerId);
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
      }

      setShowingPractice(false);
      setPracticeLayerId(null);
    }
  };

  const handleClosePractice = () => {
    setShowingPractice(false);
    setPracticeLayerId(null);
    setPracticeExerciseIndex(0);
    setUserAnswer(null);
    setPracticeSubmitted(false);
  };

  const totalProgress = calculateProgress(progress);

  // Render practice player (compact card at bottom-left)
  if (showingPractice && practiceLayerId) {
    const layer = layers.find(l => l.id === practiceLayerId);
    if (!layer) return null;

    const exercises = getPracticeExercisesForLayer(practiceLayerId);
    if (exercises.length === 0) return null;

    const exercise = exercises[practiceExerciseIndex];
    if (!exercise) return null;

    const isAnswerCorrect = Array.isArray(exercise.answer)
      ? Array.isArray(userAnswer) && exercise.answer.sort().join('|') === (userAnswer as string[]).sort().join('|')
      : userAnswer === exercise.answer;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-4 left-4 z-40"
      >
        <Card className="w-96 shadow-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    style={{
                      backgroundColor: layer.color + '20',
                      borderColor: layer.color + '40',
                      color: layer.color,
                      border: `1px solid ${layer.color}40`,
                    }}
                  >
                    {layer.name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {practiceExerciseIndex + 1}/{exercises.length}
                  </span>
                </div>
                <h3 className="text-sm font-semibold">{exercise.title}</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={handleClosePractice}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>

            {/* Progress bar */}
            <div className="pt-2">
              <Progress value={((practiceExerciseIndex + 1) / exercises.length) * 100} className="h-1" />
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Question */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Question</h4>
              <p className="text-xs font-medium leading-relaxed">{exercise.question}</p>
            </div>

            {/* Options - Rendered based on exercise type */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Your Answer</h4>

              {exercise.type === 'predict' && Array.isArray(exercise.options) && (
                <div className="space-y-1.5">
                  {(exercise.options as string[]).map((option, idx) => (
                    <label key={idx} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-accent/50 transition-colors">
                      <input
                        type="radio"
                        name="answer"
                        value={option}
                        checked={userAnswer === option}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        disabled={practiceSubmitted}
                        className="w-3 h-3"
                      />
                      <span className="text-xs">{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {exercise.type === 'identify' && Array.isArray(exercise.options) && (
                <div className="space-y-1.5">
                  {(exercise.options as string[]).map((option, idx) => (
                    <label key={idx} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-accent/50 transition-colors">
                      <input
                        type="checkbox"
                        checked={Array.isArray(userAnswer) && userAnswer.includes(option)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setUserAnswer(Array.isArray(userAnswer) ? [...userAnswer, option] : [option]);
                          } else {
                            setUserAnswer(Array.isArray(userAnswer) ? userAnswer.filter(a => a !== option) : []);
                          }
                        }}
                        disabled={practiceSubmitted}
                        className="w-3 h-3"
                      />
                      <span className="text-xs">{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {exercise.type === 'arrange' && Array.isArray(exercise.options) && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground italic mb-2">
                    Click items to arrange them in order (click the first item, then second, etc.)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(exercise.options as string[]).map((option, idx) => {
                      const selectedIndex = Array.isArray(userAnswer) ? userAnswer.indexOf(option) : -1;
                      const isSelected = selectedIndex >= 0;

                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (!practiceSubmitted) {
                              if (isSelected) {
                                setUserAnswer(Array.isArray(userAnswer) ? userAnswer.filter(a => a !== option) : []);
                              } else {
                                setUserAnswer(Array.isArray(userAnswer) ? [...userAnswer, option] : [option]);
                              }
                            }
                          }}
                          disabled={practiceSubmitted}
                          className={`text-xs px-2 py-1.5 rounded border-2 transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100'
                              : 'border-muted bg-muted/30 text-muted-foreground hover:border-blue-300'
                          } ${practiceSubmitted ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                        >
                          {isSelected ? `${selectedIndex + 1}. ` : ''}{option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Feedback after submission */}
            {practiceSubmitted && (
              <div className={`p-2 rounded border ${isAnswerCorrect
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex gap-2">
                  {isAnswerCorrect ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className={`text-xs font-semibold mb-0.5 ${isAnswerCorrect
                      ? 'text-emerald-900 dark:text-emerald-100'
                      : 'text-red-900 dark:text-red-100'
                    }`}>
                      {isAnswerCorrect ? 'Correct!' : 'Not quite right'}
                    </h4>
                    <p className={`text-xs leading-relaxed ${isAnswerCorrect
                      ? 'text-emerald-800 dark:text-emerald-200'
                      : 'text-red-800 dark:text-red-200'
                    }`}>
                      {exercise.explanation}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          {/* Navigation */}
          <div className="flex gap-2 p-3 border-t bg-muted/30">
            {!practiceSubmitted ? (
              <Button
                size="sm"
                className="text-xs h-7 flex-1"
                style={{ backgroundColor: layer.color }}
                onClick={handlePracticeSubmit}
                disabled={userAnswer === null || (Array.isArray(userAnswer) && userAnswer.length === 0)}
              >
                Submit
              </Button>
            ) : (
              <>
                {practiceExerciseIndex === exercises.length - 1 ? (
                  <Button
                    size="sm"
                    className="text-xs h-7 flex-1"
                    style={{ backgroundColor: layer.color }}
                    onClick={handlePracticeNext}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Complete Practice
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="text-xs h-7 flex-1"
                    style={{ backgroundColor: layer.color }}
                    onClick={handlePracticeNext}
                  >
                    Next Exercise
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </>
            )}
          </div>
        </Card>
      </motion.div>
    );
  }

  // Render example player (compact card at bottom-left)
  if (showingExample && activeLayerId) {
    const layer = layers.find(l => l.id === activeLayerId);
    if (!layer) return null;

    const steps = generateGuidanceForLayer(layer);
    if (steps.length === 0) return null;

    const step = steps[currentStepIndex];
    const progressPercent = ((currentStepIndex + 1) / steps.length) * 100;
    const isLastStep = currentStepIndex === steps.length - 1;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-4 left-4 z-40"
      >
        <Card className="w-96 shadow-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    style={{
                      backgroundColor: layer.color + '20',
                      borderColor: layer.color + '40',
                      color: layer.color,
                      border: `1px solid ${layer.color}40`,
                    }}
                  >
                    {layer.name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {currentStepIndex + 1}/{steps.length}
                  </span>
                </div>
                <h3 className="text-sm font-semibold">{step.title}</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={handleCloseExample}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>

            {/* Progress bar */}
            <div className="pt-2">
              <Progress value={progressPercent} className="h-1" />
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Explanation */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">What to Learn</h4>
              <p className="text-xs leading-relaxed">{step.explanation}</p>
            </div>

            {/* Action */}
            <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="flex gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-0.5">
                    What to Do
                  </h4>
                  <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">{step.action}</p>
                </div>
              </div>
            </div>

            {/* Look For */}
            <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <div className="flex gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-emerald-900 dark:text-emerald-100 mb-0.5">
                    Look For
                  </h4>
                  <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">{step.lookFor}</p>
                </div>
              </div>
            </div>

            {/* Hint */}
            <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <div className="flex gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-0.5">
                    Helpful Hint
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">{step.hint}</p>
                </div>
              </div>
            </div>

            {/* IFC Code */}
            {step.ifcCode && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">IFC Code</h4>
                {step.ifcCode.ifc4 && (
                  <div className="text-[9px] bg-slate-100 dark:bg-slate-800 p-1.5 rounded overflow-x-auto font-mono text-slate-800 dark:text-slate-200">
                    {step.ifcCode.ifc4}
                  </div>
                )}
              </div>
            )}

            {/* Verify Question */}
            {step.verifyQuestion && (
              <div className="p-2 rounded bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                <h4 className="text-xs font-semibold text-purple-900 dark:text-purple-100 mb-1">
                  Verify Understanding
                </h4>
                <p className="text-xs text-purple-800 dark:text-purple-200 italic">{step.verifyQuestion}</p>
              </div>
            )}
          </CardContent>

          {/* Navigation */}
          <div className="flex gap-2 p-3 border-t bg-muted/30">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={handlePrevStep}
              disabled={currentStepIndex === 0}
            >
              <ChevronRight className="w-3 h-3 rotate-180 mr-1" />
              Back
            </Button>

            {isLastStep ? (
              <Button
                size="sm"
                className="text-xs h-7 flex-1"
                style={{ backgroundColor: layer.color }}
                onClick={handleNextStep}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Complete
              </Button>
            ) : (
              <Button
                size="sm"
                className="text-xs h-7 flex-1"
                style={{ backgroundColor: layer.color }}
                onClick={handleNextStep}
              >
                Next
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        </Card>
      </motion.div>
    );
  }

  // Render mini collapsed state
  if (isCollapsed) {
    return (
      <div className="fixed bottom-4 left-4 z-40">
        <Button
          onClick={() => setIsCollapsed(false)}
          className="shadow-xl gap-2"
        >
          <BookOpen className="w-4 h-4" />
          Learning
        </Button>
      </div>
    );
  }

  // Render main learning path panel
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-4 left-4 z-40"
    >
      <Card className="w-80 shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
              Learning Path
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsCollapsed(true)}
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Progress</span>
              <span className="text-muted-foreground">{totalProgress}%</span>
            </div>
            <Progress value={totalProgress} className="h-1.5" />
          </div>
        </CardHeader>

        <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
          {layers.map((layer, index) => {
            const layerProgress = progress.layers[layer.id];
            const isUnlocked = layerProgress.unlocked;
            const isCurrent = progress.currentLayer === layer.id;
            const isExpanded = expandedLayer === layer.id;
            const isCompleted = layerProgress.exampleCompleted && layerProgress.practiceCompleted;

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
                  onClick={() => {
                    if (isUnlocked) {
                      setExpandedLayer(isExpanded ? null : layer.id);
                      selectNodeForLayer(layer.id);
                    }
                  }}
                  disabled={!isUnlocked}
                  className={cn(
                    'w-full p-2.5 text-left transition-colors',
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
                            className="text-xs font-semibold"
                            style={{ color: isUnlocked ? layer.color : undefined }}
                          >
                            {layer.name}
                          </h4>
                          {isCurrent && !isCompleted && (
                            <Badge variant="secondary" className="text-[8px] px-1 h-4">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {layer.description}
                        </p>
                      </div>
                    </div>
                    {isUnlocked && (
                      <ChevronDown
                        className={cn(
                          'w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0',
                          isExpanded && 'rotate-180'
                        )}
                      />
                    )}
                  </div>
                </button>

                {/* Layer Content */}
                <AnimatePresence>
                  {isExpanded && isUnlocked && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-2.5 pb-2.5 pt-1 space-y-2 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs h-7 gap-1"
                          onClick={() => handleExampleClick(layer.id)}
                        >
                          <BookOpen className="w-3 h-3" />
                          Example
                          {layerProgress.exampleCompleted && (
                            <CheckCircle2 className="w-3 h-3 ml-auto text-emerald-500" />
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs h-7 gap-1"
                          disabled={!layerProgress.exampleCompleted}
                          onClick={() => handlePracticeClick(layer.id)}
                        >
                          <Lightbulb className="w-3 h-3" />
                          Practice
                          {layerProgress.practiceCompleted && (
                            <CheckCircle2 className="w-3 h-3 ml-auto text-emerald-500" />
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}
