/**
 * StreamingBuffer - Continuous buffer for network message parsing
 *
 * Matches vanilla Quake 2's net_message buffer architecture from:
 * - /home/user/quake2/full/qcommon/msg.c (MSG_Read* functions)
 * - /home/user/quake2/full/client/cl_main.c:1798-1799 (buffer initialization)
 *
 * Maintains a continuous stream buffer that can be incrementally filled with
 * data from demo blocks or network packets, while preserving read position
 * for stateful parsing.
 */
export class StreamingBuffer {
    private buffer: Uint8Array;
    private readOffset: number;
    private writeOffset: number;
    private static readonly INITIAL_SIZE = 64 * 1024; // 64KB initial buffer
    private static readonly MAX_STRING_LENGTH = 2048; // From vanilla Q2

    constructor(initialCapacity: number = StreamingBuffer.INITIAL_SIZE) {
        this.buffer = new Uint8Array(initialCapacity);
        this.readOffset = 0;
        this.writeOffset = 0;
    }

    /**
     * Append new data to the buffer (for demos: append blocks; for network: append packets)
     * Grows buffer if needed to accommodate new data.
     */
    append(data: ArrayBuffer | Uint8Array): void {
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        const requiredSize = this.writeOffset + bytes.length;

        // Grow buffer if needed
        if (requiredSize > this.buffer.length) {
            this.grow(requiredSize);
        }

        // Append data at write position
        this.buffer.set(bytes, this.writeOffset);
        this.writeOffset += bytes.length;
    }

    /**
     * Check if we have N bytes available from current read position
     */
    hasBytes(count: number): boolean {
        return (this.writeOffset - this.readOffset) >= count;
    }

    /**
     * Get number of bytes available for reading
     */
    available(): number {
        return this.writeOffset - this.readOffset;
    }

    /**
     * Read one byte and advance position
     * Reference: MSG_ReadByte() in /home/user/quake2/full/qcommon/msg.c
     */
    readByte(): number {
        if (!this.hasBytes(1)) {
            throw new Error('StreamingBuffer: Not enough bytes to read byte');
        }
        return this.buffer[this.readOffset++];
    }

    /**
     * Read 2-byte short (little-endian) and advance position
     * Reference: MSG_ReadShort() in /home/user/quake2/full/qcommon/msg.c
     */
    readShort(): number {
        if (!this.hasBytes(2)) {
            throw new Error('StreamingBuffer: Not enough bytes to read short');
        }
        const value = this.buffer[this.readOffset] |
                     (this.buffer[this.readOffset + 1] << 8);
        this.readOffset += 2;
        // Handle sign extension for signed shorts
        return value > 0x7FFF ? value - 0x10000 : value;
    }

    /**
     * Read 4-byte long (little-endian) and advance position
     * Reference: MSG_ReadLong() in /home/user/quake2/full/qcommon/msg.c
     */
    readLong(): number {
        if (!this.hasBytes(4)) {
            throw new Error('StreamingBuffer: Not enough bytes to read long');
        }
        const value = this.buffer[this.readOffset] |
                     (this.buffer[this.readOffset + 1] << 8) |
                     (this.buffer[this.readOffset + 2] << 16) |
                     (this.buffer[this.readOffset + 3] << 24);
        this.readOffset += 4;
        // JavaScript bitwise operations return signed 32-bit integers
        return value;
    }

    /**
     * Read null-terminated string and advance position
     * Reference: MSG_ReadString() in /home/user/quake2/full/qcommon/msg.c
     */
    readString(): string {
        const maxLength = Math.min(
            StreamingBuffer.MAX_STRING_LENGTH,
            this.writeOffset - this.readOffset
        );

        let length = 0;
        // Find null terminator
        while (length < maxLength && this.buffer[this.readOffset + length] !== 0) {
            length++;
        }

        if (length >= maxLength) {
            throw new Error('StreamingBuffer: String not null-terminated or exceeds max length');
        }

        // Read string bytes (excluding null terminator)
        const bytes = this.buffer.slice(this.readOffset, this.readOffset + length);
        this.readOffset += length + 1; // +1 to skip null terminator

        // Convert to string (ASCII/Latin-1 encoding like vanilla Q2)
        return new TextDecoder('latin1').decode(bytes);
    }

    /**
     * Read raw bytes without advancing position (peek)
     */
    peekBytes(count: number): Uint8Array {
        if (!this.hasBytes(count)) {
            throw new Error('StreamingBuffer: Not enough bytes to peek');
        }
        return this.buffer.slice(this.readOffset, this.readOffset + count);
    }

    /**
     * Read raw bytes and advance position
     */
    readBytes(count: number): Uint8Array {
        if (!this.hasBytes(count)) {
            throw new Error('StreamingBuffer: Not enough bytes to read');
        }
        const bytes = this.buffer.slice(this.readOffset, this.readOffset + count);
        this.readOffset += count;
        return bytes;
    }

    /**
     * Get current read position (for debugging/state tracking)
     */
    getReadPosition(): number {
        return this.readOffset;
    }

    /**
     * Get current write position (for debugging/state tracking)
     */
    getWritePosition(): number {
        return this.writeOffset;
    }

    /**
     * Set read position (use with caution - mainly for testing)
     */
    setReadPosition(position: number): void {
        if (position < 0 || position > this.writeOffset) {
            throw new Error('StreamingBuffer: Invalid read position');
        }
        this.readOffset = position;
    }

    /**
     * Grow buffer to accommodate more data
     * Doubles current size or grows to required size, whichever is larger
     */
    private grow(requiredSize?: number): void {
        const newSize = requiredSize
            ? Math.max(requiredSize, this.buffer.length * 2)
            : this.buffer.length * 2;

        const newBuffer = new Uint8Array(newSize);
        newBuffer.set(this.buffer);
        this.buffer = newBuffer;
    }

    /**
     * Compact buffer - remove consumed data to free memory
     * Copies unread data to beginning of buffer and resets offsets
     *
     * Call this periodically when processing large streams to prevent
     * unbounded memory growth.
     */
    compact(): void {
        if (this.readOffset === 0) {
            // Nothing to compact
            return;
        }

        const unreadBytes = this.writeOffset - this.readOffset;

        if (unreadBytes === 0) {
            // All data consumed, just reset offsets
            this.readOffset = 0;
            this.writeOffset = 0;
            return;
        }

        // Copy unread data to beginning of buffer
        this.buffer.copyWithin(0, this.readOffset, this.writeOffset);

        // Reset offsets
        this.readOffset = 0;
        this.writeOffset = unreadBytes;
    }

    /**
     * Get total buffer capacity
     */
    getCapacity(): number {
        return this.buffer.length;
    }

    /**
     * Reset buffer to initial state (clear all data)
     */
    reset(): void {
        this.readOffset = 0;
        this.writeOffset = 0;
    }
}
