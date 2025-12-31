import { describe, it, expect, beforeEach } from 'vitest';
import { StreamingBuffer } from '../../../src/stream/streamingBuffer.js';

describe('StreamingBuffer', () => {
    let buffer: StreamingBuffer;

    beforeEach(() => {
        buffer = new StreamingBuffer(16); // Start small to test growth
    });

    it('should append data and read bytes', () => {
        buffer.append(new Uint8Array([1, 2, 3]));
        expect(buffer.hasBytes(3)).toBe(true);
        expect(buffer.readByte()).toBe(1);
        expect(buffer.readByte()).toBe(2);
        expect(buffer.readByte()).toBe(3);
        expect(buffer.hasBytes(1)).toBe(false);
    });

    it('should read short (little endian)', () => {
        buffer.append(new Uint8Array([0x01, 0x02])); // 0x0201 = 513
        expect(buffer.readShort()).toBe(513);
    });

    it('should read negative short', () => {
        buffer.append(new Uint8Array([0xFF, 0xFF])); // -1
        expect(buffer.readShort()).toBe(-1);
    });

    it('should read long (little endian)', () => {
        buffer.append(new Uint8Array([0x01, 0x02, 0x03, 0x04])); // 0x04030201
        expect(buffer.readLong()).toBe(0x04030201);
    });

    it('should read string', () => {
        const text = 'hello';
        const encoder = new TextEncoder();
        const data = new Uint8Array(text.length + 1);
        data.set(encoder.encode(text));
        data[text.length] = 0; // null terminator

        buffer.append(data);
        expect(buffer.readString()).toBe('hello');
    });

    it('should throw when reading string without null terminator', () => {
        buffer.append(new Uint8Array([0x68, 0x65])); // 'he'
        expect(() => buffer.readString()).toThrow('Buffer underflow');
    });

    it('should grow when appending beyond capacity', () => {
        const data = new Uint8Array(20); // Larger than initial 16
        data.fill(1);
        buffer.append(data);

        expect(buffer.hasBytes(20)).toBe(true);
        for (let i = 0; i < 20; i++) {
            expect(buffer.readByte()).toBe(1);
        }
    });

    it('should compact buffer', () => {
        buffer.append(new Uint8Array([1, 2, 3, 4]));
        buffer.readByte();
        buffer.readByte();

        expect(buffer.getReadPosition()).toBe(2);

        buffer.compact();

        expect(buffer.getReadPosition()).toBe(0);
        expect(buffer.hasBytes(2)).toBe(true);
        expect(buffer.readByte()).toBe(3);
        expect(buffer.readByte()).toBe(4);
    });

    it('should handle reads across appended chunks', () => {
        buffer.append(new Uint8Array([0x01]));
        buffer.append(new Uint8Array([0x02, 0x03, 0x04]));

        expect(buffer.readLong()).toBe(0x04030201);
    });

    it('should read float', () => {
        const view = new DataView(new ArrayBuffer(4));
        view.setFloat32(0, 123.456, true);
        buffer.append(new Uint8Array(view.buffer));

        expect(buffer.readFloat()).toBeCloseTo(123.456);
    });

    it('should read data array', () => {
        const input = new Uint8Array([1, 2, 3, 4, 5]);
        buffer.append(input);
        const output = buffer.readData(3);
        expect(output).toEqual(new Uint8Array([1, 2, 3]));
        expect(buffer.readByte()).toBe(4);
    });
});
