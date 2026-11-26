import { BinaryWriter } from '../io/index.js';
import { EntityState } from './entityState.js';

// Constants matching packages/engine/src/demo/parser.ts
export const U_ORIGIN1   = (1 << 0);
export const U_ORIGIN2   = (1 << 1);
export const U_ANGLE2    = (1 << 2);
export const U_ANGLE3    = (1 << 3);
export const U_FRAME8    = (1 << 4);
export const U_EVENT     = (1 << 5);
export const U_REMOVE    = (1 << 6);
export const U_MOREBITS1 = (1 << 7);

export const U_NUMBER16  = (1 << 8);
export const U_ORIGIN3   = (1 << 9);
export const U_ANGLE1    = (1 << 10);
export const U_MODEL     = (1 << 11);
export const U_RENDERFX8 = (1 << 12);
export const U_ALPHA     = (1 << 13); // Rerelease: Alpha
export const U_EFFECTS8  = (1 << 14);
export const U_MOREBITS2 = (1 << 15);

export const U_SKIN8     = (1 << 16);
export const U_FRAME16   = (1 << 17);
export const U_RENDERFX16 = (1 << 18);
export const U_EFFECTS16 = (1 << 19);
export const U_MODEL2    = (1 << 20); // Rerelease
export const U_MODEL3    = (1 << 21); // Rerelease
export const U_MODEL4    = (1 << 22); // Rerelease
export const U_MOREBITS3 = (1 << 23);

export const U_OLDORIGIN = (1 << 24);
export const U_SKIN16    = (1 << 25);
export const U_SOUND     = (1 << 26);
export const U_SOLID     = (1 << 27);
export const U_SCALE     = (1 << 28); // Rerelease
export const U_INSTANCE_BITS = (1 << 29); // Rerelease
export const U_LOOP_VOLUME   = (1 << 30); // Rerelease
export const U_MOREBITS4     = 0x80000000 | 0; // Bit 31 (sign bit)

// Rerelease Extension Bits (Byte 5 - High Bits)
export const U_LOOP_ATTENUATION_HIGH = (1 << 0);
export const U_OWNER_HIGH            = (1 << 1);
export const U_OLD_FRAME_HIGH        = (1 << 2);


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

/** RF_BEAM: a beam's other end travels in old_origin. */
const RF_BEAM = 128;

/**
 * MSG_WriteDeltaEntity (qcommon/common.c), held to the C by oracle/tests/msg.oracle.test.ts,
 * plus the rerelease's extra fields (alpha, scale, ...) when a state has them.
 *
 * As in the C: `force` writes the header even when nothing changed (otherwise nothing is
 * written); `newEntity` (or a beam) also sends old_origin; event is not delta compressed, only
 * sent when non-zero; skin, effects and renderfx too big for 16 bits go as a long (both size
 * bits set), which is how laser colours and the high effect flags get through. Fields `from`
 * leaves out count as 0, so `{}` is the null baseline.
 */
export function writeDeltaEntity(
  from: EntityState,
  to: EntityState,
  writer: BinaryWriter,
  force: boolean,
  newEntity: boolean
): void {
  from = { ...NULL_STATE, ...from };
  let bits = 0;
  let bitsHigh = 0;

  if (to.number >= 256) bits |= U_NUMBER16; // number8 is implicit otherwise

  if (to.origin.x !== from.origin.x) bits |= U_ORIGIN1;
  if (to.origin.y !== from.origin.y) bits |= U_ORIGIN2;
  if (to.origin.z !== from.origin.z) bits |= U_ORIGIN3;
  if (to.angles.x !== from.angles.x) bits |= U_ANGLE1;
  if (to.angles.y !== from.angles.y) bits |= U_ANGLE2;
  if (to.angles.z !== from.angles.z) bits |= U_ANGLE3;

  const skin = to.skinNum >>> 0;
  if (to.skinNum !== from.skinNum) {
    if (skin < 256) bits |= U_SKIN8;
    else if (skin < 0x10000) bits |= U_SKIN16;
    else bits |= U_SKIN8 | U_SKIN16;
  }

  if (to.frame !== from.frame) {
    if (to.frame < 256) bits |= U_FRAME8;
    else bits |= U_FRAME16;
  }

  const effects = to.effects >>> 0; // unsigned in entity_state_t
  if (to.effects !== from.effects) {
    if (effects < 256) bits |= U_EFFECTS8;
    else if (effects < 0x8000) bits |= U_EFFECTS16;
    else bits |= U_EFFECTS8 | U_EFFECTS16;
  }

  if (to.renderfx !== from.renderfx) {
    if (to.renderfx < 256) bits |= U_RENDERFX8;
    else if (to.renderfx < 0x8000) bits |= U_RENDERFX16;
    else bits |= U_RENDERFX8 | U_RENDERFX16;
  }

  if (to.solid !== from.solid) bits |= U_SOLID;
  if (to.event) bits |= U_EVENT; // not delta compressed, just 0 compressed

  if (to.modelIndex !== from.modelIndex) bits |= U_MODEL;
  if ((to.modelIndex2 ?? 0) !== (from.modelIndex2 ?? 0)) bits |= U_MODEL2;
  if ((to.modelIndex3 ?? 0) !== (from.modelIndex3 ?? 0)) bits |= U_MODEL3;
  if ((to.modelIndex4 ?? 0) !== (from.modelIndex4 ?? 0)) bits |= U_MODEL4;
  if ((to.sound ?? 0) !== (from.sound ?? 0)) bits |= U_SOUND;
  if (newEntity || to.renderfx & RF_BEAM) bits |= U_OLDORIGIN;

  // Rerelease fields, only for states that carry them.
  if (to.alpha !== undefined && to.alpha !== from.alpha) bits |= U_ALPHA;
  if (to.scale !== undefined && to.scale !== from.scale) bits |= U_SCALE;
  if (to.instanceBits !== undefined && to.instanceBits !== from.instanceBits) bits |= U_INSTANCE_BITS;
  if (to.loopVolume !== undefined && to.loopVolume !== from.loopVolume) bits |= U_LOOP_VOLUME;
  if (to.loopAttenuation !== undefined && to.loopAttenuation !== from.loopAttenuation) bitsHigh |= U_LOOP_ATTENUATION_HIGH;
  if (to.owner !== undefined && to.owner !== from.owner) bitsHigh |= U_OWNER_HIGH;
  if (to.oldFrame !== undefined && to.oldFrame !== from.oldFrame) bitsHigh |= U_OLD_FRAME_HIGH;

  if (!bits && !bitsHigh && !force) return; // nothing to send

  if (bitsHigh) bits |= U_MOREBITS4;
  if (bits & 0xff000000) bits |= U_MOREBITS3 | U_MOREBITS2 | U_MOREBITS1;
  else if (bits & 0x00ff0000) bits |= U_MOREBITS2 | U_MOREBITS1;
  else if (bits & 0x0000ff00) bits |= U_MOREBITS1;

  writer.writeByte(bits & 0xff);
  if (bits & U_MOREBITS1) writer.writeByte((bits >>> 8) & 0xff);
  if (bits & U_MOREBITS2) writer.writeByte((bits >>> 16) & 0xff);
  if (bits & U_MOREBITS3) writer.writeByte((bits >>> 24) & 0xff);
  if (bits & U_MOREBITS4) writer.writeByte(bitsHigh & 0xff);

  if (bits & U_NUMBER16) writer.writeShort(to.number);
  else writer.writeByte(to.number);

  if (bits & U_MODEL) writer.writeByte(to.modelIndex);
  if (bits & U_MODEL2) writer.writeByte(to.modelIndex2 ?? 0);
  if (bits & U_MODEL3) writer.writeByte(to.modelIndex3 ?? 0);
  if (bits & U_MODEL4) writer.writeByte(to.modelIndex4 ?? 0);

  if (bits & U_FRAME8) writer.writeByte(to.frame);
  if (bits & U_FRAME16) writer.writeShort(to.frame);

  if (bits & U_SKIN8 && bits & U_SKIN16) writer.writeLong(to.skinNum); // used for laser colors
  else if (bits & U_SKIN8) writer.writeByte(to.skinNum);
  else if (bits & U_SKIN16) writer.writeShort(to.skinNum);

  if ((bits & (U_EFFECTS8 | U_EFFECTS16)) === (U_EFFECTS8 | U_EFFECTS16)) writer.writeLong(to.effects);
  else if (bits & U_EFFECTS8) writer.writeByte(to.effects);
  else if (bits & U_EFFECTS16) writer.writeShort(to.effects);

  if ((bits & (U_RENDERFX8 | U_RENDERFX16)) === (U_RENDERFX8 | U_RENDERFX16)) writer.writeLong(to.renderfx);
  else if (bits & U_RENDERFX8) writer.writeByte(to.renderfx);
  else if (bits & U_RENDERFX16) writer.writeShort(to.renderfx);

  if (bits & U_ORIGIN1) writer.writeCoord(to.origin.x);
  if (bits & U_ORIGIN2) writer.writeCoord(to.origin.y);
  if (bits & U_ORIGIN3) writer.writeCoord(to.origin.z);

  if (bits & U_ANGLE1) writer.writeAngle(to.angles.x);
  if (bits & U_ANGLE2) writer.writeAngle(to.angles.y);
  if (bits & U_ANGLE3) writer.writeAngle(to.angles.z);

  if (bits & U_OLDORIGIN) {
    const old = to.oldOrigin ?? { x: 0, y: 0, z: 0 };
    writer.writeCoord(old.x);
    writer.writeCoord(old.y);
    writer.writeCoord(old.z);
  }

  if (bits & U_SOUND) writer.writeByte(to.sound ?? 0);
  if (bits & U_EVENT) writer.writeByte(to.event ?? 0);
  if (bits & U_SOLID) writer.writeShort(to.solid);

  // Rerelease fields
  if (bits & U_ALPHA) writer.writeByte(Math.floor((to.alpha ?? 0) * 255));
  if (bits & U_SCALE) writer.writeFloat(to.scale ?? 0);
  if (bits & U_INSTANCE_BITS) writer.writeLong(to.instanceBits ?? 0);
  if (bits & U_LOOP_VOLUME) writer.writeByte(Math.floor((to.loopVolume ?? 0) * 255));
  if (bitsHigh & U_LOOP_ATTENUATION_HIGH) writer.writeByte(Math.floor((to.loopAttenuation ?? 0) * 255));
  if (bitsHigh & U_OWNER_HIGH) writer.writeShort(to.owner ?? 0);
  if (bitsHigh & U_OLD_FRAME_HIGH) writer.writeShort(to.oldFrame ?? 0);
}
