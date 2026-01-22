import { describe, it, expect, vi, beforeEach } from 'vitest';
import { throwGibs, spawnGib, spawnHead, GIB_ORGANIC, GIB_METALLIC, GIB_DEBRIS } from '../../../src/entities/gibs.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { DamageMod } from '../../../src/combat/damageMods.js';
import { EntityEffects } from '../../../src/entities/enums.js';
import { MoveType, Solid } from '../../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils';
import { ServerCommand, TempEntity } from '@quake2ts/shared';

describe('Gibbing System', () => {
    let context: ReturnType<typeof createTestContext>;
    let sys: EntitySystem;

    beforeEach(async () => {
        context = await createTestContext();
        sys = context.entities;

        // Mock RNG for deterministic tests
        sys.rng.crandom = vi.fn().mockReturnValue(0.5);
        sys.rng.frandom = vi.fn().mockReturnValue(0.5);
        sys.rng.irandom = vi.fn().mockReturnValue(0);
    });

    it('spawnGib creates a gib with correct properties', () => {
        const origin = { x: 100, y: 100, z: 100 };
        const damage = 100;

        const gib = spawnGib(sys, origin, damage, 'models/gibs/meat.md2', GIB_ORGANIC);

        expect(gib).toBeDefined();
        expect(gib.classname).toBe('gib');
        expect(gib.solid).toBe(Solid.Not);
        expect(gib.takedamage).toBe(true);
        expect(gib.movetype).toBe(MoveType.Toss);
        expect(gib.effects & EntityEffects.Gib).toBeTruthy();
        expect(gib.die).toBeDefined();

        // Verify velocity calculation (based on mocked RNG)
        expect(gib.velocity).toBeDefined();
        expect(gib.avelocity).toBeDefined();
    });

    it('throwGibs spawns multiple gibs for organic damage', () => {
        const origin = { x: 0, y: 0, z: 0 };
        const spySpawn = vi.spyOn(sys, 'spawn');

        throwGibs(sys, origin, 100, GIB_ORGANIC);

        // Expect 4 sm_meat, 1 meat, 1 bone, 1 head = 7 entities
        // Check implementation details in gibs.ts
        expect(spySpawn).toHaveBeenCalledTimes(7);
    });

    it('throwGibs spawns metallic debris for robotic monsters', () => {
        const origin = { x: 0, y: 0, z: 0 };
        const spySpawn = vi.spyOn(sys, 'spawn');

        throwGibs(sys, origin, 100, GIB_METALLIC);

        // Check implementation: 4 debris pieces expected
        expect(spySpawn).toHaveBeenCalledTimes(4);

        // Get one of the spawned entities (last one)
        const gib = spySpawn.mock.results[0].value;
        // Metallic gibs shouldn't have Gib effect (blood trail) but might have other properties
        // The implementation says: if type !== METALLIC && type !== DEBRIS -> effects |= Gib
        expect(gib.effects & EntityEffects.Gib).toBeFalsy();
    });

    it('spawnHead selects skin based on RNG', () => {
        const origin = { x: 0, y: 0, z: 0 };

        // Mock irandom to return 1 (Player head)
        sys.rng.irandom = vi.fn().mockReturnValue(1);
        const head1 = spawnHead(sys, origin, 50);
        expect(head1.skin).toBe(1);
        expect(head1.modelindex).toBe(sys.modelIndex('models/objects/gibs/head2/tris.md2'));

        // Mock irandom to return 0 (Skull)
        sys.rng.irandom = vi.fn().mockReturnValue(0);
        const head0 = spawnHead(sys, origin, 50);
        expect(head0.skin).toBe(0);
        expect(head0.modelindex).toBe(sys.modelIndex('models/objects/gibs/skull/tris.md2'));
    });

    it('LAVA/TRAP damage burns gibs (no blood, smoke trail)', () => {
        const origin = { x: 0, y: 0, z: 0 };
        const gib = spawnGib(sys, origin, 50, undefined, GIB_ORGANIC, DamageMod.LAVA);

        expect(gib.effects & EntityEffects.Rocket).toBeTruthy(); // Smoke trail
        expect(gib.effects & EntityEffects.Gib).toBeFalsy(); // No blood
    });

    it('Gibs multicasts blood when spawned organically', () => {
        const origin = { x: 0, y: 0, z: 0 };
        const spyMulticast = vi.spyOn(sys, 'multicast');

        spawnGib(sys, origin, 50, undefined, GIB_ORGANIC, DamageMod.UNKNOWN);

        expect(spyMulticast).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            ServerCommand.temp_entity,
            TempEntity.BLOOD,
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything()
        );
    });

    it('Gibs die when shot', () => {
        const origin = { x: 0, y: 0, z: 0 };
        const gib = spawnGib(sys, origin, 50);
        const spyFree = vi.spyOn(sys, 'free');

        expect(gib.die).toBeDefined();
        gib.die!(gib, null, null, 10, {x:0,y:0,z:0}, DamageMod.UNKNOWN);

        expect(spyFree).toHaveBeenCalledWith(gib);
    });
});
