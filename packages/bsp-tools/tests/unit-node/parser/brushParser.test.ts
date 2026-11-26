import { describe, it, expect } from 'vitest';
import { MapTokenizer } from '../../../src/parser/tokenizer.js';
import { parseBrush, planeFromPoints } from '../../../src/parser/brushParser.js';
import { type Vec3 } from '@quake2ts/shared';

describe('BrushParser', () => {
  describe('planeFromPoints', () => {
    it('should calculate plane from 3 points (CW/CCW check needed)', () => {
      // In Quake .map, points are usually defined in a specific winding order.
      // Standard is usually CW or CCW depending on tool, but the plane normal calculation expects consistent ordering.
      // q2tools uses (p2-p1) x (p3-p1).
      // Let's take 3 points on Z=0 plane: (0,0,0), (0,1,0), (1,0,0)
      // Quake 2 uses Clockwise (CW) winding for front faces.
      // p1=(0,0,0), p2=(0,1,0), p3=(1,0,0)
      // v1 = (0,1,0), v2 = (1,0,0)
      // cross(v2, v1) = (1,0,0) x (0,1,0) = (0,0,1) -> Up.

      const p1: Vec3 = { x: 0, y: 0, z: 0 };
      const p2: Vec3 = { x: 0, y: 1, z: 0 };
      const p3: Vec3 = { x: 1, y: 0, z: 0 };

      const plane = planeFromPoints(p1, p2, p3);
      expect(plane).not.toBeNull();
      expect(plane?.normal).toEqual({ x: 0, y: 0, z: 1 });
      expect(plane?.dist).toBe(0);
    });

    it('should return null for collinear points', () => {
      const p1: Vec3 = { x: 0, y: 0, z: 0 };
      const p2: Vec3 = { x: 1, y: 0, z: 0 };
      const p3: Vec3 = { x: 2, y: 0, z: 0 };

      const plane = planeFromPoints(p1, p2, p3);
      expect(plane).toBeNull();
    });
  });

  describe('parseBrush', () => {
    it('should parse a standard brush', () => {
      const input = `{
( 0 0 0 ) ( 1 0 0 ) ( 0 1 0 ) texture_name 0 0 0 1 1
( 0 0 0 ) ( 0 1 0 ) ( 0 0 1 ) texture_name 0 0 0 1 1
( 0 0 0 ) ( 0 0 1 ) ( 1 0 0 ) texture_name 0 0 0 1 1
( 1 0 0 ) ( 0 0 1 ) ( 0 1 0 ) texture_name 0 0 0 1 1
}`;
      const tokenizer = new MapTokenizer(input);
      // Consume the initial '{' because parseBrush expects to be called AFTER '{' is consumed (usually by parseEntity loop)
      // Wait, parseEntity loops: if (token == '{') parseBrush().
      // Does parseBrush expect '{' to be consumed?
      // Looking at q2tools/src/map.c: ParseBrush is called after '{' is read.
      // But typically a parser function might consume the start token or assume it's already consumed.
      // Let's assume it starts parsing contents immediately (sides), so '{' must be consumed.
      tokenizer.next();

      const brush = parseBrush(tokenizer, 220);
      expect(brush.sides).toHaveLength(4);
      expect(brush.sides[0].texture).toBe('texture_name');
      expect(brush.sides[0].offsetX).toBe(0);
      expect(brush.sides[0].scaleX).toBe(1);
    });

    it('should parse Valve 220 format', () => {
       const input = `{
( 0 0 0 ) ( 1 0 0 ) ( 0 1 0 ) texture_name [ 1 0 0 0 ] [ 0 1 0 0 ] 0 1 1
}`;
       const tokenizer = new MapTokenizer(input);
       tokenizer.next(); // Consume '{'

       const brush = parseBrush(tokenizer, 220);
       expect(brush.sides).toHaveLength(1);
       expect(brush.sides[0].uAxis).toBeDefined();
       expect(brush.sides[0].uAxis).toEqual({ x: 1, y: 0, z: 0 });
       expect(brush.sides[0].uOffset).toBe(0);
       expect(brush.sides[0].vAxis).toEqual({ x: 0, y: 1, z: 0 });
    });

    it('should parse surface flags content and value', () => {
        const input = `{
( 0 0 0 ) ( 1 0 0 ) ( 0 1 0 ) texture_name 0 0 0 1 1 1337 1 2
}`;
        const tokenizer = new MapTokenizer(input);
        tokenizer.next(); // Consume '{'

        const brush = parseBrush(tokenizer, 220);
        expect(brush.sides[0].contents).toBe(1337);
        expect(brush.sides[0].surfaceFlags).toBe(1);
        expect(brush.sides[0].value).toBe(2);
    });
  });
});
