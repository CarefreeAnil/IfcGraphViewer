/**
 * IFC Parser Web Worker
 * Processes IFC files in a background thread to prevent UI blocking
 * Integrates with the full parser system
 */

import { parseIFCFile, ParseProgressCallback } from '../lib/ifcParser';
import { parseIFC5File } from '../lib/ifc5Parser';

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
      const fileName = file.name.toLowerCase();
      
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

      // Parse based on file type
      let result;
      if (fileName.endsWith('.ifcx')) {
        // Send progress for IFC5
        progressCallback({
          percentage: 50,
          message: 'Parsing IFC5 file...',
        });
        result = await parseIFC5File(file);
        progressCallback({
          percentage: 100,
          message: 'IFC5 parsing complete',
        });
      } else {
        result = await parseIFCFile(file, progressCallback);
      }

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
