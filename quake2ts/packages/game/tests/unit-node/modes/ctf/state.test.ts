import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlagState, setFlagState, FlagEntity } from '../../../../src/modes/ctf/state.js';
import { EntitySystem } from '../../../../src/entities/system.js';
import { Entity } from '../../../../src/entities/entity.js';

describe('CTF Flag State', () => {
    let flag: FlagEntity;
    let context: EntitySystem;

    beforeEach(() => {
        flag = {
            flagState: FlagState.AT_BASE,
            flagTeam: 'red',
            baseOrigin: [0, 0, 0],
        } as FlagEntity;
        context = {} as EntitySystem;
    });

    it('should transition to AT_BASE', () => {
        setFlagState(flag, FlagState.AT_BASE, context);
        expect(flag.flagState).toBe(FlagState.AT_BASE);
    });

    it('should transition to CARRIED', () => {
        setFlagState(flag, FlagState.CARRIED, context);
        expect(flag.flagState).toBe(FlagState.CARRIED);
    });

    it('should transition to DROPPED', () => {
        setFlagState(flag, FlagState.DROPPED, context);
        expect(flag.flagState).toBe(FlagState.DROPPED);
    });
});
