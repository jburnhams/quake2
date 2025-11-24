import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ClientObituary, PRINT_MEDIUM, getGender } from '../../src/combat/obituary.js';
import { Entity } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { ServerCommand } from '@quake2ts/shared';
import { MulticastType } from '../../src/imports.js';

// Mock getGender since it's hardcoded to "male" but we want to test female paths if possible.
// We can use vi.mock to mock the module, but since we are testing the module itself, that's tricky.
// Instead, we can verify that "male" behavior is correct for now, and if we ever update getGender, we can update tests.

describe('ClientObituary', () => {
    let sys: EntitySystem;
    let victim: Entity;
    let attacker: Entity;
    let multicastSpy: any;

    beforeEach(() => {
        multicastSpy = vi.fn();
        sys = {
            multicast: multicastSpy,
        } as any;

        victim = new Entity(1);
        victim.classname = 'player';
        victim.client = {} as any; // Mock client presence

        attacker = new Entity(2);
        attacker.classname = 'player';
        attacker.client = {} as any;
    });

    it('should broadcast suicide message', () => {
        ClientObituary(victim, null, null, DamageMod.SUICIDE, sys);
        expect(multicastSpy).toHaveBeenCalledWith(
            expect.anything(),
            MulticastType.All,
            ServerCommand.print,
            PRINT_MEDIUM,
            expect.stringContaining('suicides')
        );
    });

    it('should broadcast kill message for PvP', () => {
        ClientObituary(victim, null, attacker, DamageMod.SHOTGUN, sys);
        expect(multicastSpy).toHaveBeenCalledWith(
            expect.anything(),
            MulticastType.All,
            ServerCommand.print,
            PRINT_MEDIUM,
            expect.stringContaining('gunned down by Enemy')
        );
    });

    it('should broadcast death by slime', () => {
        ClientObituary(victim, null, null, DamageMod.SLIME, sys);
        expect(multicastSpy).toHaveBeenCalledWith(
            expect.anything(),
            MulticastType.All,
            ServerCommand.print,
            PRINT_MEDIUM,
            expect.stringContaining('melted')
        );
    });

    it('should broadcast male suicide message by default', () => {
        // Since getGender returns male by default
        ClientObituary(victim, null, victim, DamageMod.ROCKET, sys);
         expect(multicastSpy).toHaveBeenCalledWith(
            expect.anything(),
            MulticastType.All,
            ServerCommand.print,
            PRINT_MEDIUM,
            expect.stringContaining('blew himself up')
        );
    });
});
