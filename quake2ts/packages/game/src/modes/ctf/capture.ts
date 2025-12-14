// =================================================================
// Quake II - CTF Capture Logic
// =================================================================

import { Entity, Solid } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { FlagEntity, FlagState, setFlagState } from './state.js';
import { GameExports } from '../../index.js';
import { KeyId, hasKey } from '../../inventory/playerInventory.js';
import { addTeamScore, CtfTeam } from './scoreboard.js';

export function checkCapture(
    flag: FlagEntity,
    player: Entity,
    game: GameExports,
    context: EntitySystem
): boolean {
    if (!player.client) return false;

    // Determine player team
    const playerTeam = (player.client as any).team || 'red';

    // We are checking if the player is touching their OWN flag at base
    if (flag.flagTeam !== playerTeam) {
        return false;
    }

    if (flag.flagState !== FlagState.AT_BASE) {
        return false;
    }

    // Does player have the enemy flag?
    const enemyFlagKey = playerTeam === 'red' ? KeyId.BlueFlag : KeyId.RedFlag;

    if (hasKey(player.client.inventory, enemyFlagKey)) {
        return captureFlag(flag, player, game, context);
    }

    return false;
}

export function captureFlag(
    ownFlag: FlagEntity,
    player: Entity,
    game: GameExports,
    context: EntitySystem
): boolean {
    if (!player.client) return false;

    const playerTeam = (player.client as any).team || 'red';
    const enemyTeam = playerTeam === 'red' ? 'blue' : 'red';

    // 1. Award points
    // Player capture bonus (usually 5)
    // We increment the capture count in stats, which will be calculated into score
    const ctfStats = player.client.ctfStats;
    if (ctfStats) {
        ctfStats.captures++;
    }

    // Also update raw score for compatibility/immediate display?
    if (player.client.score !== undefined) {
        player.client.score += 5; // Bonus
    } else {
        player.client.score = 5;
    }

    // Team score
    const teamEnum = playerTeam === 'red' ? CtfTeam.RED : CtfTeam.BLUE;
    addTeamScore(teamEnum, 1);

    game.sound?.(player, 0, 'ctf/flagcap.wav', 1, 1, 0);
    game.centerprintf?.(player, 'You captured the flag!');
    // Broadcast message
    // game.bprint(`${player.netname} captured the ${enemyTeam} flag!`);

    // 2. Remove enemy flag from player inventory
    const enemyFlagKey = playerTeam === 'red' ? KeyId.BlueFlag : KeyId.RedFlag;
    player.client.inventory.keys.delete(enemyFlagKey);

    // 3. Reset enemy flag entity
    context.forEachEntity((ent) => {
        const flag = ent as FlagEntity;
        if ((flag.classname === 'item_flag_team1' || flag.classname === 'item_flag_team2') && flag.flagTeam === enemyTeam) {
             setFlagState(flag, FlagState.AT_BASE, context);
             flag.origin = { ...flag.baseOrigin };
             flag.solid = Solid.Trigger;
             flag.owner = null;
             flag.model = flag.flagTeam === 'red' ? 'players/male/flag1.md2' : 'players/male/flag2.md2';
             flag.svflags &= ~1;
        }
    });

    return true;
}
