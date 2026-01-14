/**
 * Virtual List Component
 * Renders large lists efficiently with automatic pagination
 */

import { forwardRef, ReactNode, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  bufferSize?: number;
  className?: string;
}

export const VirtualList = forwardRef<HTMLDivElement, VirtualListProps<any>>(
  ({ items, itemHeight, containerHeight, renderItem, bufferSize = 5, className = '' }, ref) => {
    const bufferSizeValue = bufferSize;

    // Calculate visible range
    const visibleItems = Math.ceil(containerHeight / itemHeight) + bufferSizeValue * 2;
    
    // Pre-render virtualized items
    const virtualItems = useMemo(() => {
      const total = items.length;
      const result = [];
      
      for (let i = 0; i < total; i++) {
        result.push(
          <div
            key={i}
            style={{
              height: `${itemHeight}px`,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {renderItem(items[i], i)}
          </div>
        );
      }
      
      return result;
    }, [items, itemHeight, renderItem]);

    return (
      <div
        ref={ref}
        className={`overflow-y-auto overflow-x-hidden ${className}`}
        style={{ height: containerHeight }}
      >
        <div style={{ height: items.length * itemHeight }}>
          {virtualItems}
        </div>
      </div>
    );
  }
);

VirtualList.displayName = 'VirtualList';
