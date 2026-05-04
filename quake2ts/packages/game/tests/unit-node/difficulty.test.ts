import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../../src/entities/system.js';
import {
    createTestContext,
    createMonsterEntityFactory,
    createPlayerEntityFactory,
    spawnEntity,
    createGameFrameContext,
    createMonsterInfoFactory,
    createEntityStateFactory
} from '@quake2ts/test-utils';
import { foundTarget } from '../../src/ai/targeting.js';

describe('Difficulty Scaling - Reaction Time', () => {
    let context: EntitySystem;
    let monster: any;
    let enemy: any;

    beforeEach(() => {
        // createTestContext is not async
        const spawnContext = createTestContext();
        context = spawnContext.entities;

        // Use spawnEntity to properly handle entity properties sanitization and system registration (though using factories directly is also common in unit tests if no system needed)
        // Since foundTarget might access system, spawning is safer.
        monster = spawnEntity(context, createMonsterEntityFactory('monster_test', {
            monsterinfo: createMonsterInfoFactory({
                run: vi.fn(),
            }),
            s: createEntityStateFactory({ number: 1 }),
            attack_finished_time: 0,
        }));

        enemy = spawnEntity(context, createPlayerEntityFactory({
            origin: { x: 100, y: 0, z: 0 },
            light_level: 128
        }));

        monster.enemy = enemy;
    });

    it('adds extra reaction time on Easy skill (0)', () => {
        Object.defineProperty(context, 'skill', { get: () => 0, configurable: true });
        const baseTime = 100;
        Object.defineProperty(context, 'timeSeconds', { get: () => baseTime, configurable: true });

        foundTarget(monster, createGameFrameContext({
            timeSeconds: baseTime,
            frameNumber: 1
        }), context);

        // Expected: baseTime + 0.6 (grace) + 0.4 (easy) = baseTime + 1.0
        expect(monster.attack_finished_time).toBeCloseTo(baseTime + 1.0, 1);
    });

    it('adds extra reaction time on Medium skill (1)', () => {
        Object.defineProperty(context, 'skill', { get: () => 1, configurable: true });
        const baseTime = 100;
        Object.defineProperty(context, 'timeSeconds', { get: () => baseTime, configurable: true });

        foundTarget(monster, createGameFrameContext({
            timeSeconds: baseTime,
            frameNumber: 1
        }), context);

        // Expected: baseTime + 0.6 (grace) + 0.2 (medium) = baseTime + 0.8
        expect(monster.attack_finished_time).toBeCloseTo(baseTime + 0.8, 1);
    });

    it('adds no extra reaction time on Hard/Nightmare skill (2+)', () => {
        Object.defineProperty(context, 'skill', { get: () => 2, configurable: true });
        const baseTime = 100;
        Object.defineProperty(context, 'timeSeconds', { get: () => baseTime, configurable: true });

        foundTarget(monster, createGameFrameContext({
            timeSeconds: baseTime,
            frameNumber: 1
        }), context);

        // Expected: baseTime + 0.6 (grace) = baseTime + 0.6
        expect(monster.attack_finished_time).toBeCloseTo(baseTime + 0.6, 1);
    });
});
