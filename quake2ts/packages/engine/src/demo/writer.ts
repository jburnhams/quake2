import { BinaryWriter, ServerCommand } from '@quake2ts/shared';
import { EntityState, ProtocolPlayerState, FrameData, U_ORIGIN1, U_ORIGIN2, U_ANGLE2, U_ANGLE3, U_FRAME8, U_EVENT, U_REMOVE, U_MOREBITS1, U_NUMBER16, U_ORIGIN3, U_ANGLE1, U_MODEL, U_RENDERFX8, U_ALPHA, U_EFFECTS8, U_MOREBITS2, U_SKIN8, U_FRAME16, U_RENDERFX16, U_EFFECTS16, U_MODEL2, U_MODEL3, U_MODEL4, U_MOREBITS3, U_OLDORIGIN, U_SKIN16, U_SOUND, U_SOLID, U_SCALE, U_INSTANCE_BITS, U_LOOP_VOLUME, U_MOREBITS4, U_LOOP_ATTENUATION_HIGH, U_OWNER_HIGH, U_OLD_FRAME_HIGH } from './parser.js';
import { Vec3 } from '@quake2ts/shared';

export class MessageWriter {
    private writer: BinaryWriter;

    constructor() {
        this.writer = new BinaryWriter();
    }

    public getData(): Uint8Array {
        return this.writer.getData();
    }

    // ... (unchanged methods)

    public writeServerData(protocol: number, serverCount: number, attractLoop: number, gameDir: string, playerNum: number, levelName: string): void {
        this.writer.writeByte(ServerCommand.serverdata);
        this.writer.writeLong(protocol);
        this.writer.writeLong(serverCount);
        this.writer.writeByte(attractLoop);
        this.writer.writeString(gameDir);
        this.writer.writeShort(playerNum);
        this.writer.writeString(levelName);
    }

    public writeServerDataRerelease(protocol: number, spawnCount: number, demoType: number, tickRate: number, gameDir: string, playerNum: number, levelName: string): void {
        this.writer.writeByte(ServerCommand.serverdata);
        this.writer.writeLong(protocol);
        this.writer.writeLong(spawnCount);
        this.writer.writeByte(demoType);
        this.writer.writeByte(tickRate);
        this.writer.writeString(gameDir);
        this.writer.writeShort(playerNum);
        this.writer.writeString(levelName);
    }

    public writeConfigString(index: number, str: string): void {
        this.writer.writeByte(ServerCommand.configstring);
        this.writer.writeShort(index);
        this.writer.writeString(str);
    }

    public writeSpawnBaseline(entity: EntityState, protocolVersion: number): void {
        this.writer.writeByte(ServerCommand.spawnbaseline);
        this.writeEntityState(entity, null, true, protocolVersion);
    }

    public writeStuffText(text: string): void {
        this.writer.writeByte(ServerCommand.stufftext);
        this.writer.writeString(text);
    }

    public writeCenterPrint(text: string): void {
        this.writer.writeByte(ServerCommand.centerprint);
        this.writer.writeString(text);
    }

    public writePrint(level: number, text: string): void {
        this.writer.writeByte(ServerCommand.print);
        this.writer.writeByte(level);
        this.writer.writeString(text);
    }

    public writeLayout(layout: string): void {
        this.writer.writeByte(ServerCommand.layout);
        this.writer.writeString(layout);
    }

    public writeInventory(inventory: number[]): void {
        this.writer.writeByte(ServerCommand.inventory);
        for(let i=0; i<256; i++) {
            this.writer.writeShort(inventory[i] || 0);
        }
    }

    public writeMuzzleFlash(ent: number, weapon: number): void {
        this.writer.writeByte(ServerCommand.muzzleflash);
        this.writer.writeShort(ent);
        this.writer.writeByte(weapon);
    }

    public writeMuzzleFlash2(ent: number, weapon: number): void {
        this.writer.writeByte(ServerCommand.muzzleflash2);
        this.writer.writeShort(ent);
        this.writer.writeByte(weapon);
    }

    public writeTempEntity(type: number, pos: Vec3, pos2?: Vec3, dir?: Vec3, cnt?: number, color?: number, ent?: number, srcEnt?: number, destEnt?: number): void {
        // Safe stub: do not write partial header to avoid corruption
        console.warn('writeTempEntity not implemented - skipping message');
    }

    public writeSound(mask: number, soundNum: number, volume?: number, attenuation?: number, offset?: number, ent?: number, pos?: Vec3): void {
        this.writer.writeByte(ServerCommand.sound);
        this.writer.writeByte(mask);
        this.writer.writeByte(soundNum);
        if (mask & 1) this.writer.writeByte(volume || 0);
        if (mask & 2) this.writer.writeByte(attenuation || 0);
        if (mask & 16) this.writer.writeByte(offset || 0);
        if (mask & 8) this.writer.writeShort(ent || 0);
        if (mask & 4 && pos) {
            this.writer.writeCoord(pos.x);
            this.writer.writeCoord(pos.y);
            this.writer.writeCoord(pos.z);
        }
    }

    public writeDisconnect(): void {
        this.writer.writeByte(ServerCommand.disconnect);
    }

    public writeReconnect(): void {
        this.writer.writeByte(ServerCommand.reconnect);
    }

    public writeFrame(frame: FrameData, protocolVersion: number): void {
        this.writer.writeByte(ServerCommand.frame);
        this.writer.writeLong(frame.serverFrame);
        this.writer.writeLong(frame.deltaFrame);

        if (protocolVersion !== 25 && protocolVersion !== 26) {
             this.writer.writeByte(frame.surpressCount);
        }

        this.writer.writeByte(frame.areaBytes);
        if (frame.areaBytes > 0) {
            this.writer.writeBytes(frame.areaBits);
        }

        this.writer.writeByte(ServerCommand.playerinfo);
        this.writePlayerState(frame.playerState);

        this.writePacketEntities(frame.packetEntities.entities, frame.packetEntities.delta, protocolVersion);
    }

    public writePlayerState(ps: ProtocolPlayerState): void {
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
        if (ps.blend[0] !== 0 || ps.blend[1] !== 0 || ps.blend[2] !== 0 || ps.blend[3] !== 0) flags |= 1024;
        if (ps.gun_index !== 0) flags |= 4096;
        if (ps.gun_frame !== 0 || ps.gun_offset.x !== 0 || ps.gun_offset.y !== 0 || ps.gun_offset.z !== 0 || ps.gun_angles.x !== 0 || ps.gun_angles.y !== 0 || ps.gun_angles.z !== 0) flags |= 8192;
        if (ps.fov !== 0) flags |= 2048;
        if (ps.rdflags !== 0) flags |= 16384;

        this.writer.writeShort(flags);

        if (flags & 1) this.writer.writeByte(ps.pm_type);
        if (flags & 2) { this.writer.writeCoord(ps.origin.x); this.writer.writeCoord(ps.origin.y); this.writer.writeCoord(ps.origin.z); }
        if (flags & 4) { this.writer.writeCoord(ps.velocity.x); this.writer.writeCoord(ps.velocity.y); this.writer.writeCoord(ps.velocity.z); }
        if (flags & 8) this.writer.writeByte(ps.pm_time);
        if (flags & 16) this.writer.writeByte(ps.pm_flags);
        if (flags & 32) this.writer.writeShort(ps.gravity);
        if (flags & 64) {
             this.writer.writeShort(Math.round(ps.delta_angles.x * (32768/180)));
             this.writer.writeShort(Math.round(ps.delta_angles.y * (32768/180)));
             this.writer.writeShort(Math.round(ps.delta_angles.z * (32768/180)));
        }
        if (flags & 128) {
            this.writer.writeChar(Math.round(ps.viewoffset.x * 4));
            this.writer.writeChar(Math.round(ps.viewoffset.y * 4));
            this.writer.writeChar(Math.round(ps.viewoffset.z * 4));
        }
        if (flags & 256) {
             this.writer.writeAngle16(ps.viewangles.x);
             this.writer.writeAngle16(ps.viewangles.y);
             this.writer.writeAngle16(ps.viewangles.z);
        }
        if (flags & 512) {
             this.writer.writeChar(Math.round(ps.kick_angles.x * 4));
             this.writer.writeChar(Math.round(ps.kick_angles.y * 4));
             this.writer.writeChar(Math.round(ps.kick_angles.z * 4));
        }
        if (flags & 4096) this.writer.writeByte(ps.gun_index);
        if (flags & 8192) {
            this.writer.writeByte(ps.gun_frame);
            this.writer.writeChar(Math.round(ps.gun_offset.x * 4));
            this.writer.writeChar(Math.round(ps.gun_offset.y * 4));
            this.writer.writeChar(Math.round(ps.gun_offset.z * 4));
            this.writer.writeChar(Math.round(ps.gun_angles.x * 4));
            this.writer.writeChar(Math.round(ps.gun_angles.y * 4));
            this.writer.writeChar(Math.round(ps.gun_angles.z * 4));
        }
        if (flags & 1024) {
            this.writer.writeByte(ps.blend[0]);
            this.writer.writeByte(ps.blend[1]);
            this.writer.writeByte(ps.blend[2]);
            this.writer.writeByte(ps.blend[3]);
        }
        if (flags & 2048) this.writer.writeByte(ps.fov);
        if (flags & 16384) this.writer.writeByte(ps.rdflags);

        let statbits = 0;
        for(let i=0; i<32; i++) {
            if (ps.stats[i] !== 0) statbits |= (1 << i);
        }
        this.writer.writeLong(statbits);
        for(let i=0; i<32; i++) {
            if (statbits & (1 << i)) this.writer.writeShort(ps.stats[i]);
        }
    }

    public writePacketEntities(entities: EntityState[], delta: boolean, protocolVersion: number): void {
        this.writer.writeByte(delta ? ServerCommand.deltapacketentities : ServerCommand.packetentities);

        for (const ent of entities) {
            const force = !delta;
            this.writeEntityState(ent, null, force, protocolVersion);
        }

        this.writer.writeShort(0);
    }

    public writeEntityState(to: EntityState, from: EntityState | null, force: boolean, protocolVersion: number): void {
        let bits = 0;
        let bitsHigh = 0;

        if (to.bits !== 0 && !force) {
            // Respect existing bits if not forcing
            bits = to.bits;
            bitsHigh = to.bitsHigh;
        } else {
            // Calculate bits based on values (fallback or forced generation)
            // If force is true, we check non-zero values to generate bits.

            if (to.modelindex !== 0) bits |= U_MODEL;
            if (to.modelindex2 !== 0) bits |= U_MODEL2;
            if (to.modelindex3 !== 0) bits |= U_MODEL3;
            if (to.modelindex4 !== 0) bits |= U_MODEL4;

            if (to.frame !== 0) {
                 if (to.frame >= 256) bits |= U_FRAME16;
                 else bits |= U_FRAME8;
            }

            if (to.skinnum !== 0) {
                if (to.skinnum >= 256) bits |= U_SKIN16;
                else bits |= U_SKIN8;
            }

            if (to.effects !== 0) {
                if (to.effects >= 256) bits |= U_EFFECTS16;
                else bits |= U_EFFECTS8;
            }

            if (to.renderfx !== 0) {
                if (to.renderfx >= 256) bits |= U_RENDERFX16;
                else bits |= U_RENDERFX8;
            }

            if (to.origin.x !== 0) bits |= U_ORIGIN1;
            if (to.origin.y !== 0) bits |= U_ORIGIN2;
            if (to.origin.z !== 0) bits |= U_ORIGIN3;

            if (to.angles.x !== 0) bits |= U_ANGLE1;
            if (to.angles.y !== 0) bits |= U_ANGLE2;
            if (to.angles.z !== 0) bits |= U_ANGLE3;

            if (to.old_origin.x !== 0 || to.old_origin.y !== 0 || to.old_origin.z !== 0) bits |= U_OLDORIGIN;

            if (to.sound !== 0) bits |= U_SOUND;
            if (to.event !== 0) bits |= U_EVENT;
            if (to.solid !== 0) bits |= U_SOLID;

            // Rerelease specific
            if (protocolVersion >= 2023) {
                 if (to.alpha !== 0) bits |= U_ALPHA;
                 if (to.scale !== 0) bits |= U_SCALE;
                 if (to.instanceBits !== 0) bits |= U_INSTANCE_BITS;
                 if (to.loopVolume !== 0) bits |= U_LOOP_VOLUME;
                 if (to.loopAttenuation !== 0) bitsHigh |= U_LOOP_ATTENUATION_HIGH;
                 if (to.owner !== 0) bitsHigh |= U_OWNER_HIGH;
                 if (to.oldFrame !== 0) bitsHigh |= U_OLD_FRAME_HIGH;
            }

            if (to.number >= 256) bits |= U_NUMBER16;
        }

        // Logic to handle U_MOREBITS
        if (bitsHigh !== 0) bits |= U_MOREBITS4;
        if ((bits & 0xFF000000) !== 0) bits |= U_MOREBITS3;
        if ((bits & 0x00FF0000) !== 0) bits |= U_MOREBITS2;
        if ((bits & 0x0000FF00) !== 0) bits |= U_MOREBITS1;

        // Write header
        this.writer.writeByte(bits & 255);
        if (bits & U_MOREBITS1) this.writer.writeByte((bits >> 8) & 255);
        if (bits & U_MOREBITS2) this.writer.writeByte((bits >> 16) & 255);
        if (bits & U_MOREBITS3) this.writer.writeByte((bits >> 24) & 255);
        if (protocolVersion >= 2023 && (bits & U_MOREBITS4)) {
            this.writer.writeByte(bitsHigh & 255);
        }

        // Write number
        if (bits & U_NUMBER16) this.writer.writeShort(to.number);
        else this.writer.writeByte(to.number);

        if (bits & U_MODEL) this.writer.writeByte(to.modelindex);
        if (bits & U_MODEL2) this.writer.writeByte(to.modelindex2);
        if (bits & U_MODEL3) this.writer.writeByte(to.modelindex3);
        if (bits & U_MODEL4) this.writer.writeByte(to.modelindex4);

        if (bits & U_FRAME8) this.writer.writeByte(to.frame);
        if (bits & U_FRAME16) this.writer.writeShort(to.frame);

        if ((bits & U_SKIN8) && (bits & U_SKIN16)) this.writer.writeLong(to.skinnum);
        else if (bits & U_SKIN8) this.writer.writeByte(to.skinnum);
        else if (bits & U_SKIN16) this.writer.writeShort(to.skinnum);

        if ((bits & U_EFFECTS8) && (bits & U_EFFECTS16)) this.writer.writeLong(to.effects);
        else if (bits & U_EFFECTS8) this.writer.writeByte(to.effects);
        else if (bits & U_EFFECTS16) this.writer.writeShort(to.effects);

        if ((bits & U_RENDERFX8) && (bits & U_RENDERFX16)) this.writer.writeLong(to.renderfx);
        else if (bits & U_RENDERFX8) this.writer.writeByte(to.renderfx);
        else if (bits & U_RENDERFX16) this.writer.writeShort(to.renderfx);

        if (bits & U_ORIGIN1) this.writer.writeCoord(to.origin.x);
        if (bits & U_ORIGIN2) this.writer.writeCoord(to.origin.y);
        if (bits & U_ORIGIN3) this.writer.writeCoord(to.origin.z);

        if (bits & U_ANGLE1) this.writer.writeAngle(to.angles.x);
        if (bits & U_ANGLE2) this.writer.writeAngle(to.angles.y);
        if (bits & U_ANGLE3) this.writer.writeAngle(to.angles.z);

        if (bits & U_OLDORIGIN) {
             this.writer.writeCoord(to.old_origin.x);
             this.writer.writeCoord(to.old_origin.y);
             this.writer.writeCoord(to.old_origin.z);
        }

        if (bits & U_SOUND) this.writer.writeByte(to.sound);
        if (bits & U_EVENT) this.writer.writeByte(to.event);
        if (bits & U_SOLID) this.writer.writeShort(to.solid);

        if (protocolVersion >= 2023) {
            if (bits & U_ALPHA) this.writer.writeByte(Math.round(to.alpha * 255));
            if (bits & U_SCALE) this.writer.writeFloat(to.scale);
            if (bits & U_INSTANCE_BITS) this.writer.writeLong(to.instanceBits);
            if (bits & U_LOOP_VOLUME) this.writer.writeByte(Math.round(to.loopVolume * 255));
            if (bitsHigh & U_LOOP_ATTENUATION_HIGH) this.writer.writeByte(Math.round(to.loopAttenuation * 255));
            if (bitsHigh & U_OWNER_HIGH) this.writer.writeShort(to.owner);
            if (bitsHigh & U_OLD_FRAME_HIGH) this.writer.writeShort(to.oldFrame);
        }
    }
}
