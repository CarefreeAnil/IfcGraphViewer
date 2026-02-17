/**
 * Practice Player Component
 * Interactive exercises: multiple-choice, drag-connect, predict-verify
 */

import { useState } from 'react';
import { useLearning } from '@/contexts/LearningContext';
import { LAYER_DEFINITIONS, PracticeExercise } from '@/types/learning';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Dumbbell,
  CheckCircle2,
  XCircle,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function PracticePlayer() {
  const {
    currentPractice,
    currentPracticeIndex,
    submitPracticeAnswer,
    nextPracticeExercise,
    prevPracticeExercise,
    completePractice,
    setMode,
  } = useLearning();

  const [userAnswer, setUserAnswer] = useState<any>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  if (!currentPractice.length) return null;

  const exercise = currentPractice[currentPracticeIndex];
  const progress = ((currentPracticeIndex + 1) / currentPractice.length) * 100;
  const isLastExercise = currentPracticeIndex === currentPractice.length - 1;
  const layerDef = LAYER_DEFINITIONS[exercise.layer];

  const handleSubmit = () => {
    const correct = checkAnswer(exercise, userAnswer);
    setIsCorrect(correct);
    setShowFeedback(true);
    submitPracticeAnswer(correct);
  };

  const handleNext = () => {
    setUserAnswer(null);
    setShowFeedback(false);
    if (isLastExercise) {
      completePractice();
    } else {
      nextPracticeExercise();
    }
  };

  const handlePrev = () => {
    setUserAnswer(null);
    setShowFeedback(false);
    prevPracticeExercise();
  };

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
                <Dumbbell className="w-4 h-4" style={{ color: layerDef.color }} />
              </div>
              <div>
                <CardTitle className="text-sm">Practice Exercise</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {currentPracticeIndex + 1} of {currentPractice.length}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                completePractice();
                setMode('overview');
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <Progress value={progress} className="h-1.5" />
        </CardHeader>

        <CardContent className="space-y-4">
          <Badge variant="outline" style={{ borderColor: layerDef.color }}>
            {layerDef.name}
          </Badge>

          {/* Question */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">{exercise.question}</h3>
            {exercise.hint && (
              <div className="flex items-start gap-2 mt-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                <Lightbulb className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">{exercise.hint}</p>
              </div>
            )}
          </div>

          {/* Exercise based on type */}
          <div className="space-y-3">
            {exercise.type === 'multiple-choice' && (
              <MultipleChoiceExercise
                exercise={exercise}
                userAnswer={userAnswer}
                setUserAnswer={setUserAnswer}
                showFeedback={showFeedback}
              />
            )}
            {exercise.type === 'predict-verify' && (
              <PredictVerifyExercise
                exercise={exercise}
                userAnswer={userAnswer}
                setUserAnswer={setUserAnswer}
              />
            )}
            {exercise.type === 'drag-connect' && (
              <DragConnectExercise
                exercise={exercise}
                userAnswer={userAnswer}
                setUserAnswer={setUserAnswer}
              />
            )}
          </div>

          {/* Feedback */}
          <AnimatePresence>
            {showFeedback && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={cn(
                  'flex items-start gap-2 p-3 rounded-lg border',
                  isCorrect
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                )}
              >
                {isCorrect ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                )}
                <div>
                  <p
                    className={cn(
                      'text-sm font-medium',
                      isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                    )}
                  >
                    {isCorrect ? 'Correct!' : 'Not quite right'}
                  </p>
                  {exercise.explanation && (
                    <p className="text-xs text-muted-foreground mt-1">{exercise.explanation}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handlePrev}
              disabled={currentPracticeIndex === 0}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </Button>

            {showFeedback ? (
              <Button
                size="sm"
                className="gap-1.5"
                style={{ backgroundColor: layerDef.color }}
                onClick={handleNext}
              >
                {isLastExercise ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Complete
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5"
                style={{ backgroundColor: layerDef.color }}
                onClick={handleSubmit}
                disabled={!userAnswer}
              >
                Submit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Multiple Choice Exercise
function MultipleChoiceExercise({
  exercise,
  userAnswer,
  setUserAnswer,
  showFeedback,
}: {
  exercise: PracticeExercise;
  userAnswer: string | null;
  setUserAnswer: (answer: string) => void;
  showFeedback: boolean;
}) {
  return (
    <div className="space-y-2">
      {exercise.options?.map((option) => {
        const isSelected = userAnswer === option.id;
        const showCorrectness = showFeedback && option.isCorrect;
        const showIncorrect = showFeedback && isSelected && !option.isCorrect;

        return (
          <button
            key={option.id}
            onClick={() => !showFeedback && setUserAnswer(option.id)}
            disabled={showFeedback}
            className={cn(
              'w-full text-left p-3 rounded-lg border-2 transition-all',
              isSelected && !showFeedback && 'border-primary bg-primary/5',
              !isSelected && !showFeedback && 'border-border hover:border-primary/50',
              showCorrectness && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20',
              showIncorrect && 'border-red-500 bg-red-50 dark:bg-red-950/20',
              showFeedback && 'cursor-not-allowed'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm">{option.label}</span>
              {showCorrectness && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              {showIncorrect && <XCircle className="w-4 h-4 text-red-500" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Predict-Verify Exercise
function PredictVerifyExercise({
  exercise,
  userAnswer,
  setUserAnswer,
}: {
  exercise: PracticeExercise;
  userAnswer: string | null;
  setUserAnswer: (answer: string) => void;
}) {
  return (
    <div>
      <Input
        placeholder="Type your answer..."
        value={userAnswer || ''}
        onChange={(e) => setUserAnswer(e.target.value)}
        className="text-sm"
      />
    </div>
  );
}

// Drag-Connect Exercise (simplified as button selection pairs)
function DragConnectExercise({
  exercise,
  userAnswer,
  setUserAnswer,
}: {
  exercise: PracticeExercise;
  userAnswer: Array<[string, string]> | null;
  setUserAnswer: (answer: Array<[string, string]>) => void;
}) {
  const [pairs, setPairs] = useState<Array<[string, string]>>(userAnswer || []);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);

  const handleLeftClick = (id: string) => {
    setSelectedLeft(id);
  };

  const handleRightClick = (rightId: string) => {
    if (!selectedLeft) return;

    // Remove existing pair with either item
    const filtered = pairs.filter(([l, r]) => l !== selectedLeft && r !== rightId);
    const newPairs: Array<[string, string]> = [...filtered, [selectedLeft, rightId]];

    setPairs(newPairs);
    setUserAnswer(newPairs);
    setSelectedLeft(null);
  };

  const getPairedRight = (leftId: string) => pairs.find(([l]) => l === leftId)?.[1];
  const getPairedLeft = (rightId: string) => pairs.find(([, r]) => r === rightId)?.[0];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Click a left item, then click its matching right item to connect them.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {/* Left Items */}
        <div className="space-y-2">
          {exercise.leftItems?.map((item) => {
            const pairedRight = getPairedRight(item.id);
            return (
              <button
                key={item.id}
                onClick={() => handleLeftClick(item.id)}
                className={cn(
                  'w-full text-left p-2 rounded border-2 transition-all text-xs',
                  selectedLeft === item.id && 'border-primary bg-primary/10',
                  pairedRight && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20',
                  !selectedLeft && !pairedRight && 'border-border hover:border-primary/50'
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Right Items */}
        <div className="space-y-2">
          {exercise.rightItems?.map((item) => {
            const pairedLeft = getPairedLeft(item.id);
            return (
              <button
                key={item.id}
                onClick={() => handleRightClick(item.id)}
                disabled={!selectedLeft}
                className={cn(
                  'w-full text-left p-2 rounded border-2 transition-all text-xs',
                  pairedLeft && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20',
                  !pairedLeft && selectedLeft && 'border-border hover:border-primary/50',
                  !selectedLeft && 'opacity-50 cursor-not-allowed'
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {pairs.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {pairs.length} pair{pairs.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}

// Answer checking logic
function checkAnswer(exercise: PracticeExercise, userAnswer: any): boolean {
  if (!userAnswer) return false;

  switch (exercise.type) {
    case 'multiple-choice':
      return exercise.options?.find((opt) => opt.id === userAnswer)?.isCorrect || false;

    case 'predict-verify':
      return (
        userAnswer.toString().toLowerCase().trim() === exercise.correctAnswer?.toLowerCase().trim()
      );

    case 'drag-connect':
      if (!Array.isArray(userAnswer) || !exercise.correctPairs) return false;
      const correct = exercise.correctPairs;
      return (
        userAnswer.length === correct.length &&
        userAnswer.every((pair) =>
          correct.some(([l, r]) => pair[0] === l && pair[1] === r)
        )
      );

    default:
      return false;
  }
}
