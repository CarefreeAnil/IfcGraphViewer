/**
 * Hook for using IFC Parser Web Worker
 * Handles worker lifecycle and message passing
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ParsedIFCData } from '@/types/graph';
import type { WorkerMessage, WorkerResponse } from '@/workers/ifcParserWorker';
import { logger } from '@/utils/logger';

interface ParseProgress {
  percentage: number;
  message: string;
  entitiesProcessed?: number;
  totalEntities?: number;
}

// Worker timeout: 2 minutes for parsing large files
const WORKER_TIMEOUT_MS = 120000;

export function useIFCWorker() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<ParseProgress>({ percentage: 0, message: '' });
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const currentFileId = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup worker on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        logger.debug('Cleaning up IFC worker on unmount');
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const parseFile = useCallback(
    (file: File): Promise<ParsedIFCData> => {
      return new Promise((resolve, reject) => {
        // Terminate any existing worker
        if (workerRef.current) {
          logger.debug('Terminating existing worker');
          workerRef.current.terminate();
          workerRef.current = null;
        }

        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
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

        // Set timeout to prevent hung workers
        timeoutRef.current = setTimeout(() => {
          logger.error('Worker timeout: parsing took too long');
          if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
          }
          setIsLoading(false);
          setError('Parsing timeout: file took too long to process');
          reject(new Error('Worker timeout: parsing exceeded 2 minutes'));
        }, WORKER_TIMEOUT_MS);

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
            // Clear timeout on successful completion
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            setIsLoading(false);
            // Use timing message from final progress if available
            const finalMessage = workerProgress?.message || 'Parsing complete';
            setProgress({ percentage: 100, message: finalMessage });
            worker.terminate();
            workerRef.current = null;

            // Convert rawStepLines parallel arrays back to Map
            // Worker serializes as { keys: Int32Array, values: string[] } for efficient transfer
            if (data?.rawData?.rawStepLines && !(data.rawData.rawStepLines instanceof Map)) {
              const raw = data.rawData.rawStepLines as any;
              const stepsMap = new Map<number, string>();
              if (raw.keys instanceof Int32Array && Array.isArray(raw.values)) {
                // Parallel array format (optimized)
                const keys = raw.keys;
                const values = raw.values;
                for (let i = 0; i < keys.length; i++) {
                  stepsMap.set(keys[i], values[i]);
                }
              } else if (typeof raw === 'object') {
                // Legacy Object format (fallback)
                Object.entries(raw).forEach(([key, value]) => {
                  stepsMap.set(parseInt(key, 10), value as string);
                });
              }
              data.rawData.rawStepLines = stepsMap;
            }

            resolve(data);
          } else if (type === 'error') {
            // Clear timeout on error
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            setIsLoading(false);
            setError(workerError || 'Unknown error');
            logger.error('IFC parsing error:', workerError);
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
