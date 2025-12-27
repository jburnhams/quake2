
import { EntityState, ProtocolPlayerState, FrameData, createEmptyEntityState } from './state.js';
import {
    U_ORIGIN1, U_ORIGIN2, U_ANGLE2, U_ANGLE3, U_FRAME8, U_EVENT, U_REMOVE, U_MOREBITS1,
    U_NUMBER16, U_ORIGIN3, U_ANGLE1, U_MODEL, U_RENDERFX8, U_ALPHA, U_EFFECTS8, U_MOREBITS2,
    U_SKIN8, U_FRAME16, U_RENDERFX16, U_EFFECTS16, U_MODEL2, U_MODEL3, U_MODEL4, U_MOREBITS3,
    U_OLDORIGIN, U_SKIN16, U_SOUND, U_SOLID, U_SCALE, U_INSTANCE_BITS, U_LOOP_VOLUME,
    U_MOREBITS4, U_LOOP_ATTENUATION_HIGH, U_OWNER_HIGH, U_OLD_FRAME_HIGH,
    BinaryWriter, ServerCommand, ANORMS
} from '@quake2ts/shared';

// Use Legacy opcodes for testing until we unify
const PROTO34_SERVERDATA = 13;

export class MessageWriter {
    private writer: BinaryWriter;
    private protocol: number;

    constructor(writer?: BinaryWriter, protocol: number = 34) {
        this.writer = writer || new BinaryWriter(new Uint8Array(64 * 1024));
        this.protocol = protocol;
    }

    getData(): Uint8Array {
        return this.writer.getData();
    }

    private getOpcode(cmd: ServerCommand): number {
        if (this.protocol === 34) {
            switch(cmd) {
                case ServerCommand.serverdata: return 13;
                case ServerCommand.frame: return 5;
                case ServerCommand.playerinfo: return 17;
                case ServerCommand.packetentities: return 18;
                case ServerCommand.deltapacketentities: return 19;
                case ServerCommand.print: return 11;
                case ServerCommand.centerprint: return 16;
                case ServerCommand.stufftext: return 12;
                case ServerCommand.sound: return 10;
                case ServerCommand.temp_entity: return 9;
                case ServerCommand.configstring: return 14;
                case ServerCommand.spawnbaseline: return 15;
                case ServerCommand.layout: return 7;
                case ServerCommand.inventory: return 6;
                case ServerCommand.muzzleflash: return 8;
                case ServerCommand.muzzleflash2: return 20;
            }
        }
        return cmd;
    }

    writeCommand(cmd: ServerCommand, protocol?: number): void {
        const proto = protocol ?? this.protocol;
        if (proto === 34 || proto === 0) {
             this.writer.writeByte(this.getOpcode(cmd));
        } else {
             this.writer.writeByte(cmd);
        }
    }

    writeServerData(protocol: number, serverCount: number, attractLoop: number, gameDir: string, playerNum: number, levelName: string): void {
        this.writeCommand(ServerCommand.serverdata);
        this.writer.writeLong(protocol);
        this.writer.writeLong(serverCount);
        this.writer.writeByte(attractLoop);
        this.writer.writeString(gameDir);
        this.writer.writeShort(playerNum);
        this.writer.writeString(levelName);
    }

    writeConfigString(index: number, str: string): void {
        this.writeCommand(ServerCommand.configstring);
        this.writer.writeShort(index);
        this.writer.writeString(str);
    }

    writeStuffText(text: string): void {
        this.writeCommand(ServerCommand.stufftext);
        this.writer.writeString(text);
    }

    writeCenterPrint(msg: string): void {
        this.writeCommand(ServerCommand.centerprint);
        this.writer.writeString(msg);
    }

    writePrint(level: number, msg: string): void {
        this.writeCommand(ServerCommand.print);
        this.writer.writeByte(level);
        this.writer.writeString(msg);
    }

    writeLayout(layout: string): void {
        this.writeCommand(ServerCommand.layout);
        this.writer.writeString(layout);
    }

    writeInventory(inventory: number[]): void {
        this.writeCommand(ServerCommand.inventory);
        for (const count of inventory) {
            this.writer.writeShort(count);
        }
        for (let i = inventory.length; i < 256; i++) {
            this.writer.writeShort(0);
        }
    }

    writeMuzzleFlash(ent: number, weapon: number): void {
        this.writeCommand(ServerCommand.muzzleflash);
        this.writer.writeShort(ent);
        this.writer.writeByte(weapon);
    }

    writeMuzzleFlash2(ent: number, weapon: number): void {
        this.writeCommand(ServerCommand.muzzleflash2);
        this.writer.writeShort(ent);
        this.writer.writeByte(weapon);
    }

    writeSound(mask: number, soundNum: number, volume: number, attenuation: number, offset: number, ent: number, pos: any, protocol: number): void {
        this.writeCommand(ServerCommand.sound);
        this.writer.writeByte(mask);
        this.writer.writeByte(soundNum);

        if (mask & 1) this.writer.writeByte(volume);
        if (mask & 2) this.writer.writeByte(attenuation);
        if (mask & 16) this.writer.writeByte(offset);
        if (mask & 8) this.writer.writeShort(ent);
        if (mask & 4) {
            this.writer.writeCoord(pos.x);
            this.writer.writeCoord(pos.y);
            this.writer.writeCoord(pos.z);
        }
    }

    writeTempEntity(type: number, pos: any, pos2?: any, dir?: any, cnt?: number, color?: number, ent?: number, srcEnt?: number, destEnt?: number): void {
        this.writeCommand(ServerCommand.temp_entity);
        this.writer.writeByte(type);
        if (pos) {
            this.writer.writePos(pos);
        }
    }

    writePlayerState(ps: ProtocolPlayerState): void {
        this.writeCommand(ServerCommand.playerinfo);

        let flags = 0;
        if (ps.pm_type !== 0) flags |= 1;
        if (ps.origin.x !== 0 || ps.origin.y !== 0 || ps.origin.z !== 0) flags |= 2;
        if (ps.velocity.x !== 0 || ps.velocity.y !== 0 || ps.velocity.z !== 0) flags |= 4;
        if (ps.pm_time !== 0) flags |= 8;
        if (ps.pm_flags !== 0) flags |= 16;
        if (ps.gravity !== 0) flags |= 32;
        if (ps.delta_angles.x !== 0 || ps.delta_angles.y !== 0 || ps.delta_angles.z !== 0) flags |= 64;
        if (ps.viewoffset.x !== 0 || ps.viewoffset.y !== 0 || ps.viewoffset.z !== 0) flags |= 128;
        if (ps.viewangles.x !== 0 || ps.viewangles.y !== 0 || ps.viewangles.z !== 0) flags |= 256;
        if (ps.kick_angles.x !== 0 || ps.kick_angles.y !== 0 || ps.kick_angles.z !== 0) flags |= 512;
        if (ps.gun_index !== 0) flags |= 4096;
        if (ps.gun_frame !== 0 || ps.gun_offset.x !== 0 || ps.gun_offset.y !== 0 || ps.gun_offset.z !== 0 ||
            ps.gun_angles.x !== 0 || ps.gun_angles.y !== 0 || ps.gun_angles.z !== 0) flags |= 8192;
        if (ps.blend[0] !== 0 || ps.blend[1] !== 0 || ps.blend[2] !== 0 || ps.blend[3] !== 0) flags |= 1024;
        if (ps.fov !== 0) flags |= 2048;
        if (ps.rdflags !== 0) flags |= 16384;
        if (ps.watertype !== 0) flags |= 32768;

        this.writer.writeShort(flags);

        if (flags & 1) this.writer.writeByte(ps.pm_type);
        if (flags & 2) {
            this.writer.writeShort(ps.origin.x / 0.125);
            this.writer.writeShort(ps.origin.y / 0.125);
            this.writer.writeShort(ps.origin.z / 0.125);
        }
        if (flags & 4) {
            this.writer.writeShort(ps.velocity.x / 0.125);
            this.writer.writeShort(ps.velocity.y / 0.125);
            this.writer.writeShort(ps.velocity.z / 0.125);
        }
        if (flags & 8) this.writer.writeByte(ps.pm_time);
        if (flags & 16) this.writer.writeByte(ps.pm_flags);
        if (flags & 32) this.writer.writeShort(ps.gravity);
        if (flags & 64) {
            this.writer.writeShort(ps.delta_angles.x / (180 / 32768));
            this.writer.writeShort(ps.delta_angles.y / (180 / 32768));
            this.writer.writeShort(ps.delta_angles.z / (180 / 32768));
        }
        if (flags & 128) {
             this.writer.writeByte(ps.viewoffset.x / 0.25);
             this.writer.writeByte(ps.viewoffset.y / 0.25);
             this.writer.writeByte(ps.viewoffset.z / 0.25);
        }
        if (flags & 256) {
             this.writer.writeShort(ps.viewangles.x / (360.0 / 65536));
             this.writer.writeShort(ps.viewangles.y / (360.0 / 65536));
             this.writer.writeShort(ps.viewangles.z / (360.0 / 65536));
        }
        if (flags & 512) {
             this.writer.writeByte(ps.kick_angles.x / 0.25);
             this.writer.writeByte(ps.kick_angles.y / 0.25);
             this.writer.writeByte(ps.kick_angles.z / 0.25);
        }
        if (flags & 4096) this.writer.writeByte(ps.gun_index);
        if (flags & 8192) {
             this.writer.writeByte(ps.gun_frame);
             this.writer.writeByte(ps.gun_offset.x / 0.25);
             this.writer.writeByte(ps.gun_offset.y / 0.25);
             this.writer.writeByte(ps.gun_offset.z / 0.25);
             this.writer.writeByte(ps.gun_angles.x / 0.25);
             this.writer.writeByte(ps.gun_angles.y / 0.25);
             this.writer.writeByte(ps.gun_angles.z / 0.25);
        }
        if (flags & 1024) {
             this.writer.writeByte(ps.blend[0]);
             this.writer.writeByte(ps.blend[1]);
             this.writer.writeByte(ps.blend[2]);
             this.writer.writeByte(ps.blend[3]);
        }
        if (flags & 2048) this.writer.writeByte(ps.fov);
        if (flags & 16384) this.writer.writeByte(ps.rdflags);
        if (flags & 32768) this.writer.writeByte(ps.watertype);

        let statbits = 0;
        for (let i = 0; i < 32; i++) {
             if (ps.stats[i] !== 0) statbits |= (1 << i);
        }
        this.writer.writeLong(statbits);
        for (let i = 0; i < 32; i++) {
             if (statbits & (1 << i)) this.writer.writeShort(ps.stats[i]);
        }
    }

    writePacketEntities(entities: EntityState[], delta: boolean, protocol: number): void {
        this.writeCommand(delta ? ServerCommand.deltapacketentities : ServerCommand.packetentities);

        for (const ent of entities) {
            this.writeDeltaEntity(createEmptyEntityState(), ent, true);
        }
        this.writer.writeShort(0);
    }

    writeFrame(frame: FrameData, protocol: number): void {
        this.writeCommand(ServerCommand.frame);
        this.writer.writeLong(frame.serverFrame);
        this.writer.writeLong(frame.deltaFrame);

        if (protocol !== 26 && protocol !== 25) {
             this.writer.writeByte(frame.surpressCount);
        }

        this.writer.writeByte(frame.areaBytes);
        this.writer.writeBytes(frame.areaBits);

        this.writePlayerState(frame.playerState);
        this.writePacketEntities(frame.packetEntities.entities, frame.packetEntities.delta, protocol);
    }

    writeDeltaEntity(from: EntityState, to: EntityState, force: boolean): void {
        let bits = 0;
        let bitsHigh = 0;

        if (to.modelindex !== from.modelindex || force) bits |= U_MODEL;
        if (to.modelindex2 !== from.modelindex2 || force) bits |= U_MODEL2;
        if (to.modelindex3 !== from.modelindex3 || force) bits |= U_MODEL3;
        if (to.modelindex4 !== from.modelindex4 || force) bits |= U_MODEL4;

        if (to.frame !== from.frame || force) {
            if (to.frame >= 256) bits |= U_FRAME16;
            else bits |= U_FRAME8;
        }

        if (to.skinnum !== from.skinnum || force) {
            if (to.skinnum >= 256) bits |= U_SKIN16;
            else bits |= U_SKIN8;
        }

        if (to.effects !== from.effects || force) {
            if (to.effects >= 256) bits |= U_EFFECTS16;
            else bits |= U_EFFECTS8;
        }

        if (to.renderfx !== from.renderfx || force) {
            if (to.renderfx >= 256) bits |= U_RENDERFX16;
            else bits |= U_RENDERFX8;
        }

        if (to.origin.x !== from.origin.x || force) {
            if (to.origin.x !== 0) bits |= U_ORIGIN1;
        }
        if (to.origin.y !== from.origin.y || force) {
            if (to.origin.y !== 0) bits |= U_ORIGIN2;
        }
        if (to.origin.z !== from.origin.z || force) {
            if (to.origin.z !== 0) bits |= U_ORIGIN3;
        }

        if (to.angles.x !== from.angles.x || force) {
            if (to.angles.x !== 0) bits |= U_ANGLE1;
        }
        if (to.angles.y !== from.angles.y || force) {
            if (to.angles.y !== 0) bits |= U_ANGLE2;
        }
        if (to.angles.z !== from.angles.z || force) {
            if (to.angles.z !== 0) bits |= U_ANGLE3;
        }

        if (to.sound !== from.sound || force) bits |= U_SOUND;
        if (to.event !== from.event || force) bits |= U_EVENT;
        if (to.solid !== from.solid || force) bits |= U_SOLID;

        // Rerelease fields - Only if NOT protocol 34
        if (this.protocol !== 34) {
            if (to.alpha !== from.alpha || force) bits |= U_ALPHA;
            if (to.scale !== from.scale || force) bits |= U_SCALE;
            if (to.instanceBits !== from.instanceBits || force) bits |= U_INSTANCE_BITS;
            if (to.loopVolume !== from.loopVolume || force) bits |= U_LOOP_VOLUME;

            // High bits
            if (to.loopAttenuation !== from.loopAttenuation || force) bitsHigh |= U_LOOP_ATTENUATION_HIGH;
            if (to.owner !== from.owner || force) bitsHigh |= U_OWNER_HIGH;
            if (to.oldFrame !== from.oldFrame || force) bitsHigh |= U_OLD_FRAME_HIGH;
        }

        // Determine cascades
        if (bitsHigh > 0) bits |= U_MOREBITS4;
        if (bits & 0xFF000000) bits |= U_MOREBITS3;
        if (bits & 0xFFFF0000) bits |= U_MOREBITS2;
        if (bits & 0xFFFFFF00) bits |= U_MOREBITS1;

        // Write header
        this.writer.writeByte(bits & 0xFF);
        if (bits & U_MOREBITS1) this.writer.writeByte((bits >> 8) & 0xFF);
        if (bits & U_MOREBITS2) this.writer.writeByte((bits >> 16) & 0xFF);
        if (bits & U_MOREBITS3) this.writer.writeByte((bits >> 24) & 0xFF);
        if (bits & U_MOREBITS4) this.writer.writeByte(bitsHigh & 0xFF);

        // Write number
        if (to.number >= 256) {
             this.writer.writeShort(to.number);
        } else {
             this.writer.writeByte(to.number);
        }

        // Write fields
        if (bits & U_MODEL) this.writer.writeByte(to.modelindex);
        if (bits & U_MODEL2) this.writer.writeByte(to.modelindex2);
        if (bits & U_MODEL3) this.writer.writeByte(to.modelindex3);
        if (bits & U_MODEL4) this.writer.writeByte(to.modelindex4);

        if (bits & U_FRAME8) this.writer.writeByte(to.frame);
        if (bits & U_FRAME16) this.writer.writeShort(to.frame);

        if (bits & U_SKIN8) this.writer.writeByte(to.skinnum);
        if (bits & U_SKIN16) this.writer.writeShort(to.skinnum);

        if (bits & U_EFFECTS8) this.writer.writeByte(to.effects);
        if (bits & U_EFFECTS16) this.writer.writeShort(to.effects);

        if (bits & U_RENDERFX8) this.writer.writeByte(to.renderfx);
        if (bits & U_RENDERFX16) this.writer.writeShort(to.renderfx);

        if (bits & U_ORIGIN1) this.writer.writeCoord(to.origin.x);
        if (bits & U_ORIGIN2) this.writer.writeCoord(to.origin.y);
        if (bits & U_ORIGIN3) this.writer.writeCoord(to.origin.z);

        if (bits & U_ANGLE1) this.writer.writeAngle(to.angles.x);
        if (bits & U_ANGLE2) this.writer.writeAngle(to.angles.y);
        if (bits & U_ANGLE3) this.writer.writeAngle(to.angles.z);

        if (bits & U_SOUND) this.writer.writeByte(to.sound ?? 0);
        if (bits & U_EVENT) this.writer.writeByte(to.event ?? 0);
        if (bits & U_SOLID) this.writer.writeShort(to.solid);

        if (this.protocol !== 34) {
            if (bits & U_ALPHA) this.writer.writeByte(to.alpha * 255);
            if (bits & U_SCALE) this.writer.writeFloat(to.scale);
            if (bits & U_INSTANCE_BITS) this.writer.writeLong(to.instanceBits);
            if (bits & U_LOOP_VOLUME) this.writer.writeByte(to.loopVolume * 255);

            if (bitsHigh & U_LOOP_ATTENUATION_HIGH) this.writer.writeByte(to.loopAttenuation * 255);
            if (bitsHigh & U_OWNER_HIGH) this.writer.writeShort(to.owner);
            if (bitsHigh & U_OLD_FRAME_HIGH) this.writer.writeShort(to.oldFrame);
        }
    }
}
