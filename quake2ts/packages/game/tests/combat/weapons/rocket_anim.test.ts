
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rocketLauncherThink } from '../../../src/combat/weapons/rocket.js';
import { Entity } from '../../../src/entities/entity.js';
import { GameExports } from '../../../src/index.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import {
    FRAME_ROCKET_ACTIVATE_LAST,
    FRAME_ROCKET_FIRE_LAST,
    FRAME_ROCKET_IDLE_LAST,
    FRAME_ROCKET_DEACTIVATE_LAST
} from '../../../src/combat/weapons/frames.js';
import { WeaponId } from '../../../src/inventory/playerInventory.js';
import { AmmoType } from '../../../src/inventory/ammo.js';

describe('Rocket Launcher Animation Logic', () => {
    let mockSys: EntitySystem;
    let mockGame: GameExports;
    let mockPlayer: Entity;

    beforeEach(() => {
        // Mock EntitySystem with spawn method
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
        } as unknown as EntitySystem;

        mockGame = {
            time: 10.0,
            trace: vi.fn(),
            multicast: vi.fn(),
            sound: vi.fn(),
            random: {
                crandom: () => 0.5,
                frandom: () => 0.5,
                irandom: () => 110,
            },
            entities: mockSys, // Link entities to mockSys
        } as unknown as GameExports;

        // Link game back to sys if needed (though rocketLauncherThink uses sys)
        (mockSys as any).game = mockGame;

        mockPlayer = {
            client: {
                weaponstate: WeaponStateEnum.WEAPON_READY,
                gun_frame: FRAME_ROCKET_IDLE_LAST,
                weapon_think_time: 0,
                buttons: 0,
                inventory: {
                    ammo: {
                        counts: {
                            [AmmoType.Rockets]: 10,
                        },
                    },
                    powerups: new Map(),
                    weaponStates: {
                        [WeaponId.RocketLauncher]: { lastFireTime: 0 }
                    }
                },
                angles: { x: 0, y: 0, z: 0 },
            },
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            index: 1,
        } as unknown as Entity;
    });

    it('should fire on frame 4', () => {
        // Setup state to fire
        mockPlayer.client!.buttons = 1; // BUTTON_ATTACK
        mockPlayer.client!.weaponstate = WeaponStateEnum.WEAPON_READY;
        mockPlayer.client!.gun_frame = FRAME_ROCKET_IDLE_LAST;

        // 1. Ready -> Firing (Start)
        rocketLauncherThink(mockPlayer, mockSys);
        expect(mockPlayer.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        // FRAME_ROCKET_ACTIVATE_LAST is 3. So start frame is 3+1 = 4.
        expect(mockPlayer.client!.gun_frame).toBe(FRAME_ROCKET_ACTIVATE_LAST + 1); // 4

        // Mock trace to avoid error in fireRocket (though rocket doesn't trace usually, P_ProjectSource might?)
        // P_ProjectSource uses trace to prevent wall clipping.
        (mockGame.trace as any).mockReturnValue({ fraction: 1.0, endpos: { x: 100, y: 0, z: 0 } });

        // 2. Firing Frame 4
        mockSys.timeSeconds += 0.1;
        rocketLauncherThink(mockPlayer, mockSys);

        // Frame 4 is in fire_frames [4]. Should fire.
        expect(mockGame.multicast).toHaveBeenCalled(); // Muzzle flash
        expect(mockPlayer.client!.inventory.ammo.counts[AmmoType.Rockets]).toBe(9);
        expect(mockSys.spawn).toHaveBeenCalled(); // Projectile spawned

        // gun_frame should increment to 5
        expect(mockPlayer.client!.gun_frame).toBe(5);
    });

    it('should transition to idle after firing', () => {
        mockPlayer.client!.buttons = 0; // Release button
        mockPlayer.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;

        // Fast forward to end of fire animation
        mockPlayer.client!.gun_frame = FRAME_ROCKET_FIRE_LAST; // 12
        mockSys.timeSeconds = 11.0;

        rocketLauncherThink(mockPlayer, mockSys);

        // Should transition to READY and start idle sequence
        expect(mockPlayer.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);
        // Should start at FRAME_FIRE_LAST + 1 = 13
        expect(mockPlayer.client!.gun_frame).toBe(FRAME_ROCKET_FIRE_LAST + 1);
    });
});
