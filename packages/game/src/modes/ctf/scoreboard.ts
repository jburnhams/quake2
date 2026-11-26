// =================================================================
// Quake II - CTF Scoreboard & Scoring
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { PlayerStat, ConfigStringIndex, ServerCommand } from '@quake2ts/shared';
import { CtfTeam, countPlayersOnTeam, getTeamName, ClientWithTeam } from './teams.js';
export { CtfTeam };
// import { GameExports } from '../../index.js'; // Avoid circular dependency if unused

// CTF Stats tracked per client
export interface CtfPlayerStats {
    captures: number;
    returns: number;
    defends: number;
    assists: number;
}

// Extend PlayerClient to include stats
declare module '../../inventory/playerInventory.js' {
    interface PlayerClient {
        ctfStats?: CtfPlayerStats;
    }
}

// Team scores
export let teamScores = {
    [CtfTeam.RED]: 0,
    [CtfTeam.BLUE]: 0
};

export function resetTeamScores() {
    teamScores[CtfTeam.RED] = 0;
    teamScores[CtfTeam.BLUE] = 0;
}

export function addTeamScore(team: CtfTeam, points: number) {
    if (team === CtfTeam.RED || team === CtfTeam.BLUE) {
        teamScores[team] += points;
    }
}

export function initPlayerCtfStats(client: any) {
    if (!client.ctfStats) {
        client.ctfStats = {
            captures: 0,
            returns: 0,
            defends: 0,
            assists: 0
        };
    }
}

/**
 * Calculates the total score for a player in CTF mode.
 * Formula from g_ctf.c:
 * score = frags + (captures * 5) + returns + defends + assists
 */
export function calculatePlayerScore(ent: Entity): number {
    if (!ent.client) return 0;

    // We assume 'frags' is available via some mechanism, usually updated elsewhere
    // If client.score is used for frags in base game:
    const frags = ent.client.score || 0;

    // In CTF, the client.score is typically overwritten by the total CTF score for the scoreboard sorting,
    // OR we separate frags and CTF score.
    // However, if we look at `g_ctf.c`, the scoreboard calculation sums up everything.
    // If we want to return the total score:

    const stats = (ent.client as any).ctfStats as CtfPlayerStats;
    if (!stats) return frags;

    // Bonus points
    // Note: If ent.client.score tracks just frags, we add bonus.
    // If ent.client.score tracks total score, we just return it.
    // But usually we recalculate it for the scoreboard.

    const bonus = (stats.captures * 5) +
                  (stats.returns * 1) +
                  (stats.defends * 1) +
                  (stats.assists * 1);

    // Assuming ent.client.score is ONLY frags in this implementation context
    // because we increment captures separately.

    return frags + bonus;
}

/**
 * Updates the STAT_ keys for the client to display the scoreboard properly.
 * This is called during player think or before sending the frame.
 */
export function updateCtfScoreboard(ent: Entity, sys: EntitySystem) {
    if (!ent.client || !ent.client.stats) return;

    const stats = ent.client.stats; // network stats array

    // 1. Set Team Graphics (Pics)
    // We need to look up config string indices for these pics.
    // 'pics/ctf_r.pcx' and 'pics/ctf_b.pcx' should be precached.

    stats[PlayerStat.STAT_CTF_TEAM1_PIC] = sys.configStringIndex ? sys.configStringIndex("pics/ctf_r.pcx") : 0;
    stats[PlayerStat.STAT_CTF_TEAM1_CAPS] = teamScores[CtfTeam.RED];

    stats[PlayerStat.STAT_CTF_TEAM2_PIC] = sys.configStringIndex ? sys.configStringIndex("pics/ctf_b.pcx") : 0;
    stats[PlayerStat.STAT_CTF_TEAM2_CAPS] = teamScores[CtfTeam.BLUE];

    // 2. Set Current Player Team Graphic
    const clientTeam = (ent.client as unknown as ClientWithTeam).ctfTeam;

    // Clear joined pics first
    stats[PlayerStat.STAT_CTF_JOINED_TEAM1_PIC] = 0;
    stats[PlayerStat.STAT_CTF_JOINED_TEAM2_PIC] = 0;

    if (clientTeam === CtfTeam.RED) {
        stats[PlayerStat.STAT_CTF_JOINED_TEAM1_PIC] = sys.configStringIndex ? sys.configStringIndex("pics/ctf_r.pcx") : 0;
    } else if (clientTeam === CtfTeam.BLUE) {
        stats[PlayerStat.STAT_CTF_JOINED_TEAM2_PIC] = sys.configStringIndex ? sys.configStringIndex("pics/ctf_b.pcx") : 0;
    }

    // 4. Scoreboard Layout
    // Enable the CTF scoreboard layout
    stats[PlayerStat.STAT_CTF_TEAMINFO] = 1; // Enable CTF HUD/Scoreboard elements
}
