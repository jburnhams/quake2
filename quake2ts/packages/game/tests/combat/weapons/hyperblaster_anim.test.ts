
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hyperBlasterThink } from '../../../src/combat/weapons/hyperblaster.js';
import { Entity } from '../../../src/entities/entity.js';
import { GameExports } from '../../../src/index.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import { WeaponId } from '../../../src/inventory/playerInventory.js';
import { AmmoType } from '../../../src/inventory/ammo.js';

// Frames from frames.ts (via hyperblaster.ts logic)
const FRAME_HYPERBLASTER_ACTIVATE_LAST = 5;
const FRAME_HYPERBLASTER_FIRE_FRAME = 6;
const FRAME_HYPERBLASTER_FIRE_LAST = 9;
const FRAME_HYPERBLASTER_IDLE_LAST = 28;

describe('HyperBlaster Animation Logic', () => {
    let mockSys: EntitySystem;
    let mockGame: GameExports;
    let mockPlayer: Entity;

    beforeEach(() => {
        mockSys = {
            timeSeconds: 10.0,
            sound: vi.fn(),
            spawn: vi.fn().mockReturnValue({
                classname: '',
                movetype: 0,
                origin: { x: 0, y: 0, z: 0 },
                angles: { x: 0, y: 0, z: 0 },
                velocity: { x: 0, y: 0, z: 0 },
                mins: { x: 0, y: 0, z: 0 },
                maxs: { x: 0, y: 0, z: 0 },
                owner: null,
            }),
            linkentity: vi.fn(),
            finalizeSpawn: vi.fn(),
            modelIndex: vi.fn().mockReturnValue(1),
            scheduleThink: vi.fn(),
            soundIndex: vi.fn().mockReturnValue(1),
        } as unknown as EntitySystem;

        mockGame = {
            time: 10.0,
            trace: vi.fn(),
            multicast: vi.fn(),
            sound: vi.fn(),
            random: {
                crandom: () => 0.5,
                frandom: () => 0.5,
                irandom: () => 10,
            },
            entities: mockSys,
        } as unknown as GameExports;

        (mockSys as any).game = mockGame;

        mockPlayer = {
            client: {
                weaponstate: WeaponStateEnum.WEAPON_READY,
                gun_frame: FRAME_HYPERBLASTER_IDLE_LAST,
                weapon_think_time: 0,
                buttons: 0,
                inventory: {
                    ammo: {
                        counts: {
                            [AmmoType.Cells]: 50,
                        },
                    },
                    powerups: new Map(),
                    weaponStates: {
                        [WeaponId.HyperBlaster]: { lastFireTime: 0 }
                    }
                },
                angles: { x: 0, y: 0, z: 0 },
            },
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            index: 1,
        } as unknown as Entity;
    });

    it('should fire repeatedly', () => {
        // Setup state to fire
        mockPlayer.client!.buttons = 1; // BUTTON_ATTACK
        mockPlayer.client!.weaponstate = WeaponStateEnum.WEAPON_READY;
        mockPlayer.client!.gun_frame = FRAME_HYPERBLASTER_IDLE_LAST;

        // 1. Ready -> Firing (Start)
        // Weapon_Repeating delegates to Weapon_Generic for activation.
        // It detects READY + Attack -> FIRING.
        hyperBlasterThink(mockPlayer, mockSys);

        expect(mockPlayer.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        // Weapon_Generic sets frame to ACTIVATE_LAST + 1 = 5 + 1 = 6.
        expect(mockPlayer.client!.gun_frame).toBe(FRAME_HYPERBLASTER_ACTIVATE_LAST + 1); // 6

        // Mock trace
        (mockGame.trace as any).mockReturnValue({ fraction: 1.0, endpos: { x: 100, y: 0, z: 0 } });

        // 2. Firing Frame 6 (First shot)
        // Weapon_Repeating logic:
        // if (weaponstate == WEAPON_FIRING) {
        //    if (gun_frame == FIRE_LAST || gun_frame == IDLE_LAST) gun_frame = FIRE_FRAME;
        //    else gun_frame++;
        //    if (gun_frame == FIRE_FRAME) fire();
        // }
        // BUT wait. Weapon_Generic transitions state but does NOT call fire immediately if it just transitioned (it returns).
        // So next frame, we call Weapon_Repeating again.
        // weaponstate IS WEAPON_FIRING.
        // gun_frame IS 6.

        // Wait, Weapon_Generic sets frame to 6.
        // Next frame, Weapon_Repeating runs.
        // gun_frame is 6.
        // It is NOT FIRE_LAST (9) or IDLE_LAST (28).
        // So it increments to 7?
        // "else gun_frame++;"

        // So gun_frame becomes 7.
        // "if (gun_frame == FIRE_FRAME && fire)"
        // FIRE_FRAME is 6.
        // So if it increments to 7, it does NOT fire?

        // Let's re-read Weapon_Repeating logic in animation.ts:
        /*
        if (client.gun_frame === FRAME_FIRE_LAST || client.gun_frame === FRAME_IDLE_LAST) {
            client.gun_frame = FRAME_FIRE_FRAME;
        } else {
            client.gun_frame++;
        }

        if (client.gun_frame === FRAME_FIRE_FRAME && fire) {
            fire(ent);
        }
        */

        // If we enter with 6.
        // Increments to 7.
        // Does not fire.

        // If we enter with 5 (Activate last).
        // Weapon_Generic transitions to Firing and sets 6. Returns.
        // Next frame, we have 6.
        // Logic increments to 7. No fire.

        // This seems wrong for "Instant fire".
        // In C:
        // Weapon_Generic handles start of firing?
        // No, Weapon_Repeating calls Weapon_Generic if NOT Firing.
        // Weapon_Generic sets gunframe to ACTIVATE_LAST + 1 (which is FIRE_FRAME).
        // And returns.

        // So frame 6 is "displayed".
        // Next think (0.1s later).
        // We are in FIRING. Frame is 6.
        // We increment to 7.
        // We check if frame == 6. It is 7. No fire.

        // So it skips the first fire frame?
        // Unless Weapon_Generic calls fire? No, Weapon_Repeating passes `fire` to Weapon_Generic as well.
        // Weapon_Generic calls `fire` if `gun_frame` matches `fire_frames`.
        // But Weapon_Repeating passes `null` for fire_frames to Weapon_Generic!

        /*
        Weapon_Generic(
            ent,
            FRAME_FIRE_FRAME - 1,
            FRAME_FIRE_LAST,
            FRAME_IDLE_LAST,
            FRAME_PAUSE,
            null, // pause_frames
            null, // fire_frames <--- NULL!
            fire,
            sys
        );
        */

       // So Weapon_Generic does NOT fire on the transition frame.

       // So Hyperblaster has a delay?
       // Let's look at C source.
       // Weapon_HyperBlaster calls Weapon_Repeating.

       // Weapon_Repeating:
       // if (ent->client->weaponstate == WEAPON_FIRING) { ... }
       // else Weapon_Generic(..., Weapon_HyperBlaster_Fire);

       // Weapon_Generic:
       // if (buttons & 1) {
       //    ent->client->weaponstate = WEAPON_FIRING;
       //    ent->client->ps.gunframe = ACTIVATE_LAST + 1;
       //    return;
       // }

       // So it sets frame 6 and returns.
       // Frame 6 is rendered.

       // Next frame: Weapon_Repeating is called.
       // state == FIRING.
       // gunframe == 6.
       // if (gunframe == 9) ... else gunframe++.
       // gunframe becomes 7.
       // if (gunframe == 6) fire();

       // So it fires on frame 6 ONLY if it was reset to 6 from 9?
       // Or if we entered with 5?
       // If we entered with 5, increments to 6. Fires.

       // But Weapon_Generic sets it to 6!
       // So we enter with 6.

       // Means Hyperblaster fires on the 2nd frame of firing animation?
       // 6 -> 7 (no fire) -> 8 (no fire) -> 9 (no fire) -> 6 (FIRE!)
       // This implies a wind-up?
       // Or maybe ACTIVATE_LAST is 5.
       // 5->6 (Generic transition).
       // 6->7 (Repeating logic).

       // If Hyperblaster is supposed to fire fast (10Hz), this loop is 4 frames (6,7,8,9).
       // So 400ms cycle? That's too slow.
       // Hyperblaster fires very fast.

       // Wait, Hyperblaster usually runs at higher think rate?
       // No, standard is 10Hz.
       // But maybe Hyperblaster logic in C is different.

       // C source:
       /*
       if ((ent->client->ps.gunframe == 9) || (ent->client->ps.gunframe == 28))
           ent->client->ps.gunframe = 6;
       else
           ent->client->ps.gunframe++;

       if (ent->client->ps.gunframe == 6)
           weapon_hyperblaster_fire (ent);
       */

       // So it fires ONLY on frame 6.
       // Cycle: 6 (fire) -> 7 -> 8 -> 9 -> 6 (fire).
       // So it fires every 4th frame (400ms)?
       // But Hyperblaster fires much faster.

       // Ah, `Weapon_AnimationTime`?
       // No.

       // Is it possible `Weapon_Repeating` is called multiple times?
       // No.

       // Maybe `runFrame` calls think multiple times? No.

       // Wait, Hyperblaster firing logic might fire multiple shots?
       // `fireHyperBlaster` fires one bolt.

       // Wait. Hyperblaster in Quake 2 fires continuously.
       // Maybe I am misreading C code or frames.

       // 6, 7, 8, 9.
       // If it only fires on 6, it's 2.5 shots/sec.
       // Hyperblaster is definitely faster.

       // Maybe `Weapon_Repeating` logic I copied is wrong or incomplete?
       // Or maybe `Weapon_Generic` in C behaves differently?

       // Or maybe HyperBlaster fires on ALL frames 6-9?
       // No, "if (ent->client->ps.gunframe == 6) weapon_hyperblaster_fire (ent);"

       // Wait, `fireHyperBlaster` in standard Q2 might not be the only place?
       // Or maybe `weapon_hyperblaster_fire` is called elsewhere?

       // Let's check `g_weapon.c` / `p_weapon.c`.
       // `Weapon_HyperBlaster` calls `Weapon_Repeating`.

       // Is it possible that `gunframe` doesn't increment every frame?
       // No, `else ent->client->ps.gunframe++;`

       // Maybe the frames are NOT 0.1s?
       // `ent->client->weapon_think_time` controls it.
       // `Weapon_Generic` sets it to `level.time + 0.1`.
       // `Weapon_Repeating` doesn't set think time?
       // It just updates `gun_frame`.
       // But `P_WorldEffects` or `ClientThink` calls `Weapon_Think` only if `weapon_think_time` passed?

       // If `Weapon_Repeating` is called every frame (because it's the think function),
       // it needs to set `nextthink`.
       // `Weapon_Generic` sets `weapon_think_time` which controls when it runs next.
       // `Weapon_Repeating` in my TS implementation:
       /*
        if (client.weaponstate === WeaponStateEnum.WEAPON_FIRING) {
            // ... updates gun_frame ...
            if (fire) fire(ent);
        } else {
             Weapon_Generic(...);
        }
       */

       // `Weapon_Repeating` implementation in `animation.ts` DOES NOT set `weapon_think_time`!
       // This means it runs EVERY SERVER FRAME (if `rocketLauncherThink` is called every frame).
       // `player_think` calls `Weapon_Think`.
       // `Weapon_Think` calls `ent->client->weapon_think`.

       // `Weapon_Think`:
       /*
       if (ent->client->weapon_think_time > level.time)
           return;
       */

       // If `Weapon_Repeating` does not update `weapon_think_time`, it remains at old value (past).
       // So `Weapon_Think` calls it EVERY FRAME (100ms).

       // Wait, if it runs every 100ms, then it's still 10Hz.

       // Is it possible Hyperblaster logic loops multiple times inside one think?
       // No.

       // I suspect Hyperblaster fires on EVERY frame 6-9 in original?
       // Let me check source again.
       // `p_weapon.cpp`:
       /*
       void Weapon_HyperBlaster (edict_t *ent)
       {
           Weapon_Repeating (ent, 6, 9, 28, 32, weapon_hyperblaster_fire);
       }
       */

       // `Weapon_Repeating` source:
       /*
       void Weapon_Repeating (edict_t *ent, int fire_frame, int fire_last, int idle_last, int pause_frame, void (*fire)(edict_t *ent))
       {
           if (ent->client->weaponstate == WEAPON_FIRING)
           {
               if ((ent->client->ps.gunframe == fire_last) || (ent->client->ps.gunframe == idle_last))
                   ent->client->ps.gunframe = fire_frame;
               else
                   ent->client->ps.gunframe++;

               if (ent->client->ps.gunframe == fire_frame)
                   fire (ent);

               ent->client->weapon_think_time = level.time + 0.1; // <--- IT SETS TIME!
               // ...
           }
           else
               Weapon_Generic (ent, fire_frame-1, fire_last, idle_last, pause_frame, NULL, NULL, fire);
       }
       */

       // Okay, so it IS 10Hz.
       // So Hyperblaster fires 2.5 shots/sec?
       // That seems awfully slow for a "Hyperblaster".
       // The machinegun is 10Hz (fires every frame).
       // Chaingun spins up and fires multiple shots per frame.

       // Hyperblaster:
       // Damage 15.
       // 2.5 * 15 = 37.5 DPS? That's garbage.
       // Machinegun is 8 damage * 10 = 80 DPS.

       // There must be something wrong with my understanding of Hyperblaster frames or logic.
       // Maybe `Weapon_Repeating` logic I see online is different from Rerelease?

       // In Rerelease `p_weapon.cpp`:
       // Maybe `fire_frame` logic is `if (ent->client->ps.gunframe >= fire_frame && ent->client->ps.gunframe <= fire_last)`?

       // I need to check `animation.ts` implementation of `Weapon_Repeating`.
       // It mimics the C code I saw: `if (gun_frame === FRAME_FIRE_FRAME) fire()`.

       // If this is true, Hyperblaster is broken in my port (and potentially in original if I read it right, which I doubt).

       // WAIT.
       // `Weapon_Repeating` signature in `animation.ts`:
       /*
        export function Weapon_Repeating(
            ent: Entity,
            FRAME_FIRE_FRAME: number, // 6
            FRAME_FIRE_LAST: number,  // 9
            ...
        )
       */

       // If I change it to fire on ANY frame in the loop?
       // `if (gun_frame >= FIRE_FRAME && gun_frame <= FIRE_LAST) fire()`?

       // Let's verify Rerelease source if possible. I have `rerelease/` directory in repo?
       // User said "The original source is in /full and /rerelease".
       // I can READ IT!

       // I will read `rerelease/p_weapon.cpp` (or `g_weapon.c` where it is).
       // And `rerelease/p_client.c`?
       // I'll search for `Weapon_Repeating`.

       // I'll start by listing files in `rerelease`.

    });
});
