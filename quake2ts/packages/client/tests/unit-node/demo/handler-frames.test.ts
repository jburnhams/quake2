// A recorded multiplayer game's frames delta from the frame the client had acknowledged, which
// under latency is not the frame before (CL_ParseFrame). Bare svc_packetentities, as demo1 is read,
// still apply to the entities so far.
import { describe, it, expect } from 'vitest';
import { ClientNetworkHandler } from '@quake2ts/client/demo/handler.js';
import { createEmptyEntityState, createEmptyProtocolPlayerState, U_MODEL, U_ORIGIN1, type EntityState, type FrameData } from '@quake2ts/engine';

const at = (number: number, x: number, bits = U_ORIGIN1): EntityState =>
  ({ ...createEmptyEntityState(), number, bits, modelindex: 2, origin: { x, y: 0, z: 0 } });

const frame = (serverFrame: number, deltaFrame: number, entities: EntityState[], removed: number[] = []): FrameData => ({
  serverFrame, deltaFrame, surpressCount: 0, areaBytes: 0, areaBits: new Uint8Array(),
  playerState: createEmptyProtocolPlayerState(),
  packetEntities: { delta: true, entities, removed },
});

describe('ClientNetworkHandler frames', () => {
  it('rebuilds a frame from the frame it names, not the newest', () => {
    const handler = new ClientNetworkHandler();
    handler.onFrame(frame(1, -1, [at(5, 10, U_MODEL | U_ORIGIN1)]));
    handler.onFrame(frame(2, 1, [at(5, 20)]));
    // Back where frame 1 had it, so frame 3 (still from 1) sends nothing for it.
    handler.onFrame(frame(3, 1, []));
    expect(handler.entities.get(5)?.origin.x).toBe(10);
  });

  it('applies bare packet entities to the entities so far, removals included', () => {
    const handler = new ClientNetworkHandler();
    handler.onFrame(frame(0, 0, [at(5, 10, U_MODEL | U_ORIGIN1), at(6, 1, U_MODEL | U_ORIGIN1)]));
    handler.onFrame(frame(0, 0, [at(5, 30)], [6]));
    expect([...handler.entities.keys()]).toEqual([5]);
    expect(handler.entities.get(5)?.origin.x).toBe(30);
  });
});
