import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleFlagPickup } from '../../../../src/modes/ctf/pickup.js';
import { FlagEntity, FlagState } from '../../../../src/modes/ctf/state.js';
import { GameExports } from '../../../../src/index.js';
import { EntitySystem } from '../../../../src/entities/system.js';
import { createTestContext, createItemEntityFactory, createPlayerEntityFactory, createPlayerClientFactory } from '@quake2ts/test-utils';

describe('CTF Flag Pickup', () => {
    let flag: FlagEntity;
    let player: any;
    let game: GameExports;
    let context: EntitySystem;

    beforeEach(() => {
        flag = createItemEntityFactory('item_flag_team1', {
            flagState: FlagState.AT_BASE,
            flagTeam: 'red',
            baseOrigin: { x: 100, y: 100, z: 0 },
            origin: { x: 100, y: 100, z: 0 },
            owner: undefined,
        }) as unknown as FlagEntity;

        player = createPlayerEntityFactory({
             client: createPlayerClientFactory({
                 team: 'red'
             })
        });

        const testCtx = createTestContext();
        game = testCtx.game as unknown as GameExports;
        context = testCtx.entities;

        // Mock time
        (game as any).time = 10;
    });

    it('should not allow picking up own flag at base', () => {
        const result = handleFlagPickup(flag, player, game, context);
        expect(result).toBe(false);
        expect(flag.flagState).toBe(FlagState.AT_BASE);
    });

    it('should return own flag if dropped', () => {
        flag.flagState = FlagState.DROPPED;
        flag.origin = { x: 200, y: 200, z: 0 };

        const result = handleFlagPickup(flag, player, game, context);

        expect(result).toBe(true);
        expect(flag.flagState).toBe(FlagState.AT_BASE);
        expect(flag.origin).toEqual(flag.baseOrigin);
        expect(game.sound).toHaveBeenCalledWith(player, 0, 'ctf/flagret.wav', 1, 1, 0);
    });

    it('should pickup enemy flag', () => {
        flag.flagTeam = 'blue';
        flag.classname = 'item_flag_team2';

        const result = handleFlagPickup(flag, player, game, context);

        expect(result).toBe(true);
        expect(flag.flagState).toBe(FlagState.CARRIED);
        expect(flag.owner).toBe(player);
        expect(game.sound).toHaveBeenCalledWith(player, 0, 'ctf/flagpk.wav', 1, 1, 0);
    });
});
