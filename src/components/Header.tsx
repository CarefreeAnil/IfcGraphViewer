import { motion } from 'framer-motion';
import { Network, Upload, RotateCcw } from 'lucide-react';
import { ValidationDialog } from '@/components/ValidationDialog';
import { ValidationResult } from '@/lib/ifcValidatorEnhanced';

interface HeaderProps {
  hasData: boolean;
  onReset: () => void;
  onLoadSample: () => void;
  validation?: ValidationResult;
  hasErrors?: boolean;
  onValidate?: () => void;
  isValidating?: boolean;
}

export function Header({ hasData, onReset, onLoadSample, validation, hasErrors, onValidate, isValidating }: HeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-background/80 backdrop-blur-md border-b border-border"
    >
      <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20 glow-primary">
            <Network className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gradient">IFC Graph Visualizer</h1>
            <p className="text-xs text-muted-foreground">Parse • Transform • Explore</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!hasData && (
            <button
              onClick={onLoadSample}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium text-foreground transition-colors"
            >
              <Upload className="w-4 h-4" />
              Load Sample
            </button>
          )}
          {hasData && (
            <div className="flex items-center gap-2">
              <ValidationDialog
                validation={validation}
                hasErrors={hasErrors}
                onValidate={onValidate}
                isValidating={isValidating}
              />
              <button
                onClick={onReset}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium text-foreground transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.header>
  );
}
