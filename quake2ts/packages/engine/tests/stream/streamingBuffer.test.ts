/**
 * StreamingBuffer Tests
 *
 * Tests for the continuous stream buffer that matches vanilla Q2's net_message architecture
 */
import { describe, it, expect } from 'vitest';
import { StreamingBuffer } from '../../src/stream/streamingBuffer';

describe('StreamingBuffer', () => {
    describe('Basic Read/Write Operations', () => {
        it('should append single block and read all data', () => {
            const buffer = new StreamingBuffer();
            const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

            buffer.append(data);

            expect(buffer.available()).toBe(4);
            expect(buffer.readByte()).toBe(0x01);
            expect(buffer.readByte()).toBe(0x02);
            expect(buffer.readByte()).toBe(0x03);
            expect(buffer.readByte()).toBe(0x04);
            expect(buffer.available()).toBe(0);
        });

        it('should append multiple blocks and read continuously', () => {
            const buffer = new StreamingBuffer();
            const block1 = new Uint8Array([0x01, 0x02]);
            const block2 = new Uint8Array([0x03, 0x04]);
            const block3 = new Uint8Array([0x05, 0x06]);

            buffer.append(block1);
            buffer.append(block2);
            buffer.append(block3);

            expect(buffer.available()).toBe(6);
            expect(buffer.readByte()).toBe(0x01);
            expect(buffer.readByte()).toBe(0x02);
            expect(buffer.readByte()).toBe(0x03);
            expect(buffer.readByte()).toBe(0x04);
            expect(buffer.readByte()).toBe(0x05);
            expect(buffer.readByte()).toBe(0x06);
        });

        it('should handle ArrayBuffer input', () => {
            const buffer = new StreamingBuffer();
            const arrayBuffer = new Uint8Array([0xAA, 0xBB, 0xCC]).buffer;

            buffer.append(arrayBuffer);

            expect(buffer.readByte()).toBe(0xAA);
            expect(buffer.readByte()).toBe(0xBB);
            expect(buffer.readByte()).toBe(0xCC);
        });
    });

    describe('Multi-byte Reads', () => {
        it('should read shorts (little-endian)', () => {
            const buffer = new StreamingBuffer();
            // 0x1234 in little-endian = [0x34, 0x12]
            const data = new Uint8Array([0x34, 0x12]);

            buffer.append(data);

            expect(buffer.readShort()).toBe(0x1234);
        });

        it('should read signed shorts correctly', () => {
            const buffer = new StreamingBuffer();
            // -1 as signed short = 0xFFFF
            const data = new Uint8Array([0xFF, 0xFF]);

            buffer.append(data);

            expect(buffer.readShort()).toBe(-1);
        });

        it('should read longs (little-endian)', () => {
            const buffer = new StreamingBuffer();
            // 0x12345678 in little-endian = [0x78, 0x56, 0x34, 0x12]
            const data = new Uint8Array([0x78, 0x56, 0x34, 0x12]);

            buffer.append(data);

            expect(buffer.readLong()).toBe(0x12345678);
        });

        it('should read signed longs correctly', () => {
            const buffer = new StreamingBuffer();
            // -1 as signed long = 0xFFFFFFFF
            const data = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);

            buffer.append(data);

            expect(buffer.readLong()).toBe(-1);
        });
    });

    describe('Block Boundary Handling', () => {
        it('should read short spanning block boundary', () => {
            const buffer = new StreamingBuffer();
            const block1 = new Uint8Array([0x01, 0x34]); // Last byte of short
            const block2 = new Uint8Array([0x12, 0xFF]); // First byte of short

            buffer.append(block1);
            buffer.readByte(); // Skip first byte
            buffer.append(block2);

            // Read short that spans blocks: [0x34 from block1, 0x12 from block2]
            expect(buffer.readShort()).toBe(0x1234);
        });

        it('should read long spanning block boundary', () => {
            const buffer = new StreamingBuffer();
            const block1 = new Uint8Array([0xAA, 0x78, 0x56]); // First 2 bytes of long
            const block2 = new Uint8Array([0x34, 0x12, 0xFF]); // Last 2 bytes of long

            buffer.append(block1);
            buffer.readByte(); // Skip first byte
            buffer.append(block2);

            // Read long that spans blocks: [0x78, 0x56 from block1, 0x34, 0x12 from block2]
            expect(buffer.readLong()).toBe(0x12345678);
        });

        it('should read long split across 3 blocks', () => {
            const buffer = new StreamingBuffer();
            const block1 = new Uint8Array([0x78]); // Byte 1 of long
            const block2 = new Uint8Array([0x56, 0x34]); // Bytes 2-3 of long
            const block3 = new Uint8Array([0x12]); // Byte 4 of long

            buffer.append(block1);
            buffer.append(block2);
            buffer.append(block3);

            expect(buffer.readLong()).toBe(0x12345678);
        });
    });

    describe('String Operations', () => {
        it('should read null-terminated string', () => {
            const buffer = new StreamingBuffer();
            const encoder = new TextEncoder();
            const strBytes = encoder.encode('hello');
            const data = new Uint8Array([...strBytes, 0x00]); // Null-terminated

            buffer.append(data);

            expect(buffer.readString()).toBe('hello');
        });

        it('should read empty string', () => {
            const buffer = new StreamingBuffer();
            const data = new Uint8Array([0x00]); // Just null terminator

            buffer.append(data);

            expect(buffer.readString()).toBe('');
        });

        it('should read string spanning block boundary', () => {
            const buffer = new StreamingBuffer();
            const encoder = new TextEncoder();

            // Split "hello world" across 3 blocks
            const block1 = encoder.encode('hel');
            const block2 = encoder.encode('lo wo');
            const block3 = new Uint8Array([...encoder.encode('rld'), 0x00]); // With null terminator

            buffer.append(block1);
            buffer.append(block2);
            buffer.append(block3);

            expect(buffer.readString()).toBe('hello world');
        });

        it('should throw error on missing null terminator', () => {
            const buffer = new StreamingBuffer();
            const encoder = new TextEncoder();
            const data = encoder.encode('no null terminator here');

            buffer.append(data);

            expect(() => buffer.readString()).toThrow('not null-terminated');
        });

        it('should handle latin1 characters', () => {
            const buffer = new StreamingBuffer();
            // Latin-1 character: ñ (0xF1)
            const data = new Uint8Array([0x48, 0x6F, 0x6C, 0x61, 0x20, 0xF1, 0x00]); // "Hola ñ"

            buffer.append(data);

            expect(buffer.readString()).toBe('Hola ñ');
        });
    });

    describe('hasBytes() and available()', () => {
        it('should return true when enough bytes available', () => {
            const buffer = new StreamingBuffer();
            const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

            buffer.append(data);

            expect(buffer.hasBytes(1)).toBe(true);
            expect(buffer.hasBytes(4)).toBe(true);
            expect(buffer.available()).toBe(4);
        });

        it('should return false when insufficient bytes', () => {
            const buffer = new StreamingBuffer();
            const data = new Uint8Array([0x01, 0x02]);

            buffer.append(data);

            expect(buffer.hasBytes(3)).toBe(false);
            expect(buffer.hasBytes(4)).toBe(false);
        });

        it('should update correctly as data is consumed', () => {
            const buffer = new StreamingBuffer();
            const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

            buffer.append(data);

            expect(buffer.hasBytes(4)).toBe(true);
            buffer.readByte();
            expect(buffer.hasBytes(4)).toBe(false);
            expect(buffer.hasBytes(3)).toBe(true);
            expect(buffer.available()).toBe(3);
        });

        it('should allow appending more data after partial read', () => {
            const buffer = new StreamingBuffer();
            const block1 = new Uint8Array([0x01, 0x02]);

            buffer.append(block1);
            buffer.readByte(); // Consume one byte

            expect(buffer.hasBytes(4)).toBe(false);

            const block2 = new Uint8Array([0x03, 0x04, 0x05]);
            buffer.append(block2);

            expect(buffer.hasBytes(4)).toBe(true);
            expect(buffer.available()).toBe(4);
        });
    });

    describe('Error Handling', () => {
        it('should throw error when reading byte with insufficient data', () => {
            const buffer = new StreamingBuffer();

            expect(() => buffer.readByte()).toThrow('Not enough bytes');
        });

        it('should throw error when reading short with insufficient data', () => {
            const buffer = new StreamingBuffer();
            buffer.append(new Uint8Array([0x01])); // Only 1 byte

            expect(() => buffer.readShort()).toThrow('Not enough bytes');
        });

        it('should throw error when reading long with insufficient data', () => {
            const buffer = new StreamingBuffer();
            buffer.append(new Uint8Array([0x01, 0x02, 0x03])); // Only 3 bytes

            expect(() => buffer.readLong()).toThrow('Not enough bytes');
        });
    });

    describe('Buffer Growth', () => {
        it('should grow buffer when appending beyond initial capacity', () => {
            const buffer = new StreamingBuffer(4); // Small initial capacity
            const data1 = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
            const data2 = new Uint8Array([0x05, 0x06]); // Exceeds initial capacity

            buffer.append(data1);
            expect(buffer.getCapacity()).toBe(4);

            buffer.append(data2);
            expect(buffer.getCapacity()).toBeGreaterThan(4);

            // Verify all data is still readable
            expect(buffer.readByte()).toBe(0x01);
            expect(buffer.readByte()).toBe(0x02);
            expect(buffer.readByte()).toBe(0x03);
            expect(buffer.readByte()).toBe(0x04);
            expect(buffer.readByte()).toBe(0x05);
            expect(buffer.readByte()).toBe(0x06);
        });

        it('should handle large data appends', () => {
            const buffer = new StreamingBuffer(8);
            const largeData = new Uint8Array(1024); // 1KB data
            for (let i = 0; i < largeData.length; i++) {
                largeData[i] = i % 256;
            }

            buffer.append(largeData);

            expect(buffer.getCapacity()).toBeGreaterThanOrEqual(1024);
            expect(buffer.available()).toBe(1024);

            // Spot check some values
            expect(buffer.readByte()).toBe(0);
            buffer.setReadPosition(100);
            expect(buffer.readByte()).toBe(100);
        });
    });

    describe('Buffer Compaction', () => {
        it('should compact buffer and remove consumed data', () => {
            const buffer = new StreamingBuffer();
            const data = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);

            buffer.append(data);
            expect(buffer.available()).toBe(6);

            // Consume first 3 bytes
            buffer.readByte();
            buffer.readByte();
            buffer.readByte();

            expect(buffer.getReadPosition()).toBe(3);
            expect(buffer.available()).toBe(3);

            // Compact buffer
            buffer.compact();

            // Read position should be reset to 0, but data still available
            expect(buffer.getReadPosition()).toBe(0);
            expect(buffer.available()).toBe(3);

            // Remaining data should still be readable
            expect(buffer.readByte()).toBe(0x04);
            expect(buffer.readByte()).toBe(0x05);
            expect(buffer.readByte()).toBe(0x06);
        });

        it('should handle compact when all data consumed', () => {
            const buffer = new StreamingBuffer();
            const data = new Uint8Array([0x01, 0x02]);

            buffer.append(data);
            buffer.readByte();
            buffer.readByte();

            expect(buffer.available()).toBe(0);

            buffer.compact();

            expect(buffer.getReadPosition()).toBe(0);
            expect(buffer.getWritePosition()).toBe(0);
            expect(buffer.available()).toBe(0);
        });

        it('should handle compact when nothing consumed', () => {
            const buffer = new StreamingBuffer();
            const data = new Uint8Array([0x01, 0x02, 0x03]);

            buffer.append(data);

            expect(buffer.getReadPosition()).toBe(0);

            buffer.compact(); // Should be a no-op

            expect(buffer.getReadPosition()).toBe(0);
            expect(buffer.available()).toBe(3);
            expect(buffer.readByte()).toBe(0x01);
        });
    });

    describe('Position Management', () => {
        it('should get and set read position', () => {
            const buffer = new StreamingBuffer();
            const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

            buffer.append(data);

            expect(buffer.getReadPosition()).toBe(0);
            buffer.readByte();
            expect(buffer.getReadPosition()).toBe(1);
            buffer.readByte();
            expect(buffer.getReadPosition()).toBe(2);

            buffer.setReadPosition(0); // Reset to beginning
            expect(buffer.readByte()).toBe(0x01);
        });

        it('should throw error on invalid read position', () => {
            const buffer = new StreamingBuffer();
            const data = new Uint8Array([0x01, 0x02]);

            buffer.append(data);

            expect(() => buffer.setReadPosition(-1)).toThrow('Invalid read position');
            expect(() => buffer.setReadPosition(10)).toThrow('Invalid read position');
        });

        it('should track write position', () => {
            const buffer = new StreamingBuffer();

            expect(buffer.getWritePosition()).toBe(0);

            buffer.append(new Uint8Array([0x01, 0x02]));
            expect(buffer.getWritePosition()).toBe(2);

            buffer.append(new Uint8Array([0x03, 0x04, 0x05]));
            expect(buffer.getWritePosition()).toBe(5);
        });
    });

    describe('Peek and Raw Read Operations', () => {
        it('should peek bytes without advancing position', () => {
            const buffer = new StreamingBuffer();
            const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

            buffer.append(data);

            const peeked = buffer.peekBytes(2);
            expect(peeked[0]).toBe(0x01);
            expect(peeked[1]).toBe(0x02);
            expect(buffer.getReadPosition()).toBe(0); // Position unchanged

            // Reading should still get same data
            expect(buffer.readByte()).toBe(0x01);
        });

        it('should read raw bytes and advance position', () => {
            const buffer = new StreamingBuffer();
            const data = new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD]);

            buffer.append(data);

            const bytes = buffer.readBytes(2);
            expect(bytes[0]).toBe(0xAA);
            expect(bytes[1]).toBe(0xBB);
            expect(buffer.getReadPosition()).toBe(2);

            expect(buffer.readByte()).toBe(0xCC);
        });
    });

    describe('Reset', () => {
        it('should reset buffer to initial state', () => {
            const buffer = new StreamingBuffer();
            const data = new Uint8Array([0x01, 0x02, 0x03]);

            buffer.append(data);
            buffer.readByte();
            buffer.readByte();

            buffer.reset();

            expect(buffer.getReadPosition()).toBe(0);
            expect(buffer.getWritePosition()).toBe(0);
            expect(buffer.available()).toBe(0);
        });
    });

    describe('Real-World Scenario: Demo Block Parsing', () => {
        it('should handle incremental demo block loading', () => {
            const buffer = new StreamingBuffer();

            // Simulate demo blocks arriving incrementally
            // Block 1: serverdata command (protocol 25 format)
            const block1 = new Uint8Array([
                0x07,                           // svc_serverdata (protocol 25)
                0x19, 0x00, 0x00, 0x00,        // protocol = 25
                0x4a, 0x24, 0x01, 0x00,        // servercount
                0x01,                           // attractloop
            ]);

            buffer.append(block1);

            expect(buffer.readByte()).toBe(0x07);
            expect(buffer.readLong()).toBe(25);
            expect(buffer.readLong()).toBe(0x0124a);

            // Block 2 arrives while parsing
            const block2 = new Uint8Array([
                0x6d, 0x61, 0x70, 0x73, 0x00,  // "maps" string
                0x00, 0x00,                     // playernum
                0x74, 0x65, 0x73, 0x74, 0x00   // "test" string
            ]);

            buffer.append(block2);

            expect(buffer.readByte()).toBe(0x01); // attractloop
            // Note: Can't easily test readString here without mocking, but verified in other tests
        });
    });
});
