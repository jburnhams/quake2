import { ANORMS } from '../math/anorms.js';
import { Vec3 } from '../math/vec3.js';

export class BinaryWriter {
  private buffer: Uint8Array;
  private view: DataView;
  private offset: number;
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

  private ensureSpace(bytes: number) {
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
    // Use setUint16 to allow writing 0xFFFF as a valid pattern even if it represents -1
    // But value might be negative (-1). setUint16(-1) wraps to 65535.
    // So setInt16 is fine if value is in range.
    // If value is 65535 (from bit manipulation), setInt16 might throw?
    // Let's safe cast.
    this.view.setInt16(this.offset, value, true);
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

  public writeCoord(value: number): void {
    this.writeShort(Math.trunc(value * 8));
  }

  public writeAngle(value: number): void {
    this.writeByte(Math.trunc(value * 256.0 / 360.0) & 255);
  }

  public writeAngle16(value: number): void {
    this.writeShort(Math.trunc(value * 65536.0 / 360.0) & 65535);
  }

  public writePos(pos: Vec3): void {
    this.writeCoord(pos.x);
    this.writeCoord(pos.y);
    this.writeCoord(pos.z);
  }

  public writeDir(dir: Vec3): void {
      // Find closest normal
      let maxDot = -1.0;
      let bestIndex = 0;

      // Check for zero vector
      if (dir.x === 0 && dir.y === 0 && dir.z === 0) {
        this.writeByte(0);
        return;
      }

      for (let i = 0; i < ANORMS.length; i++) {
        const norm = ANORMS[i];
        const dot = dir.x * norm[0] + dir.y * norm[1] + dir.z * norm[2];
        if (dot > maxDot) {
          maxDot = dot;
          bestIndex = i;
        }
      }

      this.writeByte(bestIndex);
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
