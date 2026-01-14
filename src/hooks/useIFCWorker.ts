/**
 * Hook for using IFC Parser Web Worker
 * Handles worker lifecycle and message passing
 */

import { useState, useCallback, useRef } from 'react';
import { ParsedIFCData } from '@/types/graph';
import type { WorkerMessage, WorkerResponse } from '@/workers/ifcParserWorker';

interface ParseProgress {
  percentage: number;
  message: string;
  entitiesProcessed?: number;
  totalEntities?: number;
}

export function useIFCWorker() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<ParseProgress>({ percentage: 0, message: '' });
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const currentFileId = useRef<string | null>(null);

  const parseFile = useCallback(
    (file: File): Promise<ParsedIFCData> => {
      return new Promise((resolve, reject) => {
        // Terminate any existing worker
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }

        // Create new worker
        const worker = new Worker(
          new URL('../workers/ifcParserWorker.ts', import.meta.url),
          { type: 'module' }
        );
        workerRef.current = worker;

        // Generate unique file ID
        const fileId = `${Date.now()}-${Math.random()}`;
        currentFileId.current = fileId;

        // Reset state
        setIsLoading(true);
        setError(null);
        setProgress({ percentage: 0, message: 'Starting parser...' });

        // Handle messages from worker
        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const { type, fileId: responseFileId, data, error: workerError, progress: workerProgress } = event.data;

          // Ignore messages from previous file
          if (responseFileId !== fileId) {
            return;
          }

          if (type === 'progress' && workerProgress) {
            setProgress(workerProgress);
          } else if (type === 'complete') {
            setIsLoading(false);
            setProgress({ percentage: 100, message: 'Parsing complete' });
            worker.terminate();
            workerRef.current = null;
            resolve(data);
          } else if (type === 'error') {
            setIsLoading(false);
            setError(workerError || 'Unknown error');
            worker.terminate();
            workerRef.current = null;
            reject(new Error(workerError || 'Unknown error'));
          }
        };

        // Handle worker errors
        worker.onerror = (event) => {
          setIsLoading(false);
          const errorMessage = `Worker error: ${event.message}`;
          setError(errorMessage);
          worker.terminate();
          workerRef.current = null;
          reject(new Error(errorMessage));
        };

        // Send parse message to worker
        const message: WorkerMessage = {
          type: 'parse',
          fileId,
          file,
        };
        worker.postMessage(message);
      });
    },
    []
  );

  const cancelParsing = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      currentFileId.current = null;
      setIsLoading(false);
      setProgress({ percentage: 0, message: 'Cancelled' });
    }
  }, []);

  return {
    parseFile,
    cancelParsing,
    isLoading,
    progress,
    error,
  };
}
