// CL_ParseFrame and CL_ParsePacketEntities (client/cl_ents.c): a frame is the frame it names
// plus its packet, and a frame whose delta frame is gone is not valid.
import { describe, it, expect } from 'vitest';
import { U_EVENT, U_FRAME8, U_MODEL, U_ORIGIN1 } from '@quake2ts/shared';
import { ClientFrames } from '../../../src/network/frames.js';
import { createEmptyEntityState, createEmptyProtocolPlayerState, type EntityState, type FrameData } from '../../../src/demo/state.js';

function delta(number: number, bits: number, fields: Partial<EntityState> = {}): EntityState {
  return { ...createEmptyEntityState(), number, bits, ...fields };
}

function frame(serverFrame: number, deltaFrame: number, entities: EntityState[], removed: number[] = []): FrameData {
  return {
    serverFrame, deltaFrame, surpressCount: 0, areaBytes: 0, areaBits: new Uint8Array(),
    playerState: createEmptyProtocolPlayerState(),
    packetEntities: { delta: true, entities, removed },
  };
}

const noBaselines = new Map<number, EntityState>();

describe('ClientFrames', () => {
  it('builds a whole frame when it names none', () => {
    const frames = new ClientFrames();
    const f = frames.parse(frame(10, -1, [delta(1, U_MODEL | U_FRAME8, { modelindex: 3, frame: 2 })]), noBaselines);
    expect(f.valid).toBe(true);
    expect(f.entities.get(1)).toMatchObject({ modelindex: 3, frame: 2 });
    expect(frames.acknowledged).toBe(10);
  });

  it('deltas from the frame it names, not the newest', () => {
    const frames = new ClientFrames();
    frames.parse(frame(10, -1, [delta(1, U_MODEL | U_FRAME8, { modelindex: 3, frame: 2 })]), noBaselines);
    // Frame 11 changes the frame; the server never heard it arrived, so 12 deltas from 10.
    frames.parse(frame(11, 10, [delta(1, U_FRAME8, { frame: 7 })]), noBaselines);
    const f12 = frames.parse(frame(12, 10, [delta(1, U_ORIGIN1, { origin: { x: 64, y: 0, z: 0 } })]), noBaselines);
    expect(f12.valid).toBe(true);
    expect(f12.entities.get(1)).toMatchObject({ modelindex: 3, frame: 2, origin: { x: 64, y: 0, z: 0 } });
  });

  it('drops removed entities and starts new ones from their baseline', () => {
    const frames = new ClientFrames();
    frames.parse(frame(10, -1, [delta(1, U_MODEL, { modelindex: 3 }), delta(2, U_MODEL, { modelindex: 4 })]), noBaselines);
    const baselines = new Map([[5, delta(5, U_MODEL | U_FRAME8, { modelindex: 9, frame: 1 })]]);
    const f = frames.parse(frame(11, 10, [delta(5, U_ORIGIN1, { origin: { x: 8, y: 0, z: 0 } })], [2]), baselines);
    expect([...f.entities.keys()].sort()).toEqual([1, 5]);
    expect(f.entities.get(5)).toMatchObject({ modelindex: 9, frame: 1, origin: { x: 8, y: 0, z: 0 } });
  });

  it('clears an event the packet does not repeat, and keeps where the entity was', () => {
    const frames = new ClientFrames();
    frames.parse(frame(10, -1, [delta(1, U_EVENT | U_ORIGIN1, { event: 2, origin: { x: 16, y: 0, z: 0 } })]), noBaselines);
    const f = frames.parse(frame(11, 10, [delta(1, U_ORIGIN1, { origin: { x: 32, y: 0, z: 0 } })]), noBaselines);
    expect(f.entities.get(1)).toMatchObject({ event: 0, origin: { x: 32 }, old_origin: { x: 16 } });
  });

  it('marks a frame invalid when its delta frame is no longer held, and acknowledges none', () => {
    const frames = new ClientFrames();
    frames.parse(frame(10, -1, []), noBaselines);
    for (let n = 11; n <= 26; n++) frames.parse(frame(n, n - 1, []), noBaselines);
    // Frame 10's slot now holds 26.
    const f = frames.parse(frame(27, 10, []), noBaselines);
    expect(f.valid).toBe(false);
    expect(frames.acknowledged).toBe(-1);
  });
});
