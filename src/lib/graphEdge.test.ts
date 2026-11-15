import { describe, expect, it } from 'vitest';
import { getEdgeRelationshipType, getRelationshipExplanation } from './graphEdge';

describe('graph edge details', () => {
  it('prefers the IFC relationship type and explains it', () => {
    const edge = {
      id: 'edge-1',
      source: 'building',
      target: 'storey',
      label: 'contains',
      type: 'relationship',
      relationshipType: 'IFCRELAGGREGATES',
    };

    expect(getEdgeRelationshipType(edge)).toBe('IFCRELAGGREGATES');
    expect(getRelationshipExplanation(getEdgeRelationshipType(edge))).toContain('Whole-part decomposition');
  });
});
