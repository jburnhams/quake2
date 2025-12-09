import { describe, it, expect, vi, beforeEach } from 'vitest';
import { throwGibs, spawnGib, spawnHead, GIB_ORGANIC } from '../../src/entities/gibs.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { EntityEffects, MoveType, Solid } from '../../src/entities/enums.js'; // Assuming enums has MoveType/Solid or we mock/check values
import { createTestContext } from '../test-helpers.js';

describe('Gibs', () => {
    let context: any;
    let sys: any;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createTestContext();
        sys = context.entities;
    });

    describe('spawnGib', () => {
        it('should set basic properties correctly', () => {
            const gib = spawnGib(sys, { x: 0, y: 0, z: 0 }, 10, undefined, GIB_ORGANIC);
            expect(gib.classname).toBe('gib');
            expect(gib.solid).toBeDefined(); // Should be Solid.Not
            expect(gib.takedamage).toBe(true);
            expect(gib.movetype).toBeDefined();
        });

        it('should set EntityEffects.Gib for organic gibs', () => {
            const gib = spawnGib(sys, { x: 0, y: 0, z: 0 }, 10, undefined, GIB_ORGANIC);
            expect(gib.effects).toBeDefined();
            // Check if EntityEffects.Gib bit is set
            expect((gib.effects || 0) & EntityEffects.Gib).toBe(EntityEffects.Gib);
        });

        it('should NOT set EntityEffects.Gib for burning gibs (LAVA)', () => {
            const gib = spawnGib(sys, { x: 0, y: 0, z: 0 }, 10, undefined, GIB_ORGANIC, DamageMod.LAVA);
            expect((gib.effects || 0) & EntityEffects.Gib).toBe(0);
        });

        it('should NOT set EntityEffects.Gib for burning gibs (TRAP)', () => {
            const gib = spawnGib(sys, { x: 0, y: 0, z: 0 }, 10, undefined, GIB_ORGANIC, DamageMod.TRAP);
            expect((gib.effects || 0) & EntityEffects.Gib).toBe(0);
        });
    });

    describe('spawnHead', () => {
        it('should set basic properties correctly', () => {
            // Mock irandom to control skin choice
            sys.rng.irandom.mockReturnValue(0);
            const head = spawnHead(sys, { x: 0, y: 0, z: 0 }, 10);
            expect(head.solid).toBeDefined(); // Solid.Not
            expect(head.takedamage).toBe(true);
            expect(head.movetype).toBeDefined();
        });

        it('should set EntityEffects.Gib by default', () => {
            const head = spawnHead(sys, { x: 0, y: 0, z: 0 }, 10);
            expect((head.effects || 0) & EntityEffects.Gib).toBe(EntityEffects.Gib);
        });

        it('should NOT set EntityEffects.Gib when burning (LAVA)', () => {
            const head = spawnHead(sys, { x: 0, y: 0, z: 0 }, 10, DamageMod.LAVA);
            expect((head.effects || 0) & EntityEffects.Gib).toBe(0);
        });
    });

    describe('throwGibs', () => {
        it('should pass DamageMod to spawnGib', () => {
            // Capture spawned entities
            const spawned: any[] = [];
            const originalSpawn = sys.spawn;
            sys.spawn = () => {
                const ent = originalSpawn();
                spawned.push(ent);
                return ent;
            };

            throwGibs(sys, { x: 0, y: 0, z: 0 }, 10, GIB_ORGANIC, DamageMod.LAVA);

            expect(spawned.length).toBeGreaterThan(0);

            const organicGibs = spawned.filter(e => e.classname === 'gib');
            expect(organicGibs.length).toBeGreaterThan(0);

            for (const gib of organicGibs) {
                expect((gib.effects || 0) & EntityEffects.Gib).toBe(0);
            }
        });

        it('should pass DamageMod to spawnHead logic (implicitly verified via spawned entities)', () => {
             // Capture spawned entities
             const spawned: any[] = [];
             const originalSpawn = sys.spawn;
             sys.spawn = () => {
                 const ent = originalSpawn();
                 // Hack to identify head: head logic doesn't set classname explicitly in spawnHead?
                 // Let's check logic in gibs.ts: spawnHead does NOT set classname!
                 // But it sets model.
                 spawned.push(ent);
                 return ent;
             };

             throwGibs(sys, { x: 0, y: 0, z: 0 }, 10, GIB_ORGANIC, DamageMod.LAVA);

             // The head logic in spawnHead sets model but not classname 'gib'.
             // So we look for the one without 'gib' classname or by checking model name if mocked.
             // But sys.modelIndex mocks return 0.

             // Assuming the last one spawned is the head (throwGibs logic: gibs then head)
             // Or we just check ALL spawned entities for lack of EF_GIB
             for (const ent of spawned) {
                 expect((ent.effects || 0) & EntityEffects.Gib).toBe(0);
             }
        });
    });
});
