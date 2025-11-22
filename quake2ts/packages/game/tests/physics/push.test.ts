import { describe, it, expect, vi } from 'vitest';
import { Entity } from '../../src/entities/entity.js';
import { GameImports } from '../../src/imports.js';
import { runPush } from '../../src/physics/movement.js';

describe('runPush', () => {
  it('should move an entity', () => {
    const ent = new Entity(0);
    ent.velocity = { x: 10, y: 0, z: 0 };
    ent.origin = { x: 0, y: 0, z: 0 };

    const imports: GameImports = {
      trace: (start, mins, maxs, end) => ({
        allsolid: false,
        startsolid: false,
        fraction: 1,
        endpos: end,
        plane: null,
        surfaceFlags: 0,
        contents: 0,
        ent: null,
      }),
      pointcontents: () => 0,
      linkentity: () => {},
    };

    runPush(ent, imports, 0.1);

    expect(ent.origin.x).toBe(1);
  });
});
