import { BinaryStream } from '@quake2ts/shared';

export interface DemoMessageBlock {
  length: number;
  data: BinaryStream;
}

export class DemoReader {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number;
  private messageOffsets: number[] = [];

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.offset = 0;
    this.scan();
  }

  /**
   * Scans the buffer to build an index of message offsets.
   */
  private scan(): void {
    let scanOffset = 0;
    this.messageOffsets = [];

    while (scanOffset + 4 <= this.buffer.byteLength) {
      const length = this.view.getInt32(scanOffset, true);

      if (length < 0 || length > 0x200000) {
        // Sanity check failed, stop scanning
        console.warn(`DemoReader: Invalid block length ${length} at offset ${scanOffset} during scan`);
        break;
      }

      if (scanOffset + 4 + length > this.buffer.byteLength) {
        // Incomplete block, stop scanning
        console.warn(`DemoReader: Incomplete block at offset ${scanOffset} during scan`);
        break;
      }

      this.messageOffsets.push(scanOffset);
      scanOffset += 4 + length;
    }
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
      return null;
    }

    const length = this.view.getInt32(this.offset, true);

    // We already validated this in scan(), but let's keep it safe
    if (length < 0 || this.offset + 4 + length > this.buffer.byteLength) {
       return null;
    }

    this.offset += 4; // Skip length

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

  /**
   * Seeks to a specific message index.
   * Returns true if successful, false if index is out of bounds.
   */
  public seekToMessage(index: number): boolean {
    if (index < 0 || index >= this.messageOffsets.length) {
      return false;
    }
    this.offset = this.messageOffsets[index];
    return true;
  }

  /**
   * Returns the total number of messages in the demo.
   */
  public getMessageCount(): number {
    return this.messageOffsets.length;
  }

  public getOffset(): number {
      return this.offset;
  }
}
