import { describe, it, expect, beforeEach } from 'vitest';
import { DemoReader } from '../../src/demo/index.js';

// Helper to create a synthetic demo buffer
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

describe('DemoReader', () => {
    it('should read all blocks to a continuous buffer', () => {
        const block1 = new Uint8Array([1, 2]);
        const block2 = new Uint8Array([3, 4, 5]);
        const demoData = createDemoBuffer([block1, block2]);

        const reader = new DemoReader(demoData);
        const continuous = reader.readAllBlocksToBuffer();
        const bytes = new Uint8Array(continuous);

        expect(bytes.length).toBe(5);
        expect(bytes[0]).toBe(1);
        expect(bytes[1]).toBe(2);
        expect(bytes[2]).toBe(3);
        expect(bytes[3]).toBe(4);
        expect(bytes[4]).toBe(5);

        expect(reader.hasMore()).toBe(false);
    });

    it('should handle reading from current offset', () => {
        const block1 = new Uint8Array([1]);
        const block2 = new Uint8Array([2]);
        const demoData = createDemoBuffer([block1, block2]);

        const reader = new DemoReader(demoData);
        reader.readNextBlock(); // Skip first

        const continuous = reader.readAllBlocksToBuffer();
        const bytes = new Uint8Array(continuous);

        expect(bytes.length).toBe(1);
        expect(bytes[0]).toBe(2);
    });
});
