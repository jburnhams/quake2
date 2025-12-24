
import { ProtocolHandler } from './types.js';
import {
    ServerCommand,
    U_ORIGIN1, U_ORIGIN2, U_ANGLE2, U_ANGLE3, U_FRAME8, U_EVENT, U_REMOVE, U_MOREBITS1,
    U_NUMBER16, U_ORIGIN3, U_ANGLE1, U_MODEL, U_RENDERFX8, U_ALPHA, U_EFFECTS8, U_MOREBITS2,
    U_SKIN8, U_FRAME16, U_RENDERFX16, U_EFFECTS16, U_MODEL2, U_MODEL3, U_MODEL4, U_MOREBITS3,
    U_OLDORIGIN, U_SKIN16, U_SOUND, U_SOLID
} from '@quake2ts/shared';
import { EntityState, ProtocolPlayerState, createEmptyProtocolPlayerState } from '../state.js';
import { StreamingBuffer } from '../../stream/streamingBuffer.js';

export class LegacyProtocolHandler implements ProtocolHandler {
    protocolVersion: number;

    constructor(version: number = 0) {
        this.protocolVersion = version;
    }

    translateCommand(cmd: number): ServerCommand {
        // Legacy Q2TS behavior (prior to fix)
        // 7 = ServerData
        // 12 = ServerData
        if (cmd === 7) return ServerCommand.serverdata;
        if (cmd === 12) return ServerCommand.serverdata;

        // Protocol 25/26 mapping (cmd + 5)
        // This was the old logic inside parser.ts
        if (cmd === 0) return ServerCommand.bad;
        const translated = cmd + 5;
        if (translated >= ServerCommand.nop && translated <= ServerCommand.frame) {
            return translated;
        }
        return ServerCommand.bad;
    }

    parseServerData(stream: StreamingBuffer) {
        // Legacy parsing logic
        const protocol = stream.readLong();
        const serverCount = stream.readLong();
        const attractLoop = stream.readByte();
        const gameDir = stream.readString();
        const playerNum = stream.readShort();
        const levelName = stream.readString();
        return {
            protocol, serverCount, attractLoop, gameDir, playerNum, levelName
        };
    }

    parseEntityBits(stream: StreamingBuffer) {
        // Legacy uses same bit parsing as base Q2 usually
        let total = stream.readByte();
        if (total & U_MOREBITS1) total |= (stream.readByte() << 8);
        if (total & U_MOREBITS2) total |= (stream.readByte() << 16);
        if (total & U_MOREBITS3) total |= (stream.readByte() << 24);

        let number: number;
        if (total & U_NUMBER16) number = stream.readShort();
        else number = stream.readByte();

        return { number, bits: total, bitsHigh: 0 };
    }

    parseDelta(from: EntityState, to: EntityState, number: number, bits: number, bitsHigh: number, stream: StreamingBuffer): void {
        // Legacy delta parsing (mostly matching Q2Base)
        to.number = from.number; to.modelindex = from.modelindex; to.modelindex2 = from.modelindex2; to.modelindex3 = from.modelindex3; to.modelindex4 = from.modelindex4;
        to.frame = from.frame; to.skinnum = from.skinnum; to.effects = from.effects; to.renderfx = from.renderfx;
        to.origin.x = from.origin.x; to.origin.y = from.origin.y; to.origin.z = from.origin.z;
        to.old_origin.x = from.origin.x; to.old_origin.y = from.origin.y; to.old_origin.z = from.origin.z;
        to.angles.x = from.angles.x; to.angles.y = from.angles.y; to.angles.z = from.angles.z;
        to.sound = from.sound; to.event = from.event; to.solid = from.solid;
        to.number = number; to.bits = bits;

        if (bits & U_MODEL) to.modelindex = stream.readByte();
        if (bits & U_MODEL2) to.modelindex2 = stream.readByte();
        if (bits & U_MODEL3) to.modelindex3 = stream.readByte();
        if (bits & U_MODEL4) to.modelindex4 = stream.readByte();
        if (bits & U_FRAME8) to.frame = stream.readByte();
        if (bits & U_FRAME16) to.frame = stream.readShort();

        if ((bits & U_SKIN8) && (bits & U_SKIN16)) to.skinnum = stream.readLong();
        else if (bits & U_SKIN8) to.skinnum = stream.readByte();
        else if (bits & U_SKIN16) to.skinnum = stream.readShort();

        if ((bits & U_EFFECTS8) && (bits & U_EFFECTS16)) to.effects = stream.readLong();
        else if (bits & U_EFFECTS8) to.effects = stream.readByte();
        else if (bits & U_EFFECTS16) to.effects = stream.readShort();

        if ((bits & U_RENDERFX8) && (bits & U_RENDERFX16)) to.renderfx = stream.readLong();
        else if (bits & U_RENDERFX8) to.renderfx = stream.readByte();
        else if (bits & U_RENDERFX16) to.renderfx = stream.readShort();

        if (bits & U_ORIGIN1) to.origin.x = stream.readShort() * 0.125;
        if (bits & U_ORIGIN2) to.origin.y = stream.readShort() * 0.125;
        if (bits & U_ORIGIN3) to.origin.z = stream.readShort() * 0.125;

        if (bits & U_ANGLE1) to.angles.x = stream.readByte() * (360.0 / 256);
        if (bits & U_ANGLE2) to.angles.y = stream.readByte() * (360.0 / 256);
        if (bits & U_ANGLE3) to.angles.z = stream.readByte() * (360.0 / 256);

        if (bits & U_OLDORIGIN) {
            to.old_origin.x = stream.readShort() * 0.125;
            to.old_origin.y = stream.readShort() * 0.125;
            to.old_origin.z = stream.readShort() * 0.125;
        }

        if (bits & U_SOUND) to.sound = stream.readByte();
        if (bits & U_EVENT) to.event = stream.readByte(); else to.event = 0;
        if (bits & U_SOLID) to.solid = stream.readShort();
    }

    parsePlayerState(stream: StreamingBuffer): ProtocolPlayerState {
        const ps = createEmptyProtocolPlayerState();
        const flags = stream.readShort();
        if (flags & 1) ps.pm_type = stream.readByte();
        if (flags & 2) {
            ps.origin.x = stream.readShort() * 0.125;
            ps.origin.y = stream.readShort() * 0.125;
            ps.origin.z = stream.readShort() * 0.125;
        }
        if (flags & 4) {
            ps.velocity.x = stream.readShort() * 0.125;
            ps.velocity.y = stream.readShort() * 0.125;
            ps.velocity.z = stream.readShort() * 0.125;
        }
        if (flags & 8) ps.pm_time = stream.readByte();
        if (flags & 16) ps.pm_flags = stream.readByte();
        if (flags & 32) ps.gravity = stream.readShort();
        if (flags & 64) {
            ps.delta_angles.x = stream.readShort() * (180 / 32768);
            ps.delta_angles.y = stream.readShort() * (180 / 32768);
            ps.delta_angles.z = stream.readShort() * (180 / 32768);
        }
        if (flags & 128) {
            ps.viewoffset.x = (stream.readByte() << 24 >> 24) * 0.25;
            ps.viewoffset.y = (stream.readByte() << 24 >> 24) * 0.25;
            ps.viewoffset.z = (stream.readByte() << 24 >> 24) * 0.25;
        }
        if (flags & 256) {
            ps.viewangles.x = stream.readShort() * (360.0 / 65536);
            ps.viewangles.y = stream.readShort() * (360.0 / 65536);
            ps.viewangles.z = stream.readShort() * (360.0 / 65536);
        }
        if (flags & 512) {
            ps.kick_angles.x = (stream.readByte() << 24 >> 24) * 0.25;
            ps.kick_angles.y = (stream.readByte() << 24 >> 24) * 0.25;
            ps.kick_angles.z = (stream.readByte() << 24 >> 24) * 0.25;
        }
        if (flags & 4096) ps.gun_index = stream.readByte();
        if (flags & 8192) {
            ps.gun_frame = stream.readByte();
            ps.gun_offset.x = (stream.readByte() << 24 >> 24) * 0.25;
            ps.gun_offset.y = (stream.readByte() << 24 >> 24) * 0.25;
            ps.gun_offset.z = (stream.readByte() << 24 >> 24) * 0.25;
            ps.gun_angles.x = (stream.readByte() << 24 >> 24) * 0.25;
            ps.gun_angles.y = (stream.readByte() << 24 >> 24) * 0.25;
            ps.gun_angles.z = (stream.readByte() << 24 >> 24) * 0.25;
        }
        if (flags & 1024) {
            ps.blend[0] = stream.readByte();
            ps.blend[1] = stream.readByte();
            ps.blend[2] = stream.readByte();
            ps.blend[3] = stream.readByte();
        }
        if (flags & 2048) ps.fov = stream.readByte();
        if (flags & 16384) ps.rdflags = stream.readByte();
        if (flags & 32768) ps.watertype = stream.readByte();

        const statbits = stream.readLong();
        for (let i = 0; i < 32; i++) {
            if (statbits & (1 << i)) ps.stats[i] = stream.readShort();
        }
        return ps;
    }
}
