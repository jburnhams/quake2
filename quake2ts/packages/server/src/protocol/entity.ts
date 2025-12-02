import { BinaryWriter, EntityState } from '@quake2ts/shared';

// Constants matching packages/engine/src/demo/parser.ts
const U_ORIGIN1   = (1 << 0);
const U_ORIGIN2   = (1 << 1);
const U_ANGLE2    = (1 << 2);
const U_ANGLE3    = (1 << 3);
const U_FRAME8    = (1 << 4);
const U_EVENT     = (1 << 5);
const U_REMOVE    = (1 << 6);
const U_MOREBITS1 = (1 << 7);

const U_NUMBER16  = (1 << 8);
const U_ORIGIN3   = (1 << 9);
const U_ANGLE1    = (1 << 10);
const U_MODEL     = (1 << 11);
const U_RENDERFX8 = (1 << 12);
const U_ALPHA     = (1 << 13); // Rerelease: Alpha
const U_EFFECTS8  = (1 << 14);
const U_MOREBITS2 = (1 << 15);

const U_SKIN8     = (1 << 16);
const U_FRAME16   = (1 << 17);
const U_RENDERFX16 = (1 << 18);
const U_EFFECTS16 = (1 << 19);
const U_MODEL2    = (1 << 20); // Rerelease
const U_MODEL3    = (1 << 21); // Rerelease
const U_MODEL4    = (1 << 22); // Rerelease
const U_MOREBITS3 = (1 << 23);

const U_OLDORIGIN = (1 << 24);
const U_SKIN16    = (1 << 25);
const U_SOUND     = (1 << 26);
const U_SOLID     = (1 << 27);
const U_SCALE     = (1 << 28); // Rerelease
const U_INSTANCE_BITS = (1 << 29); // Rerelease
const U_LOOP_VOLUME   = (1 << 30); // Rerelease
const U_MOREBITS4     = 0x80000000 | 0; // Bit 31 (sign bit)

// Rerelease Extension Bits (Byte 5 - High Bits)
const U_LOOP_ATTENUATION_HIGH = (1 << 0);
const U_OWNER_HIGH            = (1 << 1);
const U_OLD_FRAME_HIGH        = (1 << 2);


// A null state for new entities, used as a baseline for comparison.
const NULL_STATE: EntityState = {
  number: 0,
  origin: { x: 0, y: 0, z: 0 },
  angles: { x: 0, y: 0, z: 0 },
  modelIndex: 0,
  frame: 0,
  skinNum: 0,
  effects: 0,
  renderfx: 0,
  solid: 0,
  sound: 0,
  event: 0,
  alpha: 0,
  scale: 0,
  instanceBits: 0,
  loopVolume: 0,
  loopAttenuation: 0,
  owner: 0,
  oldFrame: 0,
  modelIndex2: 0,
  modelIndex3: 0,
  modelIndex4: 0
};

/**
 * Writes the remove bit for an entity.
 */
export function writeRemoveEntity(
    number: number,
    writer: BinaryWriter
): void {
    let bits = U_REMOVE;

    if (number >= 256) {
        bits |= U_NUMBER16;
    }

    // Determine needed bytes for header (U_NUMBER16 is in bits 8-15)
    if (bits & 0xFF00) {
        bits |= U_MOREBITS1;
    }

    // Write Header
    writer.writeByte(bits & 0xFF);
    if (bits & U_MOREBITS1) {
        writer.writeByte((bits >> 8) & 0xFF);
    }

    // Write Number
    if (bits & U_NUMBER16) {
        writer.writeShort(number);
    } else {
        writer.writeByte(number);
    }
}

/**
 * Writes the delta between two entity states to a binary writer.
 */
export function writeDeltaEntity(
  from: EntityState,
  to: EntityState,
  writer: BinaryWriter,
  force: boolean,
  newEntity: boolean
): void {
  let bits = 0;
  let bitsHigh = 0;

  // If this is a new entity, use a null baseline
  if (newEntity) {
    from = NULL_STATE;
  }

  // --- Compare fields and build the bitmask ---
  if (to.modelIndex !== from.modelIndex || force) {
    bits |= U_MODEL;
  }
  if (to.modelIndex2 !== from.modelIndex2 || force) {
      bits |= U_MODEL2;
  }
  if (to.modelIndex3 !== from.modelIndex3 || force) {
      bits |= U_MODEL3;
  }
  if (to.modelIndex4 !== from.modelIndex4 || force) {
      bits |= U_MODEL4;
  }

  if (to.origin.x !== from.origin.x || force) {
    bits |= U_ORIGIN1;
  }
  if (to.origin.y !== from.origin.y || force) {
    bits |= U_ORIGIN2;
  }
  if (to.origin.z !== from.origin.z || force) {
    bits |= U_ORIGIN3;
  }
  if (to.angles.x !== from.angles.x || force) {
    bits |= U_ANGLE1;
  }
  if (to.angles.y !== from.angles.y || force) {
    bits |= U_ANGLE2;
  }
  if (to.angles.z !== from.angles.z || force) {
    bits |= U_ANGLE3;
  }

  if (to.frame !== from.frame || force) {
      if (to.frame >= 256) bits |= U_FRAME16;
      else bits |= U_FRAME8;
  }

  if (to.skinNum !== from.skinNum || force) {
      if (to.skinNum >= 256) bits |= U_SKIN16;
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

  if (to.solid !== from.solid || force) {
    bits |= U_SOLID;
  }
  if (to.sound !== from.sound || force) {
    bits |= U_SOUND;
  }
  if (to.event !== from.event || force) {
    bits |= U_EVENT;
  }

  // Rerelease Fields
  if ((to.alpha !== from.alpha || force) && to.alpha !== undefined) {
      bits |= U_ALPHA;
  }
  if ((to.scale !== from.scale || force) && to.scale !== undefined) {
      bits |= U_SCALE;
  }
  if ((to.instanceBits !== from.instanceBits || force) && to.instanceBits !== undefined) {
      bits |= U_INSTANCE_BITS;
  }
  if ((to.loopVolume !== from.loopVolume || force) && to.loopVolume !== undefined) {
      bits |= U_LOOP_VOLUME;
  }

  // High Bits Fields
  if ((to.loopAttenuation !== from.loopAttenuation || force) && to.loopAttenuation !== undefined) {
      bitsHigh |= U_LOOP_ATTENUATION_HIGH;
  }
  if ((to.owner !== from.owner || force) && to.owner !== undefined) {
      bitsHigh |= U_OWNER_HIGH;
  }
  if ((to.oldFrame !== from.oldFrame || force) && to.oldFrame !== undefined) {
      bitsHigh |= U_OLD_FRAME_HIGH;
  }


  // Handle entity number
  if (to.number >= 256) {
      bits |= U_NUMBER16;
  }

  // Determine needed bytes for header

  // If we have high bits, we set U_MOREBITS4 on the 4th byte
  if (bitsHigh > 0) {
      bits |= U_MOREBITS4;
  }

  // Now calculate cascading flags
  if (bits & 0xFF000000) { // e.g. U_MOREBITS4 (bit 31) is here
      bits |= U_MOREBITS3;
  }
  if (bits & 0xFFFF0000) { // e.g. U_MOREBITS3 (bit 23) is here
      bits |= U_MOREBITS2;
  }
  if (bits & 0xFFFFFF00) { // e.g. U_MOREBITS2 (bit 15) is here
      bits |= U_MOREBITS1;
  }

  // Write Header
  writer.writeByte(bits & 0xFF);

  if (bits & U_MOREBITS1) {
      writer.writeByte((bits >> 8) & 0xFF);
  }
  if (bits & U_MOREBITS2) {
      writer.writeByte((bits >> 16) & 0xFF);
  }
  if (bits & U_MOREBITS3) {
      writer.writeByte((bits >> 24) & 0xFF);
  }
  if (bits & U_MOREBITS4) {
      writer.writeByte(bitsHigh & 0xFF);
  }

  // Write Number
  if (bits & U_NUMBER16) {
      writer.writeShort(to.number);
  } else {
      writer.writeByte(to.number);
  }

  // Write Fields in Order (matching NetworkMessageParser.parseDelta)
  if (bits & U_MODEL) writer.writeByte(to.modelIndex);
  if (bits & U_MODEL2) writer.writeByte(to.modelIndex2 ?? 0);
  if (bits & U_MODEL3) writer.writeByte(to.modelIndex3 ?? 0);
  if (bits & U_MODEL4) writer.writeByte(to.modelIndex4 ?? 0);

  if (bits & U_FRAME8) writer.writeByte(to.frame);
  if (bits & U_FRAME16) writer.writeShort(to.frame);

  if (bits & U_SKIN8) writer.writeByte(to.skinNum);
  if (bits & U_SKIN16) writer.writeShort(to.skinNum);

  if (bits & U_EFFECTS8) writer.writeByte(to.effects);
  if (bits & U_EFFECTS16) writer.writeShort(to.effects);

  if (bits & U_RENDERFX8) writer.writeByte(to.renderfx);
  if (bits & U_RENDERFX16) writer.writeShort(to.renderfx);

  if (bits & U_ORIGIN1) writer.writeCoord(to.origin.x);
  if (bits & U_ORIGIN2) writer.writeCoord(to.origin.y);
  if (bits & U_ORIGIN3) writer.writeCoord(to.origin.z);

  if (bits & U_ANGLE1) writer.writeAngle(to.angles.x);
  if (bits & U_ANGLE2) writer.writeAngle(to.angles.y);
  if (bits & U_ANGLE3) writer.writeAngle(to.angles.z);

  if (bits & U_OLDORIGIN) {
      // Not implemented in EntityState usually, skip or zero
      // writer.writePos(to.old_origin);
  }

  if (bits & U_SOUND) writer.writeByte(to.sound ?? 0);

  if (bits & U_EVENT) writer.writeByte(to.event ?? 0);

  if (bits & U_SOLID) writer.writeShort(to.solid);

  // Rerelease Fields Writing
  if (bits & U_ALPHA) writer.writeByte(Math.floor((to.alpha ?? 0) * 255));
  if (bits & U_SCALE) writer.writeFloat(to.scale ?? 0);
  if (bits & U_INSTANCE_BITS) writer.writeLong(to.instanceBits ?? 0);
  if (bits & U_LOOP_VOLUME) writer.writeByte(Math.floor((to.loopVolume ?? 0) * 255));

  // High bits fields
  if (bitsHigh & U_LOOP_ATTENUATION_HIGH) writer.writeByte(Math.floor((to.loopAttenuation ?? 0) * 255));
  if (bitsHigh & U_OWNER_HIGH) writer.writeShort(to.owner ?? 0);
  if (bitsHigh & U_OLD_FRAME_HIGH) writer.writeShort(to.oldFrame ?? 0);
}
