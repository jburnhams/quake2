// =================================================================
// Quake II - CTF Team Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { GameExports } from '../../index.js';
import { ServerCommand } from '@quake2ts/shared';

export enum CtfTeam {
    NOTEAM = 0,
    RED = 1,
    BLUE = 2
}

export interface ClientWithTeam {
    ctfTeam: CtfTeam;
    lastTeamSwitchTime?: number;
}

export function getTeamName(team: CtfTeam): string {
    switch (team) {
        case CtfTeam.RED: return "RED";
        case CtfTeam.BLUE: return "BLUE";
        default: return "UNKNOWN";
    }
}

export function getOtherTeam(team: CtfTeam): CtfTeam {
    if (team === CtfTeam.RED) return CtfTeam.BLUE;
    if (team === CtfTeam.BLUE) return CtfTeam.RED;
    return CtfTeam.NOTEAM;
}

/**
 * Assigns a player to a team.
 * If team is NOTEAM, it balances teams.
 */
export function assignTeam(client: ClientWithTeam, desiredTeam: CtfTeam, entities: EntitySystem, game: GameExports): void {
    let team = desiredTeam;

    if (team === CtfTeam.NOTEAM) {
        const redCount = countPlayersOnTeam(CtfTeam.RED, entities);
        const blueCount = countPlayersOnTeam(CtfTeam.BLUE, entities);

        if (redCount < blueCount) {
            team = CtfTeam.RED;
        } else if (blueCount < redCount) {
            team = CtfTeam.BLUE;
        } else {
            // Equal, random pick
            team = (Math.random() < 0.5) ? CtfTeam.RED : CtfTeam.BLUE;
        }
    }

    // Assign
    client.ctfTeam = team;

    // Set skin based on team
    // Note: 'client' here is likely a PlayerClient object, but we might need the Entity to set skin
    // However, ClientWithTeam interface is likely extended by PlayerClient.
    // If we have the Entity, we can set entity.skinNum

    // TODO: Need mechanism to access Entity from client to set skin/model properly if this function is only passed the client data object.
    // Assuming assignTeam is called during ClientConnect or ClientBegin where we have the entity or return it.

    // For now, let's assume we handle skin setting in setTeamSkin helper
}

export function countPlayersOnTeam(team: CtfTeam, entities: EntitySystem): number {
    let count = 0;
    entities.forEachEntity((ent) => {
        if (ent.client && (ent.client as unknown as ClientWithTeam).ctfTeam === team) {
            count++;
        }
    });
    return count;
}

export function setTeamSkin(entity: Entity, team: CtfTeam): void {
    if (!entity.client) return;

    // Typical Q2 CTF skins:
    // Red: male/ctf_r
    // Blue: male/ctf_b
    // (Or similar depending on model)

    // We assume default model is male/tris.md2 or similar.
    // In Q2 CTF it often forced a specific model/skin combo.

    let skinName = "male/grunt"; // Default fallback

    if (team === CtfTeam.RED) {
        skinName = "male/ctf_r";
    } else if (team === CtfTeam.BLUE) {
        skinName = "male/ctf_b";
    }

    // We might need to set configstring for player skin if that's how it's networked
    // But entity.skin might be an index.
    // In this engine port, skin is often an index or we use configstrings.

    // If entity.skin is a number, we need to lookup the skin index.
    // Assuming we have a way to resolve skin name to index or set it via userInfo.

    // For now, we'll placeholder this logic as setting a property on client or userinfo.
    // (entity.client as any).skin = skinName;
}

/**
 * Checks if damage should be applied (Friendly Fire logic)
 * Returns true if damage allowed, false otherwise.
 */
export function onSameTeam(ent1: Entity, ent2: Entity): boolean {
    if (!ent1.client || !ent2.client) return false;

    const client1 = ent1.client as unknown as ClientWithTeam;
    const client2 = ent2.client as unknown as ClientWithTeam;

    // If either is NOTEAM, they are not on same team (or are they?)
    // Usually NOTEAM vs NOTEAM is DM (everyone enemies)
    if (client1.ctfTeam === CtfTeam.NOTEAM || client2.ctfTeam === CtfTeam.NOTEAM) return false;

    return client1.ctfTeam === client2.ctfTeam;
}

export function checkFriendlyFire(targ: Entity, attacker: Entity): boolean {
    // If not on same team, damage always allowed
    if (!onSameTeam(targ, attacker)) return true;

    // If on same team, check friendly fire cvar (default to false/0)
    // We need access to game/cvar.
    // For now, we'll default to NO friendly fire as per task requirement "Default: no friendly fire".

    return false;
}
