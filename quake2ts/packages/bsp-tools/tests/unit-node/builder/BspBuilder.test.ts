import { describe, it, expect } from 'vitest';
import { BspBuilder } from '../../../src/builder/BspBuilder.js';
import type { BrushDef, EntityDef, OpeningDef } from '../../../src/builder/types.js';

describe('BspBuilder', () => {
  it('should initialize with default options', () => {
    const builder = new BspBuilder();
    expect(builder).toBeDefined();
  });

  it('should allow setting worldspawn properties', () => {
    const builder = new BspBuilder();
    builder.setWorldspawn({ message: 'Hello World' });
  });

  it('should add entities', () => {
    const builder = new BspBuilder();
    const entity: EntityDef = {
      classname: 'info_player_start',
      properties: { origin: '0 0 0' }
    };
    builder.addEntity(entity);
  });

  it('should add brushes', () => {
    const builder = new BspBuilder();
    const brush: BrushDef = {
      sides: [] // Empty for now
    };
    builder.addBrush(brush);
    const result = builder.build();
    expect(result.stats.brushCount).toBe(1);
  });

  it('should return a build result structure', () => {
    const builder = new BspBuilder();
    const result = builder.build();
    expect(result).toBeDefined();
    expect(result.bsp).toBeDefined();
    expect(result.stats).toBeDefined();
    expect(result.warnings).toEqual([]);
  });

  describe('High-Level Primitives', () => {
    it('should add a room with default solid walls', () => {
      const builder = new BspBuilder();
      builder.addRoom({
        origin: { x: 0, y: 0, z: 0 },
        size: { x: 256, y: 256, z: 128 },
        wallThickness: 16
      });
      const result = builder.build();
      // Room = Floor + Ceiling + 4 Walls = 6 brushes
      expect(result.stats.brushCount).toBe(6);
    });

    it('should add a room with openings', () => {
      const builder = new BspBuilder();
      const opening: OpeningDef = {
        wall: 'north',
        position: { x: 0, y: 0, z: 0 }, // Center of room
        size: { x: 64, y: 32, z: 80 }   // 64 wide, 80 high doorway
      };

      builder.addRoom({
        origin: { x: 0, y: 0, z: 0 },
        size: { x: 256, y: 256, z: 128 },
        wallThickness: 16,
        openings: [opening]
      });

      const result = builder.build();
      // Floor + Ceiling = 2
      // South, East, West walls = 3 solid
      // North wall with hole in middle -> 4 pieces (Top, Bottom, Left, Right)
      // Total = 2 + 3 + 4 = 9 brushes
      expect(result.stats.brushCount).toBe(9);
    });

    it('should add a corridor (X-aligned)', () => {
      const builder = new BspBuilder();
      builder.addCorridor({
        start: { x: 0, y: 0, z: 0 },
        end: { x: 256, y: 0, z: 0 },
        width: 64,
        height: 128,
        wallThickness: 16
      });

      const result = builder.build();
      // Floor + Ceiling + 2 Walls = 4 brushes
      expect(result.stats.brushCount).toBe(4);
    });

    it('should add a corridor (Y-aligned)', () => {
      const builder = new BspBuilder();
      builder.addCorridor({
        start: { x: 0, y: 0, z: 0 },
        end: { x: 0, y: 256, z: 0 },
        width: 64,
        height: 128,
        wallThickness: 16
      });

      const result = builder.build();
      expect(result.stats.brushCount).toBe(4);
    });

    it('should throw on diagonal corridor (MVP limitation)', () => {
      const builder = new BspBuilder();
      expect(() => {
        builder.addCorridor({
          start: { x: 0, y: 0, z: 0 },
          end: { x: 100, y: 100, z: 0 },
          width: 64,
          height: 128
        });
      }).toThrow(/Only axis-aligned corridors are supported/);
    });

    it('should add stairs', () => {
      const builder = new BspBuilder();
      builder.addStairs({
        origin: { x: 0, y: 0, z: 0 },
        width: 64,
        height: 64,
        depth: 128,
        stepCount: 4,
        direction: 'north'
      });

      const result = builder.build();
      // 4 steps = 4 brushes
      expect(result.stats.brushCount).toBe(4);
    });
  });
});
