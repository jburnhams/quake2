import { ANORMS } from '../math/anorms.js';

export class NetworkMessageBuilder {
  private buffer: Uint8Array;
  private view: DataView;
  private offset: number;

  constructor(initialSize: number = 1024) {
    this.buffer = new Uint8Array(initialSize);
    this.view = new DataView(this.buffer.buffer);
    this.offset = 0;
  }

  private ensureCapacity(needed: number): void {
    if (this.offset + needed > this.buffer.length) {
      const newSize = Math.max(this.buffer.length * 2, this.offset + needed);
      const newBuffer = new Uint8Array(newSize);
      newBuffer.set(this.buffer);
      this.buffer = newBuffer;
      this.view = new DataView(this.buffer.buffer);
    }
  }

  public getData(): Uint8Array {
    return this.buffer.slice(0, this.offset);
  }

  public writeByte(value: number): void {
    this.ensureCapacity(1);
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  public writeChar(value: number): void {
    this.ensureCapacity(1);
    this.view.setInt8(this.offset, value);
    this.offset += 1;
  }

  public writeShort(value: number): void {
    this.ensureCapacity(2);
    this.view.setInt16(this.offset, value, true);
    this.offset += 2;
  }

  public writeUShort(value: number): void {
      this.ensureCapacity(2);
      this.view.setUint16(this.offset, value, true);
      this.offset += 2;
  }

  public writeLong(value: number): void {
    this.ensureCapacity(4);
    this.view.setInt32(this.offset, value, true);
    this.offset += 4;
  }

  public writeFloat(value: number): void {
    this.ensureCapacity(4);
    this.view.setFloat32(this.offset, value, true);
    this.offset += 4;
  }

  public writeString(value: string): void {
    const len = value.length + 1; // +1 for null terminator
    this.ensureCapacity(len);
    for (let i = 0; i < value.length; i++) {
      this.view.setUint8(this.offset + i, value.charCodeAt(i));
    }
    this.view.setUint8(this.offset + value.length, 0);
    this.offset += len;
  }

  public writeData(data: Uint8Array): void {
      this.ensureCapacity(data.length);
      this.buffer.set(data, this.offset);
      this.offset += data.length;
  }

  public writeCoord(value: number): void {
    this.writeShort(Math.round(value * 8.0));
  }

  public writeAngle(value: number): void {
    this.writeByte(Math.round(value * 256.0 / 360.0) & 255);
  }

  public writeAngle16(value: number): void {
    this.writeShort(Math.round(value * 65536.0 / 360.0));
  }

  public writeDir(x: number, y: number, z: number): void {
      // Find closest normal from ANORMS
      // Simple brute force or use lookup if needed.
      // For now, let's just use 0 if implementation is complex to find best match.
      // Or unimplemented for now?
      // "WriteDir" in Q2 usually means writing a byte index into ANORMS.

      let best = 0;
      let bestDot = -999999;

      const len = Math.sqrt(x*x + y*y + z*z);
      if (len > 0) {
          x /= len; y /= len; z /= len;

          for (let i=0; i<162; i++) {
              const dot = x*ANORMS[i][0] + y*ANORMS[i][1] + z*ANORMS[i][2];
              if (dot > bestDot) {
                  bestDot = dot;
                  best = i;
              }
          }
      }

      this.writeByte(best);
  }
}
