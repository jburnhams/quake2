import { describe, it, expect } from 'vitest';
import { subtractRects, type Rect } from '../../../src/builder/rectUtils.js';

describe('subtractRects', () => {
  it('should return original rect if no holes', () => {
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const holes: Rect[] = [];
    const result = subtractRects(rect, holes);
    expect(result).toEqual([rect]);
  });

  it('should return original rect if hole does not intersect', () => {
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const holes: Rect[] = [{ x: 200, y: 0, w: 10, h: 10 }];
    const result = subtractRects(rect, holes);
    expect(result).toEqual([rect]);
  });

  it('should split rect with hole in middle', () => {
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const hole: Rect = { x: 40, y: 40, w: 20, h: 20 };
    const result = subtractRects(rect, [hole]);

    // Expect 4 pieces
    expect(result).toHaveLength(4);

    // Verify areas sum up to total - hole
    const totalArea = result.reduce((sum, r) => sum + r.w * r.h, 0);
    expect(totalArea).toBe(100*100 - 20*20);

    // Verify specific pieces (based on implementation order)
    // Top
    expect(result).toContainEqual({ x: 0, y: 0, w: 100, h: 40 });
    // Bottom
    expect(result).toContainEqual({ x: 0, y: 60, w: 100, h: 40 });
    // Left
    expect(result).toContainEqual({ x: 0, y: 40, w: 40, h: 20 });
    // Right
    expect(result).toContainEqual({ x: 60, y: 40, w: 40, h: 20 });
  });

  it('should handle hole touching edges', () => {
    // Hole touching left edge
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const hole: Rect = { x: 0, y: 40, w: 20, h: 20 };
    const result = subtractRects(rect, [hole]);

    // Left piece should not exist
    const left = result.find(r => r.x < hole.x);
    expect(left).toBeUndefined();

    // Should have Top, Bottom, Right
    expect(result).toContainEqual({ x: 0, y: 0, w: 100, h: 40 }); // Top
    expect(result).toContainEqual({ x: 0, y: 60, w: 100, h: 40 }); // Bottom
    expect(result).toContainEqual({ x: 20, y: 40, w: 80, h: 20 }); // Right
    expect(result).toHaveLength(3);
  });

  it('should handle hole covering entire rect', () => {
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const hole: Rect = { x: -10, y: -10, w: 120, h: 120 };
    const result = subtractRects(rect, [hole]);
    expect(result).toEqual([]);
  });

  it('should handle multiple holes', () => {
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const hole1: Rect = { x: 20, y: 20, w: 20, h: 20 }; // Top-left ish
    const hole2: Rect = { x: 60, y: 60, w: 20, h: 20 }; // Bottom-right ish

    const result = subtractRects(rect, [hole1, hole2]);

    const totalArea = result.reduce((sum, r) => sum + r.w * r.h, 0);
    expect(totalArea).toBe(100*100 - 20*20 - 20*20);
  });
});
