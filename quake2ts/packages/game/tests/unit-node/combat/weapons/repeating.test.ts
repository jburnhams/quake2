
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Weapon_Repeating } from '../../../../src/combat/weapons/animation.js';
import { Entity } from '../../../../src/entities/entity.js';
import { EntitySystem } from '../../../../src/entities/system.js';
import { WeaponStateEnum } from '../../../../src/combat/weapons/state.js';
import { createPlayerEntityFactory, createTestContext } from '@quake2ts/test-utils';
import { WeaponId } from '../../../../src/inventory/playerInventory.js';
import { AmmoType } from '../../../../src/inventory/ammo.js';

describe('Weapon_Repeating', () => {
  let entity: Entity;
  let sys: EntitySystem;
  let fireMock: any;

  beforeEach(() => {
    // 1. Use createTestContext to get a robust entity system and game mock
    const ctx = createTestContext();
    sys = ctx.entities;

    // We can also access game/engine mocks if needed, e.g.:
    // (ctx.game as any).time = 100;
    // But sys.timeSeconds is what's usually used by logic.
    (sys as any).timeSeconds = 100;

    fireMock = vi.fn();

    // 2. Use createPlayerEntityFactory to create a well-formed player entity
    //    instead of manually stitching together a partial object.
    const playerFactory = createPlayerEntityFactory({
      client: {
        weaponstate: WeaponStateEnum.WEAPON_FIRING,
        gun_frame: 10,
        buttons: 0,
        weapon_think_time: 0,
        // Ensure inventory structures are present (factory does this, but being explicit about overrides)
        inventory: {
            ammo: { counts: [], caps: [] },
            ownedWeapons: new Set(),
            powerups: new Map(),
            keys: new Set(),
            items: new Set()
        },
        weaponStates: {
            currentWeapon: null,
            lastFireTime: 0,
            weaponFrame: 0,
            weaponIdleTime: 0,
            states: new Map(),
            activeWeaponId: null
        }
      } as any // Cast because factory typings might be slightly loose or strict on client
    });

    // Spawn the entity into the system so it's managed (optional for this specific test but good practice)
    entity = sys.spawn();
    Object.assign(entity, playerFactory);
  });

  it('should continue firing if button is held', () => {
    // Setup: Firing state, button held
    entity.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;
    entity.client!.buttons = 1; // BUTTON_ATTACK
    entity.client!.gun_frame = 9; // Set to ACTIVATE_LAST (fire_frame - 1) so it increments to fire_frame

    // Weapon_Repeating(ent, ACTIVATE_LAST, fire_last, idle_last, deactivate_last, pause_frames, fire, sys)
    const activate_last = 9;
    const fire_last = 15;
    const idle_last = 20;

    // First call: Starts at 9, increments to 10 (fire_frame), calls fire
    Weapon_Repeating(entity, activate_last, fire_last, idle_last, 0, [], fireMock, sys);

    // Should call fire
    expect(fireMock).toHaveBeenCalledWith(entity);

    expect(entity.client!.gun_frame).toBe(10);
  });

  it('should reset loop', () => {
    entity.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;
    entity.client!.buttons = 1;
    entity.client!.gun_frame = 15; // fire_last

    const activate_last = 9;
    const fire_last = 15;
    const idle_last = 20;

    // Should reset to fire_frame (activate_last + 1 = 10)
    Weapon_Repeating(entity, activate_last, fire_last, idle_last, 0, [], fireMock, sys);

    expect(entity.client!.gun_frame).toBe(10);
    expect(fireMock).toHaveBeenCalledWith(entity); // Because it reset to 10
  });
});
