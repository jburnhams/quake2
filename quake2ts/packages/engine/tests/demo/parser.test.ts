import { describe, it, expect, vi } from 'vitest';
import { NetworkMessageParser } from '../../src/demo/parser.js';
import { BinaryStream, ServerCommand } from '@quake2ts/shared';

// Mock BinaryStream
const createMockStream = (data: number[]) => {
  const buffer = new Uint8Array(data).buffer;
  return new BinaryStream(buffer);
};

describe('NetworkMessageParser', () => {
  it('should parse svc_nop', () => {
    const stream = createMockStream([ServerCommand.nop]);
    const parser = new NetworkMessageParser(stream);
    parser.parseMessage();
    // Should not throw
  });

  it('should parse svc_print', () => {
    const message = "Hello World";
    const encoder = new TextEncoder();
    const msgBytes = encoder.encode(message);

    const data = [
      ServerCommand.print,
      1, // id
      ...msgBytes, 0 // null terminated string
    ];

    const stream = createMockStream(data);
    const parser = new NetworkMessageParser(stream);

    const consoleSpy = vi.spyOn(console, 'log');
    parser.parseMessage();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Hello World"));
  });

  it('should parse svc_stufftext', () => {
    const message = "cmd";
    const encoder = new TextEncoder();
    const msgBytes = encoder.encode(message);

    const data = [
      ServerCommand.stufftext,
      ...msgBytes, 0
    ];

    const stream = createMockStream(data);
    const parser = new NetworkMessageParser(stream);

    const consoleSpy = vi.spyOn(console, 'log');
    parser.parseMessage();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("cmd"));
  });
});
