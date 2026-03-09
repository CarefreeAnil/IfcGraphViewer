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

      // -----------------------------------------------------------------
      // Pre-filter graphData before transfer to main thread.
      //
      // Problem: graphData.nodes contains ALL semantic entities including
      // property-type nodes (IFCPROPERTYSET, IFCPROPERTYSINGLEVALUE, etc.)
      // For a 170MB building these can be 100K-300K nodes.
      //
      // GraphVisualization's filteredData useMemo iterates every node, and
      // addBidirectionalEdges doubles every edge — all synchronously on mount.
      // This is the direct cause of the "UI freezes when graph loads" issue.
      //
      // Solution:
      //  • graphData.nodes  → only non-property nodes (elements, spatial, relationships)
      //  • graphData.edges  → only edges between the above nodes
      //  • result.allEntities → property stubs + directly-referenced geometry stubs
      //    so IFC Browser can navigate to LocalPlacement, ProductShape, etc.
      // -----------------------------------------------------------------
      const nonPropertyNodes = result.graphData.nodes.filter(n => n.type !== 'property');
      const nonPropertyIds   = new Set(nonPropertyNodes.map(n => n.id));

      const normalizeId = (v: any): string =>
        typeof v === 'string' ? v : String((v as any)?.id ?? v);

      const nonPropertyEdges = result.graphData.edges.filter(e =>
        nonPropertyIds.has(normalizeId(e.source)) && nonPropertyIds.has(normalizeId(e.target))
      );

      // Minimal stubs for property nodes — just what the IFC Browser list needs.
      // Full property data is already embedded in element nodes via attachPropertySets.
      const propertyStubs = result.graphData.nodes
        .filter(n => n.type === 'property')
        .map(n => ({
          id: n.id,
          expressId: n.expressId,
          ifcType: n.ifcType,
          label: n.label,
          type: n.type,
          isGraphVisible: false as const,
          properties: {
            _ifcStep: n.properties._ifcStep,
            _schemaColor: n.properties._schemaColor,
          },
        }));

      // -----------------------------------------------------------------
      // Geometry stubs: full transitive closure of all entities reachable
      // from semantic STEP lines via #ID references (BFS expansion).
      //
      // The parser skips geometry types for performance, but those entities
      // appear as #ID references in semantic STEP lines. The IFC Browser
      // needs them so users can click any #ID and navigate to its definition.
      //
      // BFS algorithm (done while rawStepLines is still available):
      //   Seed: scan _ifcStep of every nonPropertyNode + propertyStub.
      //   Expand: for each new #ID found, look it up in rawStepLines, emit
      //           a stub with its full _ifcStep, then scan that line too.
      //   Repeat until no new IDs are discovered (transitive closure).
      //
      // Safety cap: stop at MAX_GEOMETRY_STUBS to prevent OOM on very large
      // files where geometry is not shared (degenerate case).
      // -----------------------------------------------------------------
      const MAX_GEOMETRY_STUBS = 200_000;
      const geometryStubs: any[] = [];
      if (result.rawData?.rawStepLines) {
        const REF_RE = /#(\d+)/g;
        const TYPE_LINE_RE = /^#\d+=\s*([A-Z][A-Z0-9_]*)\s*\(/;

        // Mark all entities already accounted for so we never create duplicates.
        const knownExpressIds = new Set<number>([
          ...nonPropertyNodes.map(n => n.expressId).filter(Boolean) as number[],
          ...propertyStubs.map(n => n.expressId).filter(Boolean) as number[],
        ]);

        const queue: number[] = [];

        // Enqueue every #ID found in a STEP line that is not yet known.
        // IDs are marked known immediately to prevent duplicates in the queue.
        const enqueueRefs = (step: string | undefined) => {
          if (!step) return;
          REF_RE.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = REF_RE.exec(step)) !== null) {
            const id = parseInt(m[1], 10);
            if (!knownExpressIds.has(id)) {
              knownExpressIds.add(id);
              queue.push(id);
            }
          }
        };

        // Seed the BFS from all semantic nodes and property stubs.
        for (const node of nonPropertyNodes) {
          enqueueRefs(node.properties._ifcStep as string | undefined);
        }
        for (const stub of propertyStubs) {
          enqueueRefs(stub.properties._ifcStep as string | undefined);
        }

        // BFS loop: process queue entries, expand their references in turn.
        for (let qi = 0; qi < queue.length; qi++) {
          if (geometryStubs.length >= MAX_GEOMETRY_STUBS) break;

          const expressId = queue[qi];
          const stepLine = result.rawData.rawStepLines.get(expressId);
          if (!stepLine) continue;
          const tm = TYPE_LINE_RE.exec(stepLine);
          if (!tm) continue;

          geometryStubs.push({
            id: String(expressId),
            expressId,
            ifcType: tm[1],
            label: tm[1],
            type: 'geometry' as const,
            isGraphVisible: false as const,
            properties: {
              _schemaColor: '#9ca3af',
              _ifcStep: stepLine,
            },
          });

          // Expand: queue any new references found in this stub's STEP line.
          enqueueRefs(stepLine);
        }
      }

      // rawStepLines is NOT transferred to the main thread.
      // All semantic nodes have _ifcStep embedded; geometry stubs above captured
      // only the directly-referenced geometry entries, with their STEP text.
      if (result.rawData) {
        result.rawData.rawStepLines = undefined;
      }

      result.graphData = { nodes: nonPropertyNodes, edges: nonPropertyEdges };
      result.allEntities = [...propertyStubs, ...geometryStubs] as any[];

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

      // Send completion message
      const response: WorkerResponse = {
        type: 'complete',
        fileId,
        data: result,
        progress: lastProgress ? {
          percentage: 100,
          message: lastProgress.message,
        } : undefined,
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
