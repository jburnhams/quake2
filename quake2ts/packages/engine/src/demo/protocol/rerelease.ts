
import { ProtocolHandler } from './types.js';
import { ServerCommand } from '@quake2ts/shared';
import {
    EntityState, ProtocolPlayerState, createEmptyProtocolPlayerState,
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
        // Rerelease commands are usually 1:1 with engine definitions, but may drift.
        // For now, we assume identity.
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
            serverCount: spawnCount, // Map spawnCount to serverCount interface
            spawnCount,
            attractLoop: 0, // Not used in rerelease
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
        // Copy state
        Object.assign(to, from); // Shallow copy
        // Deep copy vec3s
        to.origin = { ...from.origin };
        to.old_origin = { ...from.old_origin };
        to.angles = { ...from.angles };

        to.number = number; to.bits = bits; to.bitsHigh = bitsHigh;

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

        // Rerelease Extensions
        if (bits & U_ALPHA) to.alpha = stream.readByte() / 255.0;
        if (bits & U_SCALE) to.scale = stream.readFloat();
        if (bits & U_INSTANCE_BITS) to.instanceBits = stream.readLong();
        if (bits & U_LOOP_VOLUME) to.loopVolume = stream.readByte() / 255.0;
        if (bitsHigh & U_LOOP_ATTENUATION_HIGH) to.loopAttenuation = stream.readByte() / 255.0;
        if (bitsHigh & U_OWNER_HIGH) to.owner = stream.readShort();
        if (bitsHigh & U_OLD_FRAME_HIGH) to.oldFrame = stream.readShort();
    }

    parsePlayerState(stream: StreamingBuffer): ProtocolPlayerState {
        // Reuse strict logic, assuming identical for now.
        // Rerelease might differ, but `parser.ts` shared logic was same.
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
