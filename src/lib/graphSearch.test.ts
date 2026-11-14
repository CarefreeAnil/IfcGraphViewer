import { describe, expect, it } from 'vitest';
import { getSearchMatches, nodeMatchesSearch } from './graphSearch';
import { GraphNode } from '@/types/graph';

const node: GraphNode = {
  id: 'wall-1',
  label: 'External wall',
  type: 'element',
  ifcType: 'IfcWall',
  expressId: 42,
  properties: {
    GlobalId: '3abc-wall',
    FireRating: '90 minutes',
  },
};

describe('graph search', () => {
  it('matches labels, IFC types, Express IDs, GlobalIds, and property values', () => {
    expect(nodeMatchesSearch(node, 'external')).toBe(true);
    expect(nodeMatchesSearch(node, 'ifcwall')).toBe(true);
    expect(nodeMatchesSearch(node, '42')).toBe(true);
    expect(nodeMatchesSearch(node, '3ABC-WALL')).toBe(true);
    expect(nodeMatchesSearch(node, '90 minutes')).toBe(true);
  });

  it('returns matching nodes in graph order', () => {
    const second = { ...node, id: 'door-1', label: 'Fire door' };
    expect(getSearchMatches([node, second], 'door')).toEqual([second]);
  });
});
