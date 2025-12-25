/**
 * Web Worker for IFC parsing
 * Handles heavy parsing off the main thread to prevent UI blocking
 */

import * as WebIFC from 'web-ifc';

// Message handler
self.onmessage = async (event: MessageEvent) => {
  const { type, fileBuffer, fileName } = event.data;

  if (type === 'PARSE_IFC') {
    try {
      const result = await parseIFCInWorker(fileBuffer, fileName);
      self.postMessage({ type: 'PARSE_COMPLETE', result, error: null });
    } catch (error) {
      self.postMessage({
        type: 'PARSE_ERROR',
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
};

async function parseIFCInWorker(fileBuffer: ArrayBuffer, fileName: string) {
  const ifcApi = new WebIFC.IfcAPI();

  // Init WASM
  await ifcApi.Init((path: string) => {
    return `/${path}`;
  });

  const data = new Uint8Array(fileBuffer);
  const modelId = ifcApi.OpenModel(data);

  // Get all types
  const allTypes = ifcApi.GetAllTypesOfModel(modelId);
  const results: any[] = [];

  // Process types with progress updates
  const totalTypes = allTypes.length;
  for (let typeIdx = 0; typeIdx < totalTypes; typeIdx++) {
    const typeInfo = allTypes[typeIdx];
    const typeId = typeInfo.typeID;

    try {
      const entityIds = ifcApi.GetLineIDsWithType(modelId, typeId);
      const entities: any[] = [];

      for (let i = 0; i < entityIds.size(); i++) {
        const expressId = entityIds.get(i);
        try {
          const entity = ifcApi.GetLine(modelId, expressId);
          if (entity) {
            entities.push({ expressId, entity });
          }
        } catch {
          // Skip entities that can't be parsed
        }
      }

      results.push({
        typeId,
        entities,
      });

      // Report progress every 10 types
      if (typeIdx % 10 === 0) {
        self.postMessage({
          type: 'PARSE_PROGRESS',
          progress: (typeIdx / totalTypes) * 100,
        });
      }
    } catch {
      // Skip types that can't be enumerated
    }
  }

  ifcApi.CloseModel(modelId);

  return {
    fileName,
    fileSize: fileBuffer.byteLength,
    modelId,
    types: results,
  };
}
