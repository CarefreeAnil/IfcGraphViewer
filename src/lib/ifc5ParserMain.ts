/**
 * IFC5 Main Parser
 * Entry point for parsing .ifcx files with layer stacking and validation
 */

import {
  IFC5File,
  IFC5Schema,
  PostCompositionNode,
  IFC5ParseOptions,
  IFC5ValidationError,
  PreCompositionNode,
} from '../types/ifc5';
import {
  toInputNodes,
  flattenCompositionInput,
  createArtificialRoot,
  expandFirstRootInInput,
} from './ifc5Composition';

/**
 * Validate attribute value against schema
 */
function validateAttributeValue(
  desc: any,
  value: any,
  path: string,
  schemas: Record<string, IFC5Schema>
): void {
  if (value === undefined || value === null) {
    if (!desc.optional) {
      throw new IFC5ValidationError(
        `Required attribute at ${path} is null or undefined`
      );
    }
    return;
  }

  const dataType = desc.dataType;

  switch (dataType) {
    case 'String':
      if (typeof value !== 'string') {
        throw new IFC5ValidationError(
          `Expected string at ${path}, got ${typeof value}`
        );
      }
      break;

    case 'Boolean':
      if (typeof value !== 'boolean') {
        throw new IFC5ValidationError(
          `Expected boolean at ${path}, got ${typeof value}`
        );
      }
      break;

    case 'Integer':
    case 'Real':
      if (typeof value !== 'number') {
        throw new IFC5ValidationError(
          `Expected number at ${path}, got ${typeof value}`
        );
      }
      break;

    case 'Enum':
      if (
        desc.enumRestrictions &&
        !desc.enumRestrictions.options.includes(value)
      ) {
        throw new IFC5ValidationError(
          `Invalid enum value at ${path}: ${value}`
        );
      }
      break;

    case 'Array':
      if (!Array.isArray(value)) {
        throw new IFC5ValidationError(
          `Expected array at ${path}, got ${typeof value}`
        );
      }
      if (desc.arrayRestrictions) {
        value.forEach((item, index) => {
          validateAttributeValue(
            desc.arrayRestrictions.value,
            item,
            `${path}[${index}]`,
            schemas
          );
        });
      }
      break;

    case 'Object':
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new IFC5ValidationError(
          `Expected object at ${path}, got ${typeof value}`
        );
      }
      if (desc.objectRestrictions) {
        Object.entries(desc.objectRestrictions.values).forEach(
          ([key, valueDesc]) => {
            validateAttributeValue(
              valueDesc,
              value[key],
              `${path}.${key}`,
              schemas
            );
          }
        );
      }
      break;

    case 'Reference':
      // References should be objects with 'ref' property
      if (
        typeof value !== 'object' ||
        !value.ref ||
        typeof value.ref !== 'string'
      ) {
        throw new IFC5ValidationError(`Invalid reference at ${path}`);
      }
      break;

    case 'DateTime':
      // Accept string or Date
      if (typeof value !== 'string' && !(value instanceof Date)) {
        throw new IFC5ValidationError(
          `Expected DateTime at ${path}, got ${typeof value}`
        );
      }
      break;

    case 'Blob':
      // Accept any type for blob
      break;

    default:
      throw new IFC5ValidationError(
        `Unknown data type: ${dataType} at ${path}`
      );
  }
}

/**
 * Validate all nodes against schemas
 */
function validate(
  schemas: Record<string, IFC5Schema>,
  inputNodes: Map<string, PreCompositionNode>
): void {
  inputNodes.forEach((node, path) => {
    Object.entries(node.attributes).forEach(([attrName, attrValue]) => {
      const schema = schemas[attrName];
      if (!schema) {
        throw new IFC5ValidationError(
          `No schema found for attribute: ${attrName} at path: ${path}`
        );
      }
      validateAttributeValue(schema.value, attrValue, path, schemas);
    });
  });
}

/**
 * Parse IFC5 file and compose tree
 */
export function parseIFC5File(
  file: IFC5File,
  options: IFC5ParseOptions = {}
): PostCompositionNode {
  const {
    validateSchemas = true,
    createArtificialRoot: useArtificialRoot = true,
  } = options;

  // Convert nodes to input format
  const inputNodes = toInputNodes(file.data);

  // Flatten to pre-composition nodes
  const preCompositionNodes = flattenCompositionInput(inputNodes);

  // Validate schemas if requested
  if (validateSchemas) {
    try {
      validate(file.schemas, preCompositionNodes);
    } catch (error) {
      console.error('Schema validation failed:', error);
      throw error;
    }
  }

  // Compose tree
  if (useArtificialRoot) {
    return createArtificialRoot(preCompositionNodes);
  } else {
    return expandFirstRootInInput(preCompositionNodes);
  }
}

/**
 * Federate multiple IFC5 files into one
 */
export function federateIFC5Files(files: IFC5File[]): IFC5File {
  if (files.length === 0) {
    throw new Error('Cannot federate empty set of files');
  }

  const result: IFC5File = {
    header: { ...files[0].header },
    imports: [],
    schemas: {},
    data: [],
  };

  // Merge schemas
  files.forEach((file) => {
    Object.entries(file.schemas).forEach(([schemaId, schema]) => {
      result.schemas[schemaId] = schema;
    });
  });

  // Merge data
  files.forEach((file) => {
    file.data.forEach((node) => {
      result.data.push(node);
    });
  });

  return result;
}

/**
 * Load IFC5 file from JSON string
 */
export function loadIFC5FromJSON(jsonString: string): IFC5File {
  try {
    const file = JSON.parse(jsonString) as IFC5File;

    // Basic validation
    if (!file.header || !file.data) {
      throw new IFC5ValidationError('Invalid IFC5 file structure');
    }

    if (!file.header.id) {
      throw new IFC5ValidationError('IFC5 file missing header.id');
    }

    return file;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new IFC5ValidationError(`Invalid JSON: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Load IFC5 file from File object
 */
export async function loadIFC5FromFile(file: File): Promise<IFC5File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const ifc5File = loadIFC5FromJSON(content);
        resolve(ifc5File);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Extract file info from IFC5 file
 */
export function getIFC5FileInfo(file: IFC5File) {
  return {
    id: file.header.id,
    version: file.header.ifcxVersion || file.header.dataVersion,
    author: file.header.author,
    timestamp: file.header.timestamp,
    nodeCount: file.data.length,
    schemaCount: Object.keys(file.schemas).length,
    importCount: file.imports.length,
  };
}

/**
 * Check if file is IFC5 format
 */
export function isIFC5File(file: File): boolean {
  return file.name.toLowerCase().endsWith('.ifcx');
}

/**
 * Prune duplicate nodes from federated file
 */
export function pruneIFC5File(file: IFC5File): IFC5File {
  const seen = new Set<string>();
  const prunedData = file.data.filter((node) => {
    const key = JSON.stringify(node);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return {
    ...file,
    data: prunedData,
  };
}
