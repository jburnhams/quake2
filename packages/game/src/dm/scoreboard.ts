import { EntitySystem } from '../entities/system.js';
import { Entity } from '../entities/entity.js';

export interface PlayerScore {
    name: string;
    frags: number;
    deaths: number;
    ping: number;
    clientIndex: number;
    startTime: number;
}

export interface ScoreboardData {
    mapName: string;
    players: PlayerScore[];
}

export function getScoreboard(sys: EntitySystem): ScoreboardData {
    const players: PlayerScore[] = [];

    sys.forEachEntity((ent) => {
        if (ent.client) { // Only clients
            players.push({
                name: ent.client.pers.netname || `Player ${ent.index - 1}`,
                frags: (ent.client as any).score || 0,
                deaths: 0,
                ping: 0,
                clientIndex: ent.index - 1,
                startTime: 0
            });
        }
    });

    // Sort by frags descending
    players.sort((a, b) => b.frags - a.frags);

    return {
        mapName: 'unknown',
        players
    };
}
