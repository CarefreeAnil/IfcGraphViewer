/**
 * UI State Context
 * Global state management for UI controls and filters
 */
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { NodeType } from '@/types/graph';

interface UIStateContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
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
  // 3D Viewer state
  show3DViewer: boolean;
  setShow3DViewer: (show: boolean) => void;
  // Schema version for current loaded IFC file
  schemaVersion: string;
  setSchemaVersion: (version: string) => void;
  resetFilters: () => void;
}

const UIStateContext = createContext<UIStateContextType | undefined>(undefined);

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return window.localStorage.getItem('ifc-graph-theme') === 'light' ? 'light' : 'dark';
  });
  const [highlightedTypes, setHighlightedTypes] = useState<NodeType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAttributes, setShowAttributes] = useState(false);
  const [showRelatedMetadata, setShowRelatedMetadata] = useState(false);
  const [graphLoD, setGraphLoD] = useState(2); // Default to LoD2 (Least Graph)
  const [show3DViewer, setShow3DViewer] = useState(false); // Lazy load 3D viewer
  const [schemaVersion, setSchemaVersion] = useState('IFC4'); // Default to IFC4

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem('ifc-graph-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark');
  }, []);

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
        theme,
        toggleTheme,
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
        show3DViewer,
        setShow3DViewer,
        schemaVersion,
        setSchemaVersion,
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
