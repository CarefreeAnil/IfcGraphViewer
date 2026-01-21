import { motion } from 'framer-motion';
import { Network, Upload, RotateCcw, BookOpen } from 'lucide-react';
import { ValidationDialog } from '@/components/ValidationDialog';
import { ValidationResult } from '@/lib/ifcValidatorEnhanced';
import { GraphNode } from '@/types/graph';

interface HeaderProps {
  hasData: boolean;
  onReset: () => void;
  onLoadSample: () => void;
  validation?: ValidationResult;
  hasErrors?: boolean;
  onValidate?: () => void;
  isValidating?: boolean;
  metadata?: any;
  nodes?: GraphNode[];
  onEntityClick?: (entityId: string) => void;
  isIFC5?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTime(ms: number): string {
  if (ms < 1000) return ms.toFixed(0) + 'ms';
  return (ms / 1000).toFixed(2) + 's';
}

export function Header({ hasData, onReset, onLoadSample, validation, hasErrors, onValidate, isValidating, metadata, nodes, onEntityClick, isIFC5 }: HeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-background/80 backdrop-blur-md border-b border-border"
    >
      <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 glow-primary">
              <Network className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gradient">IFC Graph Visualizer</h1>
              <p className="text-xs text-muted-foreground">Parse • Transform • Explore</p>
            </div>
          </div>
          
          {/* File metadata */}
          {hasData && metadata && (
            <div className="flex items-center gap-3 pl-4 border-l border-border">
              <div className="flex flex-col">
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground">File</span>
                <span className="text-[11px] font-mono text-foreground truncate max-w-xs">{metadata.fileName}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground">Size</span>
                <span className="text-[11px] font-mono text-foreground">{formatBytes(metadata.fileSize)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground">Parse</span>
                <span className="text-[11px] font-mono text-foreground">{formatTime(metadata.parseTime)}</span>
              </div>
            </div>
          )}
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
              {!isIFC5 && (
                <ValidationDialog
                  validation={validation}
                  hasErrors={hasErrors}
                  onValidate={onValidate}
                  isValidating={isValidating}
                  nodes={nodes}
                  onEntityClick={onEntityClick}
                />
              )}
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
