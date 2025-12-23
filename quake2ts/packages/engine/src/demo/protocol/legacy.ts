
import { ProtocolHandler } from './types.js';
import { ServerCommand } from '@quake2ts/shared';
import {
    EntityState, ProtocolPlayerState, createEmptyProtocolPlayerState,
    U_ORIGIN1, U_ORIGIN2, U_ANGLE2, U_ANGLE3, U_FRAME8, U_EVENT, U_REMOVE, U_MOREBITS1,
    U_NUMBER16, U_ORIGIN3, U_ANGLE1, U_MODEL, U_RENDERFX8, U_ALPHA, U_EFFECTS8, U_MOREBITS2,
    U_SKIN8, U_FRAME16, U_RENDERFX16, U_EFFECTS16, U_MODEL2, U_MODEL3, U_MODEL4, U_MOREBITS3,
    U_OLDORIGIN, U_SKIN16, U_SOUND, U_SOLID
} from '../parser.js';
import { StreamingBuffer } from '../../stream/streamingBuffer.js';

export class LegacyProtocolHandler implements ProtocolHandler {
    protocolVersion = 0; // Or whatever legacy tests use

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
        const mutableTo = to as any;

        mutableTo.number = from.number;
        mutableTo.modelIndex = from.modelIndex;
        mutableTo.modelIndex2 = from.modelIndex2;
        mutableTo.modelIndex3 = from.modelIndex3;
        mutableTo.modelIndex4 = from.modelIndex4;
        mutableTo.frame = from.frame;
        mutableTo.skinNum = from.skinNum;
        mutableTo.effects = from.effects;
        mutableTo.renderfx = from.renderfx;
        mutableTo.origin.x = from.origin.x;
        mutableTo.origin.y = from.origin.y;
        mutableTo.origin.z = from.origin.z;
        if (from.oldOrigin) {
            if (!mutableTo.oldOrigin) mutableTo.oldOrigin = { x: 0, y: 0, z: 0 };
            mutableTo.oldOrigin.x = from.oldOrigin.x;
            mutableTo.oldOrigin.y = from.oldOrigin.y;
            mutableTo.oldOrigin.z = from.oldOrigin.z;
        } else if (from.origin) {
            if (!mutableTo.oldOrigin) mutableTo.oldOrigin = { x: 0, y: 0, z: 0 };
             mutableTo.oldOrigin.x = from.origin.x;
             mutableTo.oldOrigin.y = from.origin.y;
             mutableTo.oldOrigin.z = from.origin.z;
        }
        mutableTo.angles.x = from.angles.x;
        mutableTo.angles.y = from.angles.y;
        mutableTo.angles.z = from.angles.z;
        mutableTo.sound = from.sound ?? 0;
        mutableTo.event = from.event ?? 0;
        mutableTo.solid = from.solid;
        mutableTo.number = number;
        mutableTo.bits = bits;
        mutableTo.bitsHigh = bitsHigh;

        if (bits & U_MODEL) mutableTo.modelIndex = stream.readByte();
        if (bits & U_MODEL2) mutableTo.modelIndex2 = stream.readByte();
        if (bits & U_MODEL3) mutableTo.modelIndex3 = stream.readByte();
        if (bits & U_MODEL4) mutableTo.modelIndex4 = stream.readByte();
        if (bits & U_FRAME8) mutableTo.frame = stream.readByte();
        if (bits & U_FRAME16) mutableTo.frame = stream.readShort();

        if ((bits & U_SKIN8) && (bits & U_SKIN16)) mutableTo.skinNum = stream.readLong();
        else if (bits & U_SKIN8) mutableTo.skinNum = stream.readByte();
        else if (bits & U_SKIN16) mutableTo.skinNum = stream.readShort();

        if ((bits & U_EFFECTS8) && (bits & U_EFFECTS16)) mutableTo.effects = stream.readLong();
        else if (bits & U_EFFECTS8) mutableTo.effects = stream.readByte();
        else if (bits & U_EFFECTS16) mutableTo.effects = stream.readShort();

        if ((bits & U_RENDERFX8) && (bits & U_RENDERFX16)) mutableTo.renderfx = stream.readLong();
        else if (bits & U_RENDERFX8) mutableTo.renderfx = stream.readByte();
        else if (bits & U_RENDERFX16) mutableTo.renderfx = stream.readShort();

        if (bits & U_ORIGIN1) mutableTo.origin.x = stream.readShort() * 0.125;
        if (bits & U_ORIGIN2) mutableTo.origin.y = stream.readShort() * 0.125;
        if (bits & U_ORIGIN3) mutableTo.origin.z = stream.readShort() * 0.125;

        if (bits & U_ANGLE1) mutableTo.angles.x = stream.readByte() * (360.0 / 256);
        if (bits & U_ANGLE2) mutableTo.angles.y = stream.readByte() * (360.0 / 256);
        if (bits & U_ANGLE3) mutableTo.angles.z = stream.readByte() * (360.0 / 256);

        if (bits & U_OLDORIGIN) {
            if (!mutableTo.oldOrigin) mutableTo.oldOrigin = { x: 0, y: 0, z: 0 };
            mutableTo.oldOrigin.x = stream.readShort() * 0.125;
            mutableTo.oldOrigin.y = stream.readShort() * 0.125;
            mutableTo.oldOrigin.z = stream.readShort() * 0.125;
        }

        if (bits & U_SOUND) mutableTo.sound = stream.readByte();
        if (bits & U_EVENT) mutableTo.event = stream.readByte(); else mutableTo.event = 0;
        if (bits & U_SOLID) mutableTo.solid = stream.readShort();
    }

    parsePlayerState(stream: StreamingBuffer): ProtocolPlayerState {
        const ps = createEmptyProtocolPlayerState();
        const mutablePs = ps as any;
        const flags = stream.readShort();
        if (flags & 1) mutablePs.pm_type = stream.readByte();
        if (flags & 2) {
            mutablePs.origin.x = stream.readShort() * 0.125;
            mutablePs.origin.y = stream.readShort() * 0.125;
            mutablePs.origin.z = stream.readShort() * 0.125;
        }
        if (flags & 4) {
            mutablePs.velocity.x = stream.readShort() * 0.125;
            mutablePs.velocity.y = stream.readShort() * 0.125;
            mutablePs.velocity.z = stream.readShort() * 0.125;
        }
        if (flags & 8) mutablePs.pm_time = stream.readByte();
        if (flags & 16) mutablePs.pm_flags = stream.readByte();
        if (flags & 32) mutablePs.gravity = stream.readShort();
        if (flags & 64) {
            mutablePs.delta_angles.x = stream.readShort() * (180 / 32768);
            mutablePs.delta_angles.y = stream.readShort() * (180 / 32768);
            mutablePs.delta_angles.z = stream.readShort() * (180 / 32768);
        }
        if (flags & 128) {
            mutablePs.viewoffset.x = (stream.readByte() << 24 >> 24) * 0.25;
            mutablePs.viewoffset.y = (stream.readByte() << 24 >> 24) * 0.25;
            mutablePs.viewoffset.z = (stream.readByte() << 24 >> 24) * 0.25;
        }
        if (flags & 256) {
            mutablePs.viewangles.x = stream.readShort() * (360.0 / 65536);
            mutablePs.viewangles.y = stream.readShort() * (360.0 / 65536);
            mutablePs.viewangles.z = stream.readShort() * (360.0 / 65536);
        }
        if (flags & 512) {
            mutablePs.kick_angles.x = (stream.readByte() << 24 >> 24) * 0.25;
            mutablePs.kick_angles.y = (stream.readByte() << 24 >> 24) * 0.25;
            mutablePs.kick_angles.z = (stream.readByte() << 24 >> 24) * 0.25;
        }
        if (flags & 4096) mutablePs.gun_index = stream.readByte();
        if (flags & 8192) {
            mutablePs.gun_frame = stream.readByte();
            mutablePs.gun_offset.x = (stream.readByte() << 24 >> 24) * 0.25;
            mutablePs.gun_offset.y = (stream.readByte() << 24 >> 24) * 0.25;
            mutablePs.gun_offset.z = (stream.readByte() << 24 >> 24) * 0.25;
            mutablePs.gun_angles.x = (stream.readByte() << 24 >> 24) * 0.25;
            mutablePs.gun_angles.y = (stream.readByte() << 24 >> 24) * 0.25;
            mutablePs.gun_angles.z = (stream.readByte() << 24 >> 24) * 0.25;
        }
        if (flags & 1024) {
            mutablePs.blend[0] = stream.readByte();
            mutablePs.blend[1] = stream.readByte();
            mutablePs.blend[2] = stream.readByte();
            mutablePs.blend[3] = stream.readByte();
        }
        if (flags & 2048) mutablePs.fov = stream.readByte();
        if (flags & 16384) mutablePs.rdflags = stream.readByte();
        if (flags & 32768) mutablePs.watertype = stream.readByte();

        const statbits = stream.readLong();
        for (let i = 0; i < 32; i++) {
            if (statbits & (1 << i)) ps.stats[i] = stream.readShort();
        }
        return ps;
    }
}
