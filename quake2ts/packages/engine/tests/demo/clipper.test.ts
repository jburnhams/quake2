import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoClipper } from '../../src/demo/clipper.js';
import { DemoPlaybackController } from '../../src/demo/playback.js';

// We mock DemoPlaybackController just for timeToFrame, but we will test extractClip with real data
vi.mock('../../src/demo/playback.js');

describe('DemoClipper', () => {
  let clipper: DemoClipper;
  let mockController: any;

  beforeEach(() => {
    clipper = new DemoClipper();
    mockController = {
        loadDemo: vi.fn(),
        timeToFrame: vi.fn((t) => Math.floor(t * 10)), // Mock 10 fps
    };
    (DemoPlaybackController as any).mockImplementation(() => mockController);
  });

  it('should extract a clip range from valid binary demo data', () => {
    // Construct a fake demo with 3 frames
    // Each frame block is: [Length (4 bytes)] [Data (Length bytes)]

    // Frame 0: Length 4, Data [0, 0, 0, 0]
    // Frame 1: Length 4, Data [1, 1, 1, 1]
    // Frame 2: Length 4, Data [2, 2, 2, 2]

    const buffer = new ArrayBuffer(24); // 3 * (4 + 4) = 24 bytes
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    // Frame 0
    view.setInt32(0, 4, true);
    u8.set([0, 0, 0, 0], 4);

    // Frame 1
    view.setInt32(8, 4, true);
    u8.set([1, 1, 1, 1], 12);

    // Frame 2
    view.setInt32(16, 4, true);
    u8.set([2, 2, 2, 2], 20);

    const demoData = new Uint8Array(buffer);

    // Extract Frame 1 only
    // Start Frame 1, End Frame 1 (exclusive range in logic? clipper usually includes start, and goes up to end)
    // Looking at clipper logic:
    // startFrame -> seekToMessage(startFrame)
    // endFrame -> seekToMessage(endFrame + 1)

    // So extracting frame 1 means start=1, end=1.
    // Seek(1) -> Offset 8.
    // Seek(1+1=2) -> Offset 16.
    // Slice(8, 16) -> Length 8 bytes.
    // Append -1 EOF (4 bytes).
    // Result Length = 12 bytes.

    const result = clipper.extractClip(demoData, { type: 'frame', frame: 1 }, { type: 'frame', frame: 1 }, mockController);

    expect(result.length).toBe(12);

    const resView = new DataView(result.buffer);

    // Check block 1
    expect(resView.getInt32(0, true)).toBe(4);
    expect(result[4]).toBe(1);
    expect(result[5]).toBe(1);
    expect(result[6]).toBe(1);
    expect(result[7]).toBe(1);

    // Check EOF
    expect(resView.getInt32(8, true)).toBe(-1);
  });

  it('should extract multiple frames', () => {
     // Construct a fake demo with 4 frames
     // Frame 0..3
     const buffer = new ArrayBuffer(32); // 4 * 8 = 32
     const view = new DataView(buffer);

     for(let i=0; i<4; i++) {
         view.setInt32(i*8, 4, true);
         // Data is just i repeated
         const u8 = new Uint8Array(buffer);
         u8.fill(i, i*8 + 4, i*8 + 8);
     }

     const demoData = new Uint8Array(buffer);

     // Extract Frame 1 to 2
     // Start=1, End=2.
     // Seek(1) -> Offset 8.
     // Seek(3) -> Offset 24.
     // Slice(8, 24) -> Length 16.
     // Result = 16 + 4 = 20.

     const result = clipper.extractClip(demoData, { type: 'frame', frame: 1 }, { type: 'frame', frame: 2 }, mockController);

     expect(result.length).toBe(20);

     const resView = new DataView(result.buffer);

     // Frame 1
     expect(resView.getInt32(0, true)).toBe(4);
     expect(result[4]).toBe(1);

     // Frame 2
     expect(resView.getInt32(8, true)).toBe(4);
     expect(result[12]).toBe(2);

     // EOF
     expect(resView.getInt32(16, true)).toBe(-1);
  });

  it('should throw if start frame is out of bounds', () => {
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      view.setInt32(0, 4, true);

      const demoData = new Uint8Array(buffer);

      expect(() => {
          clipper.extractClip(demoData, { type: 'frame', frame: 5 }, { type: 'frame', frame: 6 }, mockController);
      }).toThrow('out of bounds');
  });
});
