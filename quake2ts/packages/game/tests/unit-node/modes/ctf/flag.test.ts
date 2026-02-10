import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFlagPickupEntity } from '../../../../src/modes/ctf/flag.js';
import { GameExports } from '../../../../src/index.js';
import { FLAG_ITEMS } from '../../../../src/inventory/items.js';
import { Solid } from '../../../../src/entities/entity.js';
import { Entity, EntitySystem } from '../../../../src/entities/system.js';
import { KeyId } from '../../../../src/inventory/playerInventory.js';
import { createTestContext, createPlayerEntityFactory, createPlayerClientFactory } from '@quake2ts/test-utils';

describe('CTF Flag Entities', () => {
    let mockGame: GameExports;
    let mockEntitySystem: EntitySystem;
    let mockPlayer: Entity;

    beforeEach(() => {
        const testCtx = createTestContext();
        mockGame = testCtx.game as unknown as GameExports;
        mockEntitySystem = testCtx.entities;

        // Mock time
        (mockGame as any).time = 100;

        mockPlayer = createPlayerEntityFactory({
            client: createPlayerClientFactory()
        }) as unknown as Entity;
    });

    it('should create red flag entity', () => {
        const flagItem = FLAG_ITEMS['item_flag_team1'];
        const entity = createFlagPickupEntity(mockGame, flagItem);

        expect(entity.classname).toBe('item_flag_team1');
        expect(entity.solid).toBe(Solid.Trigger);
        expect(entity.model).toBe('players/male/flag1.md2');
    });

    it('should create blue flag entity', () => {
        const flagItem = FLAG_ITEMS['item_flag_team2'];
        const entity = createFlagPickupEntity(mockGame, flagItem);

        expect(entity.classname).toBe('item_flag_team2');
        expect(entity.solid).toBe(Solid.Trigger);
        expect(entity.model).toBe('players/male/flag2.md2');
    });

    it('should handle pickup logic', () => {
        const flagItem = FLAG_ITEMS['item_flag_team1'];
        const entity = createFlagPickupEntity(mockGame, flagItem);

        // Mock entity instance for "self"
        const self = { ...entity } as Entity;

        // Mock player to be on opposite team (blue)
        (mockPlayer.client as any).team = 'blue';

        if (entity.touch) {
            entity.touch(self, mockPlayer, undefined, undefined);
        }

        // Check inventory
        expect(mockPlayer.client!.inventory.keys.has(KeyId.RedFlag)).toBe(true);

        // Check sound
        expect(mockGame.sound).toHaveBeenCalledWith(mockPlayer, 0, 'ctf/flagpk.wav', 1, 1, 0);

        // Check message
        expect(mockGame.centerprintf).toHaveBeenCalledWith(mockPlayer, 'You got the Red Flag!');

        // Check entity state change (hidden)
        expect(self.solid).toBe(Solid.Not);
        expect(self.model).toBeUndefined();
    });

    it('should ignore non-client touches', () => {
        const flagItem = FLAG_ITEMS['item_flag_team1'];
        const entity = createFlagPickupEntity(mockGame, flagItem);
        const other = {} as Entity; // Not a client
        const self = { ...entity } as Entity;

        if (entity.touch) {
            entity.touch(self, other, undefined, undefined);
        }

        expect(mockGame.sound).not.toHaveBeenCalled();
    });
});
