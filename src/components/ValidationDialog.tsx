import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ValidationReport } from '@/components/ValidationReport';
import { ValidationResult } from '@/lib/ifcValidator';

interface ValidationDialogProps {
  validation?: ValidationResult;
  hasErrors?: boolean;
}

export function ValidationDialog({ validation, hasErrors }: ValidationDialogProps) {
  const [open, setOpen] = useState(false);

  if (!validation) {
    return null;
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
          <DialogTitle>IFC Schema Validation Report</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <ValidationReport result={validation} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
