import { BinaryStream } from '@quake2ts/shared';

export interface DemoMessageBlock {
  length: number;
  data: BinaryStream;
}

export class DemoReader {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.offset = 0;
  }

  /**
   * Checks if there are more blocks to read.
   */
  public hasMore(): boolean {
    return this.offset < this.buffer.byteLength;
  }

  /**
   * Reads the next message block from the demo file.
   * Format is [Length (4 bytes)] + [Message Block (Length bytes)].
   * Returns null if end of file or incomplete block.
   */
  public readNextBlock(): DemoMessageBlock | null {
    if (this.offset + 4 > this.buffer.byteLength) {
      // Not enough data for length
      return null;
    }

    // Read length (little endian)
    const length = this.view.getInt32(this.offset, true);
    this.offset += 4;

    if (length < 0 || length > 0x40000) { // 256k sanity check (MAX_MSGLEN is usually 1400, but demo blocks can be large)
       // Sanity check failed or negative length
       console.warn(`DemoReader: Invalid block length ${length} at offset ${this.offset - 4}`);
       return null;
    }

    if (this.offset + length > this.buffer.byteLength) {
      // Not enough data for the block body
      console.warn(`DemoReader: Incomplete block. Expected ${length} bytes, but only ${this.buffer.byteLength - this.offset} remain.`);
      return null;
    }

    // Create a view for the block data
    // Slice creates a copy, which is safer but slower.
    // For now, let's slice to ensure the BinaryStream is isolated.
    const blockData = this.buffer.slice(this.offset, this.offset + length);
    this.offset += length;

    return {
      length,
      data: new BinaryStream(blockData)
    };
  }

  /**
   * Resets the reader to the beginning.
   */
  public reset(): void {
    this.offset = 0;
  }

  public getOffset(): number {
      return this.offset;
  }
}
