/**
 * Reads little-endian numbers and NUL-terminated 8-bit strings from a buffer,
 * advancing a cursor. Strings stop at a 0 or 0xFF byte, as Quake's MSG_ReadString does.
 * Bounds are checked by DataView (a read past the end throws a RangeError).
 */
export class BinaryReader {
  protected view: DataView;
  protected offset: number;
  protected length: number;

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

  public getReadPosition(): number {
    return this.offset;
  }

  public getLength(): number {
    return this.length;
  }

  public getRemaining(): number {
    return this.length - this.offset;
  }

  public seek(position: number): void {
    if (position < 0 || position > this.length) {
      throw new Error(`Seek out of bounds: ${position} (length: ${this.length})`);
    }
    this.offset = position;
  }

  public setReadPosition(position: number): void {
    this.seek(position);
  }

  public hasMore(): boolean {
    return this.offset < this.length;
  }

  public hasBytes(count: number): boolean {
    return this.offset + count <= this.length;
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




  public readData(length: number): Uint8Array {
    if (this.offset + length > this.length) {
       throw new Error(`Read out of bounds: ${this.offset + length} (length: ${this.length})`);
    }
    const data = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length);
    this.offset += length;
    // Return a copy to avoid side effects if the original buffer is modified or reused
    return new Uint8Array(data);
  }


}
