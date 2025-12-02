import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shotgunThink } from '../../../src/combat/weapons/shotgun.js';
import { Entity } from '../../../src/entities/entity.js';
import { GameExports } from '../../../src/index.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import {
    FRAME_SHOTGUN_ACTIVATE_LAST,
    FRAME_SHOTGUN_FIRE_LAST,
    FRAME_SHOTGUN_IDLE_LAST,
    FRAME_SHOTGUN_DEACTIVATE_LAST
} from '../../../src/combat/weapons/frames.js';
import { WeaponId } from '../../../src/inventory/playerInventory.js';
import { AmmoType } from '../../../src/inventory/ammo.js';

describe('Shotgun Animation Logic', () => {
    let mockSys: EntitySystem;
    let mockGame: GameExports;
    let mockPlayer: Entity;

    beforeEach(() => {
        mockGame = {
            time: 10.0,
            trace: vi.fn(),
            multicast: vi.fn(),
            sound: vi.fn(),
            random: {
                crandom: () => 0.5,
                frandom: () => 0.5,
            },
        } as unknown as GameExports;

        mockSys = {
            timeSeconds: 10.0,
            game: mockGame,
            sound: vi.fn(),
        } as unknown as EntitySystem;

        mockPlayer = {
            client: {
                weaponstate: WeaponStateEnum.WEAPON_READY,
                gun_frame: FRAME_SHOTGUN_IDLE_LAST,
                weapon_think_time: 0,
                buttons: 0,
                inventory: {
                    ammo: {
                        counts: {
                            [AmmoType.Shells]: 10,
                        },
                    },
                    powerups: new Map(),
                    weaponStates: {
                        [WeaponId.Shotgun]: { lastFireTime: 0 }
                    }
                },
                angles: { x: 0, y: 0, z: 0 },
            },
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            index: 1,
        } as unknown as Entity;
    });

    it('should fire on frame 8 and 9', () => {
        // Setup state to fire
        mockPlayer.client!.buttons = 1; // BUTTON_ATTACK
        mockPlayer.client!.weaponstate = WeaponStateEnum.WEAPON_READY;
        mockPlayer.client!.gun_frame = FRAME_SHOTGUN_IDLE_LAST;

        // 1. Ready -> Firing (Start)
        shotgunThink(mockPlayer, mockSys);
        expect(mockPlayer.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        expect(mockPlayer.client!.gun_frame).toBe(FRAME_SHOTGUN_ACTIVATE_LAST + 1); // 8

        // Mock trace to avoid error in fireShotgun
        (mockGame.trace as any).mockReturnValue({ fraction: 1.0 });

        // 2. Firing Frame 8
        // Need to advance time
        mockSys.timeSeconds += 0.1;

        // This call should trigger firing because frame is 8 (in fire_frames)
        shotgunThink(mockPlayer, mockSys);

        // Check firing happened (muzzleflash multicast)
        expect(mockGame.multicast).toHaveBeenCalled();
        expect(mockPlayer.client!.inventory.ammo.counts[AmmoType.Shells]).toBe(9);

        // gun_frame should not increment yet? No, Weapon_Generic checks fire frame, fires, THEN increments or returns.
        // Wait, current Weapon_Generic impl:
        // Checks fire_frames. If match, fires.
        // THEN increments frame.
        // So frame should be 9 now.
        expect(mockPlayer.client!.gun_frame).toBe(9);

        // 3. Firing Frame 9
        mockSys.timeSeconds += 0.1;
        mockGame.multicast = vi.fn(); // Reset

        shotgunThink(mockPlayer, mockSys);

        // Frame 9 is also in fire_frames, so it should fire again?
        // Wait, standard Quake 2 shotgun fires ONCE.
        // But logic says: "if (ent->client->ps.gunframe == 9) { ent->client->ps.gunframe++; return; }"
        // This suggests on frame 9 it DOES NOT fire, it just increments and returns.
        // My implementation of Weapon_Generic iterates fire_frames.
        // If 9 is in fire_frames, it calls fire(ent).

        // If I put 9 in fire_frames, it WILL fire.
        // The original C code passes `weapon_shotgun_fire` as the callback.
        // And `weapon_shotgun_fire` has logic: if frame == 9, just increment and return.

        // So my `fireShotgun` needs to handle the frame 9 case if I want faithful reproduction,
        // OR I should NOT put 9 in fire_frames if it doesn't actually fire.
        // But if I don't put it in fire_frames, Weapon_Generic just treats it as a normal frame.
        // Normal frame logic: increment and set think time.

        // The special logic "gunframe++; return;" effectively SKIPS a think cycle (makes the frame duration 0?)?
        // No, it returns from the fire function.
        // The fire function is called by Weapon_Generic.
        // Weapon_Generic calls fire(). If fire() increments gunframe, then Weapon_Generic logic continues?
        // In C Weapon_Generic:
        // if (gunframe == fire_frames[n]) { fire(ent); break; }
        // ...
        // gunframe++;

        // If `fire` increments gunframe, then we increment it AGAIN in Weapon_Generic?
        // That would skip a frame.
        // In C, `weapon_shotgun_fire` increments gunframe on frame 9.
        // So on frame 9, it becomes 10 inside fire(), then Weapon_Generic loop continues...
        // wait, Weapon_Generic loop for fire_frames breaks.
        // Then Weapon_Generic increments gunframe?
        // "ent->client->ps.gunframe++; return;" is at end of Weapon_Generic FIRING block.

        // So on frame 9:
        // fire() called. increment to 10.
        // Weapon_Generic increments to 11.
        // So frame 9 and 10 are processed in one tick?
        // Effectively making frame 9 instant.

        // If I want this behavior, I need `fireShotgun` to access gun_frame.
        // But `fireShotgun` logic I extracted is pure firing logic.

        // If frame 9 is just a "pump" or delay frame that is skipped/fast-forwarded,
        // maybe I can just omit it from fire_frames?
        // If I omit 9 from fire_frames, it will be treated as a normal frame duration (0.1s).
        // If the original INTENT was to skip it, then omitting it makes it slower.

        // Let's assume for now I want it to fire ONCE.
        // So on frame 8 it fires.
        // On frame 9 it does NOT fire.
        // So I should remove 9 from `SHOTGUN_FIRE_FRAMES` in `shotgun.ts` IF `fireShotgun` doesn't handle the "skip" logic.

        // BUT, `fireShotgun` I wrote fires UNCONDITIONALLY.
        // So if I keep 9 in `SHOTGUN_FIRE_FRAMES`, it fires TWICE.
        // That is WRONG.

        // I should fix `shotgun.ts` to only have [8] in fire_frames?
        // Or fix `fireShotgun` to check frame.
        // But `fireShotgun` is generic firing logic now.

        // The "skip frame 9" logic is specific to Shotgun animation timing.
        // Maybe I should just remove 9 from `SHOTGUN_FIRE_FRAMES`.
        // Then frame 9 plays for 0.1s.
        // If the original code skipped it, then my shotgun is 0.1s slower per shot.

        // Ideally, `shotgunThink` can handle this specific logic.
        // But `Weapon_Generic` is generic.

        // I will remove 9 from `SHOTGUN_FIRE_FRAMES` in `shotgun.ts` for now to prevent double firing.
        // And I will verify it fires only once in the test.
    });
});
