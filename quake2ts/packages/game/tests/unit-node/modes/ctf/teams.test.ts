import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignTeam, CtfTeam, countPlayersOnTeam, ClientWithTeam, onSameTeam, checkFriendlyFire, setTeamSkin } from '../../../../src/modes/ctf/teams.js';
import { Entity } from '../../../../src/entities/entity.js';
import { GameExports } from '../../../../src/index.js';
import { createTestGame, spawnEntity, createPlayerEntityFactory, createPlayerClientFactory } from '@quake2ts/test-utils';
import { EntitySystem } from '../../../../src/entities/system.js';

describe('CTF Teams', () => {
    let mockGame: GameExports;
    let entities: EntitySystem;

    beforeEach(() => {
        const testGame = createTestGame();
        mockGame = testGame.game;
        entities = testGame.game.entities;
    });

    it('should count players on team correctly', () => {
        spawnEntity(entities, createPlayerEntityFactory({
            client: createPlayerClientFactory({ ctfTeam: CtfTeam.RED })
        }));
        spawnEntity(entities, createPlayerEntityFactory({
            client: createPlayerClientFactory({ ctfTeam: CtfTeam.BLUE })
        }));
        spawnEntity(entities, createPlayerEntityFactory({
            client: createPlayerClientFactory({ ctfTeam: CtfTeam.RED })
        }));
        spawnEntity(entities, createPlayerEntityFactory({
            client: null // Just to cover undefined client case (null matches expected type safely)
        }));

        expect(countPlayersOnTeam(CtfTeam.RED, entities)).toBe(2);
        expect(countPlayersOnTeam(CtfTeam.BLUE, entities)).toBe(1);
    });

    it('should assign specified team', () => {
        const client: ClientWithTeam = { ctfTeam: CtfTeam.NOTEAM };

        assignTeam(client, CtfTeam.RED, entities, mockGame);
        expect(client.ctfTeam).toBe(CtfTeam.RED);
    });

    it('should auto-assign to smaller team (RED smaller)', () => {
        const client: ClientWithTeam = { ctfTeam: CtfTeam.NOTEAM };
        spawnEntity(entities, createPlayerEntityFactory({
            client: createPlayerClientFactory({ ctfTeam: CtfTeam.BLUE })
        }));

        assignTeam(client, CtfTeam.NOTEAM, entities, mockGame);
        expect(client.ctfTeam).toBe(CtfTeam.RED);
    });

    it('should auto-assign to smaller team (BLUE smaller)', () => {
        const client: ClientWithTeam = { ctfTeam: CtfTeam.NOTEAM };
        spawnEntity(entities, createPlayerEntityFactory({
            client: createPlayerClientFactory({ ctfTeam: CtfTeam.RED })
        }));

        assignTeam(client, CtfTeam.NOTEAM, entities, mockGame);
        expect(client.ctfTeam).toBe(CtfTeam.BLUE);
    });

    it('should random assign when equal', () => {
        const client: ClientWithTeam = { ctfTeam: CtfTeam.NOTEAM };

        assignTeam(client, CtfTeam.NOTEAM, entities, mockGame);
        expect([CtfTeam.RED, CtfTeam.BLUE]).toContain(client.ctfTeam);
    });

    describe('Friendly Fire', () => {
        it('should allow damage if enemies', () => {
             const ent1 = spawnEntity(entities, createPlayerEntityFactory({ client: createPlayerClientFactory({ ctfTeam: CtfTeam.RED }) }));
             const ent2 = spawnEntity(entities, createPlayerEntityFactory({ client: createPlayerClientFactory({ ctfTeam: CtfTeam.BLUE }) }));

             expect(onSameTeam(ent1, ent2)).toBe(false);
             expect(checkFriendlyFire(ent1, ent2)).toBe(true);
        });

        it('should prevent damage if same team', () => {
             const ent1 = spawnEntity(entities, createPlayerEntityFactory({ client: createPlayerClientFactory({ ctfTeam: CtfTeam.RED }) }));
             const ent2 = spawnEntity(entities, createPlayerEntityFactory({ client: createPlayerClientFactory({ ctfTeam: CtfTeam.RED }) }));

             expect(onSameTeam(ent1, ent2)).toBe(true);
             expect(checkFriendlyFire(ent1, ent2)).toBe(false);
        });

        it('should allow damage if no teams (DM style or NOTEAM)', () => {
             const ent1 = spawnEntity(entities, createPlayerEntityFactory({ client: createPlayerClientFactory({ ctfTeam: CtfTeam.NOTEAM }) }));
             const ent2 = spawnEntity(entities, createPlayerEntityFactory({ client: createPlayerClientFactory({ ctfTeam: CtfTeam.NOTEAM }) }));

             // NOTEAM vs NOTEAM are NOT same team in CTF context (usually)
             expect(onSameTeam(ent1, ent2)).toBe(false);
             expect(checkFriendlyFire(ent1, ent2)).toBe(true);
        });
    });

    describe('Team Skins', () => {
        it('should set skin for Red team', () => {
            const ent = spawnEntity(entities, createPlayerEntityFactory({ client: createPlayerClientFactory() }));
            // setTeamSkin(ent, CtfTeam.RED);
            // expect... placeholder logic for now
        });
    });
});
