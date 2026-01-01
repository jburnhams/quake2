import { describe, it, expect } from 'vitest';
import {
  calculateReachableAreas,
  gatherVisibleFaces,
  isClusterVisible,
} from '@quake2ts/engine/render/bspTraversal';
import type { BspMap, BspArea, BspAreaPortal } from '@quake2ts/engine/assets/bsp';
import { Vec3 } from '@quake2ts/shared';

describe('bspTraversal area portals', () => {
  const createMockMap = () => {
    // Area 0 connected to Area 1 via Portal 1
    // Area 1 connected to Area 2 via Portal 2

    // Areas:
    // 0: [Portal 1 -> 1]
    // 1: [Portal 1 -> 0, Portal 2 -> 2]
    // 2: [Portal 2 -> 1]

    const areas: BspArea[] = [
      { numAreaPortals: 1, firstAreaPortal: 0 }, // Area 0
      { numAreaPortals: 2, firstAreaPortal: 1 }, // Area 1
      { numAreaPortals: 1, firstAreaPortal: 3 }, // Area 2
    ];

    const areaPortals: BspAreaPortal[] = [
      { portalNumber: 1, otherArea: 1 }, // Index 0: Area 0 -> 1
      { portalNumber: 1, otherArea: 0 }, // Index 1: Area 1 -> 0
      { portalNumber: 2, otherArea: 2 }, // Index 2: Area 1 -> 2
      { portalNumber: 2, otherArea: 1 }, // Index 3: Area 2 -> 1
    ];

    const map = {
      areas,
      areaPortals,
    } as unknown as BspMap;

    return map;
  };

  it('should find all areas if portals are open', () => {
    const map = createMockMap();
    const portalState = [false, true, true]; // Index 0 unused, 1 open, 2 open

    const reachable = calculateReachableAreas(map, 0, portalState);

    expect(reachable.has(0)).toBe(true);
    expect(reachable.has(1)).toBe(true);
    expect(reachable.has(2)).toBe(true);
  });

  it('should block traversal if a portal is closed', () => {
    const map = createMockMap();
    const portalState = [false, true, false]; // Index 1 open, 2 closed

    const reachable = calculateReachableAreas(map, 0, portalState);

    expect(reachable.has(0)).toBe(true);
    expect(reachable.has(1)).toBe(true);
    expect(reachable.has(2)).toBe(false);
  });

  it('should handle circular references or already visited nodes', () => {
      // Logic handles visited set
      const map = createMockMap();
      const portalState = [false, true, true];
      const reachable = calculateReachableAreas(map, 0, portalState);
      expect(reachable.size).toBe(3);
  });

  it('should return only start area if all portals closed', () => {
      const map = createMockMap();
      const portalState = [false, false, false];
      const reachable = calculateReachableAreas(map, 0, portalState);
      expect(reachable.has(0)).toBe(true);
      expect(reachable.has(1)).toBe(false);
  });
});
