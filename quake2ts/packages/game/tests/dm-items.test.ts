import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../src/entities/system.js';
import { createGame } from '../src/index.js';
import { handleItemPickup } from '../src/entities/items/common.js';
import { Solid } from '../src/entities/entity.js';

describe('Item Respawn', () => {
    let game: any;
    let item: any;
    let player: any;

    beforeEach(() => {
        const engine = {
            modelIndex: vi.fn().mockReturnValue(1),
            soundIndex: vi.fn(),
        } as any;

        game = createGame({
            multicast: vi.fn()
        }, engine, { gravity: { x: 0, y: 0, z: -800 }, deathmatch: true });

        item = game.entities.spawn();
        item.classname = 'item_health';
        item.solid = Solid.Trigger;
        item.model = 'models/items/healing/medium/tris.md2';
        item.modelindex = 1;
        item.think = (self: any) => {
            self.solid = Solid.Trigger;
            self.modelindex = 1;
            self.svflags &= ~1;
        };

        player = game.entities.spawn();
        player.classname = 'player';
    });

    it('handleItemPickup should schedule respawn in deathmatch', () => {
        game.entities.scheduleThink = vi.fn();

        handleItemPickup(game, item, player);

        expect(item.solid).toBe(Solid.Not);
        expect(item.modelindex).toBe(0);
        expect(item.svflags & 1).toBeTruthy(); // Hidden

        expect(game.entities.scheduleThink).toHaveBeenCalled();
        const call = (game.entities.scheduleThink as any).mock.calls[0];
        expect(call[0]).toBe(item);
        expect(call[1]).toBeGreaterThan(game.time); // scheduled in future
    });

    it('respawn callback should restore item', () => {
        // Hide item first
        handleItemPickup(game, item, player);

        // Execute think
        if (item.think) {
            item.think(item);
        }

        expect(item.solid).toBe(Solid.Trigger);
        expect(item.modelindex).toBe(1);
        expect(item.svflags & 1).toBeFalsy();
    });

    it('handleItemPickup should remove item in single player', () => {
        const spGame = createGame({}, {} as any, { gravity: { x: 0, y: 0, z: -800 }, deathmatch: false });
        const spItem = spGame.entities.spawn();

        spGame.entities.free = vi.fn();

        handleItemPickup(spGame, spItem, player);

        expect(spGame.entities.free).toHaveBeenCalledWith(spItem);
    });
});
