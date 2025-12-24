
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFoodCubePickupEntity } from '../../../src/entities/items/index.js';
import { Solid } from '../../../src/entities/entity.js';
import { createTestContext, createEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';
import { GameExports } from '../../../src/index.js';

describe('Food Cube Item', () => {
    let context: ReturnType<typeof createTestContext>;
    let game: GameExports;

    beforeEach(() => {
        context = createTestContext();
        // createTestContext returns SpawnContext which has entities (sys) and inside that engine
        // We construct a mock game object wrapping entities if needed, or use sys.engine
        const sys = context.entities;

        game = {
            sound: sys.engine.sound,
            centerprintf: sys.engine.centerprintf,
            time: 100,
            deathmatch: true,
            entities: sys
        } as unknown as GameExports;
    });

    it('should initialize correctly', () => {
        const entity = createFoodCubePickupEntity(game);
        expect(entity.classname).toBe('item_foodcube');
        expect(entity.model).toBe('models/objects/trapfx/tris.md2');
        expect(entity.solid).toBe(Solid.Trigger);
        expect(entity.effects).toBe(0x00000008); // EF_GIB
    });

    it('should heal player on touch', () => {
        const entity = createEntityFactory({
             ...createFoodCubePickupEntity(game),
             count: 40
        });

        const player = createPlayerEntityFactory({
            health: 50,
            max_health: 100,
            client: {} as any
        });

        if (entity.touch) {
            entity.touch(entity, player, null, null);
        }

        expect(player.health).toBe(90);
        expect(game.sound).toHaveBeenCalledWith(player, 0, 'items/l_health.wav', 1, 1, 0);
        expect(game.entities.free).toHaveBeenCalledWith(entity);
    });

    it('should ignore max health cap', () => {
        const entity = createEntityFactory({
            ...createFoodCubePickupEntity(game),
            count: 20
        });

        const player = createPlayerEntityFactory({
            health: 100,
            max_health: 100,
            client: {} as any
        });

        if (entity.touch) {
            entity.touch(entity, player, null, null);
        }

        expect(player.health).toBe(120); // Should exceed max
        expect(game.entities.free).toHaveBeenCalledWith(entity);
    });
});
