/**
 * IFC Data Context
 * Global state management for parsed IFC data
 */
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ParsedIFCData, GraphNode } from '@/types/graph';

interface IFCDataContextType {
  parsedData: ParsedIFCData | null;
  setParsedData: (data: ParsedIFCData | null) => void;
  selectedNode: GraphNode | null;
  setSelectedNode: (node: GraphNode | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  parseProgress: number;
  setParseProgress: (progress: number) => void;
  parseMessage: string;
  setParseMessage: (message: string) => void;
  resetData: () => void;
}

const IFCDataContext = createContext<IFCDataContextType | undefined>(undefined);

export function IFCDataProvider({ children }: { children: ReactNode }) {
  const [parsedData, setParsedData] = useState<ParsedIFCData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseMessage, setParseMessage] = useState('');

  const resetData = useCallback(() => {
    setParsedData(null);
    setSelectedNode(null);
    setIsLoading(false);
    setParseProgress(0);
    setParseMessage('');
  }, []);

  return (
    <IFCDataContext.Provider
      value={{
        parsedData,
        setParsedData,
        selectedNode,
        setSelectedNode,
        isLoading,
        setIsLoading,
        parseProgress,
        setParseProgress,
        parseMessage,
        setParseMessage,
        resetData,
      }}
    >
      {children}
    </IFCDataContext.Provider>
  );
}

export function useIFCData() {
  const context = useContext(IFCDataContext);
  if (!context) {
    throw new Error('useIFCData must be used within IFCDataProvider');
  }
  return context;
}
