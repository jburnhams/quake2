import { BinaryWriter, ServerCommand, TempEntity, Vec3 } from '@quake2ts/shared';
import { Entity } from '@quake2ts/game';

/**
 * Writes a server command and its arguments to a BinaryWriter.
 * This handles the serialization of generic arguments passed to multicast/unicast
 * into the specific binary format expected by the protocol.
 */
export function writeServerCommand(writer: BinaryWriter, event: ServerCommand, ...args: any[]): void {
    writer.writeByte(event);

    switch (event) {
        case ServerCommand.print: {
            // args: [level: number, text: string]
            const level = args[0] as number;
            const text = args[1] as string;
            writer.writeByte(level);
            writer.writeString(text);
            break;
        }

        case ServerCommand.centerprint: {
            // args: [text: string]
            const text = args[0] as string;
            writer.writeString(text);
            break;
        }

        case ServerCommand.stufftext: {
            // args: [text: string]
            const text = args[0] as string;
            writer.writeString(text);
            break;
        }

        case ServerCommand.sound: {
            // args: [flags, soundNum, volume?, attenuation?, offset?, ent?, pos?]
            const flags = args[0] as number;
            const soundNum = args[1] as number;
            const volume = args[2] as number | undefined;
            const attenuation = args[3] as number | undefined;
            const offset = args[4] as number | undefined;
            const ent = args[5] as number | undefined;
            const pos = args[6] as Vec3 | undefined;

            writer.writeByte(flags);
            writer.writeByte(soundNum);

            if (flags & 1) { // SND_VOLUME
                writer.writeByte(volume || 0);
            }
            if (flags & 2) { // SND_ATTENUATION
                writer.writeByte(attenuation || 0);
            }
            if (flags & 16) { // SND_OFFSET
                writer.writeByte(offset || 0);
            }
            if (flags & 8) { // SND_ENT
                writer.writeShort(ent || 0);
            }
            if (flags & 4) { // SND_POS
                if (pos) {
                    writer.writePos(pos);
                } else {
                    writer.writePos({x:0, y:0, z:0});
                }
            }
            break;
        }

        case ServerCommand.muzzleflash: {
            // args: [entityIndex: number, flashType: number]
            const entIndex = args[0] as number;
            const flashType = args[1] as number;
            writer.writeShort(entIndex);
            writer.writeByte(flashType);
            break;
        }

        case ServerCommand.temp_entity: {
            // args: [type: TempEntity, ...params]
            const type = args[0] as TempEntity;
            writer.writeByte(type);
            writeTempEntity(writer, type, args.slice(1));
            break;
        }

        default:
            console.warn(`writeServerCommand: Unhandled command ${event}`);
            break;
    }
}

function writeTempEntity(writer: BinaryWriter, type: TempEntity, args: any[]): void {
    switch (type) {
        case TempEntity.ROCKET_EXPLOSION:
        case TempEntity.GRENADE_EXPLOSION:
        case TempEntity.EXPLOSION1:
        case TempEntity.EXPLOSION2:
        case TempEntity.ROCKET_EXPLOSION_WATER:
        case TempEntity.GRENADE_EXPLOSION_WATER:
        case TempEntity.BFG_EXPLOSION:
        case TempEntity.BFG_BIGEXPLOSION:
        case TempEntity.PLASMA_EXPLOSION:
        case TempEntity.PLAIN_EXPLOSION:
        case TempEntity.TRACKER_EXPLOSION:
        case TempEntity.EXPLOSION1_BIG:
        case TempEntity.EXPLOSION1_NP:
        case TempEntity.EXPLOSION1_NL:
        case TempEntity.EXPLOSION2_NL:
        case TempEntity.BERSERK_SLAM:
            // Format: [pos]
            writer.writePos(args[0] as Vec3);
            break;

        case TempEntity.BLASTER:
        case TempEntity.FLECHETTE:
            // Format: [pos, dir]
            writer.writePos(args[0] as Vec3);
            writer.writeDir(args[1] as Vec3);
            break;

        case TempEntity.RAILTRAIL:
        case TempEntity.DEBUGTRAIL:
        case TempEntity.BUBBLETRAIL:
        case TempEntity.BUBBLETRAIL2:
        case TempEntity.BFG_LASER:
        case TempEntity.LIGHTNING_BEAM:
        case TempEntity.LIGHTNING:
            // Format: [start, end]
            writer.writePos(args[0] as Vec3);
            writer.writePos(args[1] as Vec3);
            break;

        case TempEntity.LASER_SPARKS:
        case TempEntity.WELDING_SPARKS:
        case TempEntity.TUNNEL_SPARKS:
        case TempEntity.ELECTRIC_SPARKS:
        case TempEntity.HEATBEAM_SPARKS:
        case TempEntity.HEATBEAM_STEAM:
        case TempEntity.STEAM:
            // Format: [count, pos, dir, color?]
            // Q2: writeByte(count), writePos(start), writeDir(normal), writeByte(skin/color)
            writer.writeByte(args[0] as number);
            writer.writePos(args[1] as Vec3);
            writer.writeDir(args[2] as Vec3);
            writer.writeByte(args[3] as number || 0);
            break;

        case TempEntity.PARASITE_ATTACK:
        case TempEntity.MEDIC_CABLE_ATTACK:
            // Format: [entIndex, start, end]
            // args[0] is Entity usually
            const ent = args[0] as Entity;
            writer.writeShort(ent ? ent.index : 0);
            writer.writePos(args[1] as Vec3);
            writer.writePos(args[2] as Vec3);
            break;

        case TempEntity.GUNSHOT:
        case TempEntity.BLOOD:
        case TempEntity.SPARKS:
        case TempEntity.BULLET_SPARKS:
        case TempEntity.SCREEN_SPARKS:
        case TempEntity.SHIELD_SPARKS:
            // Format: [pos, dir]
            writer.writePos(args[0] as Vec3);
            writer.writeDir(args[1] as Vec3);
            break;

        case TempEntity.SPLASH:
        case TempEntity.POWER_SPLASH:
        case TempEntity.WIDOWSPLASH:
            // Format: [count, pos, dir, color]
            writer.writeByte(args[0] as number);
            writer.writePos(args[1] as Vec3);
            writer.writeDir(args[2] as Vec3);
            writer.writeByte(args[3] as number || 0);
            break;

        default:
            console.warn(`writeTempEntity: Unhandled TempEntity ${type}`);
            break;
    }
}
