import { describe, it, expect, beforeEach } from 'vitest';
import { M_CheckBottom } from '../../../src/ai/movement.js';
import type { Entity } from '../../../src/entities/entity.js';
import type { EntitySystem } from '../../../src/entities/system.js';
import { MoveType } from '../../../src/entities/entity.js';
import { createEntityFactory, createTraceMock, createTestGame, spawnEntity } from '@quake2ts/test-utils';
import type { GameImports } from '../../../src/imports.js';

describe('M_CheckBottom', () => {
  let entity: Entity;
  let context: EntitySystem;
  let imports: GameImports;

  beforeEach(() => {
    const gameResult = createTestGame();
    context = gameResult.game.entities;
    imports = gameResult.imports;

    entity = spawnEntity(context, createEntityFactory({
      origin: { x: 0, y: 0, z: 100 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      movetype: MoveType.Step,
      flags: 0,
      groundentity: null,
      waterlevel: 0,
    }));
  });

  it('should return true if point content is solid (lava/slime/water)', () => {
    // Non-zero content represents solid/liquid here
    imports.pointcontents.mockReturnValue(1);
    const result = M_CheckBottom(entity, context);
    expect(result).toBe(true);
  });

  it('should return false if trace does not hit anything (stepping off into void)', () => {
    imports.pointcontents.mockReturnValue(0);
    imports.trace.mockReturnValue(createTraceMock({ fraction: 1.0 })); // Did not hit anything

    const result = M_CheckBottom(entity, context);
    expect(result).toBe(false);
  });

  it('should return true if trace hits something (solid ground)', () => {
    imports.pointcontents.mockReturnValue(0);
    imports.trace.mockReturnValue(createTraceMock({ fraction: 0.5, endpos: { x: 0, y: 0, z: 50 } })); // Hit something

    const result = M_CheckBottom(entity, context);
    expect(result).toBe(true);
  });
});
