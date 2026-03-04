import { describe, it, expect, beforeEach, type Mock } from 'vitest';
import { M_walkmove } from '../../../src/ai/movement.js';
import type { Entity } from '../../../src/entities/entity.js';
import type { EntitySystem } from '../../../src/entities/system.js';
import { MoveType } from '../../../src/entities/entity.js';
import { createMonsterEntityFactory, createTraceMock, createTestGame, spawnEntity } from '@quake2ts/test-utils';
import type { GameImports } from '../../../src/imports.js';

describe('M_walkmove', () => {
  let entity: Entity;
  let context: EntitySystem;
  let imports: GameImports;

  beforeEach(() => {
    const gameResult = createTestGame();
    context = gameResult.game.entities;
    imports = gameResult.imports;

    entity = spawnEntity(context, createMonsterEntityFactory('monster_infantry', {
      origin: { x: 0, y: 0, z: 100 },
      oldOrigin: { x: 0, y: 0, z: 100 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      movetype: MoveType.Step,
      flags: 0,
      groundentity: { index: 1 } as Entity,
      waterlevel: 0,
    }));
  });

  it('should return false if checkBottom fails (step off ledge)', () => {
    // 1. Move trace: succeeds
    (imports.trace as Mock).mockReturnValueOnce(createTraceMock({ fraction: 1.0, endpos: { x: 10, y: 0, z: 100 } }));

    // 2. M_CheckBottom traces: fail (no ground found)
    // It does two traces. Both return fraction 1.0 (no hit)
    (imports.trace as Mock).mockReturnValue(createTraceMock({ fraction: 1.0 }));
    (imports.pointcontents as Mock).mockReturnValue(0);

    const result = M_walkmove(entity, 0, 10, context);
    expect(result).toBe(false);
  });

  it('should return true and update origin if move is valid', () => {
    // 1. Move trace: succeeds
    (imports.trace as Mock).mockReturnValueOnce(createTraceMock({ fraction: 1.0, endpos: { x: 10, y: 0, z: 100 } }));

    // 2. M_CheckBottom traces: succeed (hit ground)
    (imports.trace as Mock).mockReturnValue(createTraceMock({ fraction: 0.5, endpos: { x: 10, y: 0, z: 80 } }));
    (imports.pointcontents as Mock).mockReturnValue(0);

    const result = M_walkmove(entity, 0, 10, context);

    expect(result).toBe(true);
    expect(entity.origin.x).toBeGreaterThan(0);
  });

  it('should return false if move hits a wall (and stepping fails)', () => {
    // 1. Forward trace: Hit wall
    (imports.trace as Mock).mockReturnValueOnce(createTraceMock({ fraction: 0.5, startsolid: false, allsolid: false, endpos: { x: 5, y: 0, z: 100 } }));

    // 2. Step Up trace: Clear
    (imports.trace as Mock).mockReturnValueOnce(createTraceMock({ fraction: 1.0, startsolid: false, allsolid: false, endpos: { x: 0, y: 0, z: 118 } }));

    // 3. Step Forward (High) trace: Hit wall again (Too tall to step)
    (imports.trace as Mock).mockReturnValueOnce(createTraceMock({ fraction: 0.5, startsolid: false, allsolid: false, endpos: { x: 5, y: 0, z: 118 } }));

    const result = M_walkmove(entity, 0, 10, context);

    expect(result).toBe(false);
  });
});
