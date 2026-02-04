import { describe, it, expect } from 'vitest';
import { BspBuilder } from '../../../src/builder/BspBuilder.js';
import type { BrushDef, EntityDef } from '../../../src/builder/types.js';

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
});
