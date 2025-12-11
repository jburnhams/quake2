import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkPlayerFlagDrop } from '../../../src/modes/ctf/integration.js';
import { FlagEntity, FlagState } from '../../../src/modes/ctf/state.js';
import { Entity, Solid } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { KeyId } from '../../../src/inventory/playerInventory.js';

describe('CTF Integration', () => {
    let player: Entity;
    let flag: FlagEntity;
    let context: EntitySystem;
    let entities: Entity[];

    beforeEach(() => {
        player = {
            client: {
                inventory: {
                    keys: new Set()
                }
            },
            origin: [100, 100, 0]
        } as unknown as Entity;

        flag = {
            flagState: FlagState.CARRIED,
            classname: 'item_flag_team2',
            owner: player,
            origin: [0, 0, 0],
            baseOrigin: [1000, 1000, 0],
            flagTeam: 'blue'
        } as unknown as FlagEntity;

        entities = [player, flag];

        context = {
            forEachEntity: (cb) => entities.forEach(cb),
            game: {
                time: 100,
                sound: vi.fn(),
                multicast: vi.fn(),
                bprint: vi.fn()
            }
        } as unknown as EntitySystem;
    });

    it('should drop flag if player has key and owns flag entity', () => {
        player.client!.inventory.keys.add(KeyId.BlueFlag);

        checkPlayerFlagDrop(player, context);

        expect(flag.flagState).toBe(FlagState.DROPPED);
        expect(flag.owner).toBeUndefined();
        expect(flag.origin[0]).toBe(100); // Dropped at player origin
        expect(player.client!.inventory.keys.has(KeyId.BlueFlag)).toBe(false);
    });

    it('should not drop flag if player does not have key', () => {
        checkPlayerFlagDrop(player, context);

        expect(flag.flagState).toBe(FlagState.CARRIED);
        expect(flag.owner).toBe(player);
    });
});
