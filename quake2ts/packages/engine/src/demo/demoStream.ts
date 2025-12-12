import { DemoReader } from './index.js';
import { StreamingBuffer } from '../stream/streamingBuffer.js';

/**
 * DemoStream - Adapter to stream demo blocks into a StreamingBuffer
 *
 * Facilitates reading a demo file (which consists of discrete blocks)
 * as a continuous stream of data for the NetworkMessageParser.
 */
export class DemoStream {
    private reader: DemoReader;
    private buffer: StreamingBuffer;
    private _isComplete: boolean = false;

    constructor(demoData: ArrayBuffer | Uint8Array) {
        this.reader = new DemoReader(demoData instanceof Uint8Array ? demoData.buffer : demoData);
        this.buffer = new StreamingBuffer();
    }

    /**
     * Load all remaining blocks from the demo into the streaming buffer.
     * Useful for parsing a complete demo file at once.
     */
    loadComplete(): void {
        while (this.reader.hasMore()) {
            const block = this.reader.readNextBlock();
            if (!block) break;

            // Extract raw data from BinaryStream
            // block.data is a BinaryStream created from a slice of the demo file
            // We read the full length of the block
            const data = block.data.readData(block.length);
            this.buffer.append(data);
        }
        this._isComplete = true;
    }

    /**
     * Load the next N blocks from the demo into the streaming buffer.
     * Useful for simulating streaming playback or throttling.
     * @param count Number of blocks to load
     * @returns True if blocks were loaded, False if end of demo reached
     */
    loadNextBlocks(count: number): boolean {
        let loaded = 0;
        while (loaded < count && this.reader.hasMore()) {
            const block = this.reader.readNextBlock();
            if (!block) break;

            const data = block.data.readData(block.length);
            this.buffer.append(data);
            loaded++;
        }

        if (!this.reader.hasMore()) {
            this._isComplete = true;
        }

        return loaded > 0;
    }

    /**
     * Check if the entire demo has been loaded into the buffer.
     */
    isComplete(): boolean {
        return this._isComplete;
    }

    /**
     * Get the underlying streaming buffer for parsing.
     */
    getBuffer(): StreamingBuffer {
        return this.buffer;
    }

    /**
     * Get the underlying demo reader (e.g. to check total size or progress)
     */
    getReader(): DemoReader {
        return this.reader;
    }
}
