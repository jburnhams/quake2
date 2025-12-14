import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkCapture } from '../../../src/modes/ctf/capture.js';
import { FlagEntity, FlagState } from '../../../src/modes/ctf/state.js';
import { Entity, Solid } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { KeyId } from '../../../src/inventory/playerInventory.js';
import { GameExports } from '../../../src/index.js';

describe('CTF Capture Logic', () => {
    let ownFlag: FlagEntity;
    let enemyFlag: FlagEntity;
    let player: Entity;
    let game: GameExports;
    let context: EntitySystem;
    let entities: Entity[];

    beforeEach(() => {
        // Player is RED team
        player = {
            client: {
                team: 'red',
                inventory: {
                    keys: new Set()
                },
                netname: 'Player 1'
            }
        } as unknown as Entity;

        // RED flag at base
        ownFlag = {
            flagState: FlagState.AT_BASE,
            flagTeam: 'red',
            baseOrigin: { x: 100, y: 100, z: 0 },
            origin: { x: 100, y: 100, z: 0 },
            classname: 'item_flag_team1',
            solid: Solid.Trigger,
            model: 'players/male/flag1.md2'
        } as unknown as FlagEntity;

        // BLUE flag carried (represented by entity state and player key)
        enemyFlag = {
            flagState: FlagState.CARRIED,
            flagTeam: 'blue',
            baseOrigin: { x: 900, y: 900, z: 0 },
            origin: { x: 0, y: 0, z: 0 },
            owner: player,
            classname: 'item_flag_team2',
            solid: Solid.Not,
            model: undefined
        } as unknown as FlagEntity;

        entities = [player, ownFlag, enemyFlag];

        game = {
            sound: vi.fn(),
            centerprintf: vi.fn(),
            bprint: vi.fn()
        } as unknown as GameExports;

        context = {
            forEachEntity: (cb) => entities.forEach(cb)
        } as unknown as EntitySystem;
    });

    it('should capture flag when touching own flag at base while carrying enemy flag', () => {
        // Player has enemy flag
        player.client!.inventory.keys.add(KeyId.BlueFlag);

        const result = checkCapture(ownFlag, player, game, context);

        expect(result).toBe(true);
        expect(game.centerprintf).toHaveBeenCalledWith(player, 'You captured the flag!');
        expect(player.client!.inventory.keys.has(KeyId.BlueFlag)).toBe(false);

        // Enemy flag should reset
        expect(enemyFlag.flagState).toBe(FlagState.AT_BASE);
        expect(enemyFlag.origin).toEqual(enemyFlag.baseOrigin);
        expect(enemyFlag.owner).toBeNull();
        expect(enemyFlag.model).toBe('players/male/flag2.md2');
    });

    it('should not capture if touching own flag not at base', () => {
        ownFlag.flagState = FlagState.DROPPED; // e.g. just returned or dropped
        player.client!.inventory.keys.add(KeyId.BlueFlag);

        const result = checkCapture(ownFlag, player, game, context);

        expect(result).toBe(false);
    });

    it('should not capture if not carrying enemy flag', () => {
        // Player does not have key

        const result = checkCapture(ownFlag, player, game, context);

        expect(result).toBe(false);
    });

    it('should not capture if touching enemy flag', () => {
        // Touching enemy flag is pickup, not capture
        const result = checkCapture(enemyFlag, player, game, context);
        expect(result).toBe(false);
    });
});
