
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Weapon_ChainFist, fireChainfist } from '../../../../src/combat/weapons/chainfist.js';
import { Entity } from '../../../../src/entities/entity.js';
import { EntitySystem } from '../../../../src/entities/system.js';
import { WeaponStateEnum } from '../../../../src/combat/weapons/state.js';
import { createPlayerWeaponStates } from '../../../../src/combat/weapons/state.js';
import { createPlayerInventory } from '../../../../src/inventory/playerInventory.js';
import { GameExports } from '../../../../src/index.js';
import { DamageMod } from '../../../../src/combat/damageMods.js';
import { TempEntity, ServerCommand } from '@quake2ts/shared';
import * as damage from '../../../../src/combat/damage.js';
import * as common from '../../../../src/combat/weapons/common.js';
import * as animation from '../../../../src/combat/weapons/animation.js';

describe('Chainfist Weapon', () => {
  let entity: Entity;
  let sys: EntitySystem;
  let gameMock: GameExports;
  let target: Entity;

  let tDamageSpy: any;
  let applyKickSpy: any;
  let weaponRepeatingSpy: any;

  beforeEach(() => {
    tDamageSpy = vi.spyOn(damage, 'T_Damage').mockImplementation(() => undefined as any);
    applyKickSpy = vi.spyOn(common, 'applyKick').mockImplementation(() => undefined as any);
    weaponRepeatingSpy = vi.spyOn(animation, 'Weapon_Repeating').mockImplementation((ent: any, a: any, b: any, c: any, d: any, e: any, fire: any, sys: any) => {
        if (ent.client?.weaponstate === WeaponStateEnum.WEAPON_FIRING) {
            ent.client.gun_frame++;
            fire(ent);
        }
    });

    target = {
      inUse: true,
      takedamage: 100, // health
      origin: { x: 100, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
    } as unknown as Entity;

    gameMock = {
      trace: vi.fn(),
      time: 100,
      multicast: vi.fn(),
      deathmatch: false,
      entities: {
          findInBox: vi.fn().mockReturnValue([target]),
      } as any
    } as unknown as GameExports;

    sys = {
      timeSeconds: 100,
      sound: vi.fn(),
      game: gameMock,
      rng: {
        frandom: vi.fn().mockReturnValue(0.01),
      }
    } as unknown as EntitySystem;

    entity = {
      origin: { x: 80, y: 0, z: 0 }, // Close to target
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      viewheight: 22,
      angles: { x: 0, y: 0, z: 0 },
      client: {
        weaponStates: createPlayerWeaponStates(),
        inventory: createPlayerInventory(),
        weaponstate: WeaponStateEnum.WEAPON_FIRING,
        gun_frame: 10,
        buttons: 1, // Attack held
        weapon_think_time: 0,
        v_angle: { x: 0, y: 0, z: 0 },
      },
    } as unknown as Entity;

    vi.clearAllMocks();
  });

  describe('fireChainfist', () => {
      it('should damage target if within range and in front', () => {
          // Setup
          const start = { x: 80, y: 0, z: 0 };
          const forward = { x: 1, y: 0, z: 0 }; // Facing target

          fireChainfist(gameMock, entity, entity.client!.inventory, {} as any, start, forward);

          expect(tDamageSpy).toHaveBeenCalled();
          const callArgs = (T_Damage as any).mock.calls[0];
          expect(callArgs[0]).toBe(target);
          expect(callArgs[6]).toBe(7); // Base damage
          expect(callArgs[9]).toBe(DamageMod.CHAINFIST);
      });

      it('should not damage target if out of range', () => {
          entity.origin.x = 0; // Too far (target is at 100)

          const start = { x: 0, y: 0, z: 0 };
          const forward = { x: 1, y: 0, z: 0 };

          fireChainfist(gameMock, entity, entity.client!.inventory, {} as any, start, forward);

          expect(tDamageSpy).not.toHaveBeenCalled();
      });
  });

  describe('Weapon_ChainFist Think', () => {
      it('should call Weapon_Repeating with correct args', () => {
          Weapon_ChainFist(entity, sys);

          expect(weaponRepeatingSpy).toHaveBeenCalled();
          const args = (Weapon_Repeating as any).mock.calls[0];

          expect(args[1]).toBe(4); // Activate Last
          expect(args[2]).toBe(32); // Fire Last
          expect(args[3]).toBe(57); // Idle Last
          expect(args[4]).toBe(60); // Deactivate Last
          expect(args[5]).toEqual([]); // Pause frames
      });

      it('should apply frame skipping logic via fire callback', () => {
           // Set gun_frame to 11.
           // Mocked Weapon_Repeating increments to 12.
           // Fire callback sees 12, sets to 14.
           entity.client!.gun_frame = 11;
           entity.client!.buttons = 1;

           Weapon_ChainFist(entity, sys);

           expect(entity.client!.gun_frame).toBe(14);
      });

      it('should trigger smoke effect probabilistically', () => {
          // Smoke checks gun_frame AFTER Weapon_Repeating logic.
          // We want to test when gun_frame becomes 42.
          // We set start frame to 41. Mock increments to 42.
          // Weapon_ChainFist logic checks 42.
          entity.client!.weaponstate = WeaponStateEnum.WEAPON_READY; // Use READY so mock doesn't fire (and doesn't increment if logic differs? Wait)

          // If WeaponState is READY, Weapon_Repeating usually calls Weapon_Generic.
          // Our mock only handles FIRING.
          // If we want smoke, we need to be in a state where smoke logic runs.
          // Weapon_ChainFist runs smoke logic unconditionally after Weapon_Repeating.

          // But our mock doesn't handle READY, so it does NOTHING.
          // So gun_frame stays what we set.
          // So we set 42.
          entity.client!.gun_frame = 42;

          // Note: Math.random is NOT mocked here because the code now uses sys.rng.frandom().
          // We mocked sys.rng.frandom above in beforeEach.

          Weapon_ChainFist(entity, sys);

          expect(gameMock.multicast).toHaveBeenCalledWith(
              expect.anything(),
              expect.anything(),
              ServerCommand.temp_entity,
              TempEntity.CHAINFIST_SMOKE,
              expect.anything()
          );
      });
  });
});
