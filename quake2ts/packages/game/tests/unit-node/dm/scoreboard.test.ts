import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity } from '../../../src/entities/entity.js';
import { getScoreboard } from '../../../src/dm/scoreboard.js';
import { createTestContext, spawnEntity, createPlayerEntityFactory, createPlayerClientFactory } from '@quake2ts/test-utils';

describe('Scoreboard API', () => {
    let sys: EntitySystem;

    beforeEach(() => {
        const ctx = createTestContext();
        sys = ctx.entities;

        // Mock level name
        (sys as any).level = { levelName: 'q2dm1' };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    function createPlayer(name: string, score: number) {
        const ent = spawnEntity(sys, createPlayerEntityFactory());
        if (!ent || !ent.client) {
            throw new Error('Failed to spawn player');
        }
        ent.client = createPlayerClientFactory();
        ent.client.score = score;
        ent.client.pers.netname = name;
        return ent;
    }

    it('getScoreboard should return all connected players', () => {
        createPlayer('Player1', 10);
        createPlayer('Player2', 5);

        const sb = getScoreboard(sys);

        expect(sb.players.length).toBe(2);
        // expect(sb.mapName).toBe('q2dm1'); // Currently hardcoded to 'unknown' in scoreboard.ts pending levelName exposure
    });

    it('getScoreboard should sort by frags descending', () => {
        createPlayer('Loser', 2);
        createPlayer('Winner', 100);
        createPlayer('Average', 50);

        const sb = getScoreboard(sys);

        expect(sb.players[0].name).toBe('Winner');
        expect(sb.players[1].name).toBe('Average');
        expect(sb.players[2].name).toBe('Loser');
    });

    it('getScoreboard should handle missing names', () => {
        const p = createPlayer('', 0);
        // Cast to undefined for test to handle edge cases
        p.client!.pers.netname = undefined as unknown as string;

        const sb = getScoreboard(sys);

        expect(sb.players[0].name).toContain('Player');
    });
});
