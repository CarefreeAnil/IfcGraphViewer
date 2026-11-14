import { describe, expect, it } from 'vitest';
import { mapBuildingSmartToValidationResult } from './buildingsmartMapper';

function result(overrides: Record<string, unknown> = {}) {
  return {
    public_id: 'outcome-1',
    validation_task_public_id: 'task-1',
    feature: 'Unknown validation outcome',
    severity: 4,
    outcome_code: 'X00040',
    ...overrides,
  };
}

describe('mapBuildingSmartToValidationResult', () => {
  it('normalizes numeric severity strings as errors', () => {
    const mapped = mapBuildingSmartToValidationResult({
      jobId: 'job-1',
      status: 'completed',
      outcome: { results: [result({ severity_in_db: '4' })] },
    });

    expect(mapped.errors).toHaveLength(1);
    expect(mapped.errors[0].severity).toBe('error');
    expect(mapped.errors[0].buildingSmart?.outcomeState).toBe('error');
  });

  it('does not duplicate uncategorized errors', () => {
    const mapped = mapBuildingSmartToValidationResult({
      jobId: 'job-1',
      status: 'completed',
      outcome: { results: [result({ feature: 'Uncategorized result' })] },
    });

    expect(mapped.errors).toHaveLength(1);
    expect(mapped.stats.totalErrors).toBe(1);
  });

  it('classifies structured entity rules as schema results', () => {
    const mapped = mapBuildingSmartToValidationResult({
      jobId: 'job-1',
      status: 'completed',
      outcome: {
        results: [
          result({
            feature: { type: 'entity_rule', attribute: 'IfcWall.Name' },
            severity: 3,
          }),
        ],
      },
    });

    expect(mapped.schemaErrors).toHaveLength(1);
    expect(mapped.warnings).toHaveLength(1);
  });

  it('preserves total result metadata when the response is paginated', () => {
    const mapped = mapBuildingSmartToValidationResult({
      jobId: 'job-1',
      status: 'completed',
      outcome: {
        results: [result()],
        metadata: { result_set: { total: 25, count: 1, page_size: 1, offset: 0 } },
      },
    });

    expect(mapped.stats.totalChecks).toBe(25);
    expect(mapped.errors).toHaveLength(1);
  });

  it('returns an explicit error for failed jobs', () => {
    const mapped = mapBuildingSmartToValidationResult({
      jobId: 'job-1',
      status: 'FAILED',
    });

    expect(mapped.valid).toBe(false);
    expect(mapped.errors).toHaveLength(1);
    expect(mapped.errors[0].type).toBe('VALIDATION_FAILED');
  });
});
