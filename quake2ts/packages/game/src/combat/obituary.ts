// =================================================================
// Quake II - Obituaries
// =================================================================

import { Entity, DeadFlag } from '../entities/entity.js';
import { EntitySystem } from '../entities/system.js';
import { DamageMod } from './damageMods.js';
import { ServerCommand } from '@quake2ts/shared';
import { MulticastType } from '../imports.js';
import { createRandomGenerator } from '@quake2ts/shared';

const random = createRandomGenerator();

// Print levels
export const PRINT_LOW = 0;    // pickup messages
export const PRINT_MEDIUM = 1; // death messages
export const PRINT_HIGH = 2;   // critical messages
export const PRINT_CHAT = 3;   // chat messages

export function getGender(ent: Entity): string {
    // Try to get gender from client userinfo if available
    // Assuming userinfo is stored in client property, but structure might vary.
    // For now, default to "male" as in original.
    // Ideally: return ent.client?.userinfo?.gender || "male";
    // But PlayerClient interface needs to be checked.
    return "male";
}

export function ClientObituary(self: Entity, inflictor: Entity | null, attacker: Entity | null, mod: DamageMod, sys: EntitySystem) {
    let message = "";

    // Check if player
    if (self.classname !== 'player') {
        return;
    }

    const friendlyName = self.client ? "Player" : "Player"; // Todo: get name from userinfo
    const gender = getGender(self);
    const him = gender === "female" ? "her" : "him";
    const his = gender === "female" ? "her" : "his";

    if (attacker && attacker.classname === 'worldspawn') {
        attacker = null;
    }

    if (mod === DamageMod.SUICIDE) {
        message = `${friendlyName} suicides.`;
    } else if (mod === DamageMod.FALLING) {
        message = `${friendlyName} cratered.`;
    } else if (mod === DamageMod.CRUSH) {
        message = `${friendlyName} was squished.`;
    } else if (mod === DamageMod.WATER) {
        message = `${friendlyName} sank like a rock.`;
    } else if (mod === DamageMod.SLIME) {
        message = `${friendlyName} melted.`;
    } else if (mod === DamageMod.LAVA) {
        message = `${friendlyName} does a back flip into the lava.`;
    } else if (mod === DamageMod.EXPLOSIVE) {
        message = `${friendlyName} blew up.`;
    } else if (mod === DamageMod.TARGET_LASER) {
        message = `${friendlyName} saw the light.`;
    } else if (mod === DamageMod.TARGET_BLASTER) {
        message = `${friendlyName} got blasted.`;
    } else if (mod === DamageMod.BOMB) {
        message = `${friendlyName} was bombed.`;
    } else if (attacker && attacker.classname === 'player') {
         // PvP Death
         if (self === attacker) {
            // Suicide by weapon
             switch (mod) {
                case DamageMod.GRENADE:
                case DamageMod.G_SPLASH:
                case DamageMod.HANDGRENADE:
                case DamageMod.HG_SPLASH:
                    if (gender === "female")
                        message = `${friendlyName} tripped on her own grenade.`;
                    else
                        message = `${friendlyName} tripped on his own grenade.`;
                    break;
                case DamageMod.ROCKET:
                case DamageMod.R_SPLASH:
                    if (gender === "female")
                        message = `${friendlyName} blew herself up.`;
                    else
                        message = `${friendlyName} blew himself up.`;
                    break;
                case DamageMod.BFG_BLAST:
                    message = `${friendlyName} should have used a smaller gun.`;
                    break;
                default:
                    if (gender === "female")
                        message = `${friendlyName} killed herself.`;
                    else
                        message = `${friendlyName} killed himself.`;
                    break;
            }
         } else {
             // Killed by other player
             const attackerName = "Enemy"; // Todo: get name
             switch (mod) {
                case DamageMod.BLASTER:
                    message = `${friendlyName} was blasted by ${attackerName}.`;
                    break;
                case DamageMod.SHOTGUN:
                    message = `${friendlyName} was gunned down by ${attackerName}.`;
                    break;
                case DamageMod.SSHOTGUN:
                    message = `${friendlyName} was blown away by ${attackerName}'s Super Shotgun.`;
                    break;
                case DamageMod.MACHINEGUN:
                    message = `${friendlyName} was machinegunned by ${attackerName}.`;
                    break;
                case DamageMod.CHAINGUN:
                    message = `${friendlyName} was cut in half by ${attackerName}'s Chaingun.`;
                    break;
                case DamageMod.GRENADE:
                    message = `${friendlyName} was popped by ${attackerName}'s Grenade.`;
                    break;
                case DamageMod.G_SPLASH:
                    message = `${friendlyName} was shredded by ${attackerName}'s shrapnel.`;
                    break;
                case DamageMod.ROCKET:
                    message = `${friendlyName} ate ${attackerName}'s rocket.`;
                    break;
                case DamageMod.R_SPLASH:
                    message = `${friendlyName} almost dodged ${attackerName}'s rocket.`;
                    break;
                case DamageMod.HYPERBLASTER:
                    message = `${friendlyName} was melted by ${attackerName}'s Hyperblaster.`;
                    break;
                case DamageMod.RAILGUN:
                    message = `${friendlyName} was railed by ${attackerName}.`;
                    break;
                case DamageMod.BFG_LASER:
                    message = `${friendlyName} saw the pretty lights from ${attackerName}'s BFG.`;
                    break;
                case DamageMod.BFG_BLAST:
                    message = `${friendlyName} was disintegrated by ${attackerName}'s BFG blast.`;
                    break;
                case DamageMod.BFG_EFFECT:
                    message = `${friendlyName} couldn't hide from ${attackerName}'s BFG.`;
                    break;
                case DamageMod.HANDGRENADE:
                    message = `${friendlyName} caught ${attackerName}'s Handgrenade.`;
                    break;
                case DamageMod.HG_SPLASH:
                    message = `${friendlyName} didn't see ${attackerName}'s Handgrenade.`;
                    break;
                case DamageMod.HELD_GRENADE:
                    message = `${friendlyName} feels ${attackerName}'s pain.`;
                    break;
                case DamageMod.TELEFRAG:
                    message = `${friendlyName} tried to invade ${attackerName}'s personal space.`;
                    break;
                default:
                    message = `${friendlyName} was killed by ${attackerName}.`;
                    break;
            }
         }
    } else {
        // PvE Death (killed by monster or world)
        if (attacker) {
             const attackerName = attacker.classname;

             // Generic monster death messages
             message = `${friendlyName} was killed by ${attackerName}.`;

             // Specific monster messages could go here if we had detailed monster names
        } else {
             message = `${friendlyName} died.`;
        }
    }

    if (message) {
        // Send to all clients
        // The 'print' command format: [byte: level] [string: message]
        sys.multicast({x:0,y:0,z:0}, MulticastType.All, ServerCommand.print, PRINT_MEDIUM, message + "\n");
    }
}
