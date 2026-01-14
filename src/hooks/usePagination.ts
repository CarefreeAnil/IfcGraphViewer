/**
 * Pagination Hook
 * Handles paginated data with navigation controls
 */

import { useState, useMemo } from 'react';

export interface PaginationConfig {
  pageSize?: number;
  initialPage?: number;
}

export interface PaginationResult<T> {
  currentItems: T[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
}

export function usePagination<T>(
  items: T[],
  config: PaginationConfig = {}
): PaginationResult<T> {
  const { pageSize = 50, initialPage = 0 } = config;
  const [currentPage, setCurrentPage] = useState(initialPage);

  // Calculate pagination values
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  // Ensure current page is valid
  const validPage = Math.min(Math.max(0, currentPage), totalPages - 1);
  
  // Get current page items
  const currentItems = useMemo(() => {
    const startIndex = validPage * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    return items.slice(startIndex, endIndex);
  }, [items, validPage, pageSize, totalItems]);

  // Navigation functions
  const goToPage = (page: number) => {
    const newPage = Math.min(Math.max(0, page), totalPages - 1);
    setCurrentPage(newPage);
  };

  const nextPage = () => {
    if (validPage < totalPages - 1) {
      setCurrentPage(validPage + 1);
    }
  };

  const previousPage = () => {
    if (validPage > 0) {
      setCurrentPage(validPage - 1);
    }
  };

  const goToFirstPage = () => setCurrentPage(0);
  const goToLastPage = () => setCurrentPage(totalPages - 1);

  return {
    currentItems,
    currentPage: validPage,
    totalPages,
    pageSize,
    totalItems,
    hasNextPage: validPage < totalPages - 1,
    hasPreviousPage: validPage > 0,
    goToPage,
    nextPage,
    previousPage,
    goToFirstPage,
    goToLastPage,
  };
}
