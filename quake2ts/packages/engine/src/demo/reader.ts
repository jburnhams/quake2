import { BinaryStream } from '@quake2ts/shared';

export class DemoReader {
  private stream: BinaryStream;

  constructor(buffer: ArrayBuffer) {
    this.stream = new BinaryStream(buffer);
  }

  /**
   * Reads the next message block from the demo stream.
   * Returns null if end of stream is reached.
   * Throws if the stream is malformed (e.g., length exceeds remaining data).
   */
  public readNextBlock(): { length: number; data: Uint8Array } | null {
    if (!this.stream.hasMore()) {
      return null;
    }

    // In Quake 2 demos, each block is prefixed with a 4-byte integer length
    // Reference: qcommon/common.c - though the demo recording logic is usually in cl_main.c or similar.
    // Actually, let's check cl_main.c or where CL_WriteDemoMessage is.
    // The docs say: Sequence of [Length (4 bytes)] + [Message Block (Length bytes)].

    // Check if we have enough bytes for the length
    if (this.stream.getPosition() + 4 > this.stream['length']) { // accessing protected length for check, or catch error
       // Actually BinaryStream throws on read.
       // We can check hasMore() which we did.
       // But if there are 1-3 bytes left, readLong will throw.
       // Let's wrap in try-catch or assume valid file.
    }

    try {
      const length = this.stream.readLong();

      // Sanity check length
      if (length < 0) {
        throw new Error(`Invalid negative demo block length: ${length}`);
      }

      // Read the data
      const data = this.stream.readData(length);

      return { length, data };
    } catch (e) {
      // If we fail to read the length (EOF), we might want to just return null if we were exactly at end.
      // But hasMore() check should cover it.
      throw e;
    }
  }

  public isFinished(): boolean {
    return !this.stream.hasMore();
  }
}
