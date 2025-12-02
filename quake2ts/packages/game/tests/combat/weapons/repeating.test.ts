
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Weapon_Repeating } from '../../../src/combat/weapons/animation.js';
import { Entity } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import { createPlayerWeaponStates } from '../../../src/combat/weapons/state.js';
import { createPlayerInventory } from '../../../src/inventory/playerInventory.js';
import { WeaponId } from '../../../src/inventory/playerInventory.js';
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

    fireMock = vi.fn();

    entity = {
      client: {
        weaponStates: createPlayerWeaponStates(),
        inventory: createPlayerInventory(),
        weaponstate: WeaponStateEnum.WEAPON_FIRING,
        gun_frame: 10,
        buttons: 0,
        weapon_think_time: 0,
      },
    } as unknown as Entity;
  });

  it('should continue firing if button is held', () => {
    // Setup: Firing state, button held
    entity.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;
    entity.client!.buttons = 1; // BUTTON_ATTACK
    entity.client!.gun_frame = 9; // Set to fire_frame - 1 so it increments to fire_frame

    // Weapon_Repeating(ent, fire_frame, fire_last, idle_last, pause_frames, noop_frames, fire)
    const fire_frame = 10;
    const fire_last = 15;
    const idle_last = 20;

    // First call: Starts at 9, increments to 10 (fire_frame), calls fire
    Weapon_Repeating(entity, fire_frame, fire_last, idle_last, 0, 0, fireMock, sys);

    // Should call fire
    expect(fireMock).toHaveBeenCalledWith(entity);

    expect(entity.client!.gun_frame).toBe(10);
  });

  it('should reset loop', () => {
    entity.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;
    entity.client!.buttons = 1;
    entity.client!.gun_frame = 15; // fire_last

    const fire_frame = 10;
    const fire_last = 15;
    const idle_last = 20;

    // Should reset to fire_frame
    Weapon_Repeating(entity, fire_frame, fire_last, idle_last, 0, 0, fireMock, sys);

    expect(entity.client!.gun_frame).toBe(10);
    expect(fireMock).toHaveBeenCalledWith(entity); // Because it reset to 10
  });
});
