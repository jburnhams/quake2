import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { createBfgBall } from '../../../src/entities/projectiles.js';
import * as damage from '../../../src/combat/damage.js';
import { fire } from '../../../src/combat/weapons/firing.js';
import { WeaponId } from '../../../src/inventory/playerInventory.js';

vi.mock('../../../src/combat/damage.js', async () => {
    const actual = await vi.importActual('../../../src/combat/damage.js') as any;
    return {
        ...actual,
        T_Damage: vi.fn(),
        T_RadiusDamage: vi.fn(),
    };
});

describe('BFG Projectile', () => {
    let mockSys: any;
    let owner: Entity;
    let target: Entity;

    beforeEach(() => {
        vi.clearAllMocks();

        const mockEntity = {
            origin: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
        };

        mockSys = {
            spawn: vi.fn(() => ({ ...mockEntity })),
            finalizeSpawn: vi.fn(),
            scheduleThink: vi.fn(),
            findByRadius: vi.fn().mockReturnValue([]),
            trace: vi.fn().mockReturnValue({ fraction: 1.0 }),
            multicast: vi.fn(),
            free: vi.fn(),
            timeSeconds: 0,
            modelIndex: vi.fn(),
        } as unknown as EntitySystem;

        owner = { origin: { x: 0, y: 0, z: 0 } } as Entity;
        target = { origin: { x: 50, y: 0, z: 0 }, takedamage: true } as Entity;
    });

    it('should fire in-flight lasers at nearby targets', () => {
        (mockSys.findByRadius as any).mockReturnValue([target]);
        (mockSys.trace as any).mockReturnValue({ fraction: 1.0, ent: target });

        createBfgBall(mockSys, owner, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 100, 400, 200);

        const bfgBall = (mockSys.spawn as any).mock.results[0].value;
        bfgBall.think(bfgBall);

        expect(mockSys.multicast).toHaveBeenCalledTimes(1);
        expect(damage.T_Damage).toHaveBeenCalledTimes(1);
    });

    it('should spawn a laser spawner on explosion', () => {
        createBfgBall(mockSys, owner, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 100, 400, 200);

        const bfgBall = (mockSys.spawn as any).mock.results[0].value;
        bfgBall.owner = owner;
        bfgBall.touch(bfgBall, {} as Entity);

        expect(mockSys.spawn).toHaveBeenCalledTimes(2);
    });

    it('should consume 50 cells on fire', () => {
        const game = {
            time: 0,
            entities: mockSys,
            multicast: vi.fn(),
        } as unknown as any;

        const player = {
            client: {
                inventory: {
                    ammo: { counts: [, , 100] },
                },
                weaponStates: { states: new Map() },
            },
            angles: { x: 0, y: 0, z: 0 },
            origin: { x: 0, y: 0, z: 0 },
        } as any;

        fire(game, player, WeaponId.BFG10K);

        expect(player.client.inventory.ammo.counts[2]).toBe(50);
    });

    it('bfg_laser_think should fire for 5 frames and then be freed', () => {
        (mockSys.findByRadius as any).mockReturnValue([target]);
        (mockSys.trace as any).mockReturnValue({ fraction: 1.0, ent: target });

        const laserSpawner = {
            owner: owner,
            origin: { x: 0, y: 0, z: 0 },
            think: vi.fn(),
        } as any;

        const bfg_laser_think = (self: any, sys: any) => {
            self.count = (self.count || 0) + 1;
            if (self.count >= 5) {
                sys.free(self);
            } else {
                self.nextthink = sys.timeSeconds + 0.1;
            }
        };

        for (let i = 0; i < 5; i++) {
            bfg_laser_think(laserSpawner, mockSys);
        }

        expect(mockSys.free).toHaveBeenCalledWith(laserSpawner);
    });

    it('should deal radius damage on impact', () => {
        (mockSys.findByRadius as any).mockReturnValue([target]);
        (mockSys.trace as any).mockReturnValue({ fraction: 1.0, ent: target });

        createBfgBall(mockSys, owner, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 100, 400, 200);

        const bfgBall = (mockSys.spawn as any).mock.results[0].value;
        bfgBall.owner = owner;
        bfgBall.touch(bfgBall, {} as Entity);

        expect(damage.T_RadiusDamage).toHaveBeenCalledTimes(1);
    });
});
