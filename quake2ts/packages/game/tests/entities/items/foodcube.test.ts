
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFoodCubePickupEntity } from '../../../src/entities/items/index.js';
import { Entity, Solid } from '../../../src/entities/entity.js';
import { createTestContext, createMockGameExports, createPlayerEntityFactory } from '@quake2ts/test-utils';
import { GameExports } from '../../../src/index.js';
import { EntitySystem } from '../../../src/entities/system.js';

describe('Food Cube Item', () => {
    let context: ReturnType<typeof createTestContext>;
    let game: GameExports;

    beforeEach(() => {
        context = createTestContext();
        // Use createMockGameExports
        game = createMockGameExports({
            sound: context.entities.engine.sound,
            centerprintf: context.entities.engine.centerprintf,
            time: 100,
            deathmatch: true,
            entities: context.entities as unknown as EntitySystem,
            hooks: {
                onPickup: vi.fn(),
            } as any
        });
    });

    it('should initialize correctly', () => {
        const entity = createFoodCubePickupEntity(game);
        expect(entity.classname).toBe('item_foodcube');
        expect(entity.model).toBe('models/objects/trapfx/tris.md2');
        expect(entity.solid).toBe(Solid.Trigger);
        expect(entity.effects).toBe(0x00000008); // EF_GIB
    });

    it('should heal player on touch', () => {
        const entity = new Entity(1);
        Object.assign(entity, createFoodCubePickupEntity(game));
        entity.count = 40; // Large food cube (but < 50)

        const player = createPlayerEntityFactory({
            index: 2,
            health: 50,
            max_health: 100,
        }) as Entity;
        player.client = {} as any;

        if (entity.touch) {
            entity.touch(entity, player, null, null);
        }

        expect(player.health).toBe(90);
        expect(game.sound).toHaveBeenCalledWith(player, 0, 'items/l_health.wav', 1, 1, 0);
        expect(game.entities.free).toHaveBeenCalledWith(entity);
    });

    it('should ignore max health cap', () => {
        const entity = new Entity(1);
        Object.assign(entity, createFoodCubePickupEntity(game));
        entity.count = 20;

        const player = createPlayerEntityFactory({
            index: 2,
            health: 100,
            max_health: 100
        }) as Entity;
        player.client = {} as any;

        if (entity.touch) {
            entity.touch(entity, player, null, null);
        }

        expect(player.health).toBe(120); // Should exceed max
        expect(game.entities.free).toHaveBeenCalledWith(entity);
    });
});
