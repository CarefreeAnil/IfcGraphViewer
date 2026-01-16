/**
 * Virtual List Component
 * Renders large lists efficiently with automatic pagination
 */

import { forwardRef, ReactNode, useMemo, useState } from 'react';

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
    const [scrollTop, setScrollTop] = useState(0);
    const bufferSizeValue = bufferSize;

    const visibleItems = Math.ceil(containerHeight / itemHeight) + bufferSizeValue * 2;
    const shouldVirtualize = items.length > visibleItems;
    const startIndex = shouldVirtualize
      ? Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSizeValue)
      : 0;
    const endIndex = shouldVirtualize
      ? Math.min(items.length, startIndex + visibleItems)
      : items.length;
    const offsetY = shouldVirtualize ? startIndex * itemHeight : 0;
    const paddingBottom = shouldVirtualize ? (items.length - endIndex) * itemHeight : 0;

    const virtualItems = useMemo(() => {
      const result = [];
      for (let i = startIndex; i < endIndex; i++) {
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
    }, [items, itemHeight, renderItem, startIndex, endIndex]);

    return (
      <div
        ref={ref}
        className={`overflow-y-auto overflow-x-hidden ${className}`}
        style={{ height: containerHeight }}
        onScroll={(e) => setScrollTop((e.currentTarget as HTMLDivElement).scrollTop)}
      >
        <div style={{ height: items.length * itemHeight, position: 'relative' }}>
          <div style={shouldVirtualize ? { transform: `translateY(${offsetY}px)` } : undefined}>
            {virtualItems}
          </div>
          {paddingBottom > 0 && <div style={{ height: paddingBottom }} />}
        </div>
      </div>
    );
  }
);

VirtualList.displayName = 'VirtualList';
