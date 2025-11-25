import { describe, it, expect } from 'vitest';
import { BinaryWriter, EntityState, EntityFlags as EF } from '@quake2ts/shared';
import { writeDeltaEntity } from '../../src/protocol/entity.js';

describe('writeDeltaEntity', () => {
  const baseState: EntityState = {
    number: 1,
    origin: { x: 10, y: 20, z: 30 },
    angles: { x: 90, y: 180, z: 270 },
    modelIndex: 1,
    frame: 2,
    skinNum: 3,
    effects: 4,
    renderfx: 5,
    solid: 6,
    sound: 7,
    event: 8,
  };

  it('should write nothing if states are identical', () => {
    const writer = new BinaryWriter();
    writeDeltaEntity(baseState, { ...baseState }, writer, false, false);
    const data = writer.getData();
    expect(data).toEqual(new Uint8Array([0])); // Only the 0 bitmask
  });

  it('should write all fields for a new entity', () => {
    const writer = new BinaryWriter();
    const toState = { ...baseState };
    writeDeltaEntity(null as any, toState, writer, false, true); // `from` is ignored
    const data = writer.getData();

    const expectedWriter = new BinaryWriter();
    let bits =
      EF.U_MODEL | EF.U_ORIGIN1 | EF.U_ORIGIN2 | EF.U_ORIGIN3 |
      EF.U_ANGLE1 | EF.U_ANGLE2 | EF.U_ANGLE3 | EF.U_FRAME |
      EF.U_SKIN | EF.U_EFFECTS | EF.U_RENDERFX | EF.U_SOLID |
      EF.U_SOUND | EF.U_EVENT;

    // Replicate the logic from the function under test to create the correct
    // expected bitmask.
    if (bits & 0xff00) {
      bits |= EF.U_MOREBITS;
      expectedWriter.writeByte(bits & 255);
      expectedWriter.writeByte(bits >> 8);
    } else {
      expectedWriter.writeByte(bits);
    }

    expectedWriter.writeByte(toState.modelIndex);
    expectedWriter.writeCoord(toState.origin.x);
    expectedWriter.writeCoord(toState.origin.y);
    expectedWriter.writeCoord(toState.origin.z);
    expectedWriter.writeAngle(toState.angles.x);
    expectedWriter.writeAngle(toState.angles.y);
    expectedWriter.writeAngle(toState.angles.z);
    expectedWriter.writeByte(toState.frame);
    expectedWriter.writeShort(toState.skinNum);
    expectedWriter.writeByte(toState.effects);
    expectedWriter.writeByte(toState.renderfx);
    expectedWriter.writeShort(toState.solid);
    expectedWriter.writeByte(toState.sound ?? 0);
    expectedWriter.writeByte(toState.event ?? 0);

    expect(data).toEqual(expectedWriter.getData());
  });

  it('should write a single changed field (modelIndex)', () => {
    const writer = new BinaryWriter();
    const toState = { ...baseState, modelIndex: 10 };
    writeDeltaEntity(baseState, toState, writer, false, false);
    const data = writer.getData();

    const expectedWriter = new BinaryWriter();
    expectedWriter.writeByte(EF.U_MODEL); // Bitmask
    expectedWriter.writeByte(toState.modelIndex);
    expect(data).toEqual(expectedWriter.getData());
  });

    it('should write multiple changed fields requiring U_MOREBITS', () => {
    const writer = new BinaryWriter();
    const toState: EntityState = {
      ...baseState,
      modelIndex: 10,  // U_MODEL
      frame: 20,       // U_FRAME
      skinNum: 30,     // U_SKIN
      effects: 40,     // U_EFFECTS
      renderfx: 50,    // U_RENDERFX
      solid: 60,       // U_SOLID
      sound: 70,       // U_SOUND
      event: 80,       // U_EVENT
    };
    writeDeltaEntity(baseState, toState, writer, false, false);
    const data = writer.getData();

    const expectedWriter = new BinaryWriter();
    let bits = EF.U_MODEL | EF.U_FRAME | EF.U_SKIN | EF.U_EFFECTS |
               EF.U_RENDERFX | EF.U_SOLID | EF.U_SOUND | EF.U_EVENT;

    bits |= EF.U_MOREBITS; // Should trigger two-byte mask
    expectedWriter.writeByte(bits & 255);
    expectedWriter.writeByte(bits >> 8);

    expectedWriter.writeByte(toState.modelIndex);
    expectedWriter.writeByte(toState.frame);
    expectedWriter.writeShort(toState.skinNum);
    expectedWriter.writeByte(toState.effects);
    expectedWriter.writeByte(toState.renderfx);
    expectedWriter.writeShort(toState.solid);
    expectedWriter.writeByte(toState.sound ?? 0);
    expectedWriter.writeByte(toState.event ?? 0);

    expect(data).toEqual(expectedWriter.getData());
  });
});
