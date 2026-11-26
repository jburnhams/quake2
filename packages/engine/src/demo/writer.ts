
import { EntityState, ProtocolPlayerState, FrameData, createEmptyEntityState } from './state.js';
import {
    U_ORIGIN1, U_ORIGIN2, U_ANGLE2, U_ANGLE3, U_FRAME8, U_EVENT, U_REMOVE, U_MOREBITS1,
    U_NUMBER16, U_ORIGIN3, U_ANGLE1, U_MODEL, U_RENDERFX8, U_ALPHA, U_EFFECTS8, U_MOREBITS2,
    U_SKIN8, U_FRAME16, U_RENDERFX16, U_EFFECTS16, U_MODEL2, U_MODEL3, U_MODEL4, U_MOREBITS3,
    U_OLDORIGIN, U_SKIN16, U_SOUND, U_SOLID, U_SCALE, U_INSTANCE_BITS, U_LOOP_VOLUME,
    U_MOREBITS4, U_LOOP_ATTENUATION_HIGH, U_OWNER_HIGH, U_OLD_FRAME_HIGH,
    BinaryWriter, ServerCommand, writePlayerState as writeSharedPlayerState, ANORMS, writeDeltaEntity as writeDeltaEntity34, writeRemoveEntity,
    type EntityState as NetEntityState,
} from '@quake2ts/shared';

/** The demo's entity state in the shared protocol's field names. */
function toNetEntity(e: EntityState): NetEntityState {
    return {
        number: e.number,
        origin: { x: e.origin.x, y: e.origin.y, z: e.origin.z },
        angles: { x: e.angles.x, y: e.angles.y, z: e.angles.z },
        oldOrigin: { x: e.old_origin.x, y: e.old_origin.y, z: e.old_origin.z },
        modelIndex: e.modelindex,
        modelIndex2: e.modelindex2,
        modelIndex3: e.modelindex3,
        modelIndex4: e.modelindex4,
        frame: e.frame,
        skinNum: e.skinnum,
        effects: e.effects,
        renderfx: e.renderfx,
        solid: e.solid,
        sound: e.sound,
        event: e.event,
    };
}

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

    /** Every protocol this writes numbers its commands as ServerCommand does (svc_ops_e for 34). */
    writeCommand(cmd: ServerCommand, _protocol?: number): void {
        this.writer.writeByte(cmd);
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

    /**
     * svc_playerinfo: the fields that differ from `from`, the player state of the frame this one
     * deltas from (zero for a whole frame). The shared writer is the server's, so both quantise
     * alike; until 2026-11-26 this kept its own copy, which truncated where the server rounds.
     */
    writePlayerState(ps: ProtocolPlayerState, from?: ProtocolPlayerState): void {
        this.writeCommand(ServerCommand.playerinfo);
        // The same fields; the shared type's vectors carry an index signature the demo state's lack.
        type Shared = Parameters<typeof writeSharedPlayerState>[1];
        writeSharedPlayerState(this.writer, ps as unknown as Shared, from as unknown as Shared | undefined);
    }

    writePacketEntities(entities: EntityState[], delta: boolean, protocol: number, removed: readonly number[] = []): void {
        this.writeCommand(delta ? ServerCommand.deltapacketentities : ServerCommand.packetentities);

        // In entity-number order, removals among the deltas: CL_ParsePacketEntities walks the old
        // frame in that order and copies every entity below the next number it reads.
        const updates = [...entities].sort((a, b) => a.number - b.number);
        const removals = [...removed].sort((a, b) => a - b);
        let u = 0;
        let r = 0;
        while (u < updates.length || r < removals.length) {
            if (r >= removals.length || (u < updates.length && updates[u].number < removals[r])) {
                this.writeDeltaEntity(createEmptyEntityState(), updates[u++], true);
            } else {
                writeRemoveEntity(removals[r++], this.writer);
            }
        }
        this.writer.writeShort(0);
    }

    /** svc_frame; `from` is the player state of `frame.deltaFrame`, which the reader starts from. */
    writeFrame(frame: FrameData, protocol: number, from?: ProtocolPlayerState): void {
        this.writeCommand(ServerCommand.frame);
        this.writer.writeLong(frame.serverFrame);
        this.writer.writeLong(frame.deltaFrame);

        if (protocol !== 26 && protocol !== 25) {
             this.writer.writeByte(frame.surpressCount);
        }

        this.writer.writeByte(frame.areaBytes);
        this.writer.writeBytes(frame.areaBits);

        this.writePlayerState(frame.playerState, from);
        this.writePacketEntities(frame.packetEntities.entities, frame.packetEntities.delta, protocol, frame.packetEntities.removed);
    }

    /**
     * Writes one entity delta. Protocol 34 goes through the shared writer, which matches
     * MSG_WriteDeltaEntity byte for byte (oracle/tests/msg.oracle.test.ts); `force` there is
     * also the C's `newentity`, so old_origin goes with it. This one used to leave out fields
     * that changed to 0, old_origin (a laser's far end) and the high bits of skin and effects.
     */
    writeDeltaEntity(from: EntityState, to: EntityState, force: boolean): void {
        if (this.protocol === 34) {
            writeDeltaEntity34(toNetEntity(from), toNetEntity(to), this.writer, force, force);
            return;
        }
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
