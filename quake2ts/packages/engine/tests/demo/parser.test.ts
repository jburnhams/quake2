import { describe, it, expect, vi } from 'vitest';
import { NetworkMessageParser } from '../../src/demo/parser.js';
import { BinaryStream } from '@quake2ts/shared';
import { ServerCommand } from '@quake2ts/shared';

describe('NetworkMessageParser', () => {
  it('should parse a nop command', () => {
    const buffer = new Uint8Array([ServerCommand.nop]);
    const stream = new BinaryStream(buffer);
    const parser = new NetworkMessageParser(stream);

    // We can spy on console.log or just ensure it doesn't throw
    const spy = vi.spyOn(console, 'log');
    parser.parseMessage();
    expect(spy).not.toHaveBeenCalled(); // nop logs nothing
  });

  it('should parse a print command', () => {
    const text = "Hello World";
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(text + '\0');

    const buffer = new Uint8Array(2 + textBytes.length);
    buffer[0] = ServerCommand.print;
    buffer[1] = 2; // print id
    buffer.set(textBytes, 2);

    const stream = new BinaryStream(buffer);
    const parser = new NetworkMessageParser(stream);

    const spy = vi.spyOn(console, 'log');
    parser.parseMessage();
    expect(spy).toHaveBeenCalledWith('[Server Print 2]: Hello World');
  });

  it('should parse server data', () => {
    // [byte cmd] [long protocol] [long servercount] [byte attract] [string gamedir] [short playernum] [string levelname]
    const buffer = new ArrayBuffer(100);
    const view = new DataView(buffer);
    let offset = 0;

    view.setUint8(offset++, ServerCommand.serverdata);
    view.setInt32(offset, 34, true); offset += 4; // protocol
    view.setInt32(offset, 1, true); offset += 4;  // servercount
    view.setUint8(offset++, 0);                   // attractloop

    const gamedir = "baseq2";
    for (let i = 0; i < gamedir.length; i++) view.setUint8(offset++, gamedir.charCodeAt(i));
    view.setUint8(offset++, 0);

    view.setInt16(offset, 0, true); offset += 2; // playernum

    const level = "base1";
    for (let i = 0; i < level.length; i++) view.setUint8(offset++, level.charCodeAt(i));
    view.setUint8(offset++, 0);

    const stream = new BinaryStream(buffer.slice(0, offset));
    const parser = new NetworkMessageParser(stream);

    const spy = vi.spyOn(console, 'log');
    parser.parseMessage();
    expect(spy).toHaveBeenCalledWith('Server Data: Protocol 34, Level base1, GameDir baseq2');
  });
});
