
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGrenade } from '../../src/entities/projectiles.js';
import { Entity, MoveType } from '../../src/entities/entity.js';
import { ZERO_VEC3 } from '@quake2ts/shared';
import { createEntityFactory } from '@quake2ts/test-utils';
import { createPlayerEntityFactory } from '@quake2ts/test-utils/game/factories';

describe('createGrenade', () => {
  let sys: any;
  let owner: Entity;

  beforeEach(() => {
    sys = {
      spawn: vi.fn().mockImplementation(() => createEntityFactory({ origin: { ...ZERO_VEC3 } })),
      modelIndex: vi.fn(),
      scheduleThink: vi.fn(),
      finalizeSpawn: vi.fn(),
      timeSeconds: 10,
      sound: vi.fn(),
      findByRadius: vi.fn().mockReturnValue([]),
      multicast: vi.fn(),
      free: vi.fn(),
    };
    owner = createPlayerEntityFactory({
      origin: { x: 0, y: 0, z: 0 },
    });
  });

  it('should create a grenade with correct default timer', () => {
    const dir = { x: 1, y: 0, z: 0 };
    createGrenade(sys, owner, owner.origin, dir, 100, 500);

    const grenade = sys.spawn.mock.results[0].value;
    expect(grenade.classname).toBe('grenade');
    expect(sys.scheduleThink).toHaveBeenCalledWith(grenade, 12.5); // 10 + 2.5
  });

  it('should create a grenade with custom timer', () => {
    const dir = { x: 1, y: 0, z: 0 };
    createGrenade(sys, owner, owner.origin, dir, 100, 500, 1.0);

    const grenade = sys.spawn.mock.results[0].value;
    expect(sys.scheduleThink).toHaveBeenCalledWith(grenade, 11.0); // 10 + 1.0
  });

  it('should have bounce logic', () => {
      const dir = { x: 1, y: 0, z: 0 };
      createGrenade(sys, owner, owner.origin, dir, 100, 500);
      const grenade = sys.spawn.mock.results[0].value;

      expect(grenade.movetype).toBe(MoveType.Bounce);
      expect(grenade.touch).toBeDefined();
  });

  it('should play bounce sound on touch if not on ground', () => {
      const dir = { x: 1, y: 0, z: 0 };
      createGrenade(sys, owner, owner.origin, dir, 100, 500);
      const grenade = sys.spawn.mock.results[0].value;

      grenade.groundentity = undefined;
      grenade.touch(grenade, null, null, null);

      expect(sys.sound).toHaveBeenCalledWith(grenade, 0, 'weapons/grenlb1b.wav', 1, 1, 0);
  });
});
