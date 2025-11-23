import { describe, expect, it, vi } from 'vitest';
import { checkWater } from '../../src/physics/fluid.js';
import { Entity, EntityFlags } from '../../src/entities/entity.js';
import { CONTENTS_WATER, CONTENTS_SOLID, CONTENTS_LAVA } from '@quake2ts/shared';
import { EntitySystem } from '../../src/entities/system.js';

describe('fluid physics', () => {
  const mockImports = {
    pointcontents: vi.fn(),
    trace: vi.fn(),
    linkentity: vi.fn(),
  };

  const mockSystem = {
    sound: vi.fn(),
  } as unknown as EntitySystem;

  it('should detect entering water', () => {
    const ent = new Entity(1);
    ent.origin = { x: 0, y: 0, z: 0 };
    ent.mins = { x: -16, y: -16, z: -24 };
    ent.maxs = { x: 16, y: 16, z: 32 };
    ent.waterlevel = 0;
    ent.watertype = 0;

    // Feet in water
    mockImports.pointcontents.mockReturnValue(CONTENTS_WATER);

    checkWater(ent, mockSystem, mockImports);

    expect(ent.waterlevel).toBeGreaterThan(0); // Could be 1, 2 or 3 depending on mocked point contents
    expect(ent.watertype).toBe(CONTENTS_WATER);
    expect(ent.flags & EntityFlags.Swim).toBe(EntityFlags.Swim);
    expect(mockSystem.sound).toHaveBeenCalledWith(ent, 0, 'player/watr_in.wav', 1, 1, 0);
  });

  it('should detect leaving water', () => {
    const ent = new Entity(1);
    ent.origin = { x: 0, y: 0, z: 0 };
    ent.mins = { x: -16, y: -16, z: -24 };
    ent.maxs = { x: 16, y: 16, z: 32 };
    ent.waterlevel = 1;
    ent.watertype = CONTENTS_WATER;
    ent.flags |= EntityFlags.Swim;

    // Not in water
    mockImports.pointcontents.mockReturnValue(0);

    checkWater(ent, mockSystem, mockImports);

    expect(ent.waterlevel).toBe(0);
    expect(ent.watertype).toBe(0);
    expect(ent.flags & EntityFlags.Swim).toBe(0);
    expect(mockSystem.sound).toHaveBeenCalledWith(ent, 0, 'player/watr_out.wav', 1, 1, 0);
  });

  it('should detect waist deep water', () => {
    const ent = new Entity(1);
    ent.origin = { x: 0, y: 0, z: 0 };
    ent.mins = { x: -16, y: -16, z: -24 };
    ent.maxs = { x: 16, y: 16, z: 32 };
    ent.waterlevel = 0;

    // Feet in water, Waist in water, Head in air
    mockImports.pointcontents
      .mockReturnValueOnce(CONTENTS_WATER) // Feet
      .mockReturnValueOnce(CONTENTS_WATER) // Waist
      .mockReturnValueOnce(0); // Head

    checkWater(ent, mockSystem, mockImports);

    expect(ent.waterlevel).toBe(2);
  });

  it('should play lava sound for lava', () => {
    const ent = new Entity(1);
    ent.origin = { x: 0, y: 0, z: 0 };
    ent.mins = { x: -16, y: -16, z: -24 };
    ent.maxs = { x: 16, y: 16, z: 32 };

    mockImports.pointcontents.mockReturnValue(CONTENTS_LAVA);

    checkWater(ent, mockSystem, mockImports);

    expect(ent.watertype).toBe(CONTENTS_LAVA);
    expect(mockSystem.sound).toHaveBeenCalledWith(ent, 0, 'player/lava_in.wav', 1, 1, 0);
  });
});
