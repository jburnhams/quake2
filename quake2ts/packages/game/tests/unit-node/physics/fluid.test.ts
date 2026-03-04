import { describe, expect, it, vi, beforeEach } from 'vitest';
import { checkWater } from '../../../src/physics/fluid.js';
import { EntityFlags } from '../../../src/entities/entity.js';
import { CONTENTS_WATER, CONTENTS_LAVA } from '@quake2ts/shared';
import { createTestGame, spawnEntity, createEntityFactory } from '@quake2ts/test-utils';

describe('fluid physics', () => {
  let mockImports: ReturnType<typeof createTestGame>['imports'];
  let game: ReturnType<typeof createTestGame>['game'];

  beforeEach(() => {
    const result = createTestGame();
    mockImports = result.imports;
    game = result.game;

    // Mock the sound system function so we can assert on it.
    vi.spyOn(game.entities, 'sound').mockImplementation(() => {});
  });

  it('should detect entering water', () => {
    const ent = spawnEntity(game.entities, createEntityFactory({
        origin: { x: 0, y: 0, z: 0 },
        mins: { x: -16, y: -16, z: -24 },
        maxs: { x: 16, y: 16, z: 32 },
        waterlevel: 0,
        watertype: 0,
    }));

    // Feet in water
    mockImports.pointcontents.mockReturnValue(CONTENTS_WATER);

    checkWater(ent, game.entities, mockImports);

    expect(ent.waterlevel).toBeGreaterThan(0); // Could be 1, 2 or 3 depending on mocked point contents
    expect(ent.watertype).toBe(CONTENTS_WATER);
    expect(ent.flags & EntityFlags.Swim).toBe(EntityFlags.Swim);
    expect(game.entities.sound).toHaveBeenCalledWith(ent, 0, 'player/watr_in.wav', 1, 1, 0);
  });

  it('should detect leaving water', () => {
    const ent = spawnEntity(game.entities, createEntityFactory({
        origin: { x: 0, y: 0, z: 0 },
        mins: { x: -16, y: -16, z: -24 },
        maxs: { x: 16, y: 16, z: 32 },
        waterlevel: 1,
        watertype: CONTENTS_WATER,
        flags: EntityFlags.Swim
    }));

    // Not in water
    mockImports.pointcontents.mockReturnValue(0);

    checkWater(ent, game.entities, mockImports);

    expect(ent.waterlevel).toBe(0);
    expect(ent.watertype).toBe(0);
    expect(ent.flags & EntityFlags.Swim).toBe(0);
    expect(game.entities.sound).toHaveBeenCalledWith(ent, 0, 'player/watr_out.wav', 1, 1, 0);
  });

  it('should detect waist deep water', () => {
    const ent = spawnEntity(game.entities, createEntityFactory({
        origin: { x: 0, y: 0, z: 0 },
        mins: { x: -16, y: -16, z: -24 },
        maxs: { x: 16, y: 16, z: 32 },
        waterlevel: 0
    }));

    // Feet in water, Waist in water, Head in air
    mockImports.pointcontents
      .mockReturnValueOnce(CONTENTS_WATER) // Feet
      .mockReturnValueOnce(CONTENTS_WATER) // Waist
      .mockReturnValueOnce(0); // Head

    checkWater(ent, game.entities, mockImports);

    expect(ent.waterlevel).toBe(2);
  });

  it('should play lava sound for lava', () => {
    const ent = spawnEntity(game.entities, createEntityFactory({
        origin: { x: 0, y: 0, z: 0 },
        mins: { x: -16, y: -16, z: -24 },
        maxs: { x: 16, y: 16, z: 32 }
    }));

    mockImports.pointcontents.mockReturnValue(CONTENTS_LAVA);

    checkWater(ent, game.entities, mockImports);

    expect(ent.watertype).toBe(CONTENTS_LAVA);
    expect(game.entities.sound).toHaveBeenCalledWith(ent, 0, 'player/lava_in.wav', 1, 1, 0);
  });
});
