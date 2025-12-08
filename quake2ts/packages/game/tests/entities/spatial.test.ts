import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialGrid } from '../../src/entities/spatial';
import { Entity, Solid } from '../../src/entities/entity';
import { Vec3 } from '@quake2ts/shared';

describe('SpatialGrid', () => {
  let grid: SpatialGrid;

  beforeEach(() => {
    grid = new SpatialGrid(100); // 100 unit cells for easier testing
  });

  const createEntity = (mins: Vec3, maxs: Vec3, origin: Vec3 = {x:0, y:0, z:0}): Entity => {
    const ent = {
      index: 1,
      mins,
      maxs,
      origin,
      absmin: { x: origin.x + mins.x, y: origin.y + mins.y, z: origin.z + mins.z },
      absmax: { x: origin.x + maxs.x, y: origin.y + maxs.y, z: origin.z + maxs.z },
      solid: Solid.Bbox
    } as unknown as Entity;
    return ent;
  };

  it('should insert and query entities', () => {
    const ent1 = createEntity({ x: -10, y: -10, z: -10 }, { x: 10, y: 10, z: 10 }, { x: 50, y: 50, z: 50 });
    grid.insert(ent1);

    const results = grid.query({ x: 0, y: 0, z: 0 }, { x: 100, y: 100, z: 100 });
    expect(results).toContain(ent1);
  });

  it('should not return entities outside query box', () => {
    const ent1 = createEntity({ x: -10, y: -10, z: -10 }, { x: 10, y: 10, z: 10 }, { x: 500, y: 500, z: 500 });
    grid.insert(ent1);

    const results = grid.query({ x: 0, y: 0, z: 0 }, { x: 100, y: 100, z: 100 });
    expect(results).not.toContain(ent1);
  });

  it('should handle entities spanning multiple cells', () => {
    // Cell size is 100. Cell 0: 0-99, Cell 1: 100-199
    // Entity from 50 to 150 spans cell 0 and 1
    const ent1 = createEntity({ x: 0, y: 0, z: 0 }, { x: 100, y: 100, z: 100 }, { x: 50, y: 0, z: 0 });
    // absmin x: 50, absmax x: 150
    grid.insert(ent1);

    // Query cell 0
    const results0 = grid.query({ x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 });
    expect(results0).toContain(ent1);

    // Query cell 1
    const results1 = grid.query({ x: 120, y: 0, z: 0 }, { x: 130, y: 10, z: 10 });
    expect(results1).toContain(ent1);

    // Query cell 2 (200+)
    const results2 = grid.query({ x: 250, y: 0, z: 0 }, { x: 260, y: 10, z: 10 });
    expect(results2).not.toContain(ent1);
  });

  it('should remove entities', () => {
    const ent1 = createEntity({ x: -10, y: -10, z: -10 }, { x: 10, y: 10, z: 10 });
    grid.insert(ent1);
    grid.remove(ent1);

    const results = grid.query({ x: -50, y: -50, z: -50 }, { x: 50, y: 50, z: 50 });
    expect(results).toHaveLength(0);
  });

  it('should update entities', () => {
    const ent1 = createEntity({ x: -10, y: -10, z: -10 }, { x: 10, y: 10, z: 10 }, { x: 0, y: 0, z: 0 });
    grid.insert(ent1);

    // Move to far away
    ent1.origin = { x: 500, y: 500, z: 500 };
    ent1.absmin = { x: 490, y: 490, z: 490 };
    ent1.absmax = { x: 510, y: 510, z: 510 };

    grid.update(ent1);

    const resultsOld = grid.query({ x: -20, y: -20, z: -20 }, { x: 20, y: 20, z: 20 });
    expect(resultsOld).not.toContain(ent1);

    const resultsNew = grid.query({ x: 480, y: 480, z: 480 }, { x: 520, y: 520, z: 520 });
    expect(resultsNew).toContain(ent1);
  });
});
