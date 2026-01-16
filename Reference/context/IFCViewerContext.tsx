import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ParsedIFC, IFCEntity, IFCGraphLevel } from '@/types/ifc';
import { IFCGeometry } from '@/lib/ifc-geometry-parser';

export interface IFCViewerState {
  parsedData: ParsedIFC;
  geometries: Map<number, IFCGeometry>;
  rawIFCData: Uint8Array | null;
  selectedEntityId: string | null;
  hoveredEntityId: string | null;
  levelOfDetail: IFCGraphLevel;
  isLoading: boolean;
}

export interface IFCViewerActions {
  setParsedData: (data: ParsedIFC) => void;
  setGeometries: (geometries: Map<number, IFCGeometry>) => void;
  setRawIFCData: (data: Uint8Array | null) => void;
  selectEntity: (id: string | null) => void;
  hoverEntity: (id: string | null) => void;
  setLevelOfDetail: (level: IFCGraphLevel) => void;
  setIsLoading: (loading: boolean) => void;
  getEntityById: (id: string) => IFCEntity | undefined;
}

const IFCViewerContext = createContext<(IFCViewerState & IFCViewerActions) | null>(null);

export function IFCViewerProvider({ children }: { children: ReactNode }) {
  const [parsedData, setParsedData] = useState<ParsedIFC>({ entities: [], relationships: [] });
  const [geometries, setGeometries] = useState<Map<number, IFCGeometry>>(new Map());
  const [rawIFCData, setRawIFCData] = useState<Uint8Array | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [levelOfDetail, setLevelOfDetail] = useState<IFCGraphLevel>(2);
  const [isLoading, setIsLoading] = useState(false);

  const selectEntity = useCallback((id: string | null) => {
    setSelectedEntityId(id);
  }, []);

  const hoverEntity = useCallback((id: string | null) => {
    setHoveredEntityId(id);
  }, []);

  const getEntityById = useCallback((id: string) => {
    return parsedData.entities.find(e => e.id === id);
  }, [parsedData.entities]);

  return (
    <IFCViewerContext.Provider
      value={{
        parsedData,
        geometries,
        rawIFCData,
        selectedEntityId,
        hoveredEntityId,
        levelOfDetail,
        isLoading,
        setParsedData,
        setGeometries,
        setRawIFCData,
        selectEntity,
        hoverEntity,
        setLevelOfDetail,
        setIsLoading,
        getEntityById,
      }}
    >
      {children}
    </IFCViewerContext.Provider>
  );
}

export function useIFCViewer() {
  const context = useContext(IFCViewerContext);
  if (!context) {
    throw new Error('useIFCViewer must be used within IFCViewerProvider');
  }
  return context;
}
