
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { blasterThink } from '../../../src/combat/weapons/blaster.js';
import { Entity } from '../../../src/entities/entity.js';
import { GameExports } from '../../../src/index.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import { WeaponId } from '../../../src/inventory/playerInventory.js';
import { AmmoType } from '../../../src/inventory/ammo.js';

// Blaster frames (from blaster.ts)
const BLASTER_ACTIVATE_LAST = 4;
const BLASTER_FIRE_LAST = 8;
const BLASTER_IDLE_LAST = 52;

describe('Blaster Animation Logic', () => {
    let mockSys: EntitySystem;
    let mockGame: GameExports;
    let mockPlayer: Entity;

    beforeEach(() => {
        // Mock EntitySystem
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
                irandom: () => 10,
            },
            entities: mockSys,
        } as unknown as GameExports;

        (mockSys as any).game = mockGame;

        mockPlayer = {
            client: {
                weaponstate: WeaponStateEnum.WEAPON_READY,
                gun_frame: BLASTER_IDLE_LAST,
                weapon_think_time: 0,
                buttons: 0,
                inventory: {
                    ammo: {
                        counts: {
                            // Blaster has infinite ammo usually but internally checks logic?
                            // fireBlaster doesn't check ammo.
                        },
                    },
                    powerups: new Map(),
                    weaponStates: {
                        [WeaponId.Blaster]: { lastFireTime: 0 }
                    }
                },
                angles: { x: 0, y: 0, z: 0 },
            },
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            index: 1,
        } as unknown as Entity;
    });

    it('should fire on frame 5', () => {
        // Setup state to fire
        mockPlayer.client!.buttons = 1; // BUTTON_ATTACK
        mockPlayer.client!.weaponstate = WeaponStateEnum.WEAPON_READY;
        mockPlayer.client!.gun_frame = BLASTER_IDLE_LAST;

        // 1. Ready -> Firing (Start)
        blasterThink(mockPlayer, mockSys);
        expect(mockPlayer.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        // BLASTER_ACTIVATE_LAST is 4. So start frame is 4+1 = 5.
        expect(mockPlayer.client!.gun_frame).toBe(BLASTER_ACTIVATE_LAST + 1); // 5

        // Mock trace
        (mockGame.trace as any).mockReturnValue({ fraction: 1.0, endpos: { x: 100, y: 0, z: 0 } });

        // 2. Firing Frame 5
        mockSys.timeSeconds += 0.1;

        // fire_frames is [5]. So frame 5 should fire IMMEDIATELY upon entering Firing state?
        // Wait.
        // In previous step (Ready->Firing):
        // client.weaponstate = WEAPON_FIRING;
        // client.gun_frame = ACTIVATE_LAST + 1; (5)
        // It RETURNS. So fire() is NOT called in that tick.

        // Next tick:
        // gun_frame is 5.
        // It matches fire_frames [5].
        // It calls fire().

        blasterThink(mockPlayer, mockSys);

        expect(mockGame.multicast).toHaveBeenCalled(); // Muzzle flash
        // Check projectile spawn
        expect(mockSys.spawn).toHaveBeenCalled();

        // gun_frame should increment to 6
        expect(mockPlayer.client!.gun_frame).toBe(6);
    });

    it('should transition to idle after firing', () => {
        mockPlayer.client!.buttons = 0; // Release button
        mockPlayer.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;

        // Fast forward to end of fire animation
        mockPlayer.client!.gun_frame = BLASTER_FIRE_LAST; // 8
        mockSys.timeSeconds = 11.0;

        blasterThink(mockPlayer, mockSys);

        // Should transition to READY and start idle sequence
        expect(mockPlayer.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);
        // Should start at FRAME_FIRE_LAST + 1 = 9
        expect(mockPlayer.client!.gun_frame).toBe(BLASTER_FIRE_LAST + 1);
    });
});
