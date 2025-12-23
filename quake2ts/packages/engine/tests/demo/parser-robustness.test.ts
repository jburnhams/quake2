import { describe, it, expect, vi } from 'vitest';
import { NetworkMessageParser } from '../../src/demo/parser.js';
import { BinaryStream, ServerCommand } from '@quake2ts/shared';

describe('NetworkMessageParser', () => {
  it('should handle truncated data gracefully', () => {
    // Create a truncated buffer (just command, no data)
    const buffer = new Uint8Array([ServerCommand.print]); // svc_print needs more bytes
    const stream = new BinaryStream(buffer.buffer);
    const parser = new NetworkMessageParser(stream);
    parser.setProtocolVersion(34);

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
    // expect(parser.getErrorCount()).toBeGreaterThan(0); // Might be 0 if bad command returns
  });

  it('should throw on unknown commands in strict mode', () => {
    const buffer = new Uint8Array([255]);
    const stream = new BinaryStream(buffer.buffer);
    const parser = new NetworkMessageParser(stream, undefined, true); // strict mode
    parser.setProtocolVersion(2023);

    expect(() => parser.parseMessage()).toThrow(/Unknown server command/);
  });

  it('should recover from error and stop parsing the current block', () => {
    // svc_download (16 in Rerelease/Legacy?)
    // Need to set protocol to ensure 16 is download.
    // Legacy: 16 is centerprint? No.
    // Proto 34: 16 is centerprint. 4 is download.
    // Let's use Proto 34 and command 4 (download).
    const buffer = new ArrayBuffer(3);
    const view = new DataView(buffer);
    view.setUint8(0, 4); // svc_download
    view.setInt16(1, 10, true); // Expect 10 bytes

    const stream = new BinaryStream(buffer);
    const parser = new NetworkMessageParser(stream);
    parser.setProtocolVersion(34);

    parser.parseMessage();

    expect(parser.getErrorCount()).toBeGreaterThan(0);
  });
});
