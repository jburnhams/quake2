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
  private currentBlock: DemoMessageBlock | null = null;

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

      if (length === -1) {
          // EOF
          break;
      }

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

    if (length === -1) {
        // Explicit EOF block
        return null;
    }

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
   * Advances to the next block and stores it in `currentBlock`.
   * Returns true if a block was read, false otherwise.
   * Compatible with `getBlock()` usage.
   */
  public nextBlock(): boolean {
      const block = this.readNextBlock();
      if (block) {
          this.currentBlock = block;
          return true;
      }
      this.currentBlock = null;
      return false;
  }
  
  /**
   * Returns the current block read by `nextBlock()`.
   */
  public getBlock(): DemoMessageBlock {
      if (!this.currentBlock) {
          throw new Error("No current block. Call nextBlock() first.");
      }
      return this.currentBlock;
  }

  /**
   * Reads all remaining blocks and concatenates them into a single buffer.
   * Useful for converting discrete blocks into a continuous stream.
   */
  public readAllBlocksToBuffer(): ArrayBuffer {
      // First pass: Calculate total size
      let totalLength = 0;
      const currentOffset = this.offset;
      const blockInfos: { offset: number, length: number }[] = [];

      // Scan ahead without modifying this.offset yet
      let tempOffset = this.offset;
      while (tempOffset + 4 <= this.buffer.byteLength) {
          const length = this.view.getInt32(tempOffset, true);
          if (length === -1) break;
          if (length < 0 || tempOffset + 4 + length > this.buffer.byteLength) {
              break;
          }
          blockInfos.push({ offset: tempOffset + 4, length });
          totalLength += length;
          tempOffset += 4 + length;
      }

      // Allocate result buffer
      const result = new Uint8Array(totalLength);
      let resultOffset = 0;

      // Copy data
      const srcBytes = new Uint8Array(this.buffer);
      for (const info of blockInfos) {
          result.set(srcBytes.subarray(info.offset, info.offset + info.length), resultOffset);
          resultOffset += info.length;
      }

      // Update reader state
      this.offset = tempOffset;

      return result.buffer;
  }

  /**
   * Resets the reader to the beginning.
   */
  public reset(): void {
    this.offset = 0;
    this.currentBlock = null;
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
    this.currentBlock = null;
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

  public getProgress(): { current: number; total: number; percent: number } {
      const current = this.offset;
      const total = this.buffer.byteLength;
      return {
          current,
          total,
          percent: total > 0 ? (current / total) * 100 : 0
      };
  }
}
