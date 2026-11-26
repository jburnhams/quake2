/**
 * Writes little-endian numbers and NUL-terminated 8-bit strings (one byte per UTF-16 code unit) into a buffer.
 * Created with a size, it grows by doubling; created over a Uint8Array, it is fixed and throws on overflow.
 */
export class BinaryWriter {
  protected buffer: Uint8Array;
  protected view: DataView;
  protected offset: number;
  private readonly fixed: boolean;

  constructor(sizeOrBuffer: number | Uint8Array = 1400) {
    if (typeof sizeOrBuffer === 'number') {
      this.buffer = new Uint8Array(sizeOrBuffer);
      this.fixed = false;
    } else {
      this.buffer = sizeOrBuffer;
      this.fixed = true;
    }
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
    this.offset = 0;
  }

  protected ensureSpace(bytes: number) {
    if (this.offset + bytes > this.buffer.byteLength) {
      if (this.fixed) {
        throw new Error(`Buffer overflow: capacity ${this.buffer.byteLength}, needed ${this.offset + bytes}`);
      }
      // Expand buffer (double size)
      const newSize = Math.max(this.buffer.byteLength * 2, this.offset + bytes);
      const newBuffer = new Uint8Array(newSize);
      newBuffer.set(this.buffer);
      this.buffer = newBuffer;
      this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
    }
  }

  public writeByte(value: number): void {
    this.ensureSpace(1);
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  public writeBytes(data: Uint8Array): void {
      this.ensureSpace(data.byteLength);
      this.buffer.set(data, this.offset);
      this.offset += data.byteLength;
  }

  public writeChar(value: number): void {
    this.ensureSpace(1);
    this.view.setInt8(this.offset, value);
    this.offset += 1;
  }

  public writeShort(value: number): void {
    this.ensureSpace(2);
    this.view.setInt16(this.offset, value, true);
    this.offset += 2;
  }

  public writeUShort(value: number): void {
    this.ensureSpace(2);
    this.view.setUint16(this.offset, value, true);
    this.offset += 2;
  }

  public writeLong(value: number): void {
    this.ensureSpace(4);
    this.view.setInt32(this.offset, value, true);
    this.offset += 4;
  }

  public writeFloat(value: number): void {
    this.ensureSpace(4);
    this.view.setFloat32(this.offset, value, true);
    this.offset += 4;
  }

  public writeString(value: string): void {
    // UTF-8 encoding of string + null terminator
    // We iterate manually to match readString behavior (ASCII/Latin1 mostly)
    // and avoid TextEncoder overhead if simple
    const len = value.length;
    this.ensureSpace(len + 1);
    for (let i = 0; i < len; i++) {
      this.view.setUint8(this.offset + i, value.charCodeAt(i));
    }
    this.view.setUint8(this.offset + len, 0);
    this.offset += len + 1;
  }






  public getData(): Uint8Array {
      return this.buffer.slice(0, this.offset);
  }

  public getBuffer(): Uint8Array {
      return this.buffer;
  }

  public getOffset(): number {
      return this.offset;
  }

  public reset(): void {
      this.offset = 0;
  }
}
