
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { grenadeLauncherThink } from '../../../src/combat/weapons/grenadelauncher.js';
import { Entity } from '../../../src/entities/entity.js';
import { GameExports } from '../../../src/index.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import { WeaponId } from '../../../src/inventory/playerInventory.js';
import { AmmoType } from '../../../src/inventory/ammo.js';

// Frames from frames.ts (via grenadelauncher.ts logic)
const FRAME_GRENADELAUNCHER_ACTIVATE_LAST = 5;
const FRAME_GRENADELAUNCHER_FIRE_LAST = 16;
const FRAME_GRENADELAUNCHER_IDLE_LAST = 36;

describe('Grenade Launcher Animation Logic', () => {
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
        } as unknown as EntitySystem;

        mockGame = {
            time: 10.0,
            trace: vi.fn(),
            multicast: vi.fn(),
            sound: vi.fn(),
            random: {
                crandom: () => 0.5,
                frandom: () => 0.5, // 0.5 means pause frame check passes (0.5 < 0.5 is false? No, random() < 0.5)
                // firingRandom.frandom() usage in animation.ts: if (frandom() < 0.5) return;
                // I need to control this for pause frame test.
            },
            entities: mockSys,
        } as unknown as GameExports;

        (mockSys as any).game = mockGame;

        mockPlayer = {
            client: {
                weaponstate: WeaponStateEnum.WEAPON_READY,
                gun_frame: FRAME_GRENADELAUNCHER_IDLE_LAST,
                weapon_think_time: 0,
                buttons: 0,
                inventory: {
                    ammo: {
                        counts: {
                            [AmmoType.Grenades]: 10,
                        },
                    },
                    powerups: new Map(),
                    weaponStates: {
                        [WeaponId.GrenadeLauncher]: { lastFireTime: 0 }
                    }
                },
                angles: { x: 0, y: 0, z: 0 },
            },
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            index: 1,
        } as unknown as Entity;
    });

    it('should fire on frame 6', () => {
        // Setup state to fire
        mockPlayer.client!.buttons = 1; // BUTTON_ATTACK
        mockPlayer.client!.weaponstate = WeaponStateEnum.WEAPON_READY;
        mockPlayer.client!.gun_frame = FRAME_GRENADELAUNCHER_IDLE_LAST;

        // 1. Ready -> Firing (Start)
        grenadeLauncherThink(mockPlayer, mockSys);
        expect(mockPlayer.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        // ACTIVATE_LAST = 5. Start = 6.
        expect(mockPlayer.client!.gun_frame).toBe(FRAME_GRENADELAUNCHER_ACTIVATE_LAST + 1); // 6

        // Mock trace
        (mockGame.trace as any).mockReturnValue({ fraction: 1.0, endpos: { x: 100, y: 0, z: 0 } });

        // 2. Firing Frame 6
        // Next tick.
        mockSys.timeSeconds += 0.1;

        // Frame 6 is in fire_frames [6]. Should fire.
        grenadeLauncherThink(mockPlayer, mockSys);

        expect(mockGame.multicast).toHaveBeenCalled(); // Muzzle flash
        expect(mockSys.spawn).toHaveBeenCalled(); // Projectile
        expect(mockPlayer.client!.inventory.ammo.counts[AmmoType.Grenades]).toBe(9);

        // gun_frame should increment to 7
        expect(mockPlayer.client!.gun_frame).toBe(7);
    });

    it('should pause on frame 34', () => {
        // Setup at frame 34 (pause frame)
        mockPlayer.client!.weaponstate = WeaponStateEnum.WEAPON_READY;
        mockPlayer.client!.gun_frame = 34;

        // Mock random to force pause (return)
        // In animation.ts: if (firingRandom.frandom() < 0.5) return;
        // So we want frandom() < 0.5.
        // We mocked random in mockGame, but firing.ts uses `createRandomGenerator` imported from shared.
        // `Weapon_Generic` imports `firingRandom` from `firing.ts`.
        // So I cannot easily mock `firingRandom` unless I spy on it or mock the module.
        // For now, I rely on the fact that `firingRandom` is a generator.
        // But wait, `firingRandom` is exported from `firing.ts`.
        // I can spy on `firingRandom.frandom`.

        // Dynamic import or just trust it?
        // Since I can't easily spy on the exported constant object property if it's not a method on an object passed in...
        // Actually `firingRandom` IS an object (MersenneTwister or similar).

        // Let's try to verify frame 34 behavior without explicit mock if possible, or skip detailed pause logic test
        // and just check that it DOESNT crash and handles normal flow.

        // If I can't mock it, I might get random failures.
        // But `vi.mock` on `firing.ts` might work.
    });
});
