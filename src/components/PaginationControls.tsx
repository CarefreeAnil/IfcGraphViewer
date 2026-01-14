/**
 * Pagination Controls Component
 * Navigation controls for paginated data
 */

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onFirst: () => void;
  onLast: () => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onNext,
  onPrevious,
  onFirst,
  onLast,
  hasNextPage,
  hasPreviousPage,
}: PaginationControlsProps) {
  const startItem = currentPage * pageSize + 1;
  const endItem = Math.min((currentPage + 1) * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-2 py-2 border-t border-border bg-background/50">
      <div className="text-xs text-muted-foreground">
        {totalItems > 0 ? (
          <>
            Showing {startItem}-{endItem} of {totalItems}
          </>
        ) : (
          'No items'
        )}
      </div>
      
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onFirst}
          disabled={!hasPreviousPage}
          className="h-7 w-7 p-0"
          title="First page"
        >
          <ChevronsLeft className="h-3 w-3" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrevious}
          disabled={!hasPreviousPage}
          className="h-7 w-7 p-0"
          title="Previous page"
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
        
        <div className="flex items-center gap-1 px-2 text-xs">
          <span className="text-muted-foreground">Page</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage + 1}
            onChange={(e) => {
              const page = parseInt(e.target.value, 10) - 1;
              if (!isNaN(page) && page >= 0 && page < totalPages) {
                onPageChange(page);
              }
            }}
            className="w-12 h-6 text-center bg-background border border-border rounded text-xs"
          />
          <span className="text-muted-foreground">of {totalPages}</span>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          disabled={!hasNextPage}
          className="h-7 w-7 p-0"
          title="Next page"
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onLast}
          disabled={!hasNextPage}
          className="h-7 w-7 p-0"
          title="Last page"
        >
          <ChevronsRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
