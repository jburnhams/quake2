import { describe, it, expect, vi } from 'vitest';
import { NetworkMessageParser, NetworkMessageHandler, PROTOCOL_VERSION_RERELEASE } from '../../src/demo/parser.js';
import { BinaryStream } from '@quake2ts/shared';

describe('NetworkMessageParser - Misc Rerelease Commands', () => {
  it('should parse svc_splitclient', () => {
      const clientNum = 1;
      const buffer = [21, clientNum]; // svc_splitclient
      const stream = new BinaryStream(new Uint8Array(buffer).buffer);
      const handler: NetworkMessageHandler = {
          onServerData: vi.fn(), onConfigString: vi.fn(), onSpawnBaseline: vi.fn(), onFrame: vi.fn(), onCenterPrint: vi.fn(), onStuffText: vi.fn(), onPrint: vi.fn(), onSound: vi.fn(), onTempEntity: vi.fn(), onLayout: vi.fn(), onInventory: vi.fn(), onMuzzleFlash: vi.fn(), onMuzzleFlash2: vi.fn(), onDisconnect: vi.fn(), onReconnect: vi.fn(), onDownload: vi.fn(),
          onSplitClient: vi.fn()
      };
      const parser = new NetworkMessageParser(stream, handler);
      parser.setProtocolVersion(PROTOCOL_VERSION_RERELEASE);
      parser.parseMessage();
      expect(handler.onSplitClient).toHaveBeenCalledWith(clientNum);
  });

  it('should parse svc_locprint', () => {
      const flags = 5;
      const base = "Hello %s";
      const numArgs = 1;
      const arg1 = "World";

      const buffer = [];
      buffer.push(26); // svc_locprint
      buffer.push(flags);
      // base string
      for(let i=0; i<base.length; i++) buffer.push(base.charCodeAt(i));
      buffer.push(0);
      buffer.push(numArgs);
      // arg1
      for(let i=0; i<arg1.length; i++) buffer.push(arg1.charCodeAt(i));
      buffer.push(0);

      const stream = new BinaryStream(new Uint8Array(buffer).buffer);
      const handler: NetworkMessageHandler = {
          onServerData: vi.fn(), onConfigString: vi.fn(), onSpawnBaseline: vi.fn(), onFrame: vi.fn(), onCenterPrint: vi.fn(), onStuffText: vi.fn(), onPrint: vi.fn(), onSound: vi.fn(), onTempEntity: vi.fn(), onLayout: vi.fn(), onInventory: vi.fn(), onMuzzleFlash: vi.fn(), onMuzzleFlash2: vi.fn(), onDisconnect: vi.fn(), onReconnect: vi.fn(), onDownload: vi.fn(),
          onLocPrint: vi.fn()
      };
      const parser = new NetworkMessageParser(stream, handler);
      parser.setProtocolVersion(PROTOCOL_VERSION_RERELEASE);
      parser.parseMessage();
      expect(handler.onLocPrint).toHaveBeenCalledWith(flags, base, [arg1]);
  });

  it('should parse svc_waitingforplayers', () => {
      const count = 3;
      const buffer = [28, count]; // svc_waitingforplayers
      const stream = new BinaryStream(new Uint8Array(buffer).buffer);
      const handler: NetworkMessageHandler = {
          onServerData: vi.fn(), onConfigString: vi.fn(), onSpawnBaseline: vi.fn(), onFrame: vi.fn(), onCenterPrint: vi.fn(), onStuffText: vi.fn(), onPrint: vi.fn(), onSound: vi.fn(), onTempEntity: vi.fn(), onLayout: vi.fn(), onInventory: vi.fn(), onMuzzleFlash: vi.fn(), onMuzzleFlash2: vi.fn(), onDisconnect: vi.fn(), onReconnect: vi.fn(), onDownload: vi.fn(),
          onWaitingForPlayers: vi.fn()
      };
      const parser = new NetworkMessageParser(stream, handler);
      parser.setProtocolVersion(PROTOCOL_VERSION_RERELEASE);
      parser.parseMessage();
      expect(handler.onWaitingForPlayers).toHaveBeenCalledWith(count);
  });

  it('should parse svc_bot_chat', () => {
      const botName = "Bot";
      const clientIndex = 2;
      const locString = "Chat";

      const buffer = [];
      buffer.push(29); // svc_bot_chat
      for(let i=0; i<botName.length; i++) buffer.push(botName.charCodeAt(i));
      buffer.push(0);
      buffer.push(clientIndex & 0xFF, (clientIndex >> 8) & 0xFF);
      for(let i=0; i<locString.length; i++) buffer.push(locString.charCodeAt(i));
      buffer.push(0);

      const stream = new BinaryStream(new Uint8Array(buffer).buffer);
      const handler: NetworkMessageHandler = {
          onServerData: vi.fn(), onConfigString: vi.fn(), onSpawnBaseline: vi.fn(), onFrame: vi.fn(), onCenterPrint: vi.fn(), onStuffText: vi.fn(), onPrint: vi.fn(), onSound: vi.fn(), onTempEntity: vi.fn(), onLayout: vi.fn(), onInventory: vi.fn(), onMuzzleFlash: vi.fn(), onMuzzleFlash2: vi.fn(), onDisconnect: vi.fn(), onReconnect: vi.fn(), onDownload: vi.fn(),
          onBotChat: vi.fn()
      };
      const parser = new NetworkMessageParser(stream, handler);
      parser.setProtocolVersion(PROTOCOL_VERSION_RERELEASE);
      parser.parseMessage();
      expect(handler.onBotChat).toHaveBeenCalledWith(locString);
  });

  it('should parse svc_poi', () => {
      const key = 10;
      const time = 100;
      const pos = {x: 1, y: 2, z: 3};
      const imageIndex = 5;
      const paletteIndex = 1;
      const flags = 2;

      const buffer = [];
      buffer.push(30); // svc_poi
      // key (ushort)
      buffer.push(key & 0xFF, (key >> 8) & 0xFF);
      // time (ushort)
      buffer.push(time & 0xFF, (time >> 8) & 0xFF);
      // pos (3 shorts / 8.0)
      const px = Math.round(pos.x * 8);
      const py = Math.round(pos.y * 8);
      const pz = Math.round(pos.z * 8);
      buffer.push(px & 0xFF, (px >> 8) & 0xFF);
      buffer.push(py & 0xFF, (py >> 8) & 0xFF);
      buffer.push(pz & 0xFF, (pz >> 8) & 0xFF);
      // imageIndex (ushort)
      buffer.push(imageIndex & 0xFF, (imageIndex >> 8) & 0xFF);
      // paletteIndex (byte)
      buffer.push(paletteIndex);
      // flags (byte)
      buffer.push(flags);

      const stream = new BinaryStream(new Uint8Array(buffer).buffer);
      const handler: NetworkMessageHandler = {
          onServerData: vi.fn(), onConfigString: vi.fn(), onSpawnBaseline: vi.fn(), onFrame: vi.fn(), onCenterPrint: vi.fn(), onStuffText: vi.fn(), onPrint: vi.fn(), onSound: vi.fn(), onTempEntity: vi.fn(), onLayout: vi.fn(), onInventory: vi.fn(), onMuzzleFlash: vi.fn(), onMuzzleFlash2: vi.fn(), onDisconnect: vi.fn(), onReconnect: vi.fn(), onDownload: vi.fn(),
          onPoi: vi.fn()
      };
      const parser = new NetworkMessageParser(stream, handler);
      parser.setProtocolVersion(PROTOCOL_VERSION_RERELEASE);
      parser.parseMessage();
      expect(handler.onPoi).toHaveBeenCalledWith(flags, expect.objectContaining({x:1, y:2, z:3}));
  });

  it('should parse svc_help_path', () => {
      const start = 1;
      const pos = {x: 10, y: 20, z: 30};
      // dir (byte) -> ANORMS index. 0 is up.
      const dirIndex = 0;

      const buffer = [];
      buffer.push(31); // svc_help_path
      buffer.push(start);
      // pos
      const px = Math.round(pos.x * 8);
      const py = Math.round(pos.y * 8);
      const pz = Math.round(pos.z * 8);
      buffer.push(px & 0xFF, (px >> 8) & 0xFF);
      buffer.push(py & 0xFF, (py >> 8) & 0xFF);
      buffer.push(pz & 0xFF, (pz >> 8) & 0xFF);
      // dir
      buffer.push(dirIndex);

      const stream = new BinaryStream(new Uint8Array(buffer).buffer);
      const handler: NetworkMessageHandler = {
          onServerData: vi.fn(), onConfigString: vi.fn(), onSpawnBaseline: vi.fn(), onFrame: vi.fn(), onCenterPrint: vi.fn(), onStuffText: vi.fn(), onPrint: vi.fn(), onSound: vi.fn(), onTempEntity: vi.fn(), onLayout: vi.fn(), onInventory: vi.fn(), onMuzzleFlash: vi.fn(), onMuzzleFlash2: vi.fn(), onDisconnect: vi.fn(), onReconnect: vi.fn(), onDownload: vi.fn(),
          onHelpPath: vi.fn()
      };
      const parser = new NetworkMessageParser(stream, handler);
      parser.setProtocolVersion(PROTOCOL_VERSION_RERELEASE);
      parser.parseMessage();
      expect(handler.onHelpPath).toHaveBeenCalledWith(expect.objectContaining({x:10, y:20, z:30}));
  });
});
