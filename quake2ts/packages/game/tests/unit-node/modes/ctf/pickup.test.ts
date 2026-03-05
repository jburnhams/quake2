import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleFlagPickup } from '../../../../src/modes/ctf/pickup.js';
import { FlagEntity, FlagState } from '../../../../src/modes/ctf/state.js';
import { GameExports } from '../../../../src/index.js';
import { EntitySystem } from '../../../../src/entities/system.js';
import { createTestGame, spawnEntity, createItemEntityFactory, createPlayerEntityFactory, createPlayerClientFactory } from '@quake2ts/test-utils';
import { Entity } from '../../../../src/entities/entity.js';

describe('CTF Flag Pickup', () => {
    let flag: FlagEntity;
    let player: Entity;
    let game: GameExports;
    let context: EntitySystem;

    beforeEach(() => {
        const testGame = createTestGame();
        game = testGame.game;
        context = testGame.game.entities;

        flag = spawnEntity(context, createItemEntityFactory('item_flag_team1', {
            flagState: FlagState.AT_BASE,
            flagTeam: 'red',
            baseOrigin: { x: 100, y: 100, z: 0 },
            origin: { x: 100, y: 100, z: 0 },
            owner: null,
        })) as FlagEntity;

        player = spawnEntity(context, createPlayerEntityFactory({
             client: createPlayerClientFactory({
                 team: 'red'
             } as any)
        }));

        // Mock time
        vi.spyOn(game, 'time', 'get').mockReturnValue(10);
    });

    it('should not allow picking up own flag at base', () => {
        const result = handleFlagPickup(flag, player, game, context);
        expect(result).toBe(false);
        expect(flag.flagState).toBe(FlagState.AT_BASE);
    });

    it('should return own flag if dropped', () => {
        flag.flagState = FlagState.DROPPED;
        flag.origin = { x: 200, y: 200, z: 0 };

        vi.spyOn(game, 'sound');

        const result = handleFlagPickup(flag, player, game, context);

        expect(result).toBe(true);
        expect(flag.flagState).toBe(FlagState.AT_BASE);
        expect(flag.origin).toEqual(flag.baseOrigin);
        expect(game.sound).toHaveBeenCalledWith(player, 0, 'ctf/flagret.wav', 1, 1, 0);
    });

    it('should pickup enemy flag', () => {
        flag.flagTeam = 'blue';
        flag.classname = 'item_flag_team2';

        vi.spyOn(game, 'sound');

        const result = handleFlagPickup(flag, player, game, context);

        expect(result).toBe(true);
        expect(flag.flagState).toBe(FlagState.CARRIED);
        expect(flag.owner).toBe(player);
        expect(game.sound).toHaveBeenCalledWith(player, 0, 'ctf/flagpk.wav', 1, 1, 0);
    });
});
