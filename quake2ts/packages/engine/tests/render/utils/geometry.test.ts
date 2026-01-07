import { describe, test, expect } from 'vitest';
import { sortFrontToBack, sortBackToFront } from '../../../src/render/utils/geometry.js';
import type { VisibleFace } from '../../../src/render/bspTraversal.js';

describe('Geometry Utilities', () => {
  describe('sortFrontToBack', () => {
    test('sorts faces with higher sortKey first (nearest)', () => {
      const faces: VisibleFace[] = [
        { faceIndex: 0, sortKey: 10 },
        { faceIndex: 1, sortKey: 30 },
        { faceIndex: 2, sortKey: 20 },
      ];

      const sorted = sortFrontToBack(faces);

      expect(sorted).toEqual([
        { faceIndex: 1, sortKey: 30 },
        { faceIndex: 2, sortKey: 20 },
        { faceIndex: 0, sortKey: 10 },
      ]);
    });

    test('does not mutate original array', () => {
      const faces: VisibleFace[] = [
        { faceIndex: 0, sortKey: 10 },
        { faceIndex: 1, sortKey: 20 },
      ];

      const original = [...faces];
      sortFrontToBack(faces);

      expect(faces).toEqual(original);
    });
  });

  describe('sortBackToFront', () => {
    test('sorts faces with lower sortKey first (farthest)', () => {
      const faces: VisibleFace[] = [
        { faceIndex: 0, sortKey: 30 },
        { faceIndex: 1, sortKey: 10 },
        { faceIndex: 2, sortKey: 20 },
      ];

      const sorted = sortBackToFront(faces);

      expect(sorted).toEqual([
        { faceIndex: 1, sortKey: 10 },
        { faceIndex: 2, sortKey: 20 },
        { faceIndex: 0, sortKey: 30 },
      ]);
    });

    test('does not mutate original array', () => {
      const faces: VisibleFace[] = [
        { faceIndex: 0, sortKey: 10 },
        { faceIndex: 1, sortKey: 20 },
      ];

      const original = [...faces];
      sortBackToFront(faces);

      expect(faces).toEqual(original);
    });
  });
});
