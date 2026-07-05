import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Network, RotateCcw, BookOpen, CheckSquare, GraduationCap, Github } from 'lucide-react';
import { ValidationDialog } from '@/components/ValidationDialog';
import { ValidationResult } from '@/lib/ifcValidatorEnhanced';
import { GraphNode } from '@/types/graph';
import { EducationalSample } from '@/features/educational/data/educationalSamples';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  hasData: boolean;
  onReset: () => void;
  validation?: ValidationResult;
  hasErrors?: boolean;
  onValidate?: () => void;
  isValidating?: boolean;
  metadata?: any;
  nodes?: GraphNode[];
  onEntityClick?: (entityId: string) => void;
  isIFC5?: boolean;
  parsedData?: any;
  ifcFileBuffer?: ArrayBuffer;
  fileName?: string;
  learningMode?: boolean;
  learningSample?: EducationalSample | null;
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

export function Header({ hasData, onReset, validation, hasErrors, onValidate, isValidating, metadata, nodes, onEntityClick, isIFC5, parsedData, ifcFileBuffer, fileName, learningMode, learningSample }: HeaderProps) {
  const navigate = useNavigate();

  const handleNavigateToValidation = () => {
    // Navigate to validation page with parsed data, buffer, filename, and any existing validation results
    navigate('/validation', {
      state: {
        parsedData,
        ifcFileBuffer,
        fileName,
        validationResults: parsedData?.validation, // Pass existing validation if available
        selectedValidator: parsedData?.validation ? 'local' : null
      }
    });
  };

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

          {/* Learning Mode Indicator */}
          {learningMode && learningSample && (
            <div className="flex items-center gap-2 pl-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30">
                <GraduationCap className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-primary">Learning Mode</span>
                <span className="text-xs text-primary/70">•</span>
                <span className="text-xs text-primary/90 max-w-[120px] truncate">{learningSample.name}</span>
              </div>
            </div>
          )}

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
          <a
            href="https://github.com/CarefreeAnil/IfcGraphViewer"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card/70 hover:bg-card text-foreground transition-colors"
            title="IfcGraphViewer on GitHub"
            aria-label="IfcGraphViewer on GitHub"
          >
            <Github className="w-4 h-4" />
            <span className="text-sm font-medium">GitHub</span>
          </a>

          {/* Learn Button - Always visible */}
          <button
            onClick={() => navigate('/learn')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors"
            title="Explore educational IFC samples"
          >
            <BookOpen className="w-4 h-4" />
            Learn
          </button>

          {hasData && (
            <div className="flex items-center gap-2">
              {!isIFC5 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNavigateToValidation}
                  className="gap-2"
                >
                  <CheckSquare className="w-4 h-4" />
                  {parsedData?.validation ? 'Validation Results' : 'Validate'}
                </Button>
              )}
              <button
                onClick={onReset}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-sm font-medium text-destructive transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Unload File
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.header>
  );
}
