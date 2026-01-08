import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignTeam, CtfTeam, countPlayersOnTeam, ClientWithTeam, onSameTeam, checkFriendlyFire, setTeamSkin } from '../../../src/modes/ctf/teams.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity } from '../../../src/entities/entity.js';
import { GameExports } from '../../../src/index.js';

describe('CTF Teams', () => {
    let mockEntities: any;
    let mockGame: any;

    beforeEach(() => {
        mockEntities = {
            entities: [],
            forEachEntity: (callback: (e: Entity) => void) => {
                mockEntities.entities.forEach(callback);
            }
        };

        mockGame = {
            serverCommand: vi.fn(),
            centerprintf: vi.fn(),
        };
    });

    it('should count players on team correctly', () => {
        const client1 = { ctfTeam: CtfTeam.RED };
        const client2 = { ctfTeam: CtfTeam.BLUE };
        const client3 = { ctfTeam: CtfTeam.RED };

        mockEntities.entities = [
            { client: client1 },
            { client: client2 },
            { client: client3 },
            { client: undefined }, // Not a player
        ];

        expect(countPlayersOnTeam(CtfTeam.RED, mockEntities)).toBe(2);
        expect(countPlayersOnTeam(CtfTeam.BLUE, mockEntities)).toBe(1);
    });

    it('should assign specified team', () => {
        const client: ClientWithTeam = { ctfTeam: CtfTeam.NOTEAM };
        assignTeam(client, CtfTeam.RED, mockEntities, mockGame);
        expect(client.ctfTeam).toBe(CtfTeam.RED);
    });

    it('should auto-assign to smaller team (RED smaller)', () => {
        const client: ClientWithTeam = { ctfTeam: CtfTeam.NOTEAM };
        mockEntities.entities = [
            { client: { ctfTeam: CtfTeam.BLUE } },
        ];

        assignTeam(client, CtfTeam.NOTEAM, mockEntities, mockGame);
        expect(client.ctfTeam).toBe(CtfTeam.RED);
    });

    it('should auto-assign to smaller team (BLUE smaller)', () => {
        const client: ClientWithTeam = { ctfTeam: CtfTeam.NOTEAM };
        mockEntities.entities = [
            { client: { ctfTeam: CtfTeam.RED } },
        ];

        assignTeam(client, CtfTeam.NOTEAM, mockEntities, mockGame);
        expect(client.ctfTeam).toBe(CtfTeam.BLUE);
    });

    it('should random assign when equal', () => {
        const client: ClientWithTeam = { ctfTeam: CtfTeam.NOTEAM };
        mockEntities.entities = [];

        // We can't easily test randomness, but we can ensure it assigns ONE of them
        assignTeam(client, CtfTeam.NOTEAM, mockEntities, mockGame);
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
