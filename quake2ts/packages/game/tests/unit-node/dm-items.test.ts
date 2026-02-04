import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { handleItemPickup } from '../../src/entities/items/common.js';
import { Solid, Entity, GameExports } from '../../src/index.js';
import { createTestGame, createItemEntityFactory, createPlayerEntityFactory, spawnEntity } from '@quake2ts/test-utils';

describe('Item Respawn', () => {
    let game: GameExports;
    let item: Entity;
    let player: Entity;

    beforeEach(() => {
        const result = createTestGame({
            config: {
                deathmatch: true
            }
        });
        game = result.game;

        item = spawnEntity(game.entities, createItemEntityFactory('item_health', {
            model: 'models/items/healing/medium/tris.md2',
            modelindex: 1,
            think: (self: Entity) => {
                self.solid = Solid.Trigger;
                self.modelindex = 1;
                self.svflags &= ~1;
            }
        }));

        player = spawnEntity(game.entities, createPlayerEntityFactory());
    });

    it('handleItemPickup should schedule respawn in deathmatch', () => {
        game.entities.scheduleThink = vi.fn();
        const scheduleThinkMock = game.entities.scheduleThink as Mock;

        handleItemPickup(game, item, player);

        expect(item.solid).toBe(Solid.Not);
        expect(item.modelindex).toBe(0);
        expect(item.svflags & 1).toBeTruthy(); // Hidden

        expect(scheduleThinkMock).toHaveBeenCalled();
        const [target, time] = scheduleThinkMock.mock.calls[0];
        expect(target).toBe(item);
        expect(time).toBeGreaterThan(game.time);
    });

    it('respawn callback should restore item', () => {
        handleItemPickup(game, item, player);

        if (item.think) {
            item.think(item);
        }

        expect(item.solid).toBe(Solid.Trigger);
        expect(item.modelindex).toBe(1);
        expect(item.svflags & 1).toBeFalsy();
    });

    it('handleItemPickup should remove item in single player', () => {
        const { game: spGame } = createTestGame({
            config: { deathmatch: false }
        });
        const spItem = spawnEntity(spGame.entities, createItemEntityFactory('item_health'));

        spGame.entities.free = vi.fn();

        handleItemPickup(spGame, spItem, player);

        expect(spGame.entities.free).toHaveBeenCalledWith(spItem);
    });
});
