import { Entity } from '../entities/entity.js';
import { EntitySystem } from '../entities/system.js';
import { GameExports } from '../index.js';

export function cmd_say(sys: EntitySystem, sender: Entity | null, text: string, team: boolean) {
    if (!text || text.trim().length === 0) return;

    const senderName = sender && sender.client ? (sender.client.pers.netname || `Player ${sender.index - 1}`) : 'Console';
    const message = `${senderName}: ${text}`;

    if (team && sender && sender.client) {
        sys.imports.serverCommand(`print 2 "[TEAM] ${message}\n"`);
    } else {
        sys.imports.serverCommand(`print 2 "${message}\n"`);
    }
}
