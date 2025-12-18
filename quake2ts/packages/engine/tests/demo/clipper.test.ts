import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoClipper, WorldState } from '../../src/demo/clipper.js';
import { DemoPlaybackController } from '../../src/demo/playback.js';
import { createEmptyEntityState, createEmptyProtocolPlayerState, FrameData } from '../../src/demo/parser.js';
import { ServerCommand, BinaryStream } from '@quake2ts/shared';
import { MessageWriter } from '../../src/demo/writer.js';
import { DemoWriter } from '../../src/demo/demoWriter.js';

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
      // Frame 0: Full
      // Frame 1: Delta 0
      // Frame 2: Delta 1
      
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
      const result = clipper.extractStandaloneClip(demoData, { type: 'frame', frame: 1 }, { type: 'frame', frame: 2 }, worldState);
      
      // 4. Verify output
      const reader = new BinaryStream(result.buffer);
      
      // Block 1: Header (includes Frame 0 which maps to original Frame 1)
      const len1 = reader.readLong();
      expect(len1).toBeGreaterThan(0);
      const startPos1 = reader.getPosition();
      
      // Skip Block 1 data
      reader.seek(startPos1 + len1);
      
      // Block 2 (Original Frame 2)
      // The previous error was that it read -1 (EOF) instead of > 0.
      // This means Block 2 was NOT written or reader is at EOF?
      // Or extractStandaloneClip did not find Frame 2?
      
      // The demoData contains frames 0, 1, 2.
      // Start=1, End=2.
      // Synthesized Frame 0 (replaces input Frame 1).
      // Then we loop startFrame + 1 (1 + 1 = 2) to endFrame (2).
      // So we seekToMessage(2).
      // demoWriter creates blocks:
      // Block 0: Frame 0.
      // Block 1: Frame 1.
      // Block 2: Frame 2.
      // EOF.
      
      // seekToMessage(2) should find Block 2.
      // nextBlock() should read Block 2.
      // Then loop writes Block 2.
      
      // If len2 is -1, it means we are at EOF.
      // This implies loop didn't run or didn't write?
      
      // Debug: why loop might not run?
      // reader.seekToMessage(2) -> index 2.
      // messageOffsets in reader: [off0, off1, off2].
      // If offsets are correct, it should work.
      
      // DemoReader constructor calls scan().
      // It uses buffer view.
      // demoData is Uint8Array.
      
      const len2 = reader.readLong();
      
      if (len2 === -1) {
          // Failure case debug
          // Maybe seekToMessage(2) failed?
          // Frame 2 is the 3rd message (index 2).
          // offsets.length should be 3?
          // Let's assume it failed and verify result size is small.
          // expect(result.byteLength).toBeGreaterThan(len1 + 100); 
      }
      
      expect(len2).toBeGreaterThan(0);
      const startPos2 = reader.getPosition();
      
      // Should be Frame command
      expect(reader.readByte()).toBe(ServerCommand.frame);
      const seq2 = reader.readLong();
      const delta2 = reader.readLong();
      
      expect(seq2).toBe(1); // Frame 2 mapped to 1
      expect(delta2).toBe(0); // Delta 1 mapped to 0
      
      // EOF
      reader.seek(startPos2 + len2);
      expect(reader.readLong()).toBe(-1);
  });
});
