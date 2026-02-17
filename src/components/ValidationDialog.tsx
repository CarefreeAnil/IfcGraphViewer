import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ValidationReport } from '@/components/ValidationReport';
import { ValidationResult } from '@/lib/ifcValidatorEnhanced';
import { GraphNode } from '@/types/graph';

interface ValidationDialogProps {
  validation?: ValidationResult;
  hasErrors?: boolean;
  onValidate?: () => void;
  isValidating?: boolean;
  nodes?: GraphNode[];
  onEntityClick?: (entityId: string) => void;
}

export function ValidationDialog({ validation, hasErrors, onValidate, isValidating, nodes, onEntityClick }: ValidationDialogProps) {
  const [open, setOpen] = useState(false);

  // Handler to close dialog and navigate to entity
  const handleEntityClick = (entityId: string) => {
    setOpen(false); // Close the dialog first
    onEntityClick?.(entityId); // Then navigate
  };

  // If no validation has been run, show validate button
  if (!validation) {
    if (!onValidate) return null;
    
    return (
      <Button
        onClick={onValidate}
        disabled={isValidating}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        {isValidating ? (
          <>
            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            Validating...
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4" />
            Run Validation
          </>
        )}
      </Button>
    );
  }

  const totalIssues = validation.stats.totalErrors + validation.stats.totalWarnings;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={hasErrors || validation.stats.totalErrors > 0 ? 'destructive' : 'outline'}
          size="sm"
          className="gap-2"
        >
          <AlertCircle className="w-4 h-4" />
          Validation Report
          {totalIssues > 0 && <span className="ml-1">({totalIssues})</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            IFC Schema Validation Report {validation.schemaVersion && `(${validation.schemaVersion})`}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <ValidationReport result={validation} nodes={nodes} onEntityClick={handleEntityClick} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
