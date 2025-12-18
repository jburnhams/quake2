import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoClipper, WorldState } from '../../src/demo/clipper.js';
import { DemoPlaybackController } from '../../src/demo/playback.js';
import { createEmptyEntityState, createEmptyProtocolPlayerState, FrameData } from '../../src/demo/parser.js';
import { ServerCommand, BinaryStream } from '@quake2ts/shared';
import { MessageWriter } from '../../src/demo/writer.js';
import { DemoWriter } from '../../src/demo/demoWriter.js';
import { DemoReader } from '../../src/demo/demoReader.js';

// We mock DemoPlaybackController
vi.mock('../../src/demo/playback.js', () => {
    return {
        DemoPlaybackController: vi.fn().mockImplementation(() => ({
            loadDemo: vi.fn(),
            timeToFrame: vi.fn((t) => {
                // Return frame number directly if 'frame' type, or convert sec * 10
                return Math.floor(t * 10);
            }),
            setHandler: vi.fn(),
            seek: vi.fn()
        })),
        PlaybackState: {}
    };
});

describe('DemoClipper', () => {
  let clipper: DemoClipper;
  let mockController: any;

  beforeEach(() => {
    clipper = new DemoClipper();
    // Reset mock
    (DemoPlaybackController as any).mockClear();
  });

  // ... previous tests ...
  it('should extract a clip range from valid binary demo data', () => {
    const buffer = new ArrayBuffer(24);
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    view.setInt32(0, 4, true);
    u8.set([0, 0, 0, 0], 4);

    view.setInt32(8, 4, true);
    u8.set([1, 1, 1, 1], 12);

    view.setInt32(16, 4, true);
    u8.set([2, 2, 2, 2], 20);

    const demoData = new Uint8Array(buffer);
    const controller = new DemoPlaybackController();

    const result = clipper.extractClip(demoData, { type: 'frame', frame: 1 }, { type: 'frame', frame: 1 }, controller);

    expect(result.length).toBe(12);
    const resView = new DataView(result.buffer);
    expect(resView.getInt32(0, true)).toBe(4);
    expect(result[4]).toBe(1);
    expect(resView.getInt32(8, true)).toBe(-1);
  });

  it('should extract standalone clip with synthesized header and frame 0', () => {
     const worldState: WorldState = {
         serverData: {
             protocol: 34,
             serverCount: 1,
             attractLoop: 0,
             gameDir: 'baseq2',
             playerNum: 0,
             levelName: 'q2dm1'
         },
         configStrings: new Map([[1, 'test']]),
         entityBaselines: new Map(),
         playerState: createEmptyProtocolPlayerState(),
         currentEntities: new Map(),
         currentFrameNumber: 10
     };

     const demoData = new Uint8Array(100);

     const result = clipper.extractStandaloneClip(demoData, { type: 'frame', frame: 10 }, { type: 'frame', frame: 10 }, worldState);

     const reader = new BinaryStream(result.buffer);

     const blockLen = reader.readLong();
     expect(blockLen).toBeGreaterThan(0);

     // Check EOF
     reader.seek(result.byteLength - 4);
     expect(reader.readLong()).toBe(-1);
  });

  it('should re-serialize multiple frames and update deltas', () => {
      // 1. Create a synthetic demo with 3 frames: 0, 1, 2.
      const demoWriter = new DemoWriter();
      const proto = 34;

      const createFrame = (seq: number, delta: number): Uint8Array => {
          const w = new MessageWriter();
          const frame: FrameData = {
              serverFrame: seq,
              deltaFrame: delta,
              surpressCount: 0,
              areaBytes: 0,
              areaBits: new Uint8Array(0),
              playerState: createEmptyProtocolPlayerState(),
              packetEntities: { delta: delta !== -1, entities: [] }
          };
          w.writeFrame(frame, proto);
          return w.getData();
      };

      demoWriter.writeBlock(createFrame(0, -1));
      demoWriter.writeBlock(createFrame(1, 0));
      demoWriter.writeBlock(createFrame(2, 1));
      demoWriter.writeEOF();

      const demoData = demoWriter.getData();

      // VERIFY INPUT STRUCTURE - Use slice().buffer to ensure offset 0
      const inputReader = new DemoReader(demoData.slice().buffer);
      expect(inputReader.getMessageCount()).toBe(3);

      // 2. We want to clip Frames 1-2.
      const worldState: WorldState = {
         serverData: { protocol: proto, serverCount: 1, attractLoop: 0, gameDir: 'baseq2', playerNum: 0, levelName: 'map' },
         configStrings: new Map(),
         entityBaselines: new Map(),
         playerState: createEmptyProtocolPlayerState(),
         currentEntities: new Map(),
         currentFrameNumber: 1
      };

      // 3. Run extractStandaloneClip
      const result = clipper.extractStandaloneClip(demoData.slice(), { type: 'frame', frame: 1 }, { type: 'frame', frame: 2 }, worldState);

      // 4. Verify output
      const reader = new BinaryStream(result.buffer);

      // Block 1: Header (includes Frame 0 which maps to original Frame 1)
      const len1 = reader.readLong();
      expect(len1).toBeGreaterThan(0);
      const startPos1 = reader.getPosition();

      // Skip Block 1 data
      reader.seek(startPos1 + len1);

      // Block 2 (Original Frame 2)
      const len2 = reader.readLong();

      expect(len2).toBeGreaterThan(0);
      const startPos2 = reader.getPosition();

      // Should be Frame command
      expect(reader.readByte()).toBe(5); // Protocol 34 Wire for Frame (ServerCommand.frame is 20)
      const seq2 = reader.readLong();
      const delta2 = reader.readLong();

      expect(seq2).toBe(1); // Frame 2 mapped to 1
      expect(delta2).toBe(0); // Delta 1 mapped to 0

      // EOF
      reader.seek(startPos2 + len2);
      expect(reader.readLong()).toBe(-1);
  });
});
