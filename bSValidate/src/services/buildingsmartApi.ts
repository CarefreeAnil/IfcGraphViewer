/**
 * BuildingSmart Validation API Client Service
 * Handles file submission, polling, and result retrieval
 */

export interface BuildingSmartSubmitResponse {
  jobId: string;
  status: string;
}

export interface BuildingSmartResultsResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | string;
  outcome?: {
    results?: Array<{
      // Actual BuildingSmart fields (from API response)
      public_id: string;
      validation_task_public_id: string;
      feature: any;
      feature_version?: number | null;
      severity: any;
      outcome_code?: string;
      expected?: any;
      observed?: any;
      instance_public_id?: string | null;
      created?: string;
      updated?: string | null;
      
      // Legacy/alternative field names (for compatibility)
      msg?: string;
      message?: string;
      instance_id?: string;
      instanceId?: string;
      instance_type?: string;
      instanceType?: string;
      entity_type?: string;
      entityType?: string;
      attribute?: string;
      property?: string;
      propertyName?: string;
      validation_task?: string;
      validation_task_id?: string;
      instance_ref?: string;
      on_instance?: string;
      [key: string]: any; // Allow additional fields
    }>;
    metadata?: {
      result_set?: {
        total: number;
        count: number;
        page_size?: number;
        offset?: number;
        limit?: number;
      };
    };
  };
}

export interface ValidationTask {
  public_id: string;
  request_public_id: string;
  type: string; // SYNTAX, SCHEMA, NORMATIVE_IA, NORMATIVE_IP, INDUSTRY, etc.
  status: string; // PENDING, SKIPPED, N/A, INITIATED, FAILED, COMPLETED
  progress: number | null; // 0-100%
  status_reason: string | null;
  created: string;
  started: string | null;
  ended: string | null;
  updated: string | null;
}

export interface ValidationTasksResponse {
  jobId: string;
  tasks: ValidationTask[];
  metadata?: {
    result_set?: {
      total?: number;
      count?: number;
    };
  };
}

export class BuildingSmartApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'BuildingSmartApiError';
  }
}

const API_BASE = 'http://localhost:5001/api';

/**
 * Submit IFC file for validation
 */
export async function submitValidation(
  fileBuffer: ArrayBuffer,
  fileName: string
): Promise<BuildingSmartSubmitResponse> {
  try {
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
    formData.append('file', blob, fileName);

    const response = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      // Check if response is HTML (server error or not running)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new BuildingSmartApiError(
          'Backend server is not responding correctly. Please ensure the validation backend server is running at http://localhost:5001',
          response.status
        );
      }

      const errorData = await response.json().catch(() => ({}));
      throw new BuildingSmartApiError(
        errorData.error || 'Failed to submit validation',
        response.status,
        errorData.details
      );
    }

    const result = await response.json();
    return result;
  } catch (error) {
    if (error instanceof BuildingSmartApiError) throw error;

    // Check for JSON parse errors (typically means HTML response)
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      throw new BuildingSmartApiError(
        'Backend server is not running or not accessible. Please start the backend server at http://localhost:5001 using: cd bSValidate && npm start',
        undefined,
        error
      );
    }

    // Network errors (CORS, connection refused, etc.)
    if (error instanceof TypeError) {
      throw new BuildingSmartApiError(
        'Cannot connect to backend server at http://localhost:5001. Please ensure: 1) Backend server is running, 2) No firewall blocking the connection',
        undefined,
        error
      );
    }

    throw new BuildingSmartApiError(
      'Network error: Could not connect to validation server',
      undefined,
      error
    );
  }
}

/**
 * Fetch validation results for a job
 */
export async function fetchValidationResults(
  jobId: string
): Promise<BuildingSmartResultsResponse> {
  try {
    const response = await fetch(`${API_BASE}/results/${jobId}`);

    if (!response.ok) {
      // Check if response is HTML (server error or not running)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new BuildingSmartApiError(
          'Backend server is not responding correctly. Please ensure the validation backend server is running at http://localhost:5001',
          response.status
        );
      }

      const errorData = await response.json().catch(() => ({}));
      throw new BuildingSmartApiError(
        errorData.error || 'Failed to fetch results',
        response.status,
        errorData
      );
    }

    const result = await response.json();
    return result;
  } catch (error) {
    if (error instanceof BuildingSmartApiError) throw error;

    // Check for JSON parse errors (typically means HTML response)
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      throw new BuildingSmartApiError(
        'Backend server is not running or not accessible. Please start the backend server at http://localhost:5001 using: cd bSValidate && npm start',
        undefined,
        error
      );
    }

    // Network errors (CORS, connection refused, etc.)
    if (error instanceof TypeError) {
      throw new BuildingSmartApiError(
        'Cannot connect to backend server at http://localhost:5001. Please ensure the backend server is running',
        undefined,
        error
      );
    }

    throw new BuildingSmartApiError(
      'Network error: Could not fetch validation results',
      undefined,
      error
    );
  }
}

/**
 * Poll for validation results until completion
 * @param jobId - The validation job ID
 * @param onProgress - Callback for status updates
 * @param pollInterval - Polling interval in milliseconds (default: 3000)
 * @param maxAttempts - Maximum polling attempts (default: 120, i.e., 6 minutes)
 */
export async function pollValidationResults(
  jobId: string,
  onProgress?: (status: string) => void,
  pollInterval: number = 3000,
  maxAttempts: number = 120
): Promise<BuildingSmartResultsResponse> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const result = await fetchValidationResults(jobId);

    const statusLower = result.status?.toLowerCase();
    console.log(`[Poll ${attempts + 1}/${maxAttempts}] Status: ${result.status} (normalized: ${statusLower})`);

    if (onProgress) {
      onProgress(result.status);
    }

    // Check status case-insensitively
    if (statusLower === 'completed' || statusLower === 'failed') {
      return result;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    attempts++;
  }

  throw new BuildingSmartApiError(
    'Validation timeout: Results not available after maximum polling attempts. Job may still be processing.',
    408
  );
}

/**
 * Fetch validation tasks for a job
 * Shows detailed progress of each validation type (syntax, schema, normative rules, etc.)
 */
export async function fetchValidationTasks(
  jobId: string
): Promise<ValidationTasksResponse> {
  try {
    const response = await fetch(`${API_BASE}/tasks/${jobId}`);

    if (!response.ok) {
      // Check if response is HTML (server error or not running)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new BuildingSmartApiError(
          'Backend server is not responding correctly. Please ensure the validation backend server is running at http://localhost:5001',
          response.status
        );
      }

      const errorData = await response.json().catch(() => ({}));
      throw new BuildingSmartApiError(
        errorData.error || 'Failed to fetch validation tasks',
        response.status,
        errorData
      );
    }

    const result = await response.json();
    return result;
  } catch (error) {
    if (error instanceof BuildingSmartApiError) throw error;

    // Check for JSON parse errors (typically means HTML response)
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      throw new BuildingSmartApiError(
        'Backend server is not running or not accessible. Please start the backend server at http://localhost:5001',
        undefined,
        error
      );
    }

    // Network errors (CORS, connection refused, etc.)
    if (error instanceof TypeError) {
      throw new BuildingSmartApiError(
        'Cannot connect to backend server at http://localhost:5001. Please ensure the backend server is running',
        undefined,
        error
      );
    }

    throw new BuildingSmartApiError(
      'Network error: Could not fetch validation tasks',
      undefined,
      error
    );
  }
}

/**
 * Cancel a running validation
 * @param jobId - The validation job ID to cancel
 */
export async function cancelValidation(jobId: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/validate/${jobId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      // Check if response is HTML (server error or not running)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new BuildingSmartApiError(
          'Backend server is not responding correctly. Please ensure the validation backend server is running at http://localhost:5001',
          response.status
        );
      }

      const errorData = await response.json().catch(() => ({}));
      throw new BuildingSmartApiError(
        errorData.error || 'Failed to cancel validation',
        response.status,
        errorData
      );
    }

    // Success - no content expected (204)
  } catch (error) {
    if (error instanceof BuildingSmartApiError) throw error;

    // Check for JSON parse errors (typically means HTML response)
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      throw new BuildingSmartApiError(
        'Backend server is not running or not accessible. Please start the backend server at http://localhost:5001',
        undefined,
        error
      );
    }

    // Network errors (CORS, connection refused, etc.)
    if (error instanceof TypeError) {
      throw new BuildingSmartApiError(
        'Cannot connect to backend server at http://localhost:5001. Please ensure the backend server is running',
        undefined,
        error
      );
    }

    throw new BuildingSmartApiError(
      'Network error: Could not cancel validation',
      undefined,
      error
    );
  }
}
