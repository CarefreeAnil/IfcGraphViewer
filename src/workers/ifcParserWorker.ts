/**
 * IFC Parser Web Worker
 * Processes IFC files in a background thread to prevent UI blocking
 * Integrates with the full parser system
 */

import { parseIFCFile, ParseProgressCallback } from '../lib/ifcParser';

export interface WorkerMessage {
  type: 'parse' | 'cancel';
  fileId?: string;
  file?: File;
}

export interface WorkerResponse {
  type: 'progress' | 'complete' | 'error';
  fileId?: string;
  data?: any;
  error?: string;
  progress?: {
    percentage: number;
    message: string;
    entitiesProcessed?: number;
    totalEntities?: number;
  };
}

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, fileId, file } = event.data;

  if (type === 'cancel') {
    // Worker termination is handled by main thread
    return;
  }

  if (type === 'parse' && file && fileId) {
    try {
      // Progress callback
      const progressCallback: ParseProgressCallback = (progress) => {
        const response: WorkerResponse = {
          type: 'progress',
          fileId,
          progress: {
            percentage: progress.percentage,
            message: progress.message,
            entitiesProcessed: progress.entitiesProcessed,
            totalEntities: progress.totalEntities,
          },
        };
        self.postMessage(response);
      };

      // Parse all files with the unified parser (handles both IFC4 and IFC5)
      const result = await parseIFCFile(file, progressCallback);

      // Send completion message
      const response: WorkerResponse = {
        type: 'complete',
        fileId,
        data: result,
      };
      self.postMessage(response);

    } catch (error) {
      // Send error message
      const response: WorkerResponse = {
        type: 'error',
        fileId,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      };
      self.postMessage(response);
    }
  }
};

export {};
