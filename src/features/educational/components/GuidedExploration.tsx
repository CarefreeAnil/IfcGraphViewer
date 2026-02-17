/**
 * Guided Exploration Component
 * Minimal step-by-step guidance overlays for learning samples
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Lightbulb, CheckCircle2, X, HelpCircle, AlertCircle } from 'lucide-react';
import { EducationalSample } from '@/features/educational/data/educationalSamples';
import { GraphNode } from '@/types/graph';
import { ComposedObject } from '@/types/ifc5';

interface GuidanceStep {
  id: string;
  title: string;
  guidance: string;
  hint: string; // What to look for
  targetEntity?: string; // Entity type to look for
  suggestedAction: string; // e.g., "Click on the Project node"
}

interface GuidedExplorationProps {
  sample: EducationalSample;
  selectedNode?: GraphNode | null;
  selectedIFC5Node?: ComposedObject | null;
  onClose: () => void;
}

// Step-by-step guidance sequences for each sample
const GUIDANCE_SEQUENCES: Record<string, GuidanceStep[]> = {
  'hello-wall-ifc5': [
    {
      id: 'step-1',
      title: 'IFC5 Foundation',
      guidance: 'Let\'s explore the IFC5 structure. Start by finding the Project entity - it\'s the root of everything.',
      hint: 'Look for "IfcProject" in the graph or tree - it\'s at the top level',
      targetEntity: 'IfcProject',
      suggestedAction: '👉 Click on the Project node in the graph',
    },
    {
      id: 'step-2',
      title: 'Wall Entity',
      guidance: 'Now let\'s explore the Wall. Find IfcWall in the tree - this is the main building element in this file.',
      hint: 'Expand the hierarchy to find the Wall element',
      targetEntity: 'IfcWall',
      suggestedAction: '👉 Click on the IfcWall node',
    },
    {
      id: 'step-3',
      title: 'Wall Properties',
      guidance: 'Great! Now check the properties panel on the right. What properties does this wall have? Look for geometry and material information.',
      hint: 'The properties panel shows all attributes of the selected entity',
      suggestedAction: '✓ Explore the properties panel',
    },
    {
      id: 'step-4',
      title: 'IFC5 vs IFC4',
      guidance: 'Notice how IFC5 uses JSON format with path-based references instead of numeric IDs. How is this different from traditional IFC?',
      hint: 'Look at how entities reference each other in the tree view',
      suggestedAction: '✓ Observe the structure differences',
    },
  ],

  'simple-wall-opening-window': [
    {
      id: 'step-1',
      title: 'Spatial Hierarchy',
      guidance: 'Begin by understanding the building\'s spatial structure. Find the Building in the hierarchy.',
      hint: 'Look for IfcBuilding - it\'s typically the second level below IfcProject',
      targetEntity: 'IfcBuilding',
      suggestedAction: '👉 Click on IfcBuilding',
    },
    {
      id: 'step-2',
      title: 'Building Storey',
      guidance: 'Now find the BuildingStorey - it represents a floor level in the building.',
      hint: 'Expand the Building to find IfcBuildingStorey',
      targetEntity: 'IfcBuildingStorey',
      suggestedAction: '👉 Click on IfcBuildingStorey',
    },
    {
      id: 'step-3',
      title: 'The Wall',
      guidance: 'Find the Wall element. In IFC, walls are major structural elements. Look for IfcWall.',
      hint: 'Walls are usually contained within the storey',
      targetEntity: 'IfcWall',
      suggestedAction: '👉 Click on the IfcWall',
    },
    {
      id: 'step-4',
      title: 'Opening Element',
      guidance: 'Now find the Opening - this is a void (hole) in the wall. Look for IfcOpeningElement.',
      hint: 'Openings are related to walls via IfcRelVoidsElement',
      targetEntity: 'IfcOpeningElement',
      suggestedAction: '👉 Click on IfcOpeningElement',
    },
    {
      id: 'step-5',
      title: 'The Window',
      guidance: 'Find the Window element - it fills the opening in the wall. Look for IfcWindow.',
      hint: 'Windows are related to openings via IfcRelFillsElement',
      targetEntity: 'IfcWindow',
      suggestedAction: '👉 Click on the IfcWindow',
    },
    {
      id: 'step-6',
      title: 'Relationships',
      guidance: 'Notice what you\'ve learned: Wall → hasOpening → OpeningElement → isFilledBy → Window. This is how IFC models complexity!',
      hint: 'This pattern of relationships appears throughout all IFC models',
      suggestedAction: '✓ Now you understand key IFC concepts',
    },
  ],

  'solibri-structural': [
    {
      id: 'step-1',
      title: 'Complex Structure',
      guidance: 'This model shows a complete structural system. Start by exploring the Building - it contains many structural elements.',
      hint: 'Look for IfcBuilding to see the overall structure',
      targetEntity: 'IfcBuilding',
      suggestedAction: '👉 Click on IfcBuilding',
    },
    {
      id: 'step-2',
      title: 'Multiple Storeys',
      guidance: 'Expand the Building to see multiple IfcBuildingStorey elements - these represent different floor levels.',
      hint: 'This building has several floors, each contained in a storey',
      targetEntity: 'IfcBuildingStorey',
      suggestedAction: '👉 Click on a BuildingStorey'
    },
    {
      id: 'step-3',
      title: 'Structural Elements',
      guidance: 'Find the structural elements: IfcBeam (horizontal), IfcColumn (vertical), IfcSlab (floor plates).',
      hint: 'These are the main structural components in this model',
      targetEntity: 'IfcBeam',
      suggestedAction: '👉 Click on a IfcBeam to explore'
    },
    {
      id: 'step-4',
      title: 'Type Definitions',
      guidance: 'This model uses type definitions - IfcTypeObject. Find where elements are linked to their types. This enables standardization.',
      hint: 'Look for relationships with "IfcRelDefinesByType" in the graph',
      targetEntity: 'IfcTypeObject',
      suggestedAction: '👉 Click on a structural type object'
    },
    {
      id: 'step-5',
      title: 'Material Properties',
      guidance: 'Now explore material information. Structural elements have material properties. Look for material-related properties in the panel.',
      hint: 'Check the properties panel for material composition',
      suggestedAction: '✓ Review material definitions'
    },
  ],

  'fzk-haus': [
    {
      id: 'step-1',
      title: 'Large Model Overview',
      guidance: 'This is a complete residential building with 2800+ entities! Start by understanding its scale. Check the graph stats.',
      hint: 'Look at the entity count and complexity in the header/stats',
      targetEntity: 'IfcProject',
      suggestedAction: '✓ Observe the model statistics'
    },
    {
      id: 'step-2',
      title: 'Multi-Storey Navigation',
      guidance: 'Navigate the spatial structure. Find the Building and explore its multiple BuildingStoreys.',
      hint: 'Expand the Building node to see all floor levels',
      targetEntity: 'IfcBuildingStorey',
      suggestedAction: '👉 Click on different BuildingStoreys'
    },
    {
      id: 'step-3',
      title: 'Rich Element Diversity',
      guidance: 'This model has diverse element types. Explore different room spaces using IfcSpace - notice how they relate to elements.',
      hint: 'Look for IfcSpace entities which represent rooms and zones',
      targetEntity: 'IfcSpace',
      suggestedAction: '👉 Find and click on an IfcSpace'
    },
    {
      id: 'step-4',
      title: 'Element Coordination',
      guidance: 'Find how doors and windows relate to walls. Use the filters to show "void/fill" relationships.',
      hint: 'Enable void/fill relationship visualization in the graph controls',
      targetEntity: 'IfcRelFillsElement',
      suggestedAction: '👉 Toggle relationship filters to see connections'
    },
    {
      id: 'step-5',
      title: 'Properties at Scale',
      guidance: 'Select a wall or door and explore its comprehensive property sets. Real models have detailed metadata.',
      hint: 'Look for Pset_WallCommon or similar property set definitions',
      targetEntity: 'IfcPropertySet',
      suggestedAction: '👉 Click on an element to see its properties'
    },
    {
      id: 'step-6',
      title: 'Model Mastery',
      guidance: 'You\'ve explored a complete real-world IFC model! Notice how all concepts (hierarchy, relationships, properties) work together.',
      hint: 'This is what professional BIM data looks like',
      suggestedAction: '✓ Congratulations! You understand IFC'
    },
  ],

  // Default for any sample without specific sequence
  'default': [
    {
      id: 'step-1',
      title: 'Start Exploring',
      guidance: 'Click on any node in the graph to select it and view its properties.',
      hint: 'Use the tree view on the left to browse the hierarchy',
      suggestedAction: '👉 Double-click any entity to inspect it'
    },
    {
      id: 'step-2',
      title: 'View Relationships',
      guidance: 'Look at the graph to see how entities relate to each other with different types of connections.',
      hint: 'Different colored lines represent different relationship types',
      suggestedAction: '👉 Use filters to focus on specific relationship types'
    },
    {
      id: 'step-3',
      title: 'Explore Properties',
      guidance: 'The properties panel shows detailed information about selected entities.',
      hint: 'Look for property sets, geometric data, and metadata',
      suggestedAction: '✓ Check the properties panel'
    },
    {
      id: 'step-4',
      title: 'Use the 3D View',
      guidance: 'Switch to the 3D view to see geometric representations of the elements.',
      hint: 'The 3D view helps visualize spatial relationships',
      suggestedAction: '👉 Enable the 3D viewer to see geometry'
    },
  ]
};

export function GuidedExploration({
  sample,
  selectedNode,
  selectedIFC5Node,
  onClose
}: GuidedExplorationProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dismissedSteps, setDismissedSteps] = useState<Set<string>>(new Set());
  const [showCompactMode, setShowCompactMode] = useState(false);

  // Get the guidance sequence for this sample
  const guidance = GUIDANCE_SEQUENCES[sample.id] || GUIDANCE_SEQUENCES['default'];
  const step = guidance[currentStep];

  // Auto-advance when user selects the target entity
  useEffect(() => {
    if (!step.targetEntity) return;

    const selectedType = selectedNode?.type || selectedIFC5Node?.type;
    if (selectedType === step.targetEntity && currentStep < guidance.length - 1) {
      // Brief delay to let user see they clicked correctly
      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [selectedNode, selectedIFC5Node, step, currentStep, guidance.length]);

  const markStepDismissed = () => {
    setDismissedSteps(prev => new Set([...prev, step.id]));
    if (currentStep < guidance.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentStep < guidance.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const progress = ((currentStep + 1) / guidance.length) * 100;

  if (showCompactMode) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-4 right-4 z-40"
      >
        <button
          onClick={() => setShowCompactMode(false)}
          className="flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg shadow-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Lightbulb className="w-4 h-4" />
          <span>Exploration Step {currentStep + 1}/{guidance.length}</span>
          <ChevronRight className="w-4 h-4 ml-2" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, y: 20 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 20, y: 20 }}
      className="fixed bottom-4 right-4 z-40 w-80 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border p-3 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 flex-shrink-0 mt-0.5">
            <Lightbulb className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground">Step {currentStep + 1} of {guidance.length}</p>
            </div>
            <h4 className="text-sm font-semibold text-foreground leading-tight">{step.title}</h4>
          </div>
        </div>
        <button
          onClick={() => setShowCompactMode(true)}
          className="p-1 hover:bg-background rounded transition-colors flex-shrink-0"
          title="Minimize"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-muted overflow-hidden">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Main Guidance */}
        <div className="space-y-2">
          <p className="text-sm text-foreground leading-relaxed">{step.guidance}</p>
        </div>

        {/* Hint Box */}
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-info/5 border border-info/20">
          <HelpCircle className="w-4 h-4 text-info mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">{step.hint}</p>
        </div>

        {/* Suggested Action */}
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
          <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-foreground font-medium">{step.suggestedAction}</p>
        </div>

        {/* Selected Entity Feedback */}
        {(selectedNode || selectedIFC5Node) && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                Great! You selected: {selectedNode?.type || selectedIFC5Node?.type}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Navigation */}
      <div className="p-3 border-t border-border bg-muted/30 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-3 py-1.5 text-xs font-medium rounded border border-border hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={handleNext}
            disabled={currentStep === guidance.length - 1}
            className="px-3 py-1.5 text-xs font-medium rounded border border-border hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
        <button
          onClick={() => onClose()}
          className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          title="Exit guided exploration"
        >
          <X className="w-3 h-3" />
          Exit
        </button>
      </div>
    </motion.div>
  );
}
