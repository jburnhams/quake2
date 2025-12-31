import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity } from '../../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import * as gibs from '../../../src/entities/gibs.js';
import { SP_monster_medic } from '../../../src/entities/monsters/medic.js';
import { SP_monster_flyer } from '../../../src/entities/monsters/flyer.js';
import { SP_monster_icarus } from '../../../src/entities/monsters/icarus.js';
import { SP_monster_supertank } from '../../../src/entities/monsters/supertank.js';
import { SP_monster_fixbot } from '../../../src/entities/monsters/fixbot.js';
import { SP_monster_turret } from '../../../src/entities/monsters/turret.js';
import { SP_monster_boss2 } from '../../../src/entities/monsters/boss2.js';

describe('Robot Gibbing System', () => {
    let context: EntitySystem;
    let throwGibsSpy: any;

    beforeEach(() => {
        const spawnContext = createTestContext();
        context = spawnContext.entities;

        // Spy on throwGibs
        // We need to spy on the export. Since we are importing * as gibs, we can spy on it.
        // However, if the modules use named imports, spying on the module export might not work
        // if they import it directly. But for this test, checking the mocked implementation or
        // the side effect might be better.
        // Actually, Vitest `vi.spyOn` works on objects.
        throwGibsSpy = vi.spyOn(gibs, 'throwGibs');
    });

    const checkRobotGibs = (
        spawnFunc: (ent: Entity, ctx: any) => void,
        classname: string
    ) => {
        const ent = context.spawn();
        ent.classname = classname;
        ent.origin = { x: 0, y: 0, z: 0 };
        ent.angles = { x: 0, y: 0, z: 0 };
        ent.monsterinfo = {};

        // Spawn
        spawnFunc(ent, {
            entities: context,
            keyValues: { classname },
            warn: () => {},
            free: (e: any) => context.free(e),
            health_multiplier: 1
        } as any);

        // Force gibbing death
        ent.health = -100;

        // Execute die function
        if (ent.die) {
            ent.die(ent, null, null, 100, { x: 0, y: 0, z: 0 });
        }

        // Check if throwGibs was called with GIB_METALLIC
        // We use expect.anything() for optional arguments if they are passed, but to be safe against
        // undefined/missing optional args, we can check the calls directly or use a flexible matcher.
        // Since mod is optional, it might not be present in the call arguments if default value logic is used.
        const lastCall = throwGibsSpy.mock.lastCall;
        expect(lastCall).toBeDefined();
        if (lastCall) {
            expect(lastCall[3]).toBe(gibs.GIB_METALLIC);
        }

        throwGibsSpy.mockClear();
    };

    it('monster_medic throws metallic gibs', () => {
        checkRobotGibs(SP_monster_medic, 'monster_medic');
    });

    it('monster_flyer throws metallic gibs', () => {
        checkRobotGibs(SP_monster_flyer, 'monster_flyer');
    });

    it('monster_icarus throws metallic gibs', () => {
        checkRobotGibs(SP_monster_icarus, 'monster_icarus');
    });

    it('monster_supertank throws metallic gibs', () => {
        checkRobotGibs(SP_monster_supertank, 'monster_supertank');
    });

    it('monster_fixbot throws metallic gibs', () => {
        checkRobotGibs(SP_monster_fixbot, 'monster_fixbot');
    });

    it('monster_turret throws metallic gibs', () => {
        checkRobotGibs(SP_monster_turret, 'monster_turret');
    });

    // Boss2 is Hornet/Supertank boss, effectively Supertank logic
    it('monster_boss2 throws metallic gibs', () => {
        checkRobotGibs(SP_monster_boss2, 'monster_boss2');
    });
});
