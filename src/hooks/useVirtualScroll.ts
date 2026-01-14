/**
 * Virtual Scrolling Hook
 * Efficiently render large lists by only rendering visible items
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface VirtualScrollConfig {
  itemHeight: number;
  containerHeight: number;
  bufferSize?: number; // Extra items to render outside visible area
}

export interface VirtualScrollResult {
  startIndex: number;
  endIndex: number;
  offsetY: number;
  visibleItems: number;
}

/**
 * Calculate virtual scroll positions
 */
export function useVirtualScroll(
  totalItems: number,
  config: VirtualScrollConfig
): VirtualScrollResult {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const bufferSize = config.bufferSize || 5;

  const visibleItems = Math.ceil(config.containerHeight / config.itemHeight) + bufferSize * 2;
  const startIndex = Math.max(0, Math.floor(scrollTop / config.itemHeight) - bufferSize);
  const endIndex = Math.min(totalItems, startIndex + visibleItems);
  const offsetY = startIndex * config.itemHeight;

  const handleScroll = useCallback((e: Event) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  return {
    startIndex,
    endIndex,
    offsetY,
    visibleItems,
  };
}
