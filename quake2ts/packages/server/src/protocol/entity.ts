import { BinaryWriter, EntityState, EntityFlags } from '@quake2ts/shared';

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
};

/**
 * Writes the delta between two entity states to a binary writer. This function
 * is critical for minimizing network bandwidth by only sending the fields
 * that have changed since the last update the client acknowledged.
 *
 * Based on rerelease/qcommon/common.c#MSG_WriteDeltaEntity
 *
 * @param from The baseline entity state (the last state the client knows about).
 * @param to The new, current entity state.
 * @param writer The binary writer to serialize the delta into.
 * @param force If true, all fields are written regardless of change.
 * @param newEntity If true, the `from` state is ignored and treated as null,
 * forcing all fields of the `to` state to be written.
 */
export function writeDeltaEntity(
  from: EntityState,
  to: EntityState,
  writer: BinaryWriter,
  force: boolean,
  newEntity: boolean
): void {
  let bits = 0;

  // If this is a new entity, use a null baseline to ensure all fields are sent.
  if (newEntity) {
    from = NULL_STATE;
  }

  // --- Compare fields and build the bitmask ---
  if (to.modelIndex !== from.modelIndex || force) {
    bits |= EntityFlags.U_MODEL;
  }
  if (to.origin.x !== from.origin.x || force) {
    bits |= EntityFlags.U_ORIGIN1;
  }
  if (to.origin.y !== from.origin.y || force) {
    bits |= EntityFlags.U_ORIGIN2;
  }
  if (to.origin.z !== from.origin.z || force) {
    bits |= EntityFlags.U_ORIGIN3;
  }
  if (to.angles.x !== from.angles.x || force) {
    bits |= EntityFlags.U_ANGLE1;
  }
  if (to.angles.y !== from.angles.y || force) {
    bits |= EntityFlags.U_ANGLE2;
  }
  if (to.angles.z !== from.angles.z || force) {
    bits |= EntityFlags.U_ANGLE3;
  }
  if (to.frame !== from.frame || force) {
    bits |= EntityFlags.U_FRAME;
  }
  if (to.skinNum !== from.skinNum || force) {
    bits |= EntityFlags.U_SKIN;
  }
  if (to.effects !== from.effects || force) {
    bits |= EntityFlags.U_EFFECTS;
  }
  if (to.renderfx !== from.renderfx || force) {
    bits |= EntityFlags.U_RENDERFX;
  }
  if (to.solid !== from.solid || force) {
    bits |= EntityFlags.U_SOLID;
  }
  // Sound and event are only sent if they are non-zero.
  if (to.sound !== from.sound || force) {
    bits |= EntityFlags.U_SOUND;
  }
  if (to.event !== from.event || force) {
    bits |= EntityFlags.U_EVENT;
  }

  // --- Write the bitmask ---
  // U_MOREBITS is used to signal that the bitmask is two bytes long.
  // In the original C, it also signaled extra model/skin info, but that's
  // not used in this port yet.
  if (bits & 0xff00) {
    // Two byte bitmask
    bits |= EntityFlags.U_MOREBITS;
    writer.writeByte(bits & 255);
    writer.writeByte(bits >> 8);
  } else {
    // One byte bitmask
    writer.writeByte(bits);
  }

  // --- Write the actual data based on the bitmask ---
  if (bits & EntityFlags.U_MODEL) {
    writer.writeByte(to.modelIndex);
  }
  if (bits & EntityFlags.U_ORIGIN1) {
    writer.writeCoord(to.origin.x);
  }
  if (bits & EntityFlags.U_ORIGIN2) {
    writer.writeCoord(to.origin.y);
  }
  if (bits & EntityFlags.U_ORIGIN3) {
    writer.writeCoord(to.origin.z);
  }
  if (bits & EntityFlags.U_ANGLE1) {
    writer.writeAngle(to.angles.x);
  }
  if (bits & EntityFlags.U_ANGLE2) {
    writer.writeAngle(to.angles.y);
  }
  if (bits & EntityFlags.U_ANGLE3) {
    writer.writeAngle(to.angles.z);
  }
  if (bits & EntityFlags.U_FRAME) {
    writer.writeByte(to.frame);
  }
  if (bits & EntityFlags.U_SKIN) {
    writer.writeShort(to.skinNum);
  }
  if (bits & EntityFlags.U_EFFECTS) {
    writer.writeByte(to.effects);
  }
  if (bits & EntityFlags.U_RENDERFX) {
    writer.writeByte(to.renderfx);
  }
  if (bits & EntityFlags.U_SOLID) {
    writer.writeShort(to.solid);
  }
  if (bits & EntityFlags.U_SOUND) {
    writer.writeByte(to.sound ?? 0);
  }
  if (bits & EntityFlags.U_EVENT) {
    writer.writeByte(to.event ?? 0);
  }
}
