import { describe, it, expect } from 'vitest';
import { Entity } from '../../src/entities/entity.js';
import { createGame, GameExports } from '../../src/index.js';
import { GameImports } from '../../src/imports.js';
import { WeaponId } from '../../src/inventory/playerInventory.js';
import { fire } from '../../src/combat/weapons/firing.js';
import { SP_monster_soldier } from '../../src/entities/monsters/soldier.js';

describe('BFG Integration Test', () => {
    it('should damage multiple targets with in-flight and explosion lasers', () => {
        let monster1: Entity, monster2: Entity;

        const imports = {
            linkentity: (ent: Entity) => {
                ent.absmin = { x: ent.origin.x + ent.mins.x, y: ent.origin.y + ent.mins.y, z: ent.origin.z + ent.mins.z };
                ent.absmax = { x: ent.origin.x + ent.maxs.x, y: ent.origin.y + ent.maxs.y, z: ent.origin.z + ent.maxs.z };
            },
            multicast: () => {},
            unicast: () => {},
            sound: () => {},
            trace: (start: any, mins: any, maxs: any, end: any, ignore: any) => {
                if (end && end.x === 100 && end.y === 0 && end.z === 0) {
                    return { fraction: 0.9, allsolid: false, startsolid: false, endpos: end, plane: null, ent: monster1 };
                }
                if (end && end.x === 150 && end.y === 50 && end.z === 0) {
                    return { fraction: 0.9, allsolid: false, startsolid: false, endpos: end, plane: null, ent: monster2 };
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
        player.mins = { x: -16, y: -16, z: -24 };
        player.maxs = { x: 16, y: 16, z: 32 };
        player.viewheight = 22;
        player.client = {
            inventory: {
                ammo: { counts: [0, 0, 100, 0, 0] },
                items: new Set(),
            },
            weaponStates: { states: new Map() },
        } as any;
        sys.finalizeSpawn(player);

        monster1 = sys.spawn();
        monster1.origin = { x: 100, y: 0, z: 0 };
        SP_monster_soldier(monster1, sys as any);
        sys.finalizeSpawn(monster1);
        const initialHealth1 = monster1.health;

        monster2 = sys.spawn();
        monster2.origin = { x: 150, y: 50, z: 0 };
        SP_monster_soldier(monster2, sys as any);
        sys.finalizeSpawn(monster2);
        const initialHealth2 = monster2.health;

        const bfgBall = fire(game, player, WeaponId.BFG10K);

        // Simulate BFG ball flight
        if (bfgBall) {
            for (let i = 0; i < 5; i++) {
                bfgBall.think(bfgBall);
            }
        }

        // Check if monsters took damage from in-flight lasers
        expect(monster1.health).toBeLessThan(initialHealth1);
        expect(monster2.health).toBeLessThan(initialHealth2);

        // Simulate BFG ball explosion
        if (bfgBall) {
            bfgBall.touch(bfgBall, monster1);
        }

        // Simulate explosion lasers
        for (let i = 0; i < 5; i++) {
            sys.runFrame(0.1);
        }
    });
});
