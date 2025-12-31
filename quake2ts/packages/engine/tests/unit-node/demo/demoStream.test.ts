import { describe, it, expect, beforeEach } from 'vitest';
import { DemoStream } from '@quake2ts/engine/demo/demoStream.js';
import { StreamingBuffer } from '@quake2ts/engine/stream/streamingBuffer.js';

// Helper to create a synthetic demo buffer
// Block format: length (4 bytes little endian) + data
function createDemoBuffer(blocks: Uint8Array[]): ArrayBuffer {
    let totalSize = 0;
    for (const block of blocks) {
        totalSize += 4 + block.length;
    }

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);

    let offset = 0;
    for (const block of blocks) {
        view.setUint32(offset, block.length, true);
        offset += 4;
        uint8View.set(block, offset);
        offset += block.length;
    }

    return buffer;
}

describe('DemoStream', () => {
    let demoData: ArrayBuffer;
    let block1: Uint8Array;
    let block2: Uint8Array;

    beforeEach(() => {
        block1 = new Uint8Array([1, 2, 3]);
        block2 = new Uint8Array([4, 5, 6, 7]);
        demoData = createDemoBuffer([block1, block2]);
    });

    it('should load all blocks with loadComplete', () => {
        const stream = new DemoStream(demoData);
        stream.loadComplete();

        expect(stream.isComplete()).toBe(true);

        const buffer = stream.getBuffer();
        // Should contain 1, 2, 3, 4, 5, 6, 7 continuously
        expect(buffer.available()).toBe(7);
        expect(buffer.readByte()).toBe(1);
        expect(buffer.readByte()).toBe(2);
        expect(buffer.readByte()).toBe(3);
        expect(buffer.readByte()).toBe(4);
    });

    it('should load blocks incrementally with loadNextBlocks', () => {
        const stream = new DemoStream(demoData);

        // Load first block
        const hasMore = stream.loadNextBlocks(1);
        expect(hasMore).toBe(true);
        expect(stream.isComplete()).toBe(false);

        const buffer = stream.getBuffer();
        expect(buffer.available()).toBe(3);
        expect(buffer.readByte()).toBe(1);

        // Load second block
        const hasMore2 = stream.loadNextBlocks(1);
        expect(hasMore2).toBe(true);
        // After reading last block, it might not know it is complete until next read fails or checks hasMore
        // Implementation sets complete if !reader.hasMore() after load
        expect(stream.isComplete()).toBe(true);

        expect(buffer.available()).toBe(2 + 4); // 2 left from block1 + 4 from block2
        expect(buffer.readByte()).toBe(2);
        expect(buffer.readByte()).toBe(3);
        expect(buffer.readByte()).toBe(4);
    });

    it('should handle empty demo', () => {
        const emptyData = new ArrayBuffer(0);
        const stream = new DemoStream(emptyData);

        stream.loadComplete();
        expect(stream.isComplete()).toBe(true);
        expect(stream.getBuffer().available()).toBe(0);
    });
});
