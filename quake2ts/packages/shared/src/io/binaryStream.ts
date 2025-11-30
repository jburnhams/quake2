import { Vec3 } from '../math/vec3.js';
import { ANORMS } from '../math/anorms.js';

export class BinaryStream {
  private view: DataView;
  private offset: number;
  private length: number;

  constructor(buffer: ArrayBuffer | Uint8Array) {
    if (buffer instanceof Uint8Array) {
      this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else {
      this.view = new DataView(buffer);
    }
    this.offset = 0;
    this.length = this.view.byteLength;
  }

  public getPosition(): number {
    return this.offset;
  }

  public seek(position: number): void {
    if (position < 0 || position > this.length) {
      throw new Error(`Seek out of bounds: ${position} (length: ${this.length})`);
    }
    this.offset = position;
  }

  public hasMore(): boolean {
    return this.offset < this.length;
  }

  public readChar(): number {
    const value = this.view.getInt8(this.offset);
    this.offset += 1;
    return value;
  }

  public readByte(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  public readShort(): number {
    const value = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return value;
  }

  public readUShort(): number {
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  public readLong(): number {
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  public readULong(): number {
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  public readFloat(): number {
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  public readString(): string {
    let str = '';
    while (this.offset < this.length) {
      const charCode = this.readChar();
      if (charCode === -1 || charCode === 0) {
        break;
      }
      str += String.fromCharCode(charCode);
    }
    return str;
  }

  public readStringLine(): string {
    let str = '';
    while (this.offset < this.length) {
      const charCode = this.readChar();
      if (charCode === -1 || charCode === 0 || charCode === 10) { // 10 is \n
        break;
      }
      str += String.fromCharCode(charCode);
    }
    return str;
  }

  public readCoord(): number {
    return this.readShort() * (1.0 / 8.0);
  }

  public readAngle(): number {
    return this.readChar() * (360.0 / 256.0);
  }

  public readAngle16(): number {
    return (this.readShort() * 360.0) / 65536.0;
  }

  public readData(length: number): Uint8Array {
    if (this.offset + length > this.length) {
       throw new Error(`Read out of bounds: ${this.offset + length} (length: ${this.length})`);
    }
    const data = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length);
    this.offset += length;
    // Return a copy to avoid side effects if the original buffer is modified or reused
    return new Uint8Array(data);
  }

  public readPos(out: { x: number, y: number, z: number }): void {
    out.x = this.readCoord();
    out.y = this.readCoord();
    out.z = this.readCoord();
  }

  public readDir(out: { x: number, y: number, z: number }): void {
    const b = this.readByte();
    if (b >= 162) { // NUMVERTEXNORMALS
      out.x = 0; out.y = 0; out.z = 0;
      return;
    }
    const norm = ANORMS[b];
    out.x = norm[0];
    out.y = norm[1];
    out.z = norm[2];
  }
}
