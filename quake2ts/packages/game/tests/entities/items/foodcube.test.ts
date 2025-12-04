
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFoodCubePickupEntity } from '../../../../src/entities/items/foodcube.js';
import { Entity, Solid } from '../../../../src/entities/entity.js';
import { createTestContext } from '../../test-helpers.js';
import { GameExports } from '../../../../src/index.js';

describe('Food Cube Item', () => {
    let context: ReturnType<typeof createTestContext>;
    let game: GameExports;

    beforeEach(() => {
        context = createTestContext();
        game = context.game;

        // Mock game.sound and free
        game.sound = vi.fn();
        game.entities.free = vi.fn();
    });

    it('should initialize correctly', () => {
        const entity = createFoodCubePickupEntity(game);
        expect(entity.classname).toBe('item_foodcube');
        expect(entity.model).toBe('models/objects/trapfx/tris.md2');
        expect(entity.solid).toBe(Solid.Trigger);
        // Expect effects? We defined it locally, hard to check unless we export it or check value.
        expect(entity.effects).toBe(0x00000008); // EF_GIB
    });

    it('should heal player on touch', () => {
        const entity = new Entity(1);
        Object.assign(entity, createFoodCubePickupEntity(game));
        entity.count = 50; // Large food cube

        const player = new Entity(2);
        player.client = {} as any;
        player.health = 50;
        player.max_health = 100;

        if (entity.touch) {
            entity.touch(entity, player, null, null);
        }

        expect(player.health).toBe(100);
        expect(game.sound).toHaveBeenCalledWith(player, 0, 'items/l_health.wav', 1, 1, 0);
        expect(game.entities.free).toHaveBeenCalledWith(entity);
    });

    it('should ignore max health cap', () => {
        const entity = new Entity(1);
        Object.assign(entity, createFoodCubePickupEntity(game));
        entity.count = 20;

        const player = new Entity(2);
        player.client = {} as any;
        player.health = 100;
        player.max_health = 100;

        if (entity.touch) {
            entity.touch(entity, player, null, null);
        }

        expect(player.health).toBe(120); // Should exceed max
        expect(game.entities.free).toHaveBeenCalledWith(entity);
    });
});
