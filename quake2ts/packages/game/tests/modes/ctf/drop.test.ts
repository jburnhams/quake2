import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dropFlag, flagThink } from '../../../src/modes/ctf/drop.js';
import { FlagEntity, FlagState } from '../../../src/modes/ctf/state.js';
import { Entity, Solid } from '../../../src/entities/entity.js';
import { GameExports } from '../../../src/index.js';
import { EntitySystem } from '../../../src/entities/system.js';

describe('CTF Flag Drop', () => {
    let flag: FlagEntity;
    let game: GameExports;
    let context: EntitySystem;

    beforeEach(() => {
        flag = {
            flagState: FlagState.CARRIED,
            flagTeam: 'red',
            baseOrigin: [100, 100, 0],
            origin: [0,0,0],
            owner: {}, // Owned by someone
            classname: 'item_flag_team1',
            solid: Solid.Not,
            model: undefined
        } as unknown as FlagEntity;

        game = {
            time: 100,
            sound: vi.fn(),
            multicast: vi.fn(),
            bprint: vi.fn()
        } as unknown as GameExports;

        context = {} as EntitySystem;
    });

    it('should drop flag correctly', () => {
        const dropOrigin: [number, number, number] = [500, 500, 10];

        dropFlag(flag, dropOrigin, game, context);

        expect(flag.flagState).toBe(FlagState.DROPPED);
        expect(flag.origin[0]).toBe(500);
        expect(flag.origin[1]).toBe(500);
        // Z might be adjusted
        expect(flag.solid).toBe(Solid.Trigger);
        expect(flag.owner).toBeUndefined();
        expect(flag.model).toBe('players/male/flag1.md2');
        expect(flag.nextthink).toBe(130); // 100 + 30
    });

    it('should return flag on timeout', () => {
        flag.flagState = FlagState.DROPPED;
        flag.origin = [500, 500, 10];

        flagThink(flag, context, game);

        expect(flag.flagState).toBe(FlagState.AT_BASE);
        expect(flag.origin).toEqual(flag.baseOrigin);
        expect(flag.nextthink).toBe(-1);
    });
});
