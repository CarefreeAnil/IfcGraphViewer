/**
 * UI State Context
 * Global state management for UI controls and filters
 */
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { NodeType } from '@/types/graph';

interface UIStateContextType {
  highlightedTypes: NodeType[];
  setHighlightedTypes: (types: NodeType[]) => void;
  toggleType: (type: NodeType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showAttributes: boolean;
  setShowAttributes: (show: boolean) => void;
  showRelatedMetadata: boolean;
  setShowRelatedMetadata: (show: boolean) => void;
  graphLoD: number;
  setGraphLoD: (lod: number) => void;
  resetFilters: () => void;
}

const UIStateContext = createContext<UIStateContextType | undefined>(undefined);

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [highlightedTypes, setHighlightedTypes] = useState<NodeType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAttributes, setShowAttributes] = useState(false);
  const [showRelatedMetadata, setShowRelatedMetadata] = useState(false);
  const [graphLoD, setGraphLoD] = useState(4); // Default to LoD4 (Core Graph)

  const toggleType = useCallback((type: NodeType) => {
    setHighlightedTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  }, []);

  const resetFilters = useCallback(() => {
    setHighlightedTypes([]);
    setSearchQuery('');
    setShowAttributes(false);
    setShowRelatedMetadata(false);
  }, []);

  return (
    <UIStateContext.Provider
      value={{
        highlightedTypes,
        setHighlightedTypes,
        toggleType,
        searchQuery,
        setSearchQuery,
        showAttributes,
        setShowAttributes,
        showRelatedMetadata,
        setShowRelatedMetadata,
        graphLoD,
        setGraphLoD,
        resetFilters,
      }}
    >
      {children}
    </UIStateContext.Provider>
  );
}

export function useUIState() {
  const context = useContext(UIStateContext);
  if (!context) {
    throw new Error('useUIState must be used within UIStateProvider');
  }
  return context;
}
