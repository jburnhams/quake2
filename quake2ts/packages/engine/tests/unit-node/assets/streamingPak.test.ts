
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StreamingPakArchive } from '../../../src/assets/streamingPak.js';
import { PakDirectoryEntry } from '../../../src/assets/pak.js';

// Mock Blob implementation to avoid JSDOM issues
class MockBlob {
    constructor(private data: Uint8Array) {}

    get size() { return this.data.length; }

    slice(start?: number, end?: number): MockBlob {
        const s = start ?? 0;
        const e = end ?? this.data.length;
        return new MockBlob(this.data.slice(s, e));
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
        // Return a copy to avoid side effects
        return this.data.buffer.slice(
            this.data.byteOffset,
            this.data.byteOffset + this.data.byteLength
        );
    }

    async text(): Promise<string> {
        return new TextDecoder().decode(this.data);
    }

    stream() {
        const data = this.data;
        return new ReadableStream({
            start(controller) {
                controller.enqueue(data);
                controller.close();
            }
        });
    }
}

describe('StreamingPakArchive', () => {
    let mockBlob: Blob;
    let archive: StreamingPakArchive;

    // Helper to create a PAK buffer
    const createPakBuffer = (files: { name: string, content: string }[]) => {
        // Calculate offsets
        const headerSize = 12;
        const entrySize = 64;
        const dirOffset = headerSize + files.reduce((acc, f) => acc + f.content.length, 0);
        const dirLength = files.length * entrySize;
        const totalSize = dirOffset + dirLength;

        const buffer = new Uint8Array(totalSize);
        const view = new DataView(buffer.buffer);

        // Header
        view.setUint8(0, 'P'.charCodeAt(0));
        view.setUint8(1, 'A'.charCodeAt(0));
        view.setUint8(2, 'C'.charCodeAt(0));
        view.setUint8(3, 'K'.charCodeAt(0));
        view.setInt32(4, dirOffset, true);
        view.setInt32(8, dirLength, true);

        // File contents
        let currentOffset = headerSize;
        const fileOffsets: number[] = [];

        for (const file of files) {
            fileOffsets.push(currentOffset);
            for (let i = 0; i < file.content.length; i++) {
                buffer[currentOffset + i] = file.content.charCodeAt(i);
            }
            currentOffset += file.content.length;
        }

        // Directory
        for (let i = 0; i < files.length; i++) {
            const entryOffset = dirOffset + i * entrySize;
            const file = files[i];

            // Name
            for (let j = 0; j < Math.min(file.name.length, 55); j++) {
                view.setUint8(entryOffset + j, file.name.charCodeAt(j));
            }
            view.setUint8(entryOffset + Math.min(file.name.length, 55), 0); // Null terminator

            // Offset and Length
            view.setInt32(entryOffset + 56, fileOffsets[i], true);
            view.setInt32(entryOffset + 60, file.content.length, true);
        }

        return buffer;
    };

    beforeEach(() => {
        const buffer = createPakBuffer([
            { name: 'file1.txt', content: 'hello world' },
            { name: 'dir/file2.txt', content: 'foo bar' }
        ]);

        // Use MockBlob
        mockBlob = new MockBlob(buffer) as unknown as Blob;
        archive = new StreamingPakArchive(mockBlob);
    });

    it('readDirectory lists all files', async () => {
        const entries = await archive.readDirectory();
        expect(entries).toHaveLength(2);

        const names = entries.map(e => e.name).sort();
        expect(names).toEqual(['dir/file2.txt', 'file1.txt']);
    });

    it('readFile returns readable stream with correct content', async () => {
        const stream = await archive.readFile('file1.txt');
        const reader = stream.getReader();
        const { value, done } = await reader.read();

        expect(value).toBeDefined();
        const text = new TextDecoder().decode(value);
        expect(text).toBe('hello world');

        const result = await reader.read();
        expect(result.done).toBe(true);
    });

    it('getFileBlob returns a blob slice', async () => {
        const blob = await archive.getFileBlob('dir/file2.txt');
        const text = await blob.text();
        expect(text).toBe('foo bar');
    });

    it('throws error for missing file', async () => {
        await expect(archive.readFile('missing.txt')).rejects.toThrow(/File not found/);
    });

    it('throws error for invalid magic', async () => {
        const badBuffer = new Uint8Array(12);
        const badBlob = new MockBlob(badBuffer) as unknown as Blob;
        const badArchive = new StreamingPakArchive(badBlob);
        await expect(badArchive.readDirectory()).rejects.toThrow(/Invalid PAK header magic/);
    });
});
