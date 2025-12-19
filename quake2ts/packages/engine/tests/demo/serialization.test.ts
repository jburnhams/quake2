import { describe, it, expect } from 'vitest';
import { serializeSnapshot } from '../../src/demo/serialization/snapshot.js';
import type { GameStateSnapshot } from '@quake2ts/game';
import { ServerCommand } from '@quake2ts/shared';

describe('Snapshot Serialization', () => {
  const createMockSnapshot = (overrides?: Partial<GameStateSnapshot>): GameStateSnapshot => ({
    gravity: { x: 0, y: 0, z: -800 },
    origin: { x: 100, y: 200, z: 300 },
    velocity: { x: 10, y: 20, z: 30 },
    viewangles: { x: 10, y: 20, z: 0 },
    level: { frameNumber: 42, timeSeconds: 4.2, previousTimeSeconds: 4.1, deltaSeconds: 0.1 },
    entities: { activeCount: 1, worldClassname: 'worldspawn' },
    packetEntities: [],
    pmFlags: 0,
    pmType: 0,
    waterlevel: 0,
    watertype: 0,
    deltaAngles: { x: 0, y: 0, z: 0 },
    health: 100,
    armor: 0,
    ammo: 50,
    blend: [0, 0, 0, 0],
    damageAlpha: 0,
    damageIndicators: [],
    stats: [100, 50], // Health, Ammo
    kick_angles: { x: 0, y: 0, z: 0 },
    kick_origin: { x: 0, y: 0, z: 0 },
    gunoffset: { x: 0, y: 0, z: 0 },
    gunangles: { x: 0, y: 0, z: 0 },
    gunindex: 1,
    pm_time: 0,
    gun_frame: 0,
    rdflags: 0,
    fov: 90,
    renderfx: 0,
    ...overrides
  } as GameStateSnapshot);

  it('should serialize a basic snapshot', () => {
    const snapshot = createMockSnapshot();
    const buffer = serializeSnapshot(snapshot);
    const view = new DataView(buffer.buffer);

    expect(buffer.length).toBeGreaterThan(0);

    // Check first byte is frame command
    expect(view.getUint8(0)).toBe(ServerCommand.frame);

    // Check frame number (offset 1, 4 bytes)
    expect(view.getInt32(1, true)).toBe(42);

    // Should contain playerinfo command
    // Scanning for the command byte is tricky without parsing, but we know the structure.
    // Frame command: 1 (cmd) + 4 (frame) + 4 (delta) + 1 (area) + 1 (area) = 11 bytes.
    expect(view.getUint8(11)).toBe(ServerCommand.playerinfo);
  });

  it('should include packet entities', () => {
    const snapshot = createMockSnapshot({
      packetEntities: [{
        number: 1,
        origin: { x: 50, y: 50, z: 50 },
        angles: { x: 0, y: 0, z: 0 },
        modelIndex: 1,
        frame: 0,
        skinNum: 0,
        effects: 0,
        renderfx: 0,
        solid: 0,
        sound: 0,
        event: 0,
        oldOrigin: { x: 0, y: 0, z: 0 },
        modelIndex2: 0,
        modelIndex3: 0,
        modelIndex4: 0
      }]
    });

    const buffer = serializeSnapshot(snapshot);
    const view = new DataView(buffer.buffer);

    // Basic verification that buffer is larger than empty snapshot
    const emptyBuffer = serializeSnapshot(createMockSnapshot());
    expect(buffer.length).toBeGreaterThan(emptyBuffer.length);
  });
});
