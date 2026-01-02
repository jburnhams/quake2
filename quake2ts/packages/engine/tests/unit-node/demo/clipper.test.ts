import { describe, expect, it, beforeEach } from 'vitest';
import { DemoClipper, WorldState } from '../../../src/demo/clipper.js';
import { DemoReader } from '../../../src/demo/demoReader.js';

describe('DemoClipper', () => {
  let clipper: DemoClipper;
  let demoData: Uint8Array;

  // Create a minimal synthetic demo
  // Frame 0: Header + ConfigStrings + Frame
  // Frame 1: Frame
  // Frame 2: Frame
  // EOF
  const createSyntheticDemo = (): Uint8Array => {
    // We can manually construct blocks: [Length][Data]
    // But it's tedious to create valid protobufs.
    // Instead we rely on just testing slicing logic (length-based) if we can.
    // If we test `extractClip` (raw slice), we just need valid block structure.

    const blocks: Uint8Array[] = [];

    const addBlock = (data: Uint8Array) => {
        const length = data.length;
        const block = new Uint8Array(4 + length);
        const view = new DataView(block.buffer);
        view.setInt32(0, length, true);
        block.set(data, 4);
        blocks.push(block);
    };

    // Block 0: 10 bytes
    addBlock(new Uint8Array(10).fill(0xAA));
    // Block 1: 20 bytes
    addBlock(new Uint8Array(20).fill(0xBB));
    // Block 2: 30 bytes
    addBlock(new Uint8Array(30).fill(0xCC));
    // EOF
    const eof = new Uint8Array(4);
    new DataView(eof.buffer).setInt32(0, -1, true);
    blocks.push(eof);

    // Concatenate
    const totalLength = blocks.reduce((acc, b) => acc + b.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    blocks.forEach(b => {
        result.set(b, offset);
        offset += b.length;
    });

    return result;
  };

  beforeEach(() => {
    clipper = new DemoClipper();
    demoData = createSyntheticDemo();
  });

  it('extractClip slices raw blocks correctly', () => {
      // Frame 0: 0..14 (4 + 10)
      // Frame 1: 14..38 (4 + 20)
      // Frame 2: 38..72 (4 + 30)
      // EOF: 72..76

      // Extract Frame 1 only
      // Start frame 1, end frame 1.
      // Offset start: 14
      // Offset end: 38 (exclusive of next frame)

      // We need to mock DemoPlaybackController timeToFrame?
      // Or pass frame objects.

      // But `extractClip` uses `reader.seekToMessage` which relies on valid block lengths.
      // Our synthetic demo has valid block lengths.

      // We don't need a real controller if we pass { type: 'frame', frame: X }.
      // But `extractClip` inside creates a `reader`.

      const result = clipper.extractClip(demoData, { type: 'frame', frame: 1 }, { type: 'frame', frame: 1 }, null as any);

      // Expected: Block 1 + EOF
      // Block 1 size: 24 bytes
      // EOF size: 4 bytes
      // Total: 28 bytes

      expect(result.byteLength).toBe(28);

      const inputReader = new DemoReader(demoData.slice().buffer);
      inputReader.seekToMessage(1);
      inputReader.nextBlock(); // Advance so getBlock works
      const expectedBlock = inputReader.getBlock(); // Block 1

      const resultReader = new DemoReader(result.buffer as ArrayBuffer);
      const resultBlock = resultReader.readNextBlock();

      expect(resultBlock).not.toBeNull();
      expect(resultBlock?.length).toBe(expectedBlock.length);
      // Check content
      // @ts-ignore
      const expectedArr = new Uint8Array(expectedBlock.data.buffer).slice(expectedBlock.data.offset, expectedBlock.data.offset + expectedBlock.length);
      // @ts-ignore
      const resultArr = new Uint8Array(resultBlock!.data.buffer).slice(resultBlock!.data.offset, resultBlock!.data.offset + resultBlock!.length);
      expect(resultArr).toEqual(expectedArr);

      // Verify EOF
      expect(resultReader.readNextBlock()).toBeNull();
  });

  it('extractDemoRange calls extractClip with frame indices', () => {
      const result = clipper.extractDemoRange(demoData, 0, 1);
      // Frames 0 and 1 + EOF
      // Block 0: 14
      // Block 1: 24
      // EOF: 4
      // Total: 42
      expect(result.byteLength).toBe(42);
  });
});
