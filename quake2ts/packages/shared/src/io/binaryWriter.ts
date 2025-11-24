import { ANORMS } from '../math/anorms.js';
import { Vec3 } from '../math/vec3.js';

export class BinaryWriter {
  private buffer: Uint8Array;
  private view: DataView;
  private offset: number;

  constructor(initialSize: number = 1024) {
    this.buffer = new Uint8Array(initialSize);
    this.view = new DataView(this.buffer.buffer);
    this.offset = 0;
  }

  private ensureCapacity(bytes: number): void {
    if (this.offset + bytes > this.buffer.length) {
      const newSize = Math.max(this.buffer.length * 2, this.offset + bytes);
      const newBuffer = new Uint8Array(newSize);
      newBuffer.set(this.buffer);
      this.buffer = newBuffer;
      this.view = new DataView(this.buffer.buffer);
    }
  }

  public getData(): Uint8Array {
    return this.buffer.slice(0, this.offset);
  }

  public getLength(): number {
    return this.offset;
  }

  public reset(): void {
    this.offset = 0;
  }

  public writeChar(value: number): void {
    this.ensureCapacity(1);
    this.view.setInt8(this.offset, value);
    this.offset += 1;
  }

  public writeByte(value: number): void {
    this.ensureCapacity(1);
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  public writeShort(value: number): void {
    this.ensureCapacity(2);
    this.view.setInt16(this.offset, value, true);
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

  public writeString(str: string): void {
    // We assume simple ASCII/Latin-1 mapping for Quake 2
    this.ensureCapacity(str.length + 1);
    for (let i = 0; i < str.length; i++) {
      this.view.setUint8(this.offset + i, str.charCodeAt(i));
    }
    this.view.setUint8(this.offset + str.length, 0); // Null terminator
    this.offset += str.length + 1;
  }

  public writeData(data: Uint8Array): void {
    this.ensureCapacity(data.length);
    this.buffer.set(data, this.offset);
    this.offset += data.length;
  }

  // Quake 2 specific types

  public writeCoord(value: number): void {
    this.writeShort(Math.round(value * 8.0));
  }

  public writeAngle(value: number): void {
    // Map 360 -> 256
    this.writeChar(Math.floor(value * (256.0 / 360.0)) & 255);
  }

  public writeAngle16(value: number): void {
    // Map 360 -> 65536
    this.writeShort(Math.floor(value * (65536.0 / 360.0)) & 65535);
  }

  public writePos(pos: { x: number; y: number; z: number }): void {
    this.writeCoord(pos.x);
    this.writeCoord(pos.y);
    this.writeCoord(pos.z);
  }

  public writeDir(dir: { x: number; y: number; z: number } | null): void {
    if (!dir || (dir.x === 0 && dir.y === 0 && dir.z === 0)) {
      this.writeByte(0); // Default to index 0? Or is there a "no dir" value?
      // In original code, it might check specific logic.
      // But typically 0 is a valid normal.
      // However, readDir handles >= 162 as special (NUMVERTEXNORMALS = 162).
      // If null, maybe write 0 or a zero vector index.
      return;
    }

    let maxDot = -1.0;
    let bestIndex = 0;

    // Normalize input for comparison
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
    if (len === 0) {
        this.writeByte(0);
        return;
    }
    const nx = dir.x / len;
    const ny = dir.y / len;
    const nz = dir.z / len;

    for (let i = 0; i < ANORMS.length; i++) {
      const norm = ANORMS[i];
      const dot = nx * norm[0] + ny * norm[1] + nz * norm[2];
      if (dot > maxDot) {
        maxDot = dot;
        bestIndex = i;
      }
    }

    this.writeByte(bestIndex);
  }
}
