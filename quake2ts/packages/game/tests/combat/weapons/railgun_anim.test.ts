
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { railgunThink } from '../../../src/combat/weapons/railgun.js';
import { Entity } from '../../../src/entities/entity.js';
import { GameExports } from '../../../src/index.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import { WeaponId } from '../../../src/inventory/playerInventory.js';
import { AmmoType } from '../../../src/inventory/ammo.js';

// Frames from frames.ts (via railgun.ts logic)
const FRAME_RAILGUN_ACTIVATE_LAST = 3;
const FRAME_RAILGUN_FIRE_LAST = 18;
const FRAME_RAILGUN_IDLE_LAST = 51;

describe('Railgun Animation Logic', () => {
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
                gun_frame: FRAME_RAILGUN_IDLE_LAST,
                weapon_think_time: 0,
                buttons: 0,
                inventory: {
                    ammo: {
                        counts: {
                            [AmmoType.Slugs]: 10,
                        },
                    },
                    powerups: new Map(),
                    weaponStates: {
                        [WeaponId.Railgun]: { lastFireTime: 0 }
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
        mockPlayer.client!.gun_frame = FRAME_RAILGUN_IDLE_LAST;

        // 1. Ready -> Firing (Start)
        railgunThink(mockPlayer, mockSys);
        expect(mockPlayer.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        // ACTIVATE_LAST = 3. Start = 4.
        expect(mockPlayer.client!.gun_frame).toBe(FRAME_RAILGUN_ACTIVATE_LAST + 1); // 4

        // Mock trace
        (mockGame.trace as any).mockReturnValue({ fraction: 1.0, endpos: { x: 100, y: 0, z: 0 } });

        // 2. Firing Frame 4
        mockSys.timeSeconds += 0.1;

        // Frame 4 is in fire_frames [4]. Should fire.
        railgunThink(mockPlayer, mockSys);

        expect(mockGame.multicast).toHaveBeenCalled(); // Muzzle flash
        expect(mockPlayer.client!.inventory.ammo.counts[AmmoType.Slugs]).toBe(9);

        // gun_frame should increment to 5
        expect(mockPlayer.client!.gun_frame).toBe(5);
    });
});
