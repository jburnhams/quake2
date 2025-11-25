import { describe, it, expect, vi } from 'vitest';
import { Entity } from '../../src/entities/entity.js';
import { createGame, GameExports } from '../../src/index.js';
import { GameImports } from '../../src/imports.js';
import { WeaponId } from '../../src/inventory/playerInventory.js';
import { fire } from '../../src/combat/weapons/firing.js';
import { SP_monster_soldier } from '../../src/entities/monsters/soldier.js';
import { T_Damage, T_RadiusDamage } from '../../src/combat/damage.js';

vi.mock('../../src/combat/damage.js', () => ({
    T_Damage: vi.fn((target: Entity, inflictor: Entity, attacker: Entity, dir: any, point: any, normal: any, damage: number) => {
        target.health -= damage;
    }),
    T_RadiusDamage: vi.fn((entities: Entity[], inflictor: Entity, attacker: Entity, damage: number) => {
        for (const entity of entities) {
            entity.health -= damage;
        }
    }),
}));

describe('BFG Integration Test', () => {
    it('should damage multiple targets with in-flight and explosion lasers', () => {
        let monster1: Entity, monster2: Entity;

        const imports = {
            linkentity: () => {},
            multicast: () => {},
            unicast: () => {},
            sound: () => {},
            trace: (start: any, mins: any, maxs: any, end: any, ignore: any) => {
                if (ignore !== monster1 && end.x > 100) {
                    return { fraction: 0.5, allsolid: false, startsolid: false, endpos: monster1.origin, plane: null, ent: monster1 };
                }
                if (ignore === monster1 && end.x > 100) {
                    return { fraction: 0.7, allsolid: false, startsolid: false, endpos: monster2.origin, plane: null, ent: monster2 };
                }
                return { fraction: 1.0, allsolid: false, startsolid: false, endpos: end, plane: null, ent: null };
            },
            pointcontents: () => 0,
            modelIndex: () => 0,
        } as unknown as GameImports;

        const game = createGame(imports, {} as any, { gravity: 800 });
        const sys = game.entities;

        const player = sys.spawn();
        player.origin = { x: 0, y: 0, z: 0 };
        player.angles = { x: 0, y: 0, z: 0 };
        player.viewheight = 0;
        player.client = {
            inventory: { ammo: { counts: [0, 0, 100, 0, 0] } },
            weaponStates: { states: new Map() },
        } as any;
        sys.finalizeSpawn(player);

        monster1 = sys.spawn();
        monster1.origin = { x: 100, y: 0, z: 0 };
        SP_monster_soldier(monster1, sys as any);
        sys.finalizeSpawn(monster1);
        const initialHealth1 = monster1.health;

        monster2 = sys.spawn();
        monster2.origin = { x: 200, y: 0, z: 0 };
        SP_monster_soldier(monster2, sys as any);
        sys.finalizeSpawn(monster2);
        const initialHealth2 = monster2.health;

        const bfgBall = fire(game, player, WeaponId.BFG10K);

        // Simulate BFG ball flight
        if (bfgBall) {
            sys.runFrame(0.1);
            sys.runFrame(0.1);
        }

        // Check if monsters took damage from in-flight lasers
        expect(monster1.health).toBeLessThan(initialHealth1);
        expect(monster2.health).toBeLessThan(initialHealth2);

        // Simulate BFG ball explosion
        if (bfgBall) {
            bfgBall.touch(bfgBall, sys.world, null, null);
            sys.runFrame(0.1);
        }

        // Check if T_RadiusDamage was called
        expect(T_RadiusDamage).toHaveBeenCalled();
    });
});
