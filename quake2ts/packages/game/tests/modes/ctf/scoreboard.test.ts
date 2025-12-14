import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateCtfScoreboard, teamScores, CtfTeam, addTeamScore } from '../../../src/modes/ctf/scoreboard.js';
import { Entity } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { PlayerStat } from '@quake2ts/shared';
import { ClientWithTeam } from '../../../src/modes/ctf/teams.js';

describe('CTF Scoreboard', () => {
    let player: Entity;
    let context: EntitySystem;

    beforeEach(() => {
        player = {
            client: {
                stats: new Array(64).fill(0),
                ctfStats: {
                    captures: 0,
                    returns: 0,
                    defends: 0,
                    assists: 0
                },
                // Add unknown casting to bypass strict type check for team in test
            } as any
        } as unknown as Entity;
        (player.client as unknown as ClientWithTeam).ctfTeam = CtfTeam.RED;

        context = {
            configStringIndex: vi.fn().mockReturnValue(100),
        } as unknown as EntitySystem;

        // Reset scores
        teamScores[CtfTeam.RED] = 0;
        teamScores[CtfTeam.BLUE] = 0;
    });

    it('should update STAT_CTF_TEAMINFO', () => {
        updateCtfScoreboard(player, context);
        expect(player.client!.stats[PlayerStat.STAT_CTF_TEAMINFO]).toBe(1);
    });

    it('should set team pics and scores', () => {
        addTeamScore(CtfTeam.RED, 5);
        addTeamScore(CtfTeam.BLUE, 3);

        updateCtfScoreboard(player, context);

        expect(player.client!.stats[PlayerStat.STAT_CTF_TEAM1_CAPS]).toBe(5);
        expect(player.client!.stats[PlayerStat.STAT_CTF_TEAM2_CAPS]).toBe(3);

        // Check pics (mocked to return 100)
        expect(player.client!.stats[PlayerStat.STAT_CTF_TEAM1_PIC]).toBe(100);
        expect(player.client!.stats[PlayerStat.STAT_CTF_TEAM2_PIC]).toBe(100);
    });

    it('should set joined team pics correctly for RED team', () => {
        (player.client as unknown as ClientWithTeam).ctfTeam = CtfTeam.RED;
        updateCtfScoreboard(player, context);
        expect(player.client!.stats[PlayerStat.STAT_CTF_JOINED_TEAM1_PIC]).toBe(100);
        expect(player.client!.stats[PlayerStat.STAT_CTF_JOINED_TEAM2_PIC]).toBe(0);
    });

    it('should set joined team pics correctly for BLUE team', () => {
        (player.client as unknown as ClientWithTeam).ctfTeam = CtfTeam.BLUE;
        updateCtfScoreboard(player, context);
        expect(player.client!.stats[PlayerStat.STAT_CTF_JOINED_TEAM1_PIC]).toBe(0);
        expect(player.client!.stats[PlayerStat.STAT_CTF_JOINED_TEAM2_PIC]).toBe(100);
    });
});
