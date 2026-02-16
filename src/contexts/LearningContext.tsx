/**
 * Learning Context - State Management for IFC Learning System
 * Manages progress, modes, highlighting, and localStorage persistence
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  IFCLayer,
  LearningMode,
  LearningProgress,
  LayerProgress,
  WorkedExample,
  WorkedExampleStep,
  PracticeExercise,
  WORKED_EXAMPLES,
  PRACTICE_EXERCISES,
} from '@/types/learning';

interface LearningContextType {
  // Progress State
  progress: LearningProgress;
  mode: LearningMode;

  // Current Active Content
  currentExample: WorkedExample | null;
  currentExampleStep: number;
  currentPractice: PracticeExercise[];
  currentPracticeIndex: number;

  // Graph Integration
  highlightedEntityTypes: string[];

  // Mode Control
  setMode: (mode: LearningMode) => void;

  // Layer Progress
  isLayerUnlocked: (layer: IFCLayer) => boolean;
  unlockNextLayer: () => boolean;

  // Worked Examples
  startWorkedExample: (layer: IFCLayer) => void;
  nextExampleStep: () => void;
  prevExampleStep: () => void;
  completeWorkedExample: () => void;

  // Practice
  startPractice: (layer: IFCLayer) => void;
  submitPracticeAnswer: (isCorrect: boolean) => void;
  nextPracticeExercise: () => void;
  prevPracticeExercise: () => void;
  completePractice: () => void;

  // Progress Management
  resetProgress: () => void;
}

const LearningContext = createContext<LearningContextType | null>(null);

// Local storage key
const STORAGE_KEY = 'ifc-learning-progress';

// Initialize default progress
const DEFAULT_PROGRESS: LearningProgress = {
  currentLayer: 'project',
  layers: {
    project: { unlocked: true, workedExampleCompleted: false, practiceCompleted: false, score: 0 },
    spatial: { unlocked: false, workedExampleCompleted: false, practiceCompleted: false, score: 0 },
    element: { unlocked: false, workedExampleCompleted: false, practiceCompleted: false, score: 0 },
    relationship: { unlocked: false, workedExampleCompleted: false, practiceCompleted: false, score: 0 },
    property: { unlocked: false, workedExampleCompleted: false, practiceCompleted: false, score: 0 },
  },
  totalScore: 0,
};

export function LearningProvider({ children }: { children: React.ReactNode }) {
  // State
  const [progress, setProgress] = useState<LearningProgress>(DEFAULT_PROGRESS);
  const [mode, setMode] = useState<LearningMode>('overview');
  const [currentExample, setCurrentExample] = useState<WorkedExample | null>(null);
  const [currentExampleStep, setCurrentExampleStep] = useState(0);
  const [currentPractice, setCurrentPractice] = useState<PracticeExercise[]>([]);
  const [currentPracticeIndex, setCurrentPracticeIndex] = useState(0);
  const [highlightedEntityTypes, setHighlightedEntityTypes] = useState<string[]>([]);

  // Load progress from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setProgress(parsed);
      } catch (error) {
        console.error('Failed to parse stored progress:', error);
      }
    }
  }, []);

  // Persist progress to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  // Calculate total score whenever layer progress changes
  useEffect(() => {
    const layers = Object.values(progress.layers);
    const totalScore = Math.round(
      layers.reduce((sum, layer) => sum + layer.score, 0) / layers.length
    );
    setProgress((prev) => ({ ...prev, totalScore }));
  }, [progress.layers]);

  // Layer Management
  const isLayerUnlocked = useCallback(
    (layer: IFCLayer): boolean => {
      return progress.layers[layer].unlocked;
    },
    [progress.layers]
  );

  const unlockNextLayer = useCallback((): boolean => {
    const layerOrder: IFCLayer[] = ['project', 'spatial', 'element', 'relationship', 'property'];
    const currentIndex = layerOrder.indexOf(progress.currentLayer);

    // Check if current layer is complete
    const currentLayerProgress = progress.layers[progress.currentLayer];
    if (!currentLayerProgress.workedExampleCompleted || !currentLayerProgress.practiceCompleted) {
      return false; // Not ready to unlock next
    }

    // Check if there's a next layer
    if (currentIndex >= layerOrder.length - 1) {
      return false; // Already at last layer
    }

    // Unlock next layer
    const nextLayer = layerOrder[currentIndex + 1];
    setProgress((prev) => ({
      ...prev,
      currentLayer: nextLayer,
      layers: {
        ...prev.layers,
        [nextLayer]: { ...prev.layers[nextLayer], unlocked: true },
      },
    }));

    return true;
  }, [progress.currentLayer, progress.layers]);

  // Worked Examples
  const startWorkedExample = useCallback((layer: IFCLayer) => {
    const example = WORKED_EXAMPLES.find((ex) => ex.layer === layer);
    if (!example) return;

    setCurrentExample(example);
    setCurrentExampleStep(0);
    setMode('worked-example');

    // Highlight first step entity types
    if (example.steps[0]) {
      setHighlightedEntityTypes(example.steps[0].highlightEntityTypes);
    }
  }, []);

  const nextExampleStep = useCallback(() => {
    if (!currentExample) return;

    const nextStep = currentExampleStep + 1;
    if (nextStep < currentExample.steps.length) {
      setCurrentExampleStep(nextStep);
      setHighlightedEntityTypes(currentExample.steps[nextStep].highlightEntityTypes);
    }
  }, [currentExample, currentExampleStep]);

  const prevExampleStep = useCallback(() => {
    if (!currentExample) return;

    const prevStep = currentExampleStep - 1;
    if (prevStep >= 0) {
      setCurrentExampleStep(prevStep);
      setHighlightedEntityTypes(currentExample.steps[prevStep].highlightEntityTypes);
    }
  }, [currentExample, currentExampleStep]);

  const completeWorkedExample = useCallback(() => {
    if (!currentExample) return;

    setProgress((prev) => ({
      ...prev,
      layers: {
        ...prev.layers,
        [currentExample.layer]: {
          ...prev.layers[currentExample.layer],
          workedExampleCompleted: true,
          score: Math.max(prev.layers[currentExample.layer].score, 50), // At least 50% for completing example
        },
      },
    }));

    setCurrentExample(null);
    setCurrentExampleStep(0);
    setHighlightedEntityTypes([]);
    setMode('overview');
  }, [currentExample]);

  // Practice
  const startPractice = useCallback((layer: IFCLayer) => {
    const exercises = PRACTICE_EXERCISES.filter((ex) => ex.layer === layer);
    if (exercises.length === 0) return;

    setCurrentPractice(exercises);
    setCurrentPracticeIndex(0);
    setMode('practice');
  }, []);

  const submitPracticeAnswer = useCallback(
    (isCorrect: boolean) => {
      if (!currentPractice.length) return;

      const exercise = currentPractice[currentPracticeIndex];
      const pointsPerExercise = 100 / currentPractice.length;

      if (isCorrect) {
        setProgress((prev) => ({
          ...prev,
          layers: {
            ...prev.layers,
            [exercise.layer]: {
              ...prev.layers[exercise.layer],
              score: Math.min(100, prev.layers[exercise.layer].score + pointsPerExercise),
            },
          },
        }));
      }
    },
    [currentPractice, currentPracticeIndex]
  );

  const nextPracticeExercise = useCallback(() => {
    if (currentPracticeIndex < currentPractice.length - 1) {
      setCurrentPracticeIndex((prev) => prev + 1);
    }
  }, [currentPracticeIndex, currentPractice.length]);

  const prevPracticeExercise = useCallback(() => {
    if (currentPracticeIndex > 0) {
      setCurrentPracticeIndex((prev) => prev - 1);
    }
  }, [currentPracticeIndex]);

  const completePractice = useCallback(() => {
    if (!currentPractice.length) return;

    const layer = currentPractice[0].layer;
    setProgress((prev) => ({
      ...prev,
      layers: {
        ...prev.layers,
        [layer]: {
          ...prev.layers[layer],
          practiceCompleted: true,
        },
      },
    }));

    setCurrentPractice([]);
    setCurrentPracticeIndex(0);
    setMode('overview');
  }, [currentPractice]);

  // Progress Management
  const resetProgress = useCallback(() => {
    setProgress(DEFAULT_PROGRESS);
    setMode('overview');
    setCurrentExample(null);
    setCurrentExampleStep(0);
    setCurrentPractice([]);
    setCurrentPracticeIndex(0);
    setHighlightedEntityTypes([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value: LearningContextType = {
    progress,
    mode,
    currentExample,
    currentExampleStep,
    currentPractice,
    currentPracticeIndex,
    highlightedEntityTypes,
    setMode,
    isLayerUnlocked,
    unlockNextLayer,
    startWorkedExample,
    nextExampleStep,
    prevExampleStep,
    completeWorkedExample,
    startPractice,
    submitPracticeAnswer,
    nextPracticeExercise,
    prevPracticeExercise,
    completePractice,
    resetProgress,
  };

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

// Hook to use learning context
export function useLearning(): LearningContextType {
  const context = useContext(LearningContext);
  if (!context) {
    throw new Error('useLearning must be used within LearningProvider');
  }
  return context;
}

// Optional hook for components that may not be in learning mode
export function useLearningOptional(): LearningContextType | null {
  return useContext(LearningContext);
}
