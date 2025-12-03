
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Weapon_Repeating } from '../../../src/combat/weapons/animation.js';
import { Entity } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import { createPlayerWeaponStates } from '../../../src/combat/weapons/state.js';
import { createPlayerInventory } from '../../../src/inventory/playerInventory.js';
import { GameExports } from '../../../src/index.js';

describe('Weapon_Repeating', () => {
  let entity: Entity;
  let sys: EntitySystem;
  let fireMock: any;
  let gameMock: Partial<GameExports>;

  beforeEach(() => {
    gameMock = {
      trace: vi.fn(),
      time: 100,
    };

    // Create a partial EntitySystem mock
    sys = {
      timeSeconds: 100,
      sound: vi.fn(),
    } as unknown as EntitySystem;

    // Simulate fire function managing frames (simple increment)
    fireMock = vi.fn((ent: Entity) => {
        ent.client!.gun_frame++;
    });

    entity = {
      client: {
        weaponStates: createPlayerWeaponStates(),
        inventory: createPlayerInventory(),
        weaponstate: WeaponStateEnum.WEAPON_FIRING,
        gun_frame: 10,
        buttons: 0,
        weapon_think_time: 0,
        inventory: { // Fix inventory nesting if needed, assuming Entity struct
            ammo: { counts: {} },
            powerups: new Map()
        }
      },
    } as unknown as Entity;
  });

  it('should call fire callback every frame in firing state', () => {
    // Setup: Firing state
    entity.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;
    entity.client!.gun_frame = 9;

    const fire_frame = 10;
    const fire_last = 15;
    const idle_last = 20;

    // Call
    Weapon_Repeating(entity, fire_frame, fire_last, idle_last, 0, 0, fireMock, sys);

    // Should call fire
    expect(fireMock).toHaveBeenCalledWith(entity);

    // Check if fireMock incremented frame (proof it ran)
    expect(entity.client!.gun_frame).toBe(10);

    // Check next think time
    expect(entity.client!.weapon_think_time).toBe(sys.timeSeconds + 0.1);
  });
});
