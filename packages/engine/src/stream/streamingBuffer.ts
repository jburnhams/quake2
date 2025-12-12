export class StreamingBuffer {
  private buffer: Uint8Array;
  private readOffset: number;
  private writeOffset: number;

  constructor(initialCapacity: number = 4096) {
    this.buffer = new Uint8Array(initialCapacity);
    this.readOffset = 0;
    this.writeOffset = 0;
  }

  append(data: ArrayBuffer | Uint8Array): void {
    const input = data instanceof Uint8Array ? data : new Uint8Array(data);
    const requiredSpace = this.writeOffset + input.length;

    if (requiredSpace > this.buffer.length) {
      this.grow(requiredSpace);
    }

    this.buffer.set(input, this.writeOffset);
    this.writeOffset += input.length;
  }

  hasBytes(count: number): boolean {
    return this.writeOffset - this.readOffset >= count;
  }

  readByte(): number {
    if (!this.hasBytes(1)) {
      throw new Error('Buffer underflow');
    }
    return this.buffer[this.readOffset++];
  }

  readShort(): number {
    if (!this.hasBytes(2)) {
      throw new Error('Buffer underflow');
    }
    const val = (this.buffer[this.readOffset] | (this.buffer[this.readOffset + 1] << 8));
    this.readOffset += 2;
    // Handle signed 16-bit integer
    return (val << 16) >> 16;
  }

  readLong(): number {
    if (!this.hasBytes(4)) {
      throw new Error('Buffer underflow');
    }
    const val = (this.buffer[this.readOffset] |
      (this.buffer[this.readOffset + 1] << 8) |
      (this.buffer[this.readOffset + 2] << 16) |
      (this.buffer[this.readOffset + 3] << 24));
    this.readOffset += 4;
    return val; // Bitwise operations in JS result in signed 32-bit integers
  }

  readString(): string {
    let end = this.readOffset;
    while (end < this.writeOffset && this.buffer[end] !== 0) {
      end++;
    }

    if (end === this.writeOffset) {
      // String is not null-terminated yet, or we ran out of data
      // For streaming parser, we might want to check if we have the null terminator before starting to read.
      // But based on the interface `readString`, it implies we should read.
      // However, if we don't have the null terminator, we can't fully read the string.
      // The `hasBytes` check is usually for fixed size. For strings, we need to scan.
      // If we are strictly following "tryRead" pattern later, we might need a `hasString()` method.
      // For now, let's throw if no null terminator is found, similar to underflow.
      throw new Error('Buffer underflow: String not null-terminated');
    }

    const strBytes = this.buffer.subarray(this.readOffset, end);
    const str = new TextDecoder().decode(strBytes);
    this.readOffset = end + 1; // Skip null terminator
    return str;
  }

  readFloat(): number {
    if (!this.hasBytes(4)) {
      throw new Error('Buffer underflow');
    }
    const view = new DataView(this.buffer.buffer, this.buffer.byteOffset + this.readOffset, 4);
    const val = view.getFloat32(0, true); // Little endian
    this.readOffset += 4;
    return val;
  }

  readData(length: number): Uint8Array {
    if (!this.hasBytes(length)) {
      throw new Error('Buffer underflow');
    }
    const data = this.buffer.slice(this.readOffset, this.readOffset + length);
    this.readOffset += length;
    return data;
  }

  private grow(requiredCapacity: number): void {
    // Double capacity or match requirement, whichever is larger
    let newCapacity = this.buffer.length * 2;
    if (newCapacity < requiredCapacity) {
      newCapacity = requiredCapacity;
    }

    const newBuffer = new Uint8Array(newCapacity);
    newBuffer.set(this.buffer.subarray(0, this.writeOffset));
    this.buffer = newBuffer;
  }

  compact(): void {
    if (this.readOffset === 0) {
      return;
    }

    const remaining = this.writeOffset - this.readOffset;
    if (remaining > 0) {
      this.buffer.copyWithin(0, this.readOffset, this.writeOffset);
    }
    this.readOffset = 0;
    this.writeOffset = remaining;
  }

  getReadPosition(): number {
    return this.readOffset;
  }

  getWritePosition(): number {
    return this.writeOffset;
  }

  reset(): void {
    this.readOffset = 0;
    this.writeOffset = 0;
  }
}
