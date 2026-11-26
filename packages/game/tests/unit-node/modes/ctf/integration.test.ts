import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkPlayerFlagDrop } from '../../../../src/modes/ctf/integration.js';
import { FlagEntity, FlagState } from '../../../../src/modes/ctf/state.js';
import { EntitySystem } from '../../../../src/entities/system.js';
import { KeyId } from '../../../../src/inventory/playerInventory.js';
import { GameExports } from '../../../../src/index.js';
import { createTestGame, spawnEntity, createItemEntityFactory, createPlayerEntityFactory, createPlayerClientFactory } from '@quake2ts/test-utils';
import { Entity } from '../../../../src/entities/entity.js';

describe('CTF Integration', () => {
    let player: Entity;
    let flag: FlagEntity;
    let context: EntitySystem;
    let mockGame: GameExports;

    beforeEach(() => {
        const testGame = createTestGame();
        mockGame = testGame.game;
        context = testGame.game.entities;

        player = spawnEntity(context, createPlayerEntityFactory({
            client: createPlayerClientFactory(),
            origin: { x: 100, y: 100, z: 0 }
        }));

        flag = spawnEntity(context, createItemEntityFactory('item_flag_team2', {
            flagState: FlagState.CARRIED,
            owner: player,
            origin: { x: 0, y: 0, z: 0 },
            baseOrigin: { x: 1000, y: 1000, z: 0 },
            flagTeam: 'blue'
        })) as FlagEntity;

        vi.spyOn(mockGame, 'time', 'get').mockReturnValue(100);
    });

    it('should drop flag if player has key and owns flag entity', () => {
        player.client!.inventory.keys.add(KeyId.BlueFlag);

        checkPlayerFlagDrop(player, context);

        expect(flag.flagState).toBe(FlagState.DROPPED);
        expect(flag.owner).toBeNull();
        expect(flag.origin.x).toBe(100); // Dropped at player origin
        expect(player.client!.inventory.keys.has(KeyId.BlueFlag)).toBe(false);
    });

    it('should not drop flag if player does not have key', () => {
        checkPlayerFlagDrop(player, context);

        expect(flag.flagState).toBe(FlagState.CARRIED);
        expect(flag.owner).toBe(player);
    });
});
