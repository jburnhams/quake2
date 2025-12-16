import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoClipper, WorldState } from '../../src/demo/clipper.js';
import { DemoPlaybackController } from '../../src/demo/playback.js';
import { BinaryWriter, ServerCommand } from '@quake2ts/shared';

// Helper to create a dummy demo with a few frames
function createDummyDemo(): Uint8Array {
  const writer = new BinaryWriter();

  // Header (no explicit header in demo stream, just blocks)

  // Block 1: ServerData
  writer.writeLong(50); // Block length
  writer.writeByte(ServerCommand.serverdata);
  writer.writeLong(2023); // Protocol
  writer.writeLong(1234); // Spawn count
  writer.writeByte(1); // Demo type
  writer.writeByte(10); // Tick rate
  writer.writeString("baseq2");
  writer.writeShort(0); // Player num
  writer.writeString("map1");
  // Pad to 50 bytes? No, BinaryWriter handles specific writes.
  // Wait, block length must match content.
  // We should write content to a buffer then write length + content.

  return new Uint8Array(0);
}

function createMessageBlock(content: Uint8Array): Uint8Array {
    const writer = new BinaryWriter(content.length + 4);
    writer.writeLong(content.length);
    const result = new Uint8Array(writer.getData().length + content.length);
    result.set(writer.getData(), 0);
    result.set(content, 4);
    return result;
}

function createSimpleDemo(): Uint8Array {
    const blocks: Uint8Array[] = [];

    // 1. Server Data
    const w1 = new BinaryWriter();
    w1.writeByte(ServerCommand.serverdata);
    w1.writeLong(2023);
    w1.writeLong(1);
    w1.writeByte(0);
    w1.writeByte(10);
    w1.writeString('baseq2');
    w1.writeShort(0);
    w1.writeString('test');
    blocks.push(createMessageBlock(w1.getData()));

    // 2. Frame 0
    const w2 = new BinaryWriter();
    w2.writeByte(ServerCommand.frame);
    w2.writeLong(0); // ServerFrame
    w2.writeLong(0); // DeltaFrame
    w2.writeByte(0); // Suppress
    w2.writeByte(0); // AreaBytes
    w2.writeByte(ServerCommand.playerinfo);
    w2.writeShort(0); // Flags
    w2.writeLong(0); // Stats
    w2.writeByte(ServerCommand.packetentities);
    w2.writeByte(0); // End of entities (simplified)
    blocks.push(createMessageBlock(w2.getData()));

    // 3. Frame 1
    const w3 = new BinaryWriter();
    w3.writeByte(ServerCommand.frame);
    w3.writeLong(1);
    w3.writeLong(0); // Delta from 0
    w3.writeByte(0);
    w3.writeByte(0);
    w3.writeByte(ServerCommand.playerinfo);
    w3.writeShort(0);
    w3.writeLong(0);
    w3.writeByte(ServerCommand.packetentities);
    w3.writeByte(0);
    blocks.push(createMessageBlock(w3.getData()));

    // Combine
    let totalSize = 0;
    blocks.forEach(b => totalSize += b.length);
    const result = new Uint8Array(totalSize);
    let offset = 0;
    blocks.forEach(b => {
        result.set(b, offset);
        offset += b.length;
    });

    return result;
}

describe('DemoClipper', () => {
    let clipper: DemoClipper;
    let demoData: Uint8Array;
    let controller: DemoPlaybackController;

    beforeEach(() => {
        clipper = new DemoClipper();
        demoData = createSimpleDemo();
        controller = new DemoPlaybackController();
        controller.loadDemo(demoData.buffer as ArrayBuffer);
        // We need to set frame duration to match our mock data if we use time
        controller.setFrameDuration(100);
    });

    it('should extract a simple clip by frame range', () => {
        // Start at frame 0, end at frame 1
        const clip = clipper.extractClip(
            demoData,
            { type: 'frame', frame: 0 },
            { type: 'frame', frame: 0 }, // Inclusive? No, usually range is start inclusive, end exclusive? Or inclusive?
            // The method logic: startByteOffset is startFrame. endByteOffset is endFrame + 1.
            // So [0, 0] means extract frame 0.
            controller
        );

        // Should contain frame 0 block. Frame 0 is at index 1 (index 0 is serverdata).
        // Wait, index 0 in seekToMessage(0) maps to the first FRAME message?
        // DemoReader.scan() indexes ALL blocks.
        // DemoPlaybackController.seek(0) goes to the first frame.
        // The controller indexes frames specifically?
        // No, `seekToMessage` takes an index into `messageOffsets`.
        // `processNextFrame` consumes one block.
        // So `frame 0` effectively means `block 0` if every block is a frame.
        // But block 0 is ServerData.

        // DemoPlaybackController.processNextFrame() increments `currentFrameIndex` for every block?
        // Let's check `processNextFrame` in `playback.ts`.
        // `currentFrameIndex` starts at -1.
        // `processNextFrame` reads block, `currentFrameIndex++`.
        // So yes, block 0 is frame 0.

        // Our demo has: Block 0 (ServerData), Block 1 (Frame 0), Block 2 (Frame 1).

        // If we ask for start: frame 1, end: frame 1.
        // It should extract Block 1.

        // Let's test extraction of Block 1.
        const clip2 = clipper.extractClip(
            demoData,
            { type: 'frame', frame: 1 },
            { type: 'frame', frame: 1 },
            controller
        );

        // Verify clip2 contains Block 1 and EOF
        // Block 1 size?
        // serverdata is ~30 bytes + overhead.
        // frame is ~30 bytes + overhead.

        expect(clip2.length).toBeGreaterThan(10);
        const view = new DataView(clip2.buffer);
        const lastInt = view.getInt32(clip2.length - 4, true);
        expect(lastInt).toBe(-1);
    });

    it('should capture world state correctly', async () => {
        // Capture state at frame 1 (which is after ServerData and Frame 0)
        // Wait, if block 0 is ServerData, block 1 is Frame 0.
        // So capturing at frame 1 means we have processed block 0 and block 1.
        // So we are at the state AFTER Frame 0.

        const state = await clipper.captureWorldState(demoData, { type: 'frame', frame: 1 });

        expect(state.serverData.protocol).toBe(2023);
        expect(state.serverData.gameDir).toBe('baseq2');
        expect(state.serverData.levelName).toBe('test');
    });

    it('should throw if start frame is out of bounds', () => {
        expect(() => {
            clipper.extractClip(
                demoData,
                { type: 'frame', frame: 10 },
                { type: 'frame', frame: 11 },
                controller
            );
        }).toThrow();
    });
});
