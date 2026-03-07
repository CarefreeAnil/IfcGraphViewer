/**
 * IFC Parser Web Worker
 * Processes IFC files in a background thread to prevent UI blocking
 * Integrates with the full parser system
 */

import { parseIFCFile, ParseProgressCallback } from '../lib/ifcParser';
import { createGraphDataFromEntities } from '../lib/graphBuilder';

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
      const workerStartTime = performance.now();
      let lastProgress: any = null;
      
      // Progress callback
      const progressCallback: ParseProgressCallback = (progress) => {
        lastProgress = progress;  // Store final progress message
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

      // Post initial message
      self.postMessage({
        type: 'progress',
        fileId,
        progress: {
          percentage: 0,
          message: `[Worker] Starting parse: ${file.name} (${file.size} bytes)`,
        },
      } as WorkerResponse);

      // Parse all files with the unified parser (handles both IFC4 and IFC5)
      const parseStartTime = performance.now();
      const result = await parseIFCFile(file, progressCallback);
      const parseEndTime = performance.now();

      // [Architectural Change]: Graph construction extracted to graphBuilder
      // We run it here in the worker to keep the UI responsive
      const graphBuildStart = performance.now();
      self.postMessage({
        type: 'progress',
        fileId,
        progress: {
          percentage: 95,
          message: `[Worker] Constructing graph relationships...`,
        },
      } as WorkerResponse);

      // result.allEntities contains the nodes with necessary properties
      // IMPORTANT: Pass rawStepLines to graphBuilder so it can add actual STEP content
      const enrichedGraph = createGraphDataFromEntities(
        result.allEntities,
        result.graphData.edges,
        result.rawData?.rawStepLines  // Pass STEP lines to avoid placeholder format
      );

      // Update result with enriched graph
      result.graphData = enrichedGraph;
      if (result.metadata.relationshipCount === 0) {
          result.metadata.relationshipCount = enrichedGraph.edges.length;
      }

      // Serialize rawStepLines Map as parallel arrays for efficient transfer
      // Int32Array for keys can be Transferred (zero-copy), strings are cloned
      // This avoids creating a 300K-property Object intermediary
      let rawStepKeysBuffer: ArrayBuffer | undefined;
      if (result.rawData?.rawStepLines && result.rawData.rawStepLines instanceof Map) {
        const map = result.rawData.rawStepLines as Map<number, string>;
        const keys = new Int32Array(map.size);
        const values: string[] = new Array(map.size);
        let idx = 0;
        map.forEach((value, key) => {
          keys[idx] = key;
          values[idx] = value;
          idx++;
        });
        result.rawData.rawStepLines = { keys, values } as any;
        rawStepKeysBuffer = keys.buffer;
      }

      const graphBuildEnd = performance.now();

      // Post timing info
      self.postMessage({
        type: 'progress',
        fileId,
        progress: {
          percentage: 100,
          message: `[Worker] Complete: Parse=${(parseEndTime - parseStartTime).toFixed(0)}ms, Graph=${(graphBuildEnd - graphBuildStart).toFixed(0)}ms`,
        },
      } as WorkerResponse);

      // Send completion message — transfer rawStepLines keys buffer (zero-copy)
      const response: WorkerResponse = {
        type: 'complete',
        fileId,
        data: result,
        progress: lastProgress ? {
          percentage: 100,
          message: lastProgress.message,  // Include final timing message
        } : undefined,
      };
      const transferables: Transferable[] = [];
      if (rawStepKeysBuffer) {
        transferables.push(rawStepKeysBuffer);
      }
      self.postMessage(response, transferables);

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
