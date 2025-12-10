import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity } from '../../../src/entities/entity.js';
import { SP_monster_gunner } from '../../../src/entities/monsters/gunner.js';
import { createTestContext } from '../../test-helpers.js';

describe('Gunner Sound System', () => {
    let context: EntitySystem;
    let gunner: Entity;
    let mockSound: any;

    beforeEach(async () => {
        const spawnContext = createTestContext(); // No await needed usually, but ok
        context = spawnContext.entities;
        // mockSound is the engine.sound spy
        mockSound = context.engine.sound;

        // Create gunner
        gunner = {
            classname: 'monster_gunner',
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            monsterinfo: {},
            s: { number: 1, origin: { x: 0, y: 0, z: 0 }, angles: { x: 0, y: 0, z: 0 } },
        } as any;

        SP_monster_gunner(gunner, {
            ...spawnContext,
            health_multiplier: 1,
        } as any);
    });

    it('plays spin-up sound when opening gun', () => {
        // Mock rng for attack selection (chain)
        context.rng.frandom = vi.fn().mockReturnValue(0.6); // > 0.5 triggers chain

        // Trigger attack which chooses attack_chain_move
        gunner.monsterinfo.attack!(gunner, context);

        const move = gunner.monsterinfo.current_move!;

        // Execute the think function of the first frame (frame 0 of chain)
        if (move.frames[0].think) {
             move.frames[0].think(gunner, context);
        }

        expect(mockSound).toHaveBeenCalledWith(
            gunner,
            0,
            'gunner/gunatck1.wav',
            1,
            1,
            0
        );
    });
});
