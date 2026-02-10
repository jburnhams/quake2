import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignTeam, CtfTeam, countPlayersOnTeam, ClientWithTeam, onSameTeam, checkFriendlyFire, setTeamSkin } from '../../../../src/modes/ctf/teams.js';
import { Entity } from '../../../../src/entities/entity.js';
import { GameExports } from '../../../../src/index.js';
import { createTestContext } from '@quake2ts/test-utils';

describe('CTF Teams', () => {
    let mockGame: GameExports;

    beforeEach(() => {
        // mockGame used in tests below can be created per test or here if generic
        const testCtx = createTestContext();
        mockGame = testCtx.game as unknown as GameExports;
    });

    it('should count players on team correctly', () => {
        const client1 = { ctfTeam: CtfTeam.RED };
        const client2 = { ctfTeam: CtfTeam.BLUE };
        const client3 = { ctfTeam: CtfTeam.RED };

        const testCtx = createTestContext({
            initialEntities: [
                { client: client1 } as any,
                { client: client2 } as any,
                { client: client3 } as any,
                { client: undefined } as any
            ]
        });

        expect(countPlayersOnTeam(CtfTeam.RED, testCtx.entities)).toBe(2);
        expect(countPlayersOnTeam(CtfTeam.BLUE, testCtx.entities)).toBe(1);
    });

    it('should assign specified team', () => {
        const client: ClientWithTeam = { ctfTeam: CtfTeam.NOTEAM };
        // Pass empty entities
        const testCtx = createTestContext();

        assignTeam(client, CtfTeam.RED, testCtx.entities, mockGame);
        expect(client.ctfTeam).toBe(CtfTeam.RED);
    });

    it('should auto-assign to smaller team (RED smaller)', () => {
        const client: ClientWithTeam = { ctfTeam: CtfTeam.NOTEAM };
        const testCtx = createTestContext({
            initialEntities: [
                { client: { ctfTeam: CtfTeam.BLUE } } as any
            ]
        });

        assignTeam(client, CtfTeam.NOTEAM, testCtx.entities, mockGame);
        expect(client.ctfTeam).toBe(CtfTeam.RED);
    });

    it('should auto-assign to smaller team (BLUE smaller)', () => {
        const client: ClientWithTeam = { ctfTeam: CtfTeam.NOTEAM };
        const testCtx = createTestContext({
            initialEntities: [
                { client: { ctfTeam: CtfTeam.RED } } as any
            ]
        });

        assignTeam(client, CtfTeam.NOTEAM, testCtx.entities, mockGame);
        expect(client.ctfTeam).toBe(CtfTeam.BLUE);
    });

    it('should random assign when equal', () => {
        const client: ClientWithTeam = { ctfTeam: CtfTeam.NOTEAM };
        const testCtx = createTestContext(); // empty

        // We can't easily test randomness, but we can ensure it assigns ONE of them
        assignTeam(client, CtfTeam.NOTEAM, testCtx.entities, mockGame);
        expect([CtfTeam.RED, CtfTeam.BLUE]).toContain(client.ctfTeam);
    });

    describe('Friendly Fire', () => {
        it('should allow damage if enemies', () => {
             const ent1 = { client: { ctfTeam: CtfTeam.RED } } as unknown as Entity;
             const ent2 = { client: { ctfTeam: CtfTeam.BLUE } } as unknown as Entity;

             expect(onSameTeam(ent1, ent2)).toBe(false);
             expect(checkFriendlyFire(ent1, ent2)).toBe(true);
        });

        it('should prevent damage if same team', () => {
             const ent1 = { client: { ctfTeam: CtfTeam.RED } } as unknown as Entity;
             const ent2 = { client: { ctfTeam: CtfTeam.RED } } as unknown as Entity;

             expect(onSameTeam(ent1, ent2)).toBe(true);
             expect(checkFriendlyFire(ent1, ent2)).toBe(false);
        });

        it('should allow damage if no teams (DM style or NOTEAM)', () => {
             const ent1 = { client: { ctfTeam: CtfTeam.NOTEAM } } as unknown as Entity;
             const ent2 = { client: { ctfTeam: CtfTeam.NOTEAM } } as unknown as Entity;

             // NOTEAM vs NOTEAM are NOT same team in CTF context (usually)
             expect(onSameTeam(ent1, ent2)).toBe(false);
             expect(checkFriendlyFire(ent1, ent2)).toBe(true);
        });
    });

    describe('Team Skins', () => {
        it('should set skin for Red team', () => {
            const ent = { client: {} } as Entity;
            // setTeamSkin(ent, CtfTeam.RED);
            // expect... placeholder logic for now
        });
    });
});
