import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Network, RotateCcw, BookOpen, CheckSquare, GraduationCap, Github, Moon, Sun } from 'lucide-react';
import { ValidationDialog } from '@/components/ValidationDialog';
import { ValidationResult } from '@/lib/ifcValidatorEnhanced';
import { GraphNode } from '@/types/graph';
import { EducationalSample } from '@/features/educational/data/educationalSamples';
import { Button } from '@/components/ui/button';
import { useUIState } from '@/contexts/UIStateContext';

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
  const { theme, toggleTheme } = useUIState();

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
      className="fixed top-0 left-0 right-0 z-50 overflow-hidden border-b border-border bg-background/95 px-2 py-1 backdrop-blur-md lg:px-6 lg:py-3"
    >
      <div className="mx-auto flex min-w-0 max-w-screen-2xl items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 lg:gap-6">
          <div className="flex min-w-0 items-center gap-2 lg:gap-3">
            <div className="rounded-md border border-primary/30 bg-primary/10 p-1 lg:p-2">
              <Network className="h-4 w-4 text-primary lg:h-6 lg:w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="max-w-[150px] truncate text-sm font-bold text-foreground lg:max-w-none lg:text-xl">IFC Graph Visualizer</h1>
              <p className="hidden text-xs text-muted-foreground lg:block">Parse • Transform • Explore</p>
            </div>
          </div>

          {/* Learning Mode Indicator */}
          {learningMode && learningSample && (
            <div className="hidden items-center gap-2 pl-4 lg:flex">
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
            <div className="hidden items-center gap-3 border-l border-border pl-4 lg:flex">
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

        <div className="flex shrink-0 items-center gap-1 lg:gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-card/70 px-2 text-foreground transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-pressed={theme === 'light'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <a
            href="https://github.com/CarefreeAnil/IfcGraphViewer"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-lg border border-border bg-card/70 px-3 py-2 text-foreground transition-colors hover:bg-card lg:flex"
            title="IfcGraphViewer on GitHub"
            aria-label="IfcGraphViewer on GitHub"
          >
            <Github className="w-4 h-4" />
            <span className="text-sm font-medium">GitHub</span>
          </a>

          {/* Learn Button - Always visible */}
          <button
            onClick={() => navigate('/learn')}
            className="hidden items-center gap-2 rounded-lg bg-primary/10 px-2 py-2 text-primary text-sm font-medium transition-colors hover:bg-primary/20 lg:flex lg:px-4"
            title="Explore educational IFC samples"
          >
            <BookOpen className="w-4 h-4" />
            <span>Learn</span>
          </button>

          {hasData && (
            <div className="flex items-center gap-2">
              {!isIFC5 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNavigateToValidation}
                  className="hidden gap-2 px-2 lg:flex lg:px-3"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>{parsedData?.validation ? 'Validation Results' : 'Validate'}</span>
                </Button>
              )}
              <button
                onClick={onReset}
                aria-label="Unload File"
                className="flex items-center gap-2 rounded-lg bg-destructive/10 px-2 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 lg:px-4 lg:py-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden lg:inline">Unload File</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.header>
  );
}
