import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkPlayerFlagDrop } from '../../../src/modes/ctf/integration.js';
import { FlagEntity, FlagState } from '../../../src/modes/ctf/state.js';
import { Entity, Solid } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { KeyId } from '../../../src/inventory/playerInventory.js';
import { GameExports } from '../../../src/index.js';

describe('CTF Integration', () => {
    let player: Entity;
    let flag: FlagEntity;
    let context: EntitySystem;
    let entities: Entity[];
    let mockGame: GameExports;

    beforeEach(() => {
        player = {
            client: {
                inventory: {
                    keys: new Set()
                }
            },
            origin: { x: 100, y: 100, z: 0 }
        } as unknown as Entity;

        flag = {
            flagState: FlagState.CARRIED,
            classname: 'item_flag_team2',
            owner: player,
            origin: { x: 0, y: 0, z: 0 },
            baseOrigin: { x: 1000, y: 1000, z: 0 },
            flagTeam: 'blue'
        } as unknown as FlagEntity;

        entities = [player, flag];

        mockGame = {
            time: 100,
            sound: vi.fn(),
            multicast: vi.fn(),
            centerprintf: vi.fn()
        } as unknown as GameExports;

        context = {
            forEachEntity: (cb) => entities.forEach(cb),
            timeSeconds: 100,
            engine: {
                centerprintf: vi.fn(),
            }
        } as unknown as EntitySystem;
        (context as any)._game = mockGame;
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
