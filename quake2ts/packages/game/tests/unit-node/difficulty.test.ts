import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../../src/entities/system.js';
import { createTestContext, createMonsterEntityFactory, createPlayerEntityFactory, spawnEntity, createGameFrameContext } from '@quake2ts/test-utils';
import { foundTarget } from '../../src/ai/targeting.js';

describe('Difficulty Scaling - Reaction Time', () => {
    let context: EntitySystem;
    let monster: any;
    let enemy: any;

    beforeEach(() => {
        // createTestContext is not async
        const spawnContext = createTestContext();
        context = spawnContext.entities;

        // Ensure skill is writable for test (normally readonly)
        Object.defineProperty(context, 'skill', {
            value: 1,
            writable: true
        });

        // Use spawnEntity to properly handle entity properties sanitization and system registration (though using factories directly is also common in unit tests if no system needed)
        // Since foundTarget might access system, spawning is safer.
        monster = spawnEntity(context, createMonsterEntityFactory('monster_test', {
            monsterinfo: {
                aiflags: 0,
                last_sighting: { x: 0, y: 0, z: 0 },
                saved_goal: { x: 0, y: 0, z: 0 },
                run: vi.fn(),
                attack_finished: 0,
            } as any,
            s: { number: 1, origin: { x: 0, y: 0, z: 0 }, angles: { x: 0, y: 0, z: 0 } } as any,
            attack_finished_time: 0,
        }));

        enemy = spawnEntity(context, createPlayerEntityFactory({
            origin: { x: 100, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            flags: 0,
            light_level: 128
        }));

        monster.enemy = enemy;
    });

    it('adds extra reaction time on Easy skill (0)', () => {
        (context as any).skill = 0;
        const baseTime = 100;
        (context as any).timeSeconds = baseTime;

        foundTarget(monster, createGameFrameContext({
            timeSeconds: baseTime,
            frameNumber: 1
        }) as any, context);

        // Expected: baseTime + 0.6 (grace) + 0.4 (easy) = baseTime + 1.0
        expect(monster.attack_finished_time).toBeCloseTo(baseTime + 1.0, 1);
    });

    it('adds extra reaction time on Medium skill (1)', () => {
        (context as any).skill = 1;
        const baseTime = 100;
        (context as any).timeSeconds = baseTime;

        foundTarget(monster, createGameFrameContext({
            timeSeconds: baseTime,
            frameNumber: 1
        }) as any, context);

        // Expected: baseTime + 0.6 (grace) + 0.2 (medium) = baseTime + 0.8
        expect(monster.attack_finished_time).toBeCloseTo(baseTime + 0.8, 1);
    });

    it('adds no extra reaction time on Hard/Nightmare skill (2+)', () => {
        (context as any).skill = 2;
        const baseTime = 100;
        (context as any).timeSeconds = baseTime;

        foundTarget(monster, createGameFrameContext({
            timeSeconds: baseTime,
            frameNumber: 1
        }) as any, context);

        // Expected: baseTime + 0.6 (grace) = baseTime + 0.6
        expect(monster.attack_finished_time).toBeCloseTo(baseTime + 0.6, 1);
    });
});
