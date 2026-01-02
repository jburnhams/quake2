import { describe, it, expect, vi } from 'vitest';
import { NetworkMessageParser } from '../../../src/demo/parser.js';
import { BinaryStream, ServerCommand } from '@quake2ts/shared';

describe('NetworkMessageParser', () => {
  it('should handle truncated data gracefully', () => {
    // Create a truncated buffer (just command, no data)
    const buffer = new Uint8Array([ServerCommand.print]); // svc_print needs more bytes
    const stream = new BinaryStream(buffer.buffer);
    const parser = new NetworkMessageParser(stream);

    // Should not throw in non-strict mode
    expect(() => parser.parseMessage()).not.toThrow();

    // Error count should increment (or at least we shouldn't crash)
    expect(parser.getErrorCount()).toBeGreaterThan(0);
  });

  it('should handle unknown commands gracefully in non-strict mode', () => {
    // Command 255 is invalid/unknown
    const buffer = new Uint8Array([255, 0, 0, 0]);
    const stream = new BinaryStream(buffer.buffer);
    const parser = new NetworkMessageParser(stream);

    expect(() => parser.parseMessage()).not.toThrow();
    expect(parser.getErrorCount()).toBeGreaterThan(0);
  });

  it('should throw on unknown commands in strict mode', () => {
    const buffer = new Uint8Array([255]);
    const stream = new BinaryStream(buffer.buffer);
    const parser = new NetworkMessageParser(stream, undefined, true); // strict mode

    expect(() => parser.parseMessage()).toThrow(/Unknown server command/);
  });

  it('should recover from error and stop parsing the current block', () => {
    // svc_download (16) expects a short (2 bytes), then data.
    // We provide 16, then a short of 10, but NO data (buffer end).
    // This guarantees readData will throw.
    const buffer = new ArrayBuffer(3);
    const view = new DataView(buffer);
    view.setUint8(0, ServerCommand.download);
    view.setInt16(1, 10, true); // Expect 10 bytes

    const stream = new BinaryStream(buffer);
    const parser = new NetworkMessageParser(stream);

    parser.parseMessage();

    expect(parser.getErrorCount()).toBeGreaterThan(0);
  });
});
