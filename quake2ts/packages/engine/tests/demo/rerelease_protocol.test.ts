
import { describe, it, expect, vi } from 'vitest';
import { NetworkMessageParser, NetworkMessageHandler, PROTOCOL_VERSION_RERELEASE } from '../../src/demo/parser.js';
import { BinaryStream, ServerCommand } from '@quake2ts/shared';

// Helper to create a binary stream from bytes
const createStream = (bytes: number[]): BinaryStream => {
  const buffer = new Uint8Array(bytes);
  return new BinaryStream(buffer);
};

// Helper functions for writing data (duplicated for isolation)
const writeByte = (arr: number[], val: number) => arr.push(val & 0xFF);
const writeShort = (arr: number[], val: number) => {
  arr.push(val & 0xFF);
  arr.push((val >> 8) & 0xFF);
};
const writeLong = (arr: number[], val: number) => {
  arr.push(val & 0xFF);
  arr.push((val >> 8) & 0xFF);
  arr.push((val >> 16) & 0xFF);
  arr.push((val >> 24) & 0xFF);
};
const writeString = (arr: number[], str: string) => {
  for (let i = 0; i < str.length; i++) {
    arr.push(str.charCodeAt(i));
  }
  arr.push(0);
};

describe('Rerelease Protocol (Protocol 2023)', () => {

  it('should correctly identify Protocol 2023 in svc_serverdata', () => {
    const data: number[] = [];
    writeByte(data, ServerCommand.serverdata);
    writeLong(data, PROTOCOL_VERSION_RERELEASE);
    writeLong(data, 100); // Spawn count
    writeByte(data, 1);   // Demo type
    writeByte(data, 40);  // Tick rate
    writeString(data, "baseq2");
    writeShort(data, 0);  // Player num
    writeString(data, "unit_test_level");

    const stream = createStream(data);
    const handlerMock = {
      onServerData: vi.fn(),
    } as unknown as NetworkMessageHandler;

    const parser = new NetworkMessageParser(stream, handlerMock);
    parser.parseMessage();

    expect(handlerMock.onServerData).toHaveBeenCalledWith(
      PROTOCOL_VERSION_RERELEASE,
      100,
      0, // attractLoop (0 for rerelease)
      "baseq2",
      0,
      "unit_test_level",
      40,
      1
    );
  });

  it('should handle splitscreen player numbers in svc_serverdata', () => {
    const data: number[] = [];
    writeByte(data, ServerCommand.serverdata);
    writeLong(data, PROTOCOL_VERSION_RERELEASE);
    writeLong(data, 100);
    writeByte(data, 1);
    writeByte(data, 40);
    writeString(data, "baseq2");

    // Splitscreen indicator
    writeShort(data, -2);
    writeShort(data, 2); // 2 splits
    writeShort(data, 0); // Player 1 index
    writeShort(data, 1); // Player 2 index

    writeString(data, "unit_test_level");

    const stream = createStream(data);
    const handlerMock = {
      onServerData: vi.fn(),
    } as unknown as NetworkMessageHandler;

    const parser = new NetworkMessageParser(stream, handlerMock);
    parser.parseMessage();

    expect(handlerMock.onServerData).toHaveBeenCalledWith(
      PROTOCOL_VERSION_RERELEASE,
      100,
      0,
      "baseq2",
      0, // Defaults to 0 for primary client in parser logic
      "unit_test_level",
      40,
      1
    );
  });

  it('should parse svc_bot_chat', () => {
    const data: number[] = [];
    writeByte(data, ServerCommand.bot_chat);
    writeString(data, "BotName");
    writeShort(data, 1); // Client index
    writeString(data, "Hello World");

    const stream = createStream(data);
    const handlerMock = {
      onBotChat: vi.fn(),
    } as unknown as NetworkMessageHandler;

    const parser = new NetworkMessageParser(stream, handlerMock);
    parser.parseMessage();

    expect(handlerMock.onBotChat).toHaveBeenCalledWith("Hello World");
  });

  it('should parse svc_poi', () => {
    const data: number[] = [];
    writeByte(data, ServerCommand.poi);
    writeShort(data, 123); // key
    writeShort(data, 500); // time
    // Pos
    writeShort(data, 10 * 8); writeShort(data, 20 * 8); writeShort(data, 30 * 8);
    writeShort(data, 5); // imageIndex
    writeByte(data, 1); // paletteIndex
    writeByte(data, 7); // flags

    const stream = createStream(data);
    const handlerMock = {
      onPoi: vi.fn(),
    } as unknown as NetworkMessageHandler;

    const parser = new NetworkMessageParser(stream, handlerMock);
    parser.parseMessage();

    expect(handlerMock.onPoi).toHaveBeenCalledWith(7, {x:10, y:20, z:30});
  });

  it('should parse svc_help_path', () => {
      const data: number[] = [];
      writeByte(data, ServerCommand.help_path);
      writeByte(data, 1); // start
      // Pos
      writeShort(data, 100 * 8); writeShort(data, 200 * 8); writeShort(data, 300 * 8);
      // Dir (using 0 for up)
      writeByte(data, 0);

      const stream = createStream(data);
      const handlerMock = {
          onHelpPath: vi.fn(),
      } as unknown as NetworkMessageHandler;

      const parser = new NetworkMessageParser(stream, handlerMock);
      parser.parseMessage();

      expect(handlerMock.onHelpPath).toHaveBeenCalledWith(expect.objectContaining({
          x: 100, y: 200, z: 300
      }));
  });

});
