/**
 * useViewer3D Hook
 * Manages 3D viewer state and synchronization with other modals
 * Lazy-loads the 3D viewer for performance optimization
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { GraphNode, GraphData } from '@/types/graph';

interface Viewer3DState {
  isEnabled: boolean;
  isVisible: boolean;
  selectedNodeId: string | null;
  geometryCache: Map<string, any>;
  loadingProgress: number;
}

interface UseViewer3DOptions {
  autoLoad?: boolean;
  enableCaching?: boolean;
  maxCacheSize?: number;
}

/**
 * Hook for managing 3D viewer state and performance
 */
export function useViewer3D(options: UseViewer3DOptions = {}) {
  const {
    autoLoad = false,
    enableCaching = true,
    maxCacheSize = 500,
  } = options;

  const [state, setState] = useState<Viewer3DState>({
    isEnabled: autoLoad,
    isVisible: autoLoad,
    selectedNodeId: null,
    geometryCache: new Map(),
    loadingProgress: 0,
  });

  const cacheRef = useRef<Map<string, any>>(new Map());

  // Lazily enable 3D viewer (only when user requests it)
  const enable3DViewer = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isEnabled: true,
      isVisible: true,
    }));
  }, []);

  // Disable 3D viewer to free resources
  const disable3DViewer = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isVisible: false,
    }));
    // Clear cache to free memory
    cacheRef.current.clear();
  }, []);

  // Update selected node in 3D view
  const selectNode3D = useCallback((node: GraphNode | null) => {
    setState((prev) => ({
      ...prev,
      selectedNodeId: node?.id || null,
    }));
  }, []);

  // Cache geometry to avoid re-parsing
  const cacheGeometry = useCallback((nodeId: string, geometry: any) => {
    if (!enableCaching) return;

    // Implement simple LRU cache
    if (cacheRef.current.size >= maxCacheSize) {
      const firstKey = cacheRef.current.keys().next().value;
      cacheRef.current.delete(firstKey);
    }

    cacheRef.current.set(nodeId, geometry);
    setState((prev) => ({
      ...prev,
      geometryCache: new Map(cacheRef.current),
    }));
  }, [enableCaching, maxCacheSize]);

  // Get cached geometry
  const getGeometry = useCallback((nodeId: string) => {
    return cacheRef.current.get(nodeId);
  }, []);

  // Update loading progress
  const updateProgress = useCallback((progress: number) => {
    setState((prev) => ({
      ...prev,
      loadingProgress: Math.min(progress, 100),
    }));
  }, []);

  // Reset 3D viewer state
  const reset = useCallback(() => {
    cacheRef.current.clear();
    setState({
      isEnabled: autoLoad,
      isVisible: autoLoad,
      selectedNodeId: null,
      geometryCache: new Map(),
      loadingProgress: 0,
    });
  }, [autoLoad]);

  return {
    // State
    isEnabled: state.isEnabled,
    isVisible: state.isVisible,
    selectedNodeId: state.selectedNodeId,
    loadingProgress: state.loadingProgress,
    
    // Controls
    enable3DViewer,
    disable3DViewer,
    selectNode3D,
    
    // Caching
    cacheGeometry,
    getGeometry,
    
    // Utilities
    updateProgress,
    reset,
  };
}

/**
 * Hook for synchronizing selection across modals (Graph, Tree, Properties, 3D)
 */
export function useCrossModalSelection() {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [syncSource, setSyncSource] = useState<'graph' | 'tree' | 'properties' | '3d' | null>(null);

  // Update selection from any modal
  const selectFromGraph = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);
    setSyncSource('graph');
  }, []);

  const selectFromTree = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);
    setSyncSource('tree');
  }, []);

  const selectFromProperties = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);
    setSyncSource('properties');
  }, []);

  const selectFrom3D = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);
    setSyncSource('3d');
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNode(null);
    setSyncSource(null);
  }, []);

  return {
    selectedNode,
    syncSource,
    selectFromGraph,
    selectFromTree,
    selectFromProperties,
    selectFrom3D,
    clearSelection,
  };
}

export default useViewer3D;
