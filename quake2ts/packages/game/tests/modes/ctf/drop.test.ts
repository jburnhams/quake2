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
            baseOrigin: { x: 100, y: 100, z: 0 },
            origin: { x: 0, y: 0, z: 0 },
            owner: {}, // Owned by someone
            classname: 'item_flag_team1',
            solid: Solid.Not,
            model: undefined
        } as unknown as FlagEntity;

        game = {
            time: 100,
            sound: vi.fn(),
            multicast: vi.fn(),
            centerprintf: vi.fn()
        } as unknown as GameExports;

        context = {
            timeSeconds: 100
        } as unknown as EntitySystem;
    });

    it('should drop flag correctly', () => {
        const dropOrigin = { x: 500, y: 500, z: 10 };

        dropFlag(flag, dropOrigin, game, context);

        expect(flag.flagState).toBe(FlagState.DROPPED);
        expect(flag.origin.x).toBe(500);
        expect(flag.origin.y).toBe(500);
        expect(flag.solid).toBe(Solid.Trigger);
        expect(flag.owner).toBeNull();
        expect(flag.model).toBe('players/male/flag1.md2');
        expect(flag.nextthink).toBe(130); // 100 + 30
    });

    it('should return flag on timeout', () => {
        flag.flagState = FlagState.DROPPED;
        flag.origin = { x: 500, y: 500, z: 10 };

        flagThink(flag, context, game);

        expect(flag.flagState).toBe(FlagState.AT_BASE);
        expect(flag.origin).toEqual(flag.baseOrigin);
        expect(flag.nextthink).toBe(-1);
    });
});
