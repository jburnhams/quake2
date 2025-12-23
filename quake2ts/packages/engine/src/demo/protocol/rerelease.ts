
import { ProtocolHandler } from './types.js';
import { ServerCommand } from '@quake2ts/shared';
import {
    EntityState, ProtocolPlayerState, createEmptyProtocolPlayerState, createEmptyEntityState,
    U_ORIGIN1, U_ORIGIN2, U_ANGLE2, U_ANGLE3, U_FRAME8, U_EVENT, U_REMOVE, U_MOREBITS1,
    U_NUMBER16, U_ORIGIN3, U_ANGLE1, U_MODEL, U_RENDERFX8, U_ALPHA, U_EFFECTS8, U_MOREBITS2,
    U_SKIN8, U_FRAME16, U_RENDERFX16, U_EFFECTS16, U_MODEL2, U_MODEL3, U_MODEL4, U_MOREBITS3,
    U_OLDORIGIN, U_SKIN16, U_SOUND, U_SOLID, U_SCALE, U_INSTANCE_BITS, U_LOOP_VOLUME, U_MOREBITS4,
    U_LOOP_ATTENUATION_HIGH, U_OWNER_HIGH, U_OLD_FRAME_HIGH
} from '../parser.js';
import { StreamingBuffer } from '../../stream/streamingBuffer.js';

export const PROTOCOL_VERSION_RERELEASE = 2023;

export class RereleaseProtocolHandler implements ProtocolHandler {
    protocolVersion = PROTOCOL_VERSION_RERELEASE;

    translateCommand(cmd: number): ServerCommand {
        return cmd as ServerCommand;
    }

    parseServerData(stream: StreamingBuffer) {
        const protocol = stream.readLong();
        const spawnCount = stream.readLong();
        const demoType = stream.readByte();
        const tickRate = stream.readByte();
        const gameDir = stream.readString();
        let playerNum = stream.readShort();
        if (playerNum === -2) {
             const numSplits = stream.readShort();
             for (let i = 0; i < numSplits; i++) stream.readShort();
             playerNum = 0;
        } else if (playerNum === -1) {
            playerNum = -1;
        }
        const levelName = stream.readString();

        return {
            protocol,
            serverCount: spawnCount,
            spawnCount,
            attractLoop: 0,
            gameDir,
            playerNum,
            levelName,
            tickRate,
            demoType
        };
    }

    parseEntityBits(stream: StreamingBuffer) {
        let total = stream.readByte();
        if (total & U_MOREBITS1) total |= (stream.readByte() << 8);
        if (total & U_MOREBITS2) total |= (stream.readByte() << 16);
        if (total & U_MOREBITS3) total |= (stream.readByte() << 24);

        let bitsHigh = 0;
        if (total & U_MOREBITS4) bitsHigh = stream.readByte();

        let number: number;
        if (total & U_NUMBER16) number = stream.readShort();
        else number = stream.readByte();

        return { number, bits: total, bitsHigh };
    }

    parseDelta(from: EntityState, to: EntityState, number: number, bits: number, bitsHigh: number, stream: StreamingBuffer): void {
        const mutableTo = to as any;

        // Copy state
        Object.assign(mutableTo, from);
        mutableTo.origin = { ...from.origin };
        if (from.oldOrigin) mutableTo.oldOrigin = { ...from.oldOrigin };
        mutableTo.angles = { ...from.angles };

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

        if (bits & U_ALPHA) mutableTo.alpha = stream.readByte() / 255.0;
        if (bits & U_SCALE) mutableTo.scale = stream.readFloat();
        if (bits & U_INSTANCE_BITS) mutableTo.instanceBits = stream.readLong();
        if (bits & U_LOOP_VOLUME) mutableTo.loopVolume = stream.readByte() / 255.0;
        if (bitsHigh & U_LOOP_ATTENUATION_HIGH) mutableTo.loopAttenuation = stream.readByte() / 255.0;
        if (bitsHigh & U_OWNER_HIGH) mutableTo.owner = stream.readShort();
        if (bitsHigh & U_OLD_FRAME_HIGH) mutableTo.oldFrame = stream.readShort();
    }

    parsePlayerState(stream: StreamingBuffer): ProtocolPlayerState {
        const ps = createEmptyProtocolPlayerState();
        const mutablePs = ps as any; // Cast to mutable for parsing
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
            if (statbits & (1 << i)) mutablePs.stats[i] = stream.readShort();
        }
        return ps;
    }
}
